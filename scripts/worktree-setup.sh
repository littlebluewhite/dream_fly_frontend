#!/bin/sh
# Prepare a fresh worktree: copy the main checkout's lockfile and node_modules
# (APFS clone, near-instant). A node_modules symlink breaks vitest, whose
# server.fs.strict rejects files outside the worktree. Run from the worktree root.
set -e
main=$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")
cp "$main/package-lock.json" .
cp -cR "$main/node_modules" .
