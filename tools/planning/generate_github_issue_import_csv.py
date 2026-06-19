#!/usr/bin/env python3
"""Generate GitHub issue import CSVs from production-planning Markdown docs.

The generated CSV is a transport artifact for plan_github_issue_import.py.
Markdown remains the source of planning truth.
"""

from __future__ import annotations

import argparse
import csv
import html
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


DEFAULT_SOURCE_DIR = Path("enter-the-voidwake/docs/07-production-planning")
CODE_RE = re.compile(r"^(?P<kind>[EFPS])(?P<num>\d+(?:\.\d+)*)$")
FEATURE_HEADING_RE = re.compile(r"^###\s+(F\d+(?:\.\d+)*)\s+-\s+(.+?)\s*$")
STORY_HEADING_RE = re.compile(r"^###\s+(S\d+(?:\.\d+)*)\s+-\s+(.+?)\s*$")
LABELS = {
    "Acceptance criteria",
    "Dependencies",
    "Done when",
    "Exit question",
    "Feature scope",
    "MVP estimate",
    "Notes",
    "Placeholder / deferred notes",
    "Planning intent",
    "Project phase",
    "Prototype estimate",
    "Required debug visibility",
    "User story",
    "What the player can experience",
}


@dataclass(frozen=True)
class Feature:
    code: str
    title: str
    dependencies: list[str]


@dataclass(frozen=True)
class Section:
    code: str
    title: str
    lines: list[str]


def load_config(config_path: Path | None) -> dict[str, object]:
    if config_path is None:
        return {}
    return json.loads(config_path.read_text(encoding="utf-8"))


def config_path_value(config: dict[str, object], key: str, default: Path | None = None) -> Path | None:
    value = config.get(key)
    if value is None:
        return default
    return Path(str(value))


def normalize_epic_code(raw: str) -> str:
    value = raw.strip()
    if not value:
        raise ValueError("Epic code is required.")
    if value.lower().startswith("epic "):
        value = value.split(None, 1)[1]
    if not value.upper().startswith("E"):
        value = f"E{value}"
    value = "E" + value[1:]
    if not CODE_RE.fullmatch(value):
        raise ValueError(f"Invalid epic code: {raw!r}")
    return value


def epic_slug(epic_code: str) -> str:
    value = epic_code.removeprefix("E")
    if "." in value:
        return value.replace(".", "").zfill(3)
    return value.zfill(2)


def feature_slug(feature_code: str) -> str:
    return feature_code.lower().replace(".", "-")


def strip_frontmatter(text: str) -> str:
    if not text.startswith("---\n"):
        return text
    end = text.find("\n---\n", 4)
    if end == -1:
        return text
    return text[end + len("\n---\n") :]


def read_lines(path: Path) -> list[str]:
    return strip_frontmatter(path.read_text(encoding="utf-8")).splitlines()


def find_feature_source(source_dir: Path, epic_code: str) -> Path:
    slug = epic_slug(epic_code)
    candidates = sorted(source_dir.rglob(f"*-epic-{slug}-*-features.md"))
    if not candidates:
        raise FileNotFoundError(
            f"Could not find feature breakdown for {epic_code} under {source_dir}"
        )
    if len(candidates) > 1:
        formatted = "\n".join(str(path) for path in candidates)
        raise ValueError(f"Multiple feature breakdowns found for {epic_code}:\n{formatted}")
    return candidates[0]


def find_story_source(source_dir: Path, feature_code: str) -> Path:
    candidates = sorted(source_dir.rglob(f"*-{feature_slug(feature_code)}-*-stories.md"))
    if not candidates:
        raise FileNotFoundError(f"Could not find story breakdown for {feature_code}")
    if len(candidates) > 1:
        formatted = "\n".join(str(path) for path in candidates)
        raise ValueError(f"Multiple story breakdowns found for {feature_code}:\n{formatted}")
    return candidates[0]


def default_output_path(feature_source: Path, epic_code: str) -> Path:
    epic_dir = feature_source.parent
    slug = epic_slug(epic_code)
    existing = sorted(epic_dir.glob(f"*-epic-{slug}-github-issue-import.csv"))
    if existing:
        return existing[-1]

    # Legacy generated artifacts used "ado-import" in the filename even though
    # the importer creates GitHub issues. Keep regenerating those files in place
    # when they already exist, but use GitHub-specific names for new epics.
    existing = sorted(epic_dir.glob(f"*-epic-{slug}-ado-import.csv"))
    if existing:
        return existing[-1]

    prefixes: list[int] = []
    for path in epic_dir.iterdir():
        match = re.match(r"^(\d+)-", path.name)
        if match:
            prefixes.append(int(match.group(1)))
    next_prefix = max(prefixes, default=0) + 1
    return epic_dir / f"{next_prefix}-epic-{slug}-github-issue-import.csv"


