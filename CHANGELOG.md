# Changelog

## model-coach 0.2.0

- **English and Turkish** tips, status and report. `auto` follows Claude Code's `language` setting, then `LANG`. Switch with `/model-coach lang en|tr|auto` or the `language` option.
- **Model catalog** (`catalog.json`): families, current models and list prices out of the code. Refreshed from the repository at most once a day (`remoteCatalog` option). A weekly GitHub Action opens a PR for new models.
- **New rules:** cold cache (switching is free right now), rate-limit window ≥ 80%, 3 failing tool calls in a row (escalation ladder), compaction forecast.
- **Pit report** (`/model-coach report`): token use and estimated cost per model, cache hit rate, what the subagents would cost on Haiku.
- **Mute** any rule across sessions (`/model-coach mute <rule>`); `/model-coach rules` lists them all.
- Options: `language`, `remoteCatalog`, `injectRouting`.

## model-coach 0.1.1

- The band shows the newest tip; older ones wait as `(+n)`.
- README, icon, demo GIF.

## model-coach 0.1.0

- First release: 8 deterministic tips, layer-2 routing rules, `/model-coach on|off|status`.
