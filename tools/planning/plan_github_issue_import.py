#!/usr/bin/env python3
"""Plan or execute GitHub issue imports from production-planning CSV files.

The importer is intentionally conservative:

- dry-run output is the default
- source docs remain the planning authority
- created issues use stable planning codes and labels
- GitHub Project insertion is explicit and can be skipped when GraphQL quota is low
"""

from __future__ import annotations

import argparse
import csv
import html
import json
import re
import subprocess
import sys
import time
from dataclasses import asdict, dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable


DEFAULT_REPO = "ThirdWatchStudios/Voidwake"
DEFAULT_PROJECT_OWNER = "ThirdWatchStudios"
DEFAULT_PROJECT_NUMBER = 4
DEFAULT_SCOPE_LABEL = "prototype"
DEFAULT_SOURCE_DIR = Path("enter-the-voidwake/docs/07-production-planning")
DEFAULT_SOURCE_PREFIX = "docs/07-production-planning"
DEFAULT_ROADMAP_RELATIVE_SPEC = "00-roadmap/04-mvp-epic-roadmap.md"
ISSUE_CODE_PATTERN = re.compile(r"^\[([A-Z]\d+(?:\.\d+)*)\]")
GITHUB_API_VERSION = "2026-03-10"
CODE_RE = re.compile(r"^(?P<kind>[EFPS])(?P<num>\d+(?:\.\d+)*)$")
RANGE_RE = re.compile(
    r"^(?P<left>[EFPS]\d+(?:\.\d+)*)\s*-\s*(?P<right>[EFPS]\d+(?:\.\d+)*)$"
)


@dataclass
class IssuePlan:
    kind: str
    code: str
    title: str
    issue_title: str
    labels: list[str]
    source_spec: str
    parent_code: str | None
    dependencies: list[str]
    body: str


@dataclass
class ExistingIssue:
    number: int
    title: str
    state: str
    url: str
    labels: list[str]
    code: str | None


@dataclass
class InventoryItem:
    kind: str
    code: str
    issue_title: str
    status: str
    state: str | None
    number: int | None
    url: str | None
    missing_labels: list[str]


def load_config(config_path: Path | None) -> dict[str, object]:
    if config_path is None:
        return {}
    return json.loads(config_path.read_text(encoding="utf-8"))


def config_path_value(config: dict[str, object], key: str, default: Path | None = None) -> Path | None:
    value = config.get(key)
    if value is None:
        return default
    return Path(str(value))


def config_str_value(config: dict[str, object], key: str, default: str) -> str:
    value = config.get(key)
    return default if value is None else str(value)


def config_int_value(config: dict[str, object], key: str, default: int) -> int:
    value = config.get(key)
    return default if value is None else int(value)


def default_source_prefix_for(source_dir: Path) -> str:
    if source_dir.as_posix() == DEFAULT_SOURCE_DIR.as_posix():
        return DEFAULT_SOURCE_PREFIX
    return source_dir.as_posix().rstrip("/")


def roadmap_source_for(source_prefix: str, roadmap_source: str | None) -> str:
    if roadmap_source:
        return roadmap_source
    return f"{source_prefix.rstrip('/')}/{DEFAULT_ROADMAP_RELATIVE_SPEC}"


class MarkdownHTMLParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.in_pre = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"p", "div"}:
            self._block_break()
        elif tag in {"strong", "b"}:
            self.parts.append("**")
        elif tag in {"em", "i"}:
            self.parts.append("_")
        elif tag == "code" and not self.in_pre:
            self.parts.append("`")
        elif tag == "pre":
            self._block_break()
            self.parts.append("```text\n")
            self.in_pre = True
        elif tag in {"ul", "ol"}:
            self._block_break()
        elif tag == "li":
            self._line_break()
            self.parts.append("- ")
        elif tag == "br":
            self._line_break()
        elif re.fullmatch(r"h[1-6]", tag):
            level = int(tag[1])
            self._block_break()
            self.parts.append("#" * level + " ")

    def handle_endtag(self, tag: str) -> None:
        if tag in {"p", "div"}:
            self._block_break()
        elif tag in {"strong", "b"}:
            self.parts.append("**")
        elif tag in {"em", "i"}:
            self.parts.append("_")
        elif tag == "code" and not self.in_pre:
            self.parts.append("`")
        elif tag == "pre":
            self.parts.append("\n```\n")
            self.in_pre = False
            self._block_break()
        elif tag == "li":
            self._line_break()
        elif tag in {"ul", "ol"}:
            self._block_break()
        elif re.fullmatch(r"h[1-6]", tag):
            self._block_break()

    def handle_data(self, data: str) -> None:
        if self.in_pre:
            self.parts.append(data)
        else:
            self.parts.append(re.sub(r"\s+", " ", data))

    def markdown(self) -> str:
        text = "".join(self.parts)
        text = re.sub(r"[ \t]+\n", "\n", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        text = re.sub(r" ?\n- ", "\n- ", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    def _line_break(self) -> None:
        if not self.parts:
            return
        if not "".join(self.parts[-2:]).endswith("\n"):
            self.parts.append("\n")

    def _block_break(self) -> None:
        if not self.parts:
            return
        current = "".join(self.parts[-3:])
        if current.endswith("\n\n"):
            return
        if current.endswith("\n"):
            self.parts.append("\n")
        else:
            self.parts.append("\n\n")


def html_to_markdown(raw_html: str) -> str:
    parser = MarkdownHTMLParser()
    parser.feed(raw_html or "")
    return parser.markdown()


def strip_html(raw_html: str) -> str:
    text = re.sub(r"<[^>]+>", "", raw_html)
    return html.unescape(re.sub(r"\s+", " ", text)).strip()


def parse_title(work_item_type: str, raw_title: str) -> tuple[str, str]:
    raw_title = raw_title.strip()
    if work_item_type == "Epic":
        match = re.fullmatch(r"Epic\s+(\d+(?:\.\d+)?)\s+-\s+(.+)", raw_title)
        if not match:
            raise ValueError(f"Could not parse epic title: {raw_title!r}")
        return f"E{match.group(1)}", match.group(2).strip()

    match = re.fullmatch(r"([FPS]\d+(?:\.\d+)*)\s+-\s+(.+)", raw_title)
    if not match:
        raise ValueError(f"Could not parse item title: {raw_title!r}")
    return match.group(1), match.group(2).strip()


def first_title(row: dict[str, str]) -> str:
    for column in ("Title 1", "Title 2", "Title 3"):
        if row.get(column, "").strip():
            return row[column].strip()
    raise ValueError(f"CSV row has no title: {row!r}")


def extract_dependencies(raw_html: str) -> list[str]:
    dependencies: list[str] = []
    for block in re.findall(
        r"<strong>\s*Dependencies:?\s*</strong>.*?<ul>(.*?)</ul>",
        raw_html or "",
        flags=re.IGNORECASE | re.DOTALL,
    ):
        for item in re.findall(r"<li>(.*?)</li>", block, flags=re.IGNORECASE | re.DOTALL):
            dependency = strip_html(item).strip("` ")
            if dependency:
                dependencies.append(dependency)
    return dependencies


def parse_feature_sequence(source_dir: Path, source_prefix: str, epic_code: str) -> dict[str, list[str]]:
    source = find_feature_source(source_dir, source_prefix, epic_code)
    path = source_spec_to_path(source_dir, source_prefix, source)
    if not path.exists():
        return {}

    dependencies: dict[str, list[str]] = {}
    in_sequence = False
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("## Feature Sequence"):
            in_sequence = True
            continue
        if in_sequence and line.startswith("## ") and not line.startswith("## Feature Sequence"):
            break
        if not in_sequence or not line.startswith("|"):
            continue

        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if len(cells) < 4:
            continue
        code = cells[1] if CODE_RE.match(cells[1]) else cells[0]
        if not CODE_RE.match(code):
            continue
        dependency_cell = cells[3]
        if dependency_cell.lower() in {"", "none"}:
            dependencies[code] = []
        else:
            dependencies[code] = [
                item.strip()
                for item in re.split(r",\s*", dependency_cell)
                if item.strip()
            ]
    return dependencies


def compact_dependency(dependency: str) -> str:
    if " - " in dependency:
        return dependency.split(" - ", 1)[0].strip("` .")
    return dependency.strip("` .")


def normalize_dependency_code(dependency: str) -> str | None:
    dependency = compact_dependency(dependency).strip("` ")
    if CODE_RE.match(dependency):
        return dependency

    epic_match = re.fullmatch(r"Epic\s+(\d+(?:\.\d+)?)", dependency, flags=re.IGNORECASE)
    if epic_match:
        return f"E{epic_match.group(1)}"
    return None


def code_sort_key(code: str) -> tuple[str, tuple[int, ...]]:
    match = CODE_RE.match(code)
    if not match:
        return (code, ())
    return (match.group("kind"), tuple(int(part) for part in match.group("num").split(".")))


def expand_dependency_codes(dependency: str, known_codes: set[str]) -> list[str]:
    dependency = compact_dependency(dependency).strip("` ")
    range_match = RANGE_RE.match(dependency)
    if range_match:
        left = range_match.group("left")
        right = range_match.group("right")
        left_kind, left_tuple = code_sort_key(left)
        right_kind, right_tuple = code_sort_key(right)
        if left_kind != right_kind:
            return []
        return [
            code
            for code in sorted(known_codes, key=code_sort_key)
            if code_sort_key(code)[0] == left_kind
            and left_tuple <= code_sort_key(code)[1] <= right_tuple
        ]

    code = normalize_dependency_code(dependency)
    return [code] if code and code in known_codes else []


def parent_for(code: str, epic_code: str) -> str | None:
    if code.startswith("E"):
        return None
    if code.startswith("P"):
        return epic_code
    if code.startswith("F"):
        return epic_code
    if code.startswith("S"):
        parts = code[1:].split(".")
        return "F" + ".".join(parts[:-1])
    return None


def epic_slug(epic_code: str) -> str:
    value = epic_code.removeprefix("E")
    if "." in value:
        return value.replace(".", "").zfill(3)
    return value.zfill(2)


def feature_slug(feature_code: str) -> str:
    return feature_code.lower().replace(".", "-")


def relative_source(source_dir: Path, source_prefix: str, file_path: Path) -> str:
    relative_path = file_path.resolve().relative_to(source_dir.resolve())
    return f"{source_prefix.rstrip('/')}/{relative_path.as_posix()}"


def source_spec_to_path(source_dir: Path, source_prefix: str, source_spec: str) -> Path:
    prefix = f"{source_prefix.rstrip('/')}/"
    if source_spec.startswith(prefix):
        return source_dir / source_spec.removeprefix(prefix)
    return source_dir / source_spec


def find_feature_source(source_dir: Path, source_prefix: str, epic_code: str) -> str:
    slug = epic_slug(epic_code)
    candidates = sorted(source_dir.rglob(f"*-epic-{slug}-*-features.md"))
    if candidates:
        return relative_source(source_dir, source_prefix, candidates[0])
    return f"{source_prefix.rstrip('/')}/UNKNOWN-epic-{slug}-features.md"


def find_story_source(source_dir: Path, source_prefix: str, story_code: str, fallback: str) -> str:
    feature_code = parent_for(story_code, "") or ""
    if not feature_code.startswith("F"):
        return fallback
    candidates = sorted(source_dir.rglob(f"*-{feature_slug(feature_code)}-*-stories.md"))
    if candidates:
        return relative_source(source_dir, source_prefix, candidates[0])
    return fallback


def kind_for(work_item_type: str) -> str:
    if work_item_type == "User Story":
        return "story"
    return work_item_type.lower()


def format_dependencies(dependencies: Iterable[str]) -> str | None:
    compact = [compact_dependency(dep) for dep in dependencies]
    if not compact:
        return None
    return ", ".join(f"`{dep}`" for dep in compact)


def code_from_issue_title(title: str) -> str | None:
    match = ISSUE_CODE_PATTERN.match(title)
    if not match:
        return None
    return match.group(1)


def epic_code_for_plan(issue_plan: list[IssuePlan]) -> str:
    for issue in issue_plan:
        if issue.kind == "epic":
            return issue.code
    raise ValueError("Import plan has no epic issue.")


def build_body(
    *,
    kind: str,
    code: str,
    title: str,
    epic_label: str,
    source_spec: str,
    dependencies: list[str],
    raw_description: str,
) -> str:
    header = [
        "Imported from the planning docs.",
        "",
        f"- Kind: `{kind.title()}`",
        f"- Code: `{code}`",
        f"- Epic: `{epic_label}`",
        f"- Source spec: `{source_spec}`",
        "",
        "The design documentation remains the source of planning truth; update the source doc if the scope changes materially.",
    ]
    dependency_summary = format_dependencies(dependencies)
    if dependency_summary:
        header.extend(["", f"Depends on: {dependency_summary}"])

    description = html_to_markdown(raw_description)
    heading = f"### {code} - {title}"
    if kind == "epic":
        heading = f"### Epic {code.removeprefix('E')} - {title}"

    body_parts = header + ["", heading]
    if description:
        body_parts.extend(["", description])
    return "\n".join(body_parts).strip() + "\n"


def read_issue_plan(
    csv_path: Path,
    source_dir: Path,
    source_prefix: str,
    roadmap_source_spec: str,
    scope_label: str,
) -> list[IssuePlan]:
    with csv_path.open(newline="", encoding="utf-8-sig") as handle:
        rows = list(csv.DictReader(handle))

    if not rows:
        raise ValueError(f"{csv_path} contained no rows")

    epic_rows = [row for row in rows if row.get("Work Item Type") == "Epic"]
    if len(epic_rows) != 1:
        raise ValueError(f"Expected exactly one Epic row, found {len(epic_rows)}")

    epic_code, epic_title = parse_title("Epic", first_title(epic_rows[0]))
    epic_label = f"{epic_code} - {epic_title}"
    feature_source = find_feature_source(source_dir, source_prefix, epic_code)
    feature_dependencies = parse_feature_sequence(source_dir, source_prefix, epic_code)

    issue_plan: list[IssuePlan] = []
    for row in rows:
        work_item_type = row["Work Item Type"].strip()
        kind = kind_for(work_item_type)
        code, title = parse_title(work_item_type, first_title(row))
        issue_title = f"[{code}] {title}"
        dependencies = extract_dependencies(row.get("Description", ""))
        if kind in {"feature", "precursor"}:
            dependencies = feature_dependencies.get(code, dependencies)
        dependencies = [compact_dependency(dependency) for dependency in dependencies]

        if kind == "epic":
            source_spec = roadmap_source_spec
        elif kind in {"feature", "precursor"}:
            source_spec = feature_source
        else:
            source_spec = find_story_source(source_dir, source_prefix, code, feature_source)

        labels = [
            scope_label,
            "planning",
            f"kind: {kind}",
            "source: design-plan",
            f"epic: {epic_code}",
        ]
        body = build_body(
            kind=kind,
            code=code,
            title=title,
            epic_label=epic_label,
            source_spec=source_spec,
            dependencies=dependencies,
            raw_description=row.get("Description", ""),
        )
        issue_plan.append(
            IssuePlan(
                kind=kind,
                code=code,
                title=title,
                issue_title=issue_title,
                labels=labels,
                source_spec=source_spec,
                parent_code=parent_for(code, epic_code),
                dependencies=dependencies,
                body=body,
            )
        )

    return issue_plan


def render_markdown(
    issue_plan: list[IssuePlan],
    repo: str,
    project_owner: str,
    project_number: int,
    scope_label: str,
) -> str:
    counts: dict[str, int] = {}
    for issue in issue_plan:
        counts[issue.kind] = counts.get(issue.kind, 0) + 1

    lines = [
        "# GitHub Issue Import Plan",
        "",
        f"- Target repo: `{repo}`",
        f"- Target project: `{project_owner}` project `{project_number}`",
        f"- Scope label: `{scope_label}`",
        f"- Total issues: `{len(issue_plan)}`",
        "",
        "## Counts",
        "",
        "| Kind | Count |",
        "|---|---:|",
    ]
    for kind in ("epic", "feature", "precursor", "story"):
        if kind in counts:
            lines.append(f"| {kind} | {counts[kind]} |")

    lines.extend(["", "## Items", ""])
    for issue in issue_plan:
        dependency_summary = format_dependencies(issue.dependencies)
        suffix = f" depends on {dependency_summary}" if dependency_summary else ""
        lines.append(f"- `{issue.kind}` `{issue.code}` {issue.title}{suffix}")
    return "\n".join(lines) + "\n"


def render_json(issue_plan: list[IssuePlan]) -> str:
    return json.dumps([asdict(issue) for issue in issue_plan], indent=2) + "\n"


def run_gh(args: list[str]) -> str:
    completed = subprocess.run(
        ["gh", *args],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    return completed.stdout.strip()


def run_gh_json(args: list[str], payload: dict[str, object]) -> str:
    completed = subprocess.run(
        ["gh", *args],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        input=json.dumps(payload),
        text=True,
    )
    return completed.stdout.strip()


def emit_status(message: str, quiet: bool = False) -> None:
    if quiet:
        return
    timestamp = time.strftime("%H:%M:%S")
    print(f"[github-import {timestamp}] {message}", file=sys.stderr, flush=True)


def fetch_issues_by_code(repo: str) -> dict[str, dict[str, object]]:
    issues_by_code: dict[str, dict[str, object]] = {}
    page = 1
    while True:
        raw = run_gh(["api", f"repos/{repo}/issues?state=all&per_page=100&page={page}"])
        issues = json.loads(raw)
        if not issues:
            return issues_by_code
        for issue in issues:
            if "pull_request" in issue:
                continue
            code = code_from_issue_title(issue.get("title") or "")
            if code:
                issues_by_code[code] = issue
        page += 1


def fetch_sub_issue_numbers(repo: str, parent_number: int) -> set[int]:
    numbers: set[int] = set()
    page = 1
    while True:
        raw = run_gh(
            [
                "api",
                "-H",
                f"X-GitHub-Api-Version:{GITHUB_API_VERSION}",
                f"repos/{repo}/issues/{parent_number}/sub_issues?per_page=100&page={page}",
            ]
        )
        sub_issues = json.loads(raw)
        if not sub_issues:
            return numbers
        numbers.update(int(issue["number"]) for issue in sub_issues)
        page += 1


def fetch_blocked_by_ids(repo: str, issue_number: int) -> set[int]:
    issue_ids: set[int] = set()
    page = 1
    while True:
        raw = run_gh(
            [
                "api",
                "-H",
                f"X-GitHub-Api-Version:{GITHUB_API_VERSION}",
                f"repos/{repo}/issues/{issue_number}/dependencies/blocked_by?per_page=100&page={page}",
            ]
        )
        dependencies = json.loads(raw)
        if not dependencies:
            return issue_ids
        issue_ids.update(int(issue["id"]) for issue in dependencies)
        page += 1


def add_sub_issue(repo: str, parent_number: int, sub_issue_id: int) -> None:
    run_gh(
        [
            "api",
            "--method",
            "POST",
            "-H",
            f"X-GitHub-Api-Version:{GITHUB_API_VERSION}",
            f"repos/{repo}/issues/{parent_number}/sub_issues",
            "-F",
            f"sub_issue_id={sub_issue_id}",
        ]
    )


def add_blocked_by(repo: str, issue_number: int, blocker_issue_id: int) -> None:
    run_gh(
        [
            "api",
            "--method",
            "POST",
            "-H",
            f"X-GitHub-Api-Version:{GITHUB_API_VERSION}",
            f"repos/{repo}/issues/{issue_number}/dependencies/blocked_by",
            "-F",
            f"issue_id={blocker_issue_id}",
        ]
    )


def edit_issue_body(repo: str, issue_number: int, body: str) -> None:
    run_gh_json(
        [
            "api",
            "--method",
            "PATCH",
            f"repos/{repo}/issues/{issue_number}",
            "--input",
            "-",
        ],
        {"body": body},
    )


def sync_issue_bodies(
    issue_plan: list[IssuePlan],
    repo: str,
    issues_by_code: dict[str, dict[str, object]],
    quiet: bool = False,
) -> int:
    emit_status(f"Body sync: checking {len(issue_plan)} planned issues.", quiet)
    updated = 0
    for issue in issue_plan:
        existing = issues_by_code.get(issue.code)
        if not existing:
            continue
        if (existing.get("body") or "") == issue.body:
            continue
        emit_status(f"Body sync: updating {issue.code} #{existing['number']}.", quiet)
        edit_issue_body(repo, int(existing["number"]), issue.body)
        updated += 1
    emit_status(f"Body sync complete: {updated} issue bodies updated.", quiet)
    return updated


def sync_sub_issue_hierarchy(
    issue_plan: list[IssuePlan],
    repo: str,
    issues_by_code: dict[str, dict[str, object]],
    quiet: bool = False,
) -> int:
    planned_links = sum(1 for issue in issue_plan if issue.parent_code)
    emit_status(f"Sub-issue sync: checking {planned_links} planned parent/child links.", quiet)
    parent_cache: dict[int, set[int]] = {}
    created = 0
    for issue in issue_plan:
        if not issue.parent_code:
            continue
        parent = issues_by_code.get(issue.parent_code)
        child = issues_by_code.get(issue.code)
        if not parent or not child:
            continue

        parent_number = int(parent["number"])
        child_number = int(child["number"])
        if parent_number not in parent_cache:
            emit_status(
                f"Sub-issue sync: fetching existing children for {issue.parent_code} #{parent_number}.",
                quiet,
            )
            parent_cache[parent_number] = fetch_sub_issue_numbers(repo, parent_number)
        if child_number in parent_cache[parent_number]:
            continue

        emit_status(
            f"Sub-issue sync: linking {issue.parent_code} #{parent_number} -> {issue.code} #{child_number}.",
            quiet,
        )
        add_sub_issue(repo, parent_number, int(child["id"]))
        parent_cache[parent_number].add(child_number)
        created += 1
    emit_status(f"Sub-issue sync complete: {created} links created.", quiet)
    return created


def sync_issue_dependencies(
    issue_plan: list[IssuePlan],
    repo: str,
    issues_by_code: dict[str, dict[str, object]],
    quiet: bool = False,
) -> int:
    known_codes = set(issues_by_code)
    dependency_cache: dict[int, set[int]] = {}
    created = 0
    planned_dependencies = sum(len(issue.dependencies) for issue in issue_plan)
    emit_status(
        f"Dependency sync: checking {planned_dependencies} dependency specs.",
        quiet,
    )
    for issue in issue_plan:
        current = issues_by_code.get(issue.code)
        if not current:
            continue

        current_number = int(current["number"])
        if current_number not in dependency_cache:
            emit_status(
                f"Dependency sync: fetching existing blockers for {issue.code} #{current_number}.",
                quiet,
            )
            dependency_cache[current_number] = fetch_blocked_by_ids(repo, current_number)

        dependency_codes: list[str] = []
        for dependency in issue.dependencies:
            dependency_codes.extend(expand_dependency_codes(dependency, known_codes))

        for dependency_code in dependency_codes:
            if dependency_code == issue.code:
                continue
            dependency_issue = issues_by_code.get(dependency_code)
            if not dependency_issue:
                continue
            dependency_id = int(dependency_issue["id"])
            if dependency_id in dependency_cache[current_number]:
                continue
            emit_status(
                f"Dependency sync: marking {issue.code} #{current_number} blocked by {dependency_code} #{dependency_issue['number']}.",
                quiet,
            )
            add_blocked_by(repo, current_number, dependency_id)
            dependency_cache[current_number].add(dependency_id)
            created += 1
    emit_status(f"Dependency sync complete: {created} dependency links created.", quiet)
    return created


def fetch_existing_issues(repo: str) -> list[ExistingIssue]:
    existing: list[ExistingIssue] = []
    page = 1
    while True:
        raw = run_gh(["api", f"repos/{repo}/issues?state=all&per_page=100&page={page}"])
        issues = json.loads(raw)
        if not issues:
            return existing
        for issue in issues:
            if "pull_request" in issue:
                continue
            title = issue.get("title") or ""
            existing.append(
                ExistingIssue(
                    number=int(issue["number"]),
                    title=title,
                    state=issue.get("state") or "unknown",
                    url=issue.get("html_url") or "",
                    labels=[label["name"] for label in issue.get("labels", [])],
                    code=code_from_issue_title(title),
                )
            )
        page += 1


def fetch_existing_issue_titles(repo: str) -> dict[str, str]:
    return {issue.title: issue.url for issue in fetch_existing_issues(repo)}


def build_inventory(issue_plan: list[IssuePlan], repo: str) -> dict[str, object]:
    existing_issues = fetch_existing_issues(repo)
    existing_by_title = {issue.title: issue for issue in existing_issues}
    planned_titles = {issue.issue_title for issue in issue_plan}
    epic_code = epic_code_for_plan(issue_plan)
    epic_label = f"epic: {epic_code}"

    items: list[InventoryItem] = []
    for issue in issue_plan:
        existing = existing_by_title.get(issue.issue_title)
        if not existing:
            items.append(
                InventoryItem(
                    kind=issue.kind,
                    code=issue.code,
                    issue_title=issue.issue_title,
                    status="missing",
                    state=None,
                    number=None,
                    url=None,
                    missing_labels=issue.labels,
                )
            )
            continue

        missing_labels = [label for label in issue.labels if label not in existing.labels]
        items.append(
            InventoryItem(
                kind=issue.kind,
                code=issue.code,
                issue_title=issue.issue_title,
                status="existing",
                state=existing.state,
                number=existing.number,
                url=existing.url,
                missing_labels=missing_labels,
            )
        )

    extra_existing = [
        issue
        for issue in existing_issues
        if epic_label in issue.labels and issue.title not in planned_titles
    ]
    counts_by_kind: dict[str, dict[str, int]] = {}
    for item in items:
        counts = counts_by_kind.setdefault(item.kind, {"planned": 0, "existing": 0, "missing": 0})
        counts["planned"] += 1
        counts[item.status] += 1

    summary = {
        "planned": len(items),
        "existing": sum(1 for item in items if item.status == "existing"),
        "missing": sum(1 for item in items if item.status == "missing"),
        "label_drift": sum(1 for item in items if item.missing_labels and item.status == "existing"),
        "extra_existing_with_epic_label": len(extra_existing),
    }
    return {
        "repo": repo,
        "epic_code": epic_code,
        "summary": summary,
        "counts_by_kind": counts_by_kind,
        "items": [asdict(item) for item in items],
        "extra_existing": [asdict(issue) for issue in extra_existing],
    }


def render_inventory_markdown(inventory: dict[str, object]) -> str:
    summary = inventory["summary"]
    counts_by_kind = inventory["counts_by_kind"]
    items = inventory["items"]
    extra_existing = inventory["extra_existing"]

    lines = [
        "# GitHub Issue Import Inventory",
        "",
        f"- Target repo: `{inventory['repo']}`",
        f"- Epic: `{inventory['epic_code']}`",
        f"- Planned issues: `{summary['planned']}`",
        f"- Existing planned issues: `{summary['existing']}`",
        f"- Missing planned issues: `{summary['missing']}`",
        f"- Existing issues with missing labels: `{summary['label_drift']}`",
        f"- Extra existing issues with epic label: `{summary['extra_existing_with_epic_label']}`",
        "",
        "## Counts",
        "",
        "| Kind | Planned | Existing | Missing |",
        "|---|---:|---:|---:|",
    ]
    for kind in ("epic", "feature", "precursor", "story"):
        if kind not in counts_by_kind:
            continue
        counts = counts_by_kind.get(kind, {"planned": 0, "existing": 0, "missing": 0})
        lines.append(f"| {kind} | {counts['planned']} | {counts['existing']} | {counts['missing']} |")

    missing_items = [item for item in items if item["status"] == "missing"]
    if missing_items:
        lines.extend(["", "## Missing Planned Issues", ""])
        for item in missing_items:
            lines.append(f"- `{item['kind']}` `{item['code']}` {item['issue_title']}")

    drift_items = [
        item for item in items if item["status"] == "existing" and item["missing_labels"]
    ]
    if drift_items:
        lines.extend(["", "## Label Drift", ""])
        for item in drift_items:
            labels = ", ".join(f"`{label}`" for label in item["missing_labels"])
            lines.append(f"- `#{item['number']}` `{item['code']}` missing {labels}")

    existing_items = [item for item in items if item["status"] == "existing"]
    if existing_items:
        lines.extend(["", "## Existing Planned Issues", ""])
        for item in existing_items:
            lines.append(
                f"- `#{item['number']}` `{item['kind']}` `{item['code']}` "
                f"{item['state']} - {item['issue_title']}"
            )

    if extra_existing:
        lines.extend(["", "## Extra Existing Issues With Epic Label", ""])
        for issue in extra_existing:
            code = f"`{issue['code']}` " if issue["code"] else ""
            lines.append(f"- `#{issue['number']}` {code}{issue['state']} - {issue['title']}")

    return "\n".join(lines) + "\n"


def render_inventory_json(inventory: dict[str, object]) -> str:
    return json.dumps(inventory, indent=2) + "\n"


def ensure_label(repo: str, label: str) -> None:
    color = "5319e7"
    if label == "mvp":
        color = "0e8a16"
    elif label == "prototype":
        color = "fbca04"
    elif label == "planning":
        color = "cfd3d7"
    elif label.startswith("kind:"):
        color = "1d76db"
    elif label == "source: design-plan":
        color = "5319e7"

    subprocess.run(
        [
            "gh",
            "label",
            "create",
            label,
            "--repo",
            repo,
            "--color",
            color,
            "--description",
            f"Imported planning label: {label}",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )


def execute_import(
    issue_plan: list[IssuePlan],
    *,
    repo: str,
    project_owner: str,
    project_number: int,
    skip_project: bool,
    links_only: bool,
    skip_links: bool,
    sync_existing_bodies: bool,
    quiet: bool = False,
) -> dict[str, dict[str, str]]:
    labels = sorted({label for issue in issue_plan for label in issue.labels})
    emit_status(
        f"Import start: {len(issue_plan)} planned issues targeting {repo}; "
        f"project={'skipped' if skip_project else f'{project_owner}/{project_number}'}; "
        f"links={'skipped' if skip_links else 'enabled'}.",
        quiet,
    )
    emit_status(f"Ensuring {len(labels)} labels exist.", quiet)
    for label in labels:
        ensure_label(repo, label)

    emit_status("Fetching existing GitHub issues by title.", quiet)
    existing = fetch_existing_issue_titles(repo)
    emit_status(f"Found {len(existing)} existing GitHub issue titles.", quiet)
    result: dict[str, dict[str, str]] = {}
    if not links_only:
        for index, issue in enumerate(issue_plan, start=1):
            if issue.issue_title in existing:
                emit_status(
                    f"Issue pass [{index}/{len(issue_plan)}]: existing {issue.code} - {issue.title}.",
                    quiet,
                )
                result[issue.code] = {"status": "existing", "url": existing[issue.issue_title]}
                continue

            emit_status(
                f"Issue pass [{index}/{len(issue_plan)}]: creating {issue.code} - {issue.title}.",
                quiet,
            )
            create_args = [
                "issue",
                "create",
                "--repo",
                repo,
                "--title",
                issue.issue_title,
                "--body",
                issue.body,
            ]
            for label in issue.labels:
                create_args.extend(["--label", label])
            issue_url = run_gh(create_args)
            emit_status(
                f"Issue pass [{index}/{len(issue_plan)}]: created {issue.code} at {issue_url}.",
                quiet,
            )

            if not skip_project:
                emit_status(
                    f"Project pass [{index}/{len(issue_plan)}]: adding {issue.code} to project {project_owner}/{project_number}.",
                    quiet,
                )
                run_gh(
                    [
                        "project",
                        "item-add",
                        str(project_number),
                        "--owner",
                        project_owner,
                        "--url",
                        issue_url,
                    ]
                )
                emit_status(
                    f"Project pass [{index}/{len(issue_plan)}]: added {issue.code}.",
                    quiet,
                )
            result[issue.code] = {"status": "created", "url": issue_url}

    emit_status("Fetching issues by planning code for body/link sync.", quiet)
    issues_by_code = fetch_issues_by_code(repo)
    emit_status(f"Found {len(issues_by_code)} issues with planning codes.", quiet)
    if links_only:
        for issue in issue_plan:
            existing_issue = issues_by_code.get(issue.code)
            if existing_issue:
                result[issue.code] = {"status": "existing", "url": str(existing_issue["html_url"])}

    if sync_existing_bodies:
        result["_body_sync"] = {
            "status": "updated",
            "count": str(sync_issue_bodies(issue_plan, repo, issues_by_code, quiet)),
        }
        emit_status("Refreshing issues by planning code after body sync.", quiet)
        issues_by_code = fetch_issues_by_code(repo)

    if not skip_links:
        result["_sub_issues"] = {
            "status": "updated",
            "count": str(sync_sub_issue_hierarchy(issue_plan, repo, issues_by_code, quiet)),
        }
        time.sleep(1)
        result["_dependencies"] = {
            "status": "updated",
            "count": str(sync_issue_dependencies(issue_plan, repo, issues_by_code, quiet)),
        }

    created = sum(1 for value in result.values() if value.get("status") == "created")
    existing_count = sum(1 for value in result.values() if value.get("status") == "existing")
    emit_status(
        f"Import complete: {created} created, {existing_count} existing, "
        f"{result.get('_sub_issues', {}).get('count', '0')} sub-issue links, "
        f"{result.get('_dependencies', {}).get('count', '0')} dependency links.",
        quiet,
    )
    return result


def parse_args() -> argparse.Namespace:
    config_parser = argparse.ArgumentParser(add_help=False)
    config_parser.add_argument(
        "--config",
        type=Path,
        help="Optional JSON target config with repo, project, source, and label defaults.",
    )
    config_args, _ = config_parser.parse_known_args()
    config = load_config(config_args.config)
    default_source_dir = config_path_value(config, "source_dir", DEFAULT_SOURCE_DIR) or DEFAULT_SOURCE_DIR
    default_source_prefix = config_str_value(
        config,
        "source_prefix",
        default_source_prefix_for(default_source_dir),
    )

    parser = argparse.ArgumentParser(
        parents=[config_parser],
        description="Plan or create GitHub issues from a design planning CSV."
    )
    parser.add_argument(
        "--csv",
        default=config_path_value(config, "csv"),
        type=Path,
        help="Planning CSV to import.",
    )
    parser.add_argument(
        "--source-dir",
        default=default_source_dir,
        type=Path,
        help="Production-planning root used to resolve nested source specs.",
    )
    parser.add_argument(
        "--source-prefix",
        default=default_source_prefix,
        help="Source-spec prefix to write into issue bodies. Defaults to the Voidwake legacy prefix for the default source dir, otherwise the source-dir path.",
    )
    parser.add_argument(
        "--roadmap-source",
        default=config.get("roadmap_source"),
        help="Source spec for the epic issue body. Defaults to <source-prefix>/00-roadmap/04-mvp-epic-roadmap.md.",
    )
    parser.add_argument("--repo", default=config_str_value(config, "repo", DEFAULT_REPO))
    parser.add_argument("--project-owner", default=config_str_value(config, "project_owner", DEFAULT_PROJECT_OWNER))
    parser.add_argument("--project-number", default=config_int_value(config, "project_number", DEFAULT_PROJECT_NUMBER), type=int)
    parser.add_argument(
        "--scope-label",
        default=config_str_value(config, "scope_label", DEFAULT_SCOPE_LABEL),
        help="Top-level scope label for generated issues. Defaults to prototype while the project is in Prototype Discovery.",
    )
    parser.add_argument(
        "--format",
        choices=("markdown", "json"),
        default="markdown",
        help="Dry-run or inventory output format.",
    )
    parser.add_argument(
        "--inventory",
        action="store_true",
        help="Fetch existing GitHub issues and compare them to the CSV-derived import plan.",
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Create missing issues and add them to the GitHub Project.",
    )
    parser.add_argument(
        "--links-only",
        action="store_true",
        help="Do not create issues; only sync hierarchy/dependency links for existing issues.",
    )
    parser.add_argument(
        "--skip-links",
        action="store_true",
        help="When executing, skip sub-issue and dependency link synchronization.",
    )
    parser.add_argument(
        "--sync-existing-bodies",
        action="store_true",
        help="Replace existing imported issue bodies with generated bodies.",
    )
    parser.add_argument(
        "--skip-project",
        action="store_true",
        help="When executing, create issues but do not add them to the GitHub Project.",
    )
    parser.add_argument(
        "--issue-map",
        type=Path,
        help="When executing, write a JSON map of imported codes to issue URLs.",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress progress/status messages on stderr.",
    )
    args = parser.parse_args()
    if args.csv is None:
        parser.error("--csv is required unless provided by --config.")
    if args.inventory and args.execute:
        parser.error("--inventory cannot be combined with --execute.")
    if args.links_only and not args.execute:
        parser.error("--links-only requires --execute.")
    source_prefix_specified = (
        "source_prefix" in config
        or any(arg == "--source-prefix" or arg.startswith("--source-prefix=") for arg in sys.argv[1:])
    )
    if not source_prefix_specified:
        args.source_prefix = default_source_prefix_for(args.source_dir)
    args.roadmap_source = roadmap_source_for(args.source_prefix, args.roadmap_source)
    return args


def main() -> int:
    args = parse_args()
    issue_plan = read_issue_plan(
        args.csv,
        args.source_dir,
        args.source_prefix,
        args.roadmap_source,
        args.scope_label,
    )

    if args.inventory:
        emit_status(f"Inventory start: reading existing GitHub issues for {args.repo}.", args.quiet)
        inventory = build_inventory(issue_plan, args.repo)
        summary = inventory["summary"]
        emit_status(
            "Inventory complete: "
            f"{summary['planned']} planned, {summary['existing']} existing, "
            f"{summary['missing']} missing, {summary['label_drift']} with label drift.",
            args.quiet,
        )
        if args.format == "json":
            sys.stdout.write(render_inventory_json(inventory))
        else:
            sys.stdout.write(render_inventory_markdown(inventory))
        return 0

    if not args.execute:
        if args.format == "json":
            sys.stdout.write(render_json(issue_plan))
        else:
            sys.stdout.write(
                render_markdown(
                    issue_plan,
                    args.repo,
                    args.project_owner,
                    args.project_number,
                    args.scope_label,
                )
            )
        return 0

    result = execute_import(
        issue_plan,
        repo=args.repo,
        project_owner=args.project_owner,
        project_number=args.project_number,
        skip_project=args.skip_project,
        links_only=args.links_only,
        skip_links=args.skip_links,
        sync_existing_bodies=args.sync_existing_bodies,
        quiet=args.quiet,
    )
    output = json.dumps(result, indent=2) + "\n"
    if args.issue_map:
        args.issue_map.write_text(output, encoding="utf-8")
    sys.stdout.write(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
