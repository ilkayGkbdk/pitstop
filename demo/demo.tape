# Records demo/demo.gif. Run from the repo root: vhs demo/demo.tape
# `/model` saves the default model to ~/.claude/settings.json, so the tape
# backs that file up first and puts it back at the end.
Output demo/demo.gif
Set Shell zsh
Set FontSize 16
Set Width 1300
Set Height 720
Set Padding 24
Set TypingSpeed 60ms
Hide
Type "cp ~/.claude/settings.json ~/.claude/settings.json.pitstop-demo && cd demo/project && unset CLAUDE_CODE_CHILD_SESSION && clear && claude --plugin-dir ../../plugins/model-coach --model claude-fable-5-2" Enter
Sleep 6s
# trust the folder, skip any project MCP prompt
Down
Enter
Sleep 4s
Enter
# wait out the engine's own startup notices
Sleep 16s
Show
Sleep 3s
Type "/model sonnet"
Sleep 500ms
Enter
Sleep 4s
Type "/model-coach status"
Sleep 500ms
Enter
Sleep 5s
Hide
Ctrl+C
Ctrl+C
Sleep 2s
Type "mv ~/.claude/settings.json.pitstop-demo ~/.claude/settings.json" Enter
Sleep 500ms