def parse_feature_sequence(lines: list[str]) -> list[Feature]:
    in_sequence = False
    features: list[Feature] = []

    for line in lines:
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
        if cells[0].lower() == "order" or set(cells[0]) <= {"-", ":"}:
            continue

        code = cells[1] if CODE_RE.fullmatch(cells[1]) else cells[0]
        if not CODE_RE.fullmatch(code):
            continue

        title_cell = cells[1] if code == cells[0] else cells[2]
        if " - " in title_cell:
            _, title = title_cell.split(" - ", 1)
        else:
            title = title_cell

        dependency_cell = cells[3]
        dependencies = [] if dependency_cell.lower() in {"", "none"} else [
            item.strip() for item in re.split(r",\s*", dependency_cell) if item.strip()
        ]
        features.append(Feature(code=code, title=title, dependencies=dependencies))

    if not features:
        raise ValueError("No features found in ## Feature Sequence table.")
    return features


def parse_sections(lines: list[str], heading_re: re.Pattern[str]) -> dict[str, Section]:
    starts: list[tuple[int, re.Match[str]]] = []
    for index, line in enumerate(lines):
        match = heading_re.match(line)
        if match:
            starts.append((index, match))

    sections: dict[str, Section] = {}
    for position, (start, match) in enumerate(starts):
        end = starts[position + 1][0] if position + 1 < len(starts) else len(lines)
        code = match.group(1)
        title = match.group(2).strip()
        sections[code] = Section(code=code, title=title, lines=lines[start + 1 : end])
    return sections


def code_block_after_label(lines: list[str], label_re: re.Pattern[str]) -> str | None:
    for index, line in enumerate(lines):
        if not label_re.fullmatch(line.strip()):
            continue
        for cursor in range(index + 1, len(lines)):
            value = lines[cursor].strip()
            if not value:
                continue
            if value.startswith("```"):
                block: list[str] = []
                for block_line in lines[cursor + 1 :]:
                    if block_line.strip().startswith("```"):
                        return "\n".join(block).strip()
                    block.append(block_line)
                return "\n".join(block).strip()
            return value
    return None


def line_value(lines: list[str], label: str) -> str | None:
    prefix = f"{label}:"
    for line in lines:
        stripped = line.strip()
        if stripped.startswith(prefix):
            return stripped[len(prefix) :].strip() or None
    return None


def list_after_label(lines: list[str], label: str) -> list[str]:
    prefix = f"{label}:"
    for index, line in enumerate(lines):
        if line.strip() != prefix:
            continue
        items: list[str] = []
        for candidate in lines[index + 1 :]:
            stripped = candidate.strip()
            if not stripped:
                if items:
                    break
                continue
            if not stripped.startswith("- "):
                break
            items.append(stripped[2:].strip())
        return items
    return []


def list_after_heading(lines: list[str], heading: str) -> list[str]:
    for index, line in enumerate(lines):
        if line.strip() != heading:
            continue
        items: list[str] = []
        for candidate in lines[index + 1 :]:
            stripped = candidate.strip()
            if not stripped:
                if items:
                    continue
                continue
            if stripped.startswith("## ") or stripped.startswith("### "):
                break
            if stripped.startswith("- "):
                items.append(stripped[2:].strip())
        return items
    return []


def lines_before_any_heading(lines: list[str], headings: Iterable[str]) -> list[str]:
    prefixes = tuple(headings)
    collected: list[str] = []
    for line in lines:
        if line.startswith(prefixes):
            break
        collected.append(line)
    return collected


def first_purpose_paragraph(lines: list[str]) -> str | None:
    try:
        start = next(index for index, line in enumerate(lines) if line.strip() == "## Purpose")
    except StopIteration:
        return None

    paragraph: list[str] = []
    for line in lines[start + 1 :]:
        stripped = line.strip()
        if stripped.startswith("## "):
            break
        if not stripped:
            if paragraph:
                text = " ".join(paragraph).strip()
                if not text.startswith("This document "):
                    return text
                paragraph = []
            continue
        if stripped.startswith("```"):
            continue
        paragraph.append(stripped)

    if paragraph:
        text = " ".join(paragraph).strip()
        if not text.startswith("This document "):
            return text
    return None


