---
title: GitHub Issue Import Workflow
game: repo
doc_type: process
status: active
canonicality: working_direction
owner: TBD
departments:
  - Production
  - Engineering
tags:
  - process
  - github
  - issue-import
  - planning
updated: 2026-06-08
related_docs:
  - prototype-vs-mvp-planning.md
  - design-decomposition-workflow.md
related_issues: []
attention:
  status: clear
  needs: none
  summary: Reusable repo-level process for turning design planning docs into GitHub issues.
---
# GitHub Issue Import Workflow

## Purpose

This process turns design-repo planning docs into GitHub issues and, when a GitHub Project is available, adds those issues to the project.

Use it for any game design in this repository after the work has been classified as `Prototype Discovery`, `MVP Implementation`, or `Production Architecture`.

Markdown remains the planning source of truth. GitHub issues are the execution mirror.

For the upstream process that creates the required epic, feature, and story docs, use [Design Decomposition Workflow](design-decomposition-workflow.md).

## Required Inputs

Each design needs:

- a GitHub implementation repository, such as `ThirdWatchStudios/Voidwake`
- optionally, a GitHub Project owner and project number
- a source planning folder in this repo
- a completed decomposition pass
- an epic feature breakdown using stable planning codes
- per-feature story specs using stable planning codes
- a generated GitHub issue import CSV

The existing import tools expect durable planning codes:

```text
E1
F1.1
P0.0
S1.1.1
```

## Recommended Target Config

Create one JSON target config per design once the GitHub repository and project target are known.

Example:

```json
{
  "source_dir": "the-water-cooler/docs/production-planning",
  "source_prefix": "the-water-cooler/docs/production-planning",
  "roadmap_source": "the-water-cooler/docs/production-planning/00-roadmap/current-vertical-slice.md",
  "repo": "ThirdWatchStudios/the-water-cooler",
  "project_owner": "ThirdWatchStudios",
  "project_number": 4,
  "scope_label": "prototype"
}
```

Field meanings:

- `source_dir`: local folder the tools scan for feature and story docs.
- `source_prefix`: source path written into GitHub issue bodies.
- `roadmap_source`: source spec used for the epic issue body.
- `repo`: target GitHub issue repository.
- `project_owner`: GitHub Project owner.
- `project_number`: GitHub Project number.
- `scope_label`: top-level issue label, usually `prototype`, `mvp`, or a project-specific equivalent.

If a GitHub Project is not available yet, keep the config's repository values accurate and use `--skip-project` during execution.

## Generate CSV

Generate or refresh the CSV from Markdown source docs:

```bash
python3 tools/planning/generate_github_issue_import_csv.py \
  --config DESIGN_IMPORT_CONFIG.json \
  E1
```

The generator scans the configured `source_dir` recursively for:

- `*-epic-XX-*-features.md`
- `*-fX-X-*-stories.md`

Existing CSV files are regenerated in place. New CSV files use `github-issue-import.csv`.

## Dry Run

Review the import plan before touching GitHub:

```bash
python3 tools/planning/plan_github_issue_import.py \
  --config DESIGN_IMPORT_CONFIG.json \
  --csv PATH_TO_IMPORT.csv
```

For machine-readable review:

```bash
python3 tools/planning/plan_github_issue_import.py \
  --config DESIGN_IMPORT_CONFIG.json \
  --csv PATH_TO_IMPORT.csv \
  --format json
```

## Inventory

Compare planned issues to existing GitHub issues:

```bash
python3 tools/planning/plan_github_issue_import.py \
  --config DESIGN_IMPORT_CONFIG.json \
  --csv PATH_TO_IMPORT.csv \
  --inventory
```

The inventory reports:

- planned issues
- existing planned issues
- missing planned issues
- label drift
- extra existing issues with the same epic label

## Execute

Only execute after reviewing the dry run and inventory.

Create missing issues, add them to the configured GitHub Project, and sync hierarchy/dependency links:

```bash
python3 tools/planning/plan_github_issue_import.py \
  --config DESIGN_IMPORT_CONFIG.json \
  --csv PATH_TO_IMPORT.csv \
  --execute \
  --issue-map /tmp/design-issue-map.json
```

If the GitHub Project is unavailable or GraphQL quota is low:

```bash
python3 tools/planning/plan_github_issue_import.py \
  --config DESIGN_IMPORT_CONFIG.json \
  --csv PATH_TO_IMPORT.csv \
  --execute \
  --skip-project \
  --issue-map /tmp/design-issue-map.json
```

If issues already exist and only relationships or bodies need repair:

```bash
python3 tools/planning/plan_github_issue_import.py \
  --config DESIGN_IMPORT_CONFIG.json \
  --csv PATH_TO_IMPORT.csv \
  --execute \
  --links-only \
  --sync-existing-bodies \
  --issue-map /tmp/design-reconcile-map.json
```

For multi-CSV imports, run a final `--links-only` reconciliation after every CSV has been imported. This catches:

- parent-child links skipped because a just-created issue was not yet visible in GitHub API reads
- dependency links to issues that were created by later CSVs

For relationship-only repair without body replacement, omit `--sync-existing-bodies`.

## Post-Import Checks

After import:

- confirm every issue has the expected scope, planning, source, kind, and epic labels
- confirm all imported issues were added to the intended GitHub Project when project insertion was enabled
- confirm epic issues have feature sub-issues
- confirm feature issues have story sub-issues
- confirm dependency links exist as GitHub relationships, not only body text
- spot-check one epic, one feature, and one story against the Markdown source

If the issue body is wrong, update the Markdown source and regenerate/sync. Do not hand-edit GitHub as the source of truth.
