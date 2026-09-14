#!/usr/bin/env bash
set -euo pipefail

repo_root="${1:-.}"
dest="$repo_root/docs/plans/ai-content-editor-v2"
source_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ ! -d "$dest" ]]; then
  echo "Missing dossier directory: $dest" >&2
  exit 1
fi

cp "$source_dir/README.md" "$dest/README.md"
for src in "$source_dir"/[0-9][0-9]-*.md; do
  cp "$src" "$dest/$(basename "$src")"
done
cp "$source_dir/architecture-baseline.json" "$dest/architecture-baseline.json"

mkdir -p "$dest/tasks"
for src in "$source_dir"/tasks/*.md; do
  cp "$src" "$dest/tasks/$(basename "$src")"
done

echo "Applied complete BemTeVi AI Content Editor V2 Revision 8 dossier to $dest"
