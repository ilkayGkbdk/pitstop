# Contributing to pitstop

Thanks for stopping by. pitstop is small on purpose: every tip has to earn its place above
someone's prompt. Contributions of any size are welcome, and the most useful ones are:

- **A new language** for model-coach's tips (one table, see below)
- **A rule idea** from a moment where you wished Claude Code had told you something
- **Catalog updates** when Anthropic ships a model or changes a price
- **Bug reports** with what you saw and what you expected
- **A new mod** for the pitstop garage

If you're not sure whether something fits, open an issue or a discussion first. It saves you work.

## Setup

You need Claude Code (2.1.322 or later) and Node 22+ for the scripts.

```sh
git clone https://github.com/<you>/pitstop && cd pitstop
claude --plugin-dir ./plugins/model-coach     # loads your copy; hot-reloads on save
claude plugin test ./plugins/model-coach      # run before every PR
claude plugin validate ./plugins/model-coach
```

If you have the [`pitstop` marketplace installed](README.md#install), disable it while you
develop so the two copies don't both run.

## Layout

```
plugins/model-coach/
  catalog.json          models, families, list prices (the source of truth)
  hooks/register.tsx    wiring: events → rules → band, commands
  hooks/rules.ts        pure rule logic, no $ (easy to test)
  hooks/i18n.ts         every user-facing string, per language
  hooks/report.ts       /model-coach report
  hooks/config.ts       every threshold in one object
  hooks/catalog-data.ts generated from catalog.json (don't edit)
  tests/                claude plugin test runs these
scripts/                catalog build/update helpers
demo/                   vhs tapes for the README GIFs
```

## Add a language

1. In `hooks/i18n.ts`, add your code to `Lang`, copy the `tr` table, translate it, and add it to `TABLES` and `LANG_NAME`.
2. Teach `detectLang` your language (the `language` setting's spelling and the `LANG` prefix).
3. Add the code to the `language` option's `options` in `.claude-plugin/plugin.json`.
4. Run the type checker: it lists every string you missed. Run the tests.

Keep tips to one line. Translate the meaning, not the words: short and direct beats literal.

## Add a rule

A rule is a pure function in `hooks/rules.ts` that takes signals and returns a `Hint` (or `null`):

1. Add its id to `RuleId` in `types/index.d.ts` and to `ALL_RULES`.
2. Write the function, with any threshold in `config.ts`.
3. Add its message to **every** table in `i18n.ts`.
4. Call it from the right event in `register.tsx` through `fire(...)`. The cooldown and mutes are handled there.
5. Add tests in `tests/rules.test.ts`: when it fires, and when it stays quiet.

What makes a good rule:

- It reads a signal Claude Code really exposes. Check the mod API's types; never guess.
- It's actionable in one line, at the moment it shows.
- It stays quiet most of the time. A rule that fires every session will get muted.

## Update the catalog

Edit `plugins/model-coach/catalog.json`, then:

```sh
node scripts/build-catalog.mjs
```

Prices are **list prices in USD per million tokens** from Anthropic's pricing page. Link
your source in the PR. Every installed copy picks up a merged catalog within a day.

## Pull requests

- One topic per PR. Small PRs get reviewed fast.
- `claude plugin test` and `claude plugin validate` pass; CI checks the catalog is in sync.
- For a user-visible change, add a line to `CHANGELOG.md` and bump `version` in `plugin.json`.
- Commit messages: `feat(model-coach): …`, `fix: …`, `docs: …`, `catalog: …`.
- Don't commit secrets, `.claude-plugin/types/`, or recordings that show personal data
  (usage %, account names, paths outside the repo).

## Code of conduct

Be kind and assume good intent. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
