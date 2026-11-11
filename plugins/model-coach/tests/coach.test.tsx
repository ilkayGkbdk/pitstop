import { expect, mock, test } from 'claude-code/testing'

const BAND = {
  plugin: 'model-coach',
  component: 'AbovePrompt',
  requestId: 'band',
  props: {
    bodyColumns: 100,
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 6,
    scroll: { offset: 0, bodyRows: 6 },
    view: {},
  },
} as const

const SWITCH = {
  from_model: 'claude-opus-5-5',
  to_model: 'claude-sonnet-5-5',
  requested_model: 'sonnet',
  source: 'command',
  context_tokens: 90_000,
  prompt_cache_warm: true,
  cache_ttl: '5m',
  estimated_cache_write_usd: 0.4,
  pricing: 'catalog',
} as const

const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } } as const

test('a /model switch over 50K shows the band once, and Tamam clears it', async ($, on) => {
  mock.store(on)
  on('classic.PreModelSwitch', () => ({}))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })

  await $.classic.PreModelSwitch(SWITCH)
  await $.classic.PreModelSwitch(SWITCH) // cooldown: no second tip

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect((await ui.find({ type: 'Text', text: /compact/ }))?.text).toContain('/compact')
    expect(await ui.find({ type: 'Text', text: /\+1/ })).toBeUndefined()
    await ui.unmount()
  }

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await ui.press({ key: 'ok' })
  expect((await ui.find({ type: 'Text', text: /engine/ }))?.text).toBe('engine')
  await ui.unmount()
})

test('/model-coach off silences the band; status reports it', async ($, on) => {
  mock.store(on)
  on('classic.PreModelSwitch', () => ({}))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 1000, window: 200_000 }, rateLimits: [] } }))

  const off = await $.command.run({ ...RUN, command: 'model-coach', args: 'off' })
  expect(off.text).toContain('kapalı')

  await $.classic.PreModelSwitch(SWITCH)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /engine/ }))?.text).toBe('engine')
  await ui.unmount()

  const status = await $.command.run({ ...RUN, command: 'model-coach', args: 'status' })
  expect(status.text).toContain('durum: kapalı')
})
