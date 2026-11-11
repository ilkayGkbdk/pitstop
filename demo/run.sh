#!/bin/sh
# Starts the demo session: model-coach loaded from this repo, tips in $1 (en|tr).
cd "$(dirname "$0")/project" || exit 1
unset CLAUDE_CODE_CHILD_SESSION
opts="{\"pluginConfigs\":{\"model-coach@inline\":{\"options\":{\"language\":\"$1\",\"remoteCatalog\":false}}}}"
exec claude --settings "$opts" --plugin-dir ../../plugins/model-coach --model claude-fable-5-2
