import type { On } from 'claude-code'
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
  from_model: 'claude-fable-5-2',
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

function engine(on: On) {
  mock.store(on)
  on('classic.PreModelSwitch', () => ({}))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', () => ({
    value: { startedAt: 0, context: { tokens: 1000, window: 1_000_000 }, rateLimits: [], cost: { usd: 1.25 } },
  }))
  on('settings.read', () => ({ value: {} }))
  on('env.get', () => ({ value: undefined }))
}

test('a switch shows the newest tip with (+1); OK dismisses one at a time', async ($, on) => {
  engine(on)
  await $.classic.PreModelSwitch(SWITCH) // switch-compact + fable-downgrade
  await $.classic.PreModelSwitch(SWITCH) // cooldown: nothing new

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect((await ui.find({ type: 'Text', text: /thinking/ }))?.text).toContain('Fable → sonnet')
    expect(await ui.find({ type: 'Text', text: /\(\+1\)/ })).toBeDefined()
    await ui.unmount()
  }

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await ui.press({ key: 'ok' })
  expect((await ui.find({ type: 'Text', text: /compact/ }))?.text).toContain('/compact')
  await ui.press({ key: 'ok' })
  expect((await ui.find({ type: 'Text', text: /engine/ }))?.text).toBe('engine')
  await ui.unmount()
})

test('/model-coach lang tr redraws the band in Turkish', async ($, on) => {
  engine(on)
  await $.classic.PreModelSwitch(SWITCH)
  const res = await $.command.run({ ...RUN, command: 'model-coach', args: 'lang tr' })
  expect(res.text).toBe('Dil: tr.')
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /düşecek/ }))?.text).toContain('düşecek')
  expect(await ui.find({ type: 'Button', key: 'ok', text: 'Tamam' })).toBeDefined()
  await ui.unmount()
})

test('mute removes a rule from the band and from later sessions', async ($, on) => {
  engine(on)
  const muted = await $.command.run({ ...RUN, command: 'model-coach', args: 'mute fable-downgrade' })
  expect(muted.text).toBe('Muted fable-downgrade.')
  await $.classic.PreModelSwitch(SWITCH)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /thinking/ })).toBeUndefined()
  expect((await ui.find({ type: 'Text', text: /compact/ }))?.text).toContain('/compact')
  await ui.unmount()

  const rules = await $.command.run({ ...RUN, command: 'model-coach', args: 'rules' })
  expect(rules.text).toContain('✗   fable-downgrade')
  expect(rules.text).toContain('✓ • switch-compact')
  const bad = await $.command.run({ ...RUN, command: 'model-coach', args: 'mute nope' })
  expect(bad.text).toContain('Unknown rule')
})

test('off silences the band; status and report answer', async ($, on) => {
  engine(on)
  const off = await $.command.run({ ...RUN, command: 'model-coach', args: 'off' })
  expect(off.text).toContain('model-coach is off')
  await $.classic.PreModelSwitch(SWITCH)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /engine/ }))?.text).toBe('engine')
  await ui.unmount()

  const status = await $.command.run({ ...RUN, command: 'model-coach', args: 'status' })
  expect(status.text).toContain('state: off')
  expect(status.text).toContain('catalog: bundled')
  const report = await $.command.run({ ...RUN, command: 'model-coach', args: 'report' })
  expect(report.text).toContain('session cost $1.25')
})
