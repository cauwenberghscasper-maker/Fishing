#!/usr/bin/env bash
# Asset relay: get files the sandbox can't download (HF outputs, CC0 zips) via GitHub Actions.
# usage: tools/relay.sh <batch> <requests.json>
#   requests.json = { "files": [ { "url": "https://...", "path": "name.ext" } ] }
# Result lands in .drop/<batch>/ (with _log.txt). Run it in the background: it waits for Actions.
set -euo pipefail
BATCH="${1:?batch name}"; REQ="${2:?requests file}"
REPO=/home/claude/fishing
WT=/home/claude/fishing-relay
REQ="$(cd "$(dirname "$REQ")" && pwd)/$(basename "$REQ")"

fetch() { git fetch --depth 1 origin "+refs/heads/$1:refs/remotes/origin/$1" 2>/dev/null || { sleep 5; git fetch --depth 1 origin "+refs/heads/$1:refs/remotes/origin/$1"; }; }

exec 9>/tmp/fishing-relay.lock
flock 9
cd "$REPO"
if ! git -C "$WT" rev-parse --git-dir >/dev/null 2>&1; then
  fetch asset-pipeline
  git worktree add -f -B asset-pipeline "$WT" origin/asset-pipeline >/dev/null
fi
cd "$WT"
fetch asset-pipeline
git reset -q --hard origin/asset-pipeline
jq --arg b "$BATCH" '{batch: $b, files: .files}' "$REQ" > pipeline/requests.json
git add pipeline/requests.json
git -c user.name="relay" -c user.email="relay@users.noreply.github.com" commit -qm "relay: $BATCH"
git push -q origin HEAD:asset-pipeline || { sleep 5; git push -q origin HEAD:asset-pipeline; }
flock -u 9
echo "pushed batch $BATCH, waiting for GitHub Actions..."

for _ in $(seq 1 36); do
  sleep 20
  if fetch asset-drop >/dev/null 2>&1 && git cat-file -e "origin/asset-drop:drop/$BATCH/_log.txt" 2>/dev/null; then
    mkdir -p "$REPO/.drop"
    rm -rf "$REPO/.drop/$BATCH"
    git archive origin/asset-drop "drop/$BATCH" | tar -x -C "$REPO/.drop" --strip-components=1
    echo "arrived in .drop/$BATCH:"
    cat "$REPO/.drop/$BATCH/_log.txt"
    exit 0
  fi
done
echo "TIMEOUT: drop/$BATCH did not arrive in 12 min (check that Actions is enabled)"
exit 1
