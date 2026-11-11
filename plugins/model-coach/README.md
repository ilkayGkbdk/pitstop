# model-coach

Part of [pitstop](https://github.com/ilkayGkbdk/pitstop). This mod watches your model, effort and context use in Claude Code and
shows one-line tips above the prompt (English or Turkish) at the moment they matter. It covers 12 rules:
`/compact` before a costly `/model` switch, reasoning lost when you leave Fable, a lean main thread past 150K,
a bigger model instead of `max` effort, `model:` for your subagents, a Haiku Explore, opusplan, fallbacks,
a cold cache, rate limits, failing tool streaks and a compaction forecast. Each rule fires at most once per session.

```
/plugin install model-coach --marketplace ilkayGkbdk/pitstop
```

Commands: `/model-coach status | report | rules | mute <rule> | lang en|tr|auto | on | off`.
Thresholds: `hooks/config.ts`. Models and prices: `catalog.json`.

See the [main README](https://github.com/ilkayGkbdk/pitstop#readme) for the demo, the full rule list and how it works.
