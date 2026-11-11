import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Hint } from '../types'
import { CONFIG } from './config'
import {
  fallbackHint,
  fresh,
  onAgentFiles,
  onContext,
  onEffort,
  onExploreSpawn,
  onModelSwitch,
  onOpusplan,
  onStepModel,
  ROUTING_RULES,
} from './rules'

const queue = atom({ plugin: 'model-coach', key: 'queue' } as const, [])
const fired = atom({ plugin: 'model-coach', key: 'fired' } as const, [])
const isEnabled = atom({ plugin: 'model-coach', key: 'isEnabled' } as const, true)

const COMMAND = 'model-coach'

async function fire($: EngineInterface, hints: (Hint | null)[]) {
  if (!(await read($, isEnabled))) return
  const list = fresh(hints.filter((h): h is Hint => h !== null), await read($, fired))
  if (list.length === 0) return
  await update($, fired, f => [...new Set([...f, ...list.map(h => h.rule)])])
  await update($, queue, q => {
    const rules = new Set(q.map(h => h.rule))
    return [...q, ...list.filter(h => !rules.has(h.rule))].slice(-CONFIG.maxQueued)
  })
}

async function readAgentFiles($: EngineInterface) {
  const home = await $.env.get('HOME')
  const root = await $.session.root()
  const files: { name: string; text: string }[] = []
  const bases = [root, ...(home ? [home] : [])]
  for (const base of bases) {
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

export const register: Register = on => {
  // Last readings, for /model-coach status. Lost on reload, which is fine.
  let lastEffort: string | number | undefined

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: COMMAND,
      description: 'model-coach: on | off | status',
      argumentHint: 'on|off|status',
    })
    const stored = await $.store.get('enabled')
    await update($, isEnabled, () => stored !== false)

    const settingsModel = await $.settings.read({ key: 'model' })
    await fire($, [
      onOpusplan(typeof settingsModel === 'string' ? settingsModel : await $.session.model()),
      onAgentFiles(await readAgentFiles($).catch(() => []), await $.env.get('CLAUDE_CODE_SUBAGENT_MODEL')),
    ])
    return next(e)
  })

  // A /clear starts a new conversation: the cooldown starts over.
  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      await update($, fired, () => [])
      await update($, queue, () => [])
    }
    return next(e)
  })

  // /model (command or picker): context size and cache cost come with the switch.
  on('classic.PreModelSwitch', async ($, e, next) => {
    await fire($, [
      ...onModelSwitch({
        from: e.from_model,
        to: e.to_model,
        contextTokens: e.context_tokens,
        estimatedCacheWriteUsd: e.estimated_cache_write_usd,
      }),
      onOpusplan(e.requested_model),
    ])
    return next(e)
  }).catch(($, e, next) => next(e))

  // An automatic switch (`source: 'auto'`) is a fallback.
  on('classic.PostModelSwitch', async ($, e, next) => {
    if (e.source === 'auto') await fire($, [fallbackHint(e.from_model, e.to_model)])
    return next(e)
  }).catch(($, e, next) => next(e))

  // Every main-loop request: effort in force and the model actually sent.
  on('turn.step', async function* ($, e, next) {
    if (e.agentId === undefined) {
      lastEffort = e.effort
      await fire($, [onEffort(e.effort), onStepModel(e.model, await $.session.model())])
    }
    return yield* next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      const { context } = await $.session.usage()
      await fire($, [onContext(context.tokens)])
    }
    return next(e)
  })

  on('agent.spawn', async ($, e, next) => {
    const result = await next(e)
    if (e.subagentType === 'Explore' && result.deny === undefined) {
      await fire($, [onExploreSpawn(result.model, e.parentModel)])
    }
    return result
  }).catch(($, e, next) => next(e))

  // Layer 2: the routing rules ride the system prompt as a session section.
  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    if (!CONFIG.injectRouting || !(await read($, isEnabled))) return composed
    return {
      sections: [...composed.sections, { id: 'model-coach:routing', text: ROUTING_RULES, scope: 'session' as const }],
    }
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'on' || arg === 'off') {
      const value = arg === 'on'
      await $.store.set('enabled', value)
      await update($, isEnabled, () => value)
      if (!value) await update($, queue, () => [])
      return {
        text: value
          ? 'model-coach açık.'
          : 'model-coach kapalı. (Routing kuralları sistem prompt\'undan yeni thread\'de/compact sonrası düşer.)',
      }
    }
    if (arg !== '' && arg !== 'status') return { text: 'Kullanım: /model-coach on | off | status' }

    const { context } = await $.session.usage()
    const firedNow = await read($, fired)
    const lines = [
      `durum: ${(await read($, isEnabled)) ? 'açık' : 'kapalı'}`,
      `model: ${await $.session.model()} · effort: ${lastEffort ?? 'henüz istek yok'} · context: ${context.tokens ?? 0}/${context.window}`,
      `tetiklenen kurallar: ${firedNow.length ? firedNow.join(', ') : '—'}`,
      `eşikler: switch>${CONFIG.switchCompactTokens}, lean>${CONFIG.leanContextTokens}, effort>${CONFIG.maxComfortEffort}`,
    ]
    return { text: lines.join('\n') }
  }).catch(() => ({ text: 'model-coach: komut çalışırken hata oluştu.' }))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const list = await read($, queue)
    // Newest first: the tip about what just happened; older ones wait as (+n).
    const head = list[list.length - 1]
    if (e.props.hasSurvey || head === undefined || !(await read($, isEnabled))) return next(e)

    const { Box, Button, Text } = $.ui.resolve(e)
    const more = list.length > 1 ? ` (+${list.length - 1})` : ''
    return (
      <Box gap={1}>
        <Text color="warning" bold>
          🏁 pitstop
        </Text>
        <Box flexGrow={1} flexShrink={1}>
          <Text>
            {head.text}
            <Text dimColor>{more}</Text>
          </Text>
        </Box>
        <Button key="ok" label="Tamam" onPress={() => update($, queue, q => q.slice(0, -1))} />
      </Box>
    )
  })
}
