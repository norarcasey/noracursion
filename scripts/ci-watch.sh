#!/usr/bin/env bash
# Watch the latest CI run for the current branch (defaults to a 4s wait first so
# the run has registered after a push) and print its final conclusion. Read-only
# `gh` calls — see `npm run ci:watch`. Pass a different initial delay as $1.
sleep "${1:-4}"

branch="$(git branch --show-current 2>/dev/null || echo main)"
id="$(gh run list --branch "$branch" --limit 1 --json databaseId --jq '.[0].databaseId')"
if [ -z "$id" ]; then
  echo "No CI run found for branch '$branch'."
  exit 1
fi

gh run watch "$id" --exit-status
status=$?

gh run list --branch "$branch" --limit 1 --json conclusion,displayTitle --jq '.[0]'
exit "$status"