def extract_epic_title(lines: list[str], epic_code: str) -> str:
    code_number = epic_code.removeprefix("E")
    text = "\n".join(lines)
    exact = re.search(
        rf"`{re.escape(epic_code)}\s+-\s+([^`]+)`",
        text,
    )
    if exact:
        return f"Epic {code_number} - {exact.group(1).strip()}"

    for line in lines:
        match = re.fullmatch(
            rf"#\s+Epic\s+{re.escape(code_number)}\s+Feature Breakdown\s+-\s+(.+)",
            line.strip(),
        )
        if match:
            return f"Epic {code_number} - {match.group(1).strip()}"

    raise ValueError(f"Could not derive CSV epic title for {epic_code}.")


def inline_html(markdown: str) -> str:
    pieces = re.split(r"(`[^`]+`)", markdown)
    rendered: list[str] = []
    for piece in pieces:
        if piece.startswith("`") and piece.endswith("`"):
            rendered.append(f"<code>{html.escape(piece[1:-1])}</code>")
        else:
            rendered.append(html.escape(piece))
    return "".join(rendered)


def paragraph(text: str) -> str:
    return f"<p>{inline_html(text)}</p>"


def strong_paragraph(label: str, value: str | None = None) -> str:
    if value:
        return f"<p><strong>{html.escape(label)}:</strong> {inline_html(value)}</p>"
    return f"<p><strong>{html.escape(label)}:</strong></p>"


def unordered_list(items: Iterable[str]) -> str:
    return "<ul>" + "".join(f"<li>{inline_html(item)}</li>" for item in items) + "</ul>"


def pre_block(text: str) -> str:
    return f"<pre>{html.escape(text)}</pre>"


def markdown_blocks_to_html(lines: list[str]) -> str:
    blocks: list[str] = []
    index = 0

    while index < len(lines):
        stripped = lines[index].strip()
        if not stripped:
            index += 1
            continue

        if stripped.startswith("```"):
            block: list[str] = []
            index += 1
            while index < len(lines) and not lines[index].strip().startswith("```"):
                block.append(lines[index])
                index += 1
            if index < len(lines):
                index += 1
            blocks.append(pre_block("\n".join(block).strip()))
            continue

        if stripped.startswith("- "):
            items: list[str] = []
            while index < len(lines) and lines[index].strip().startswith("- "):
                items.append(lines[index].strip()[2:].strip())
                index += 1
            blocks.append(unordered_list(items))
            continue

        label = stripped[:-1] if stripped.endswith(":") else None
        if label in LABELS:
            blocks.append(strong_paragraph(label))
            index += 1
            continue

        paragraph_lines = [stripped]
        index += 1
        while index < len(lines):
            candidate = lines[index].strip()
            if (
                not candidate
                or candidate.startswith("- ")
                or candidate.startswith("```")
                or (candidate.endswith(":") and candidate[:-1] in LABELS)
            ):
                break
            paragraph_lines.append(candidate)
            index += 1
        blocks.append(paragraph(" ".join(paragraph_lines)))

    return "".join(blocks)


def epic_description(lines: list[str], epic_code: str) -> str:
    code_number = epic_code.removeprefix("E")
    epic_scope = lines_before_any_heading(lines, ("## Feature Sequence", "## Feature Definitions"))
    project_phase = line_value(epic_scope, "Project phase")
    planning_intent = line_value(epic_scope, "Planning intent")
    player_experience = list_after_label(epic_scope, "What the player can experience")
    prototype_estimate = line_value(epic_scope, "Prototype estimate")
    mvp_estimate = line_value(epic_scope, "MVP estimate")
    goal = code_block_after_label(lines, re.compile(rf"Epic\s+{re.escape(code_number)}\s+goal:"))
    exit_question = code_block_after_label(
        lines, re.compile(rf"Epic\s+{re.escape(code_number)}\s+exit question:")
    )
    summary = first_purpose_paragraph(lines)
    included = list_after_heading(lines, "### Included")
    not_included = list_after_heading(lines, "### Not Included")

    blocks: list[str] = []
    if project_phase:
        blocks.append(strong_paragraph("Project phase", project_phase))
    if planning_intent:
        blocks.append(strong_paragraph("Planning intent", planning_intent))
    if player_experience:
        blocks.append(strong_paragraph("What the player can experience"))
        blocks.append(unordered_list(player_experience))
    if prototype_estimate:
        blocks.append(strong_paragraph("Prototype estimate", prototype_estimate))
    if mvp_estimate:
        blocks.append(strong_paragraph("MVP estimate", mvp_estimate))
    if goal:
        blocks.append(strong_paragraph("Goal", goal))
    if exit_question:
        blocks.append(strong_paragraph("Exit question", exit_question))
    if summary:
        blocks.append(paragraph(summary))
    if included:
        blocks.append(strong_paragraph("Included"))
        blocks.append(unordered_list(included))
    if not_included:
        blocks.append(strong_paragraph("Not included"))
        blocks.append(unordered_list(not_included))
    return "".join(blocks)


