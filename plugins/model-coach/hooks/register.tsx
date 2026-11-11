import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Hint, RuleId } from '../types'
import { type Catalog, parseCatalog } from './catalog'
import { BUNDLED_CATALOG } from './catalog-data'
import { CONFIG } from './config'
import { detectLang, type Lang, t } from './i18n'
import { addUsage, EMPTY_LEDGER, renderReport } from './report'
import {
  ALL_RULES,
  fallbackHint,
  fresh,
  kTokens,
  onAgentFiles,
  onContext,
  onEffort,
  onErrorStreak,
  onExploreSpawn,
  onGrowth,
  onIdle,
  onModelSwitch,
  onOpusplan,
  onRateLimits,
  onStepModel,
  routingRules,
} from './rules'

const P = 'model-coach'
const queue = atom({ plugin: 'model-coach', key: 'queue' } as const, [])
const fired = atom({ plugin: 'model-coach', key: 'fired' } as const, [])
const isEnabled = atom({ plugin: 'model-coach', key: 'isEnabled' } as const, true)
const langAtom = atom({ plugin: 'model-coach', key: 'lang' } as const, 'en')
const muted = atom({ plugin: 'model-coach', key: 'muted' } as const, [])
const ledger = atom({ plugin: 'model-coach', key: 'ledger' } as const, EMPTY_LEDGER)

const asLang = (s: string): Lang => (s === 'tr' ? 'tr' : 'en')

async function readAgentFiles($: EngineInterface) {
  const home = await $.env.get('HOME')
  const root = await $.session.root()
  const files: { name: string; text: string }[] = []
  for (const base of [root, ...(home ? [home] : [])]) {
    for (const rel of CONFIG.agentDirs) {
      const dir = `${base}/${rel}`
      if (!(await $.fs.exists(dir))) continue
      for (const entry of await $.fs.list(dir)) {
        if (entry.kind !== 'file' || !entry.name.endsWith('.md')) continue
        files.push({ name: entry.name.replace(/\.md$/, ''), text: await $.fs.read(`${dir}/${entry.name}`) })
      }
    }
  }
  return files
}

/** Module state: what a reload may lose without harm (register resets it). */
const S = {
  languageOption: 'auto',
  isRemoteCatalog: true,
  isRoutingOn: true,
  catalog: BUNDLED_CATALOG as Catalog,
  catalogFrom: 'bundled',
  lastEffort: undefined as string | number | undefined,
  lastTurnEnd: 0,
  isTurnRunning: false,
  contextTokens: undefined as number | undefined,
  cacheTtlMs: CONFIG.cacheTtlMs as number,
  streak: 0,
  growth: [] as number[],
}

async function fire($: EngineInterface, hints: (Hint | null)[]) {
  if (!(await read($, isEnabled))) return
  const list = fresh(hints, await read($, fired), await read($, muted))
  if (list.length === 0) return
  await update($, fired, f => [...new Set([...f, ...list.map(h => h.rule)])])
  await update($, queue, q => {
    const rules = new Set(q.map(h => h.rule))
    return [...q, ...list.filter(h => !rules.has(h.rule))].slice(-CONFIG.maxQueued)
  })
}

async function resolveLang($: EngineInterface): Promise<Lang> {
  const stored = await $.store.get('lang')
  const choice = typeof stored === 'string' ? stored : S.languageOption
  return detectLang(choice, await $.settings.read({ key: 'language' }), await $.env.get('LANG'))
}

/** The catalog from the repository, at most once a day; the bundled copy otherwise. */
async function loadCatalog($: EngineInterface) {
  const cached = (await $.store.get('catalog')) as { fetchedAt?: number; catalog?: unknown } | undefined
  const fromStore = parseCatalog(cached?.catalog)
  if (fromStore && fromStore.asOf >= BUNDLED_CATALOG.asOf) {
    S.catalog = fromStore
    S.catalogFrom = `remote ${fromStore.asOf}`
  }
  if (!S.isRemoteCatalog) return
  const now = await $.clock.now()
  if (cached?.fetchedAt && now - cached.fetchedAt < CONFIG.catalogMaxAgeMs) return
  const res = await $.http.fetch(CONFIG.catalogUrl)
  const fetched = res.ok ? parseCatalog(JSON.parse(res.text)) : null
  if (!fetched) return
  await $.store.set('catalog', { fetchedAt: now, catalog: fetched })
  if (fetched.asOf >= BUNDLED_CATALOG.asOf) {
    S.catalog = fetched
    S.catalogFrom = `remote ${fetched.asOf}`
  }
}

