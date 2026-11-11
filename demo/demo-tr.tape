# Records demo/demo-tr.gif. Run from the repo root: vhs demo/demo-tr.tape
# `/model` saves the default model to ~/.claude/settings.json, so the tape
# backs that file up first and puts it back at the end.
Output demo/demo-tr.gif
Set Shell zsh
Set FontSize 16
Set Width 1300
Set Height 720
Set Padding 24
Set TypingSpeed 60ms
Hide
Type "cp ~/.claude/settings.json ~/.claude/settings.json.pitstop-demo && clear && demo/run.sh tr" Enter
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
Type "/model-coach rules"
Sleep 500ms
Enter
Sleep 5s
Hide
Ctrl+C
Ctrl+C
Sleep 2s
Type "mv ~/.claude/settings.json.pitstop-demo ~/.claude/settings.json" Enter
Sleep 500ms