def feature_description(section: Section) -> str:
    project_phase = line_value(section.lines, "Project phase")
    planning_intent = line_value(section.lines, "Planning intent")
    player_experience = list_after_label(section.lines, "What the player can experience")
    prototype_estimate = line_value(section.lines, "Prototype estimate")
    mvp_estimate = line_value(section.lines, "MVP estimate")
    goal = line_value(section.lines, "Goal")
    scope = list_after_label(section.lines, "Feature scope")
    done = list_after_label(section.lines, "Done when")
    exit_question = code_block_after_label(section.lines, re.compile(r"Exit question:"))

    blocks: list[str] = []
    if project_phase:
        blocks.append(strong_paragraph("Project phase", project_phase))
    if planning_intent:
        blocks.append(strong_paragraph("Planning intent", planning_intent))
    if player_experience:
        blocks.append(strong_paragraph("What the player can experience"))
        blocks.append(unordered_list(player_experience))
    if prototype_estimate:
        blocks.append(strong_paragraph("Prototype estimate", prototype_estimate))
    if mvp_estimate:
        blocks.append(strong_paragraph("MVP estimate", mvp_estimate))
    if goal:
        blocks.append(strong_paragraph("Goal", goal))
    if scope:
        blocks.append(strong_paragraph("Feature scope"))
        blocks.append(unordered_list(scope))
    if done:
        blocks.append(strong_paragraph("Done when"))
        blocks.append(unordered_list(done))
    if exit_question:
        blocks.append(strong_paragraph("Exit question"))
        blocks.append(pre_block(exit_question))
    return "".join(blocks)


def story_description(section: Section) -> str:
    return markdown_blocks_to_html(section.lines)


def parent_feature_code(story_code: str) -> str:
    parts = story_code.removeprefix("S").split(".")
    return "F" + ".".join(parts[:-1])


def build_rows(source_dir: Path, epic_code: str) -> list[list[str]]:
    feature_source = find_feature_source(source_dir, epic_code)
    feature_lines = read_lines(feature_source)
    features = parse_feature_sequence(feature_lines)
    feature_sections = parse_sections(feature_lines, FEATURE_HEADING_RE)

    rows = [["Work Item Type", "Title 1", "Title 2", "Title 3", "Description"]]
    rows.append(["Epic", extract_epic_title(feature_lines, epic_code), "", "", epic_description(feature_lines, epic_code)])

    for feature in features:
        section = feature_sections.get(feature.code)
        if not section:
            raise ValueError(f"Feature {feature.code} is in the sequence but has no section.")
        rows.append(["Feature", "", f"{feature.code} - {feature.title}", "", feature_description(section)])

        story_source = find_story_source(source_dir, feature.code)
        story_sections = parse_sections(read_lines(story_source), STORY_HEADING_RE)
        feature_stories = [
            story for story in story_sections.values() if parent_feature_code(story.code) == feature.code
        ]
        if not feature_stories:
            raise ValueError(f"No stories found for {feature.code} in {story_source}.")
        for story in feature_stories:
            rows.append(["User Story", "", "", f"{story.code} - {story.title}", story_description(story)])

    return rows


def write_rows(rows: list[list[str]], output: Path | None) -> None:
    if output is None:
        writer = csv.writer(sys.stdout, lineterminator="\n")
        writer.writerows(rows)
        return

    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerows(rows)


def main() -> int:
    config_parser = argparse.ArgumentParser(add_help=False)
    config_parser.add_argument(
        "--config",
        type=Path,
        help="Optional JSON target config with source defaults.",
    )
    config_args, _ = config_parser.parse_known_args()
    config = load_config(config_args.config)

    parser = argparse.ArgumentParser(
        parents=[config_parser],
        description="Generate a GitHub issue import CSV from Markdown planning docs."
    )
    parser.add_argument("epic_code", help="Epic code to generate, such as E3.5 or 3.5.")
    parser.add_argument(
        "--source-dir",
        type=Path,
        default=config_path_value(config, "source_dir", DEFAULT_SOURCE_DIR),
        help="Production-planning root.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="CSV output path. Defaults to existing CSV for the epic, or the next numbered artifact in the epic folder.",
    )
    parser.add_argument(
        "--stdout",
        action="store_true",
        help="Write CSV to stdout instead of a file.",
    )
    args = parser.parse_args()

    epic_code = normalize_epic_code(args.epic_code)
    feature_source = find_feature_source(args.source_dir, epic_code)
    output = None if args.stdout else args.output or default_output_path(feature_source, epic_code)

    rows = build_rows(args.source_dir, epic_code)
    write_rows(rows, output)
    if output is not None:
        print(f"Wrote {output} ({len(rows) - 1} work items).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