async function idleCheck($: EngineInterface) {
  if (S.isTurnRunning || S.lastTurnEnd === 0) return
  const idle = (await $.clock.now()) - S.lastTurnEnd
  await fire($, [onIdle(idle, S.contextTokens, S.cacheTtlMs)])
}

export const register: Register = (on, options) => {
  S.languageOption = typeof options.language === 'string' ? options.language : 'auto'
  S.isRemoteCatalog = options.remoteCatalog !== false
  S.isRoutingOn = options.injectRouting !== false
  S.catalog = BUNDLED_CATALOG
  S.catalogFrom = 'bundled'
  S.growth = []
  S.streak = 0

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: P,
      description: 'model-coach: on | off | status | report | rules | mute | unmute | lang',
      argumentHint: 'status|report|rules|mute <rule>|lang en|tr|auto',
    })
    const stored = await $.store.get('enabled')
    await update($, isEnabled, () => stored !== false)
    const storedMuted = await $.store.get('muted')
    await update($, muted, () => (Array.isArray(storedMuted) ? (storedMuted as RuleId[]) : []))
    const lang = await resolveLang($)
    await update($, langAtom, () => lang)
    await loadCatalog($).catch(() => undefined)

    const settingsModel = await $.settings.read({ key: 'model' })
    await fire($, [
      onOpusplan(typeof settingsModel === 'string' ? settingsModel : await $.session.model()),
      onAgentFiles(await readAgentFiles($).catch(() => []), await $.env.get('CLAUDE_CODE_SUBAGENT_MODEL')),
    ])

    // Idle check for the cold-cache tip; runs until the module reloads.
    $.clock.every(CONFIG.idleCheckMs, () => {
      void idleCheck($).catch(() => undefined)
    })
    return next(e)
  })

  // A /clear starts a new conversation: the cooldown and the counters start over.
  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      await update($, fired, () => [])
      await update($, queue, () => [])
      await update($, ledger, () => EMPTY_LEDGER)
      S.growth.length = 0
      S.streak = 0
      S.lastTurnEnd = 0
    }
    return next(e)
  })

  on('classic.PreModelSwitch', async ($, e, next) => {
    S.cacheTtlMs = e.cache_ttl === '1h' ? 60 * 60_000 : 5 * 60_000
    await fire($, [
      ...onModelSwitch(
        { from: e.from_model, to: e.to_model, contextTokens: e.context_tokens, estimatedCacheWriteUsd: e.estimated_cache_write_usd },
        S.catalog,
      ),
      onOpusplan(e.requested_model),
    ])
    return next(e)
  }).catch(($, e, next) => next(e))

  on('classic.PostModelSwitch', async ($, e, next) => {
    if (e.source === 'auto') await fire($, [fallbackHint(e.from_model, e.to_model)])
    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) S.isTurnRunning = true
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    if (e.agentId === undefined) {
      S.lastEffort = e.effort
      await fire($, [onEffort(e.effort), onStepModel(e.model, await $.session.model(), S.catalog)])
    }
    return yield* next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const isMain = e.agentId === undefined
    if (e.usage) {
      const u = e.usage
      await update($, ledger, l => addUsage(l, u, !isMain))
    }
    if (isMain) {
      S.isTurnRunning = false
      S.lastTurnEnd = await $.clock.now()
      const usage = await $.session.usage()
      S.contextTokens = usage.context.tokens
      if (S.contextTokens !== undefined) S.growth.push(S.contextTokens)
      if (S.growth.length > 10) S.growth.shift()
      await fire($, [
        onContext(S.contextTokens),
        onGrowth(S.growth, usage.context.window),
        onRateLimits(usage.rateLimits, await $.session.model(), S.catalog),
      ])
    }
    return next(e)
  })

  // Failing tool calls in a row on the main loop → the escalation ladder.
  on('tool.call', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined && result.deny === undefined) {
      S.streak = result.isError ? S.streak + 1 : 0
      if (result.isError) await fire($, [onErrorStreak(S.streak)])
    }
    return result
  }).catch(($, e, next) => next(e))

  on('agent.spawn', async ($, e, next) => {
    const result = await next(e)
    if (e.subagentType === 'Explore' && result.deny === undefined) {
      await fire($, [onExploreSpawn(result.model, e.parentModel, S.catalog)])
    }
    return result
  }).catch(($, e, next) => next(e))

  // Layer 2: the routing rules ride the system prompt as a session section.
  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    if (!S.isRoutingOn || !(await read($, isEnabled))) return composed
    const text = routingRules(S.catalog, asLang(await read($, langAtom)))
    return { sections: [...composed.sections, { id: `${P}:routing`, text, scope: 'session' as const }] }
  })

  on('command.run', { command: P }, async ($, e) => {
    const lang = asLang(await read($, langAtom))
    const [verb = 'status', arg = ''] = e.args.trim().toLowerCase().split(/\s+/).filter(Boolean)

    if (verb === 'on' || verb === 'off') {
      const value = verb === 'on'
      await $.store.set('enabled', value)
      await update($, isEnabled, () => value)
      if (!value) await update($, queue, () => [])
      return { text: t(lang, value ? 'ui.on' : 'ui.off') }
    }

    if (verb === 'mute' || verb === 'unmute') {
      const rule = ALL_RULES.find(r => r === arg)
      if (!rule) return { text: t(lang, 'ui.unknownRule', { rule: arg, list: ALL_RULES.join(', ') }) }
      const now = await read($, muted)
      const nextList = verb === 'mute' ? [...new Set([...now, rule])] : now.filter(r => r !== rule)
      await $.store.set('muted', nextList)
      await update($, muted, () => nextList)
      if (verb === 'mute') await update($, queue, q => q.filter(h => h.rule !== rule))
      return { text: t(lang, verb === 'mute' ? 'ui.muteOk' : 'ui.unmuteOk', { rule }) }
    }

    if (verb === 'lang') {
      if (arg !== 'en' && arg !== 'tr' && arg !== 'auto') return { text: t(lang, 'ui.usage') }
      await $.store.set('lang', arg)
      const resolved = await resolveLang($)
      await update($, langAtom, () => resolved)
      return { text: t(resolved, 'ui.lang', { lang: arg === 'auto' ? `auto → ${resolved}` : resolved }) }
    }

    if (verb === 'rules') {
      const [mutedNow, firedNow] = [await read($, muted), await read($, fired)]
      const rows = ALL_RULES.map(r => `  ${mutedNow.includes(r) ? '✗' : '✓'} ${firedNow.includes(r) ? '•' : ' '} ${r}`)
      return { text: [t(lang, 'ui.rulesHead'), ...rows].join('\n') }
    }

    if (verb === 'report') {
      const usage = await $.session.usage()
      return { text: renderReport(await read($, ledger), usage.cost?.usd, S.catalog, lang) }
    }

    if (verb !== 'status') return { text: t(lang, 'ui.usage') }

    const { context } = await $.session.usage()
    const list = (xs: readonly string[]) => (xs.length ? xs.join(', ') : t(lang, 'ui.none'))
    const lines = [
      t(lang, 'ui.state', { on: (await read($, isEnabled)) ? 1 : 0, lang, catalog: S.catalogFrom }),
      t(lang, 'ui.now', {
        model: await $.session.model(),
        effort: S.lastEffort ?? t(lang, 'ui.noEffort'),
        ctx: `${kTokens(context.tokens ?? 0)}/${kTokens(context.window)}`,
      }),
      t(lang, 'ui.fired', { list: list(await read($, fired)) }),
      t(lang, 'ui.muted', { list: list(await read($, muted)) }),
      t(lang, 'ui.thresholds', {
        sw: kTokens(CONFIG.switchCompactTokens),
        lean: kTokens(CONFIG.leanContextTokens),
        effort: CONFIG.maxComfortEffort,
        rate: CONFIG.rateLimitPercent,
        err: CONFIG.errorStreak,
      }),
    ]
    return { text: lines.join('\n') }
  }).catch(async $ => ({ text: t(asLang(await read($, langAtom)), 'ui.error') }))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const list = await read($, queue)
    // Newest first: the tip about what just happened; older ones wait as (+n).
    const head = list[list.length - 1]
    if (e.props.hasSurvey || head === undefined || !(await read($, isEnabled))) return next(e)

    const lang = asLang(await read($, langAtom))
    const { Box, Button, Text } = $.ui.resolve(e)
    const more = list.length > 1 ? ` (+${list.length - 1})` : ''
    return (
      <Box gap={1}>
        <Text color="warning" bold>
          🏁 pitstop
        </Text>
        <Box flexGrow={1} flexShrink={1}>
          <Text>
            {t(lang, head.rule, head.vars)}
            <Text dimColor>{more}</Text>
          </Text>
        </Box>
        <Button key="ok" label={t(lang, 'ui.ok')} onPress={() => update($, queue, q => q.slice(0, -1))} />
      </Box>
    )
  })
}
