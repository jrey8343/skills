#!/usr/bin/env bash
set -euo pipefail

# Dev install: symlink every skill in this repo into the local harness skill
# directories, so edits here are live and `git pull` keeps them current.
#   - ~/.claude/skills  Claude Code
#   - ~/.agents/skills  Codex and other Agent Skills-compatible harnesses
#
# Usage: scripts/link-skills.sh [--unlink]
#
# Safety: an existing entry that is NOT a symlink into this repo is left alone
# and reported, never deleted. Resolve those by hand.

REPO="$(cd "$(dirname "$0")/.." && pwd)"
DESTS=("$HOME/.claude/skills" "$HOME/.agents/skills")
MODE="${1:-link}"

names=()
srcs=()
while IFS= read -r -d '' skill_md; do
  src="$(dirname "$skill_md")"
  names+=("$(basename "$src")")
  srcs+=("$src")
done < <(find "$REPO/skills" -name SKILL.md -not -path '*/node_modules/*' -print0)

conflicts=0
for DEST in "${DESTS[@]}"; do
  if [ -L "$DEST" ]; then
    resolved="$(readlink -f "$DEST")"
    case "$resolved" in
      "$REPO"|"$REPO"/*)
        echo "error: $DEST is a symlink into this repo ($resolved). Remove it and re-run." >&2
        exit 1
        ;;
    esac
  fi
  mkdir -p "$DEST"

  for i in "${!names[@]}"; do
    name="${names[$i]}"
    src="${srcs[$i]}"
    target="$DEST/$name"

    if [ -e "$target" ] && [ ! -L "$target" ]; then
      echo "skip $target: exists and is not a symlink (installed by something else?)" >&2
      conflicts=$((conflicts + 1))
      continue
    fi
    if [ -L "$target" ]; then
      case "$(readlink "$target")" in
        "$REPO"/*) ;;
        *)
          echo "skip $target: symlink points outside this repo" >&2
          conflicts=$((conflicts + 1))
          continue
          ;;
      esac
    fi

    if [ "$MODE" = "--unlink" ]; then
      if [ -L "$target" ]; then
        rm "$target"
        echo "unlinked $name ($DEST)"
      fi
    else
      ln -sfn "$src" "$target"
      echo "linked $name ($DEST)"
    fi
  done
done

if [ "$conflicts" -gt 0 ]; then
  echo "$conflicts conflicting entr(y/ies) left untouched." >&2
  exit 2
fi
