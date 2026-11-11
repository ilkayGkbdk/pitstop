#!/bin/sh
# Starts the demo session from this repo: model-coach loaded, tips in $1 (en|tr),
# model $2 (default claude-fable-5-2). Only project settings load, and no CLAUDE.md,
# so nothing from your own setup (plugins, memory, status line) shows up on screen.
cd "$(dirname "$0")/project" || exit 1
unset CLAUDE_CODE_CHILD_SESSION
export CLAUDE_CODE_DISABLE_CLAUDE_MDS=1 CLAUDE_CODE_DISABLE_AUTO_MEMORY=1
opts="{\"pluginConfigs\":{\"model-coach@inline\":{\"options\":{\"language\":\"$1\",\"remoteCatalog\":false}}}}"
rules="In this session: read files only with the Read tool, one file per call. Run a script only as exactly the command asked for, one Bash call per run, one run at a time; never loops, pipes or other commands."
exec claude --setting-sources project --strict-mcp-config --settings "$opts" \
  --permission-mode dontAsk --allowedTools "Read" "Bash(./check.sh)" \
  --append-system-prompt "$rules" \
  --plugin-dir ../../plugins/model-coach --model "${2:-claude-fable-5-2}"
