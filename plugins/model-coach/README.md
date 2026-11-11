# model-coach

Part of [pitstop](https://github.com/ilkayGkbdk/pitstop). This mod watches your model, effort and context use in Claude Code and
shows one-line tips above the prompt at the moment they matter: `/compact` before a costly
`/model` switch, reasoning lost when you leave Fable, a lean main thread past 150K, a bigger
model instead of `max` effort, `model:` for your subagents, a Haiku Explore, opusplan, and
fallbacks. Each rule fires at most once per session.

```
/plugin install model-coach --marketplace ilkayGkbdk/pitstop
```

Command: `/model-coach on | off | status`. Thresholds: `hooks/config.ts`.

See the [main README](https://github.com/ilkayGkbdk/pitstop#readme) for the demo, the full rule list and how it works.
