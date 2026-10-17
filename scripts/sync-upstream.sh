#!/usr/bin/env bash
set -euo pipefail

# Maintainer script. Re-applies the mechanical renames that separate this fork
# from mattpocock/skills, so upstream changes can be pulled in and diffed.
#
# Usage:
#   scripts/sync-upstream.sh renames
#       Apply the renames to every file under skills/ (idempotent).
#   scripts/sync-upstream.sh diff <path-to-upstream-clone>
#       Show what changed upstream in the forked skills since the recorded base
#       commit (see CREDITS.md). Review, then hand-merge into skills/.
#
# Semantic edits to forked skills are NOT re-applied by this script. CREDITS.md
# lists which forks are modified; merge those by hand.

REPO="$(cd "$(dirname "$0")/.." && pwd)"
BASE_COMMIT="49dd158d1076134a641b33efb035946536778336"

# upstream path (relative to its skills/) -> path here (relative to skills/)
FORKS=(
  "engineering/codebase-design:engineering/codebase-design"
  "engineering/domain-modeling:engineering/domain-modeling"
  "engineering/grill-with-docs:engineering/grill-with-docs"
  "engineering/to-spec:engineering/to-spec"
  "engineering/to-tickets:engineering/to-tickets"
  "engineering/implement:engineering/implement"
  "engineering/implement-spec:engineering/implement-spec"
  "engineering/wayfinder:engineering/wayfinder"
  "engineering/tdd:engineering/tdd"
  "engineering/diagnosing-bugs:engineering/diagnosing-bugs"
  "engineering/triage:engineering/triage"
  "engineering/pr:engineering/pr"
  "engineering/prototype:engineering/prototype"
  "engineering/research:engineering/research"
  "engineering/wizard:engineering/wizard"
  "engineering/code-review:engineering/review-changes"
  "engineering/improve-codebase-architecture:audits/improve-codebase-architecture"
  "engineering/setup-matt-pocock-skills:setup/setup-standards"
  "productivity/grilling:productivity/grilling"
  "productivity/grill-me:productivity/grill-me"
  "productivity/handoff:productivity/handoff"
  "productivity/writing-for-agents:productivity/writing-for-agents"
)

apply_renames() {
  local file
  while IFS= read -r -d '' file; do
    # BSD and GNU sed disagree on -i; write through a temp file instead.
    sed \
      -e 's#setup-matt-pocock-skills#setup-standards#g' \
      -e "s#Setup Matt Pocock's Skills#Setup Standards#g" \
      -e 's#Setup Matt Pocock Skills#Setup Standards#g' \
      -e 's#"code-review"#"review-changes"#g' \
      -e 's#`code-review`#`review-changes`#g' \
      -e 's#^name: code-review$#name: review-changes#' \
      -e 's#display_name: "Code Review"#display_name: "Review Changes"#' \
      -e 's#Label in mattpocock/skills#Canonical role#g' \
      "$file" > "$file.tmp"
    if cmp -s "$file" "$file.tmp"; then
      rm "$file.tmp"
    else
      mv "$file.tmp" "$file"
      echo "renamed in ${file#"$REPO"/}"
    fi
  done < <(find "$REPO/skills" -type f \( -name '*.md' -o -name '*.yaml' \) -print0)
}

show_diff() {
  local upstream="$1"
  if [ ! -d "$upstream/.git" ]; then
    echo "error: $upstream is not a git clone of mattpocock/skills" >&2
    exit 1
  fi
  local pair from to
  for pair in "${FORKS[@]}"; do
    from="${pair%%:*}"
    to="${pair##*:}"
    echo "=== $from -> skills/$to"
    git -C "$upstream" --no-pager diff --stat "$BASE_COMMIT" HEAD -- "skills/$from" || true
  done
}

case "${1:-}" in
  renames) apply_renames ;;
  diff)
    if [ -z "${2:-}" ]; then
      echo "usage: $0 diff <path-to-upstream-clone>" >&2
      exit 1
    fi
    show_diff "$2"
    ;;
  *)
    echo "usage: $0 renames | diff <path-to-upstream-clone>" >&2
    exit 1
    ;;
esac
