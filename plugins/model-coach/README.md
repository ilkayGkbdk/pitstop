# 🏁 pitstop

Claude Code mods that help you pick the right model, at the right moment.

The first mod, **model-coach**, watches your model, effort and context usage and shows a
one-line tip above the prompt exactly when it matters (tips are in Turkish for now).
It's based on Anthropic's guide
[Which Claude model should you build with?](https://claude.dev/blog/which-claude-model-should-you-build-with/).

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install model-coach --marketplace ilkayGkbdk/pitstop
```

Answer `y` to add the marketplace, then pick a scope (user scope = every session).

From a shell: `claude plugin install model-coach --marketplace ilkayGkbdk/pitstop`

## model-coach

### Layer 1: deterministic tips (band above the prompt)

| Signal | Tip |
| --- | --- |
| `/model` switch with context > 50K | Run `/compact` first, since the new model pays cache-write for the whole history (shows the estimated $) |
| Fable → a lower model | Earlier thinking/reasoning will be dropped |
| Context > 150K | Keep the main context lean and hand log/file reading to a Haiku subagent |
| Effort > `high` | Try the next model up at lower effort instead |
| `.claude/agents/*.md` without `model:` | Add `model: haiku` or `sonnet`, or set `CLAUDE_CODE_SUBAGENT_MODEL` |
| `Explore` runs on the session model | Define your own Explore with `model: haiku` |
| `opusplan` active | Code edits run on Sonnet, so measure it on your own work |
| Automatic fallback to another model | Shows which model it fell back to |

Each rule fires **at most once per session** (cooldown; `/clear` resets it).

### Layer 2: routing rules for the model

A short system-prompt section tells Claude to open a reply with a single
`🏁 pitstop: …` line when the kind of work clearly changes (Haiku for extraction and
search, Sonnet for well-scoped fixes, Opus medium for everyday engineering, Fable for
big refactors and orchestration), plus the escalation order: verification path → more
effort → bigger model at lower effort.

### Command

```
/model-coach on | off | status
```

`status` shows the current model, effort, context, the rules that have fired and the thresholds.

### Config

Every threshold lives in [`plugins/model-coach/hooks/config.ts`](plugins/model-coach/hooks/config.ts).

## Develop

```sh
claude --plugin-dir ./plugins/model-coach      # load from disk, hot-reloads on save
claude plugin validate ./plugins/model-coach
claude plugin test ./plugins/model-coach
```

## License

MIT
