## What and why

<!-- One or two lines. Link the issue if there is one: Closes #123 -->

## Checklist

- [ ] `claude plugin test ./plugins/model-coach` passes
- [ ] `claude plugin validate ./plugins/model-coach` passes
- [ ] New strings are in **every** language table in `hooks/i18n.ts`
- [ ] `catalog.json` changed → ran `node scripts/build-catalog.mjs` and linked the price source
- [ ] User-visible change → `CHANGELOG.md` line and `version` bump in `plugin.json`
