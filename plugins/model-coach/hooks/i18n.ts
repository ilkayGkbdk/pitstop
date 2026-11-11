// Every user-facing string, in English and Turkish.

export type Lang = 'en' | 'tr'

/** `auto` reads Claude Code's `language` setting, then LANG; English otherwise. */
export function detectLang(choice: string, settingLanguage: unknown, envLang: string | undefined): Lang {
  if (choice === 'en' || choice === 'tr') return choice
  const s = typeof settingLanguage === 'string' ? settingLanguage.toLowerCase() : ''
  if (s.startsWith('tr') || s.startsWith('türk')) return 'tr'
  if (s !== '') return 'en'
  return (envLang ?? '').toLowerCase().startsWith('tr') ? 'tr' : 'en'
}

type V = Record<string, string | number>
type Msg = (v: V) => string

const en = {
  'switch-compact': v => `Context ${v.k}: run /compact first, since the new model pays cache-write for the whole history${v.cost}.`,
  'fable-downgrade': v => `Fable → ${v.to}: earlier thinking/reasoning will be dropped.`,
  'context-lean': v => `Context ${v.k}: keep the main thread lean and hand log/file reading to a Haiku subagent.`,
  'effort-high': v => `Effort ${v.effort}: try the next model up at lower effort instead.`,
  'agent-no-model': v => `${v.list}: add model: haiku or sonnet (or set a default with CLAUDE_CODE_SUBAGENT_MODEL).`,
  'explore-session-model': v => `Explore runs on the session model (${v.family}): define your own Explore with model: haiku.`,
  opusplan: () => 'opusplan is on: code edits run on Sonnet, so measure it on your own work.',
  fallback: v => `Fallback: fell back from ${v.from} to ${v.to}.`,
  'cache-cold': v => `Cache went cold (${v.idle} idle): the next request re-writes the whole ${v.k} history anyway, so if you want to switch models, now costs nothing extra.`,
  'rate-limit': v => `${v.window} limit at ${v.pct}%${v.reset}: move routine work to ${v.below} to stretch it.`,
  'error-streak': v => `${v.n} failing tool calls in a row: (1) give it a check (test/build/script), (2) raise effort one level, (3) move one model up at lower effort.`,
  'compact-forecast': v => `Context grows ~${v.growth}/turn: compaction in ~${v.turns} turns. /compact at a good stopping point keeps control of what stays.`,
  // UI
  'ui.ok': () => 'OK',
  'ui.on': () => 'model-coach is on.',
  'ui.off': () => 'model-coach is off. (The routing rules leave the system prompt on the next thread or after /compact.)',
  'ui.usage': () => 'Usage: /model-coach on | off | status | report | rules | mute <rule> | unmute <rule> | lang en|tr|auto',
  'ui.state': v => `state: ${v.on ? 'on' : 'off'} · language: ${v.lang} · catalog: ${v.catalog}`,
  'ui.now': v => `model: ${v.model} · effort: ${v.effort} · context: ${v.ctx}`,
  'ui.fired': v => `fired: ${v.list}`,
  'ui.muted': v => `muted: ${v.list}`,
  'ui.thresholds': v => `thresholds: switch>${v.sw}, lean>${v.lean}, effort>${v.effort}, rate>${v.rate}%, errors≥${v.err}`,
  'ui.noEffort': () => 'no request yet',
  'ui.none': () => '—',
  'ui.muteOk': v => `Muted ${v.rule}.`,
  'ui.unmuteOk': v => `Unmuted ${v.rule}.`,
  'ui.unknownRule': v => `Unknown rule "${v.rule}". Rules: ${v.list}`,
  'ui.lang': v => `Language: ${v.lang}.`,
  'ui.rulesHead': () => 'Rules (✓ on · ✗ muted · • fired this session):',
  'ui.reportHead': v => `Pit report · session cost ${v.total}${v.estimated}`,
  'ui.reportRow': v => `  ${v.who} ${v.model}: ${v.turns} turns · in ${v.inTok} · out ${v.outTok} · cache hit ${v.hit}% · ~${v.cost}`,
  'ui.reportMain': () => 'main',
  'ui.reportSub': () => 'sub ',
  'ui.reportEmpty': () => '  No turns counted yet.',
  'ui.reportSave': v => `  Tip: the subagents spent ~${v.spent}; on ${v.target} it would be ~${v.would} (−${v.save}).`,
  'ui.reportNote': () => '  Costs are estimates from list prices in the catalog.',
  'ui.estimated': () => ' (estimated)',
  'ui.error': () => 'model-coach: the command failed.',
} satisfies Record<string, Msg>

export type MsgKey = keyof typeof en

const tr: Record<MsgKey, Msg> = {
  'switch-compact': v => `Context ${v.k}: önce /compact yap; yeni model tüm geçmiş için cache-write öder${v.cost}.`,
  'fable-downgrade': v => `Fable → ${v.to}: önceki thinking/reasoning düşecek.`,
  'context-lean': v => `Context ${v.k}: ana context'i yalın tut; log/dosya okumayı Haiku subagent'a ver.`,
  'effort-high': v => `Effort ${v.effort}: bunun yerine bir üst modeli daha düşük effort'ta dene.`,
  'agent-no-model': v => `${v.list}: model: haiku veya sonnet ekle (CLAUDE_CODE_SUBAGENT_MODEL ile varsayılan da verilebilir).`,
  'explore-session-model': v => `Explore oturum modelinde (${v.family}) çalışıyor: model: haiku ile kendi Explore subagent'ını tanımla.`,
  opusplan: () => "opusplan aktif: kod düzenlemeleri Sonnet'te; kendi işinde ölç.",
  fallback: v => `Fallback: ${v.from} → ${v.to} modeline düşüldü.`,
  'cache-cold': v => `Cache soğudu (${v.idle} boşta): sıradaki istek ${v.k} geçmişi zaten yeniden yazacak; model değiştireceksen şimdi ek maliyeti yok.`,
  'rate-limit': v => `${v.window} limiti %${v.pct}${v.reset}: rutin işi ${v.below}'ya kaydırıp limiti uzat.`,
  'error-streak': v => `Üst üste ${v.n} başarısız tool çağrısı: (1) doğrulama yolu ver (test/build/script), (2) effort'u bir kademe artır, (3) bir üst modele daha düşük effort'la geç.`,
  'compact-forecast': v => `Context turn başına ~${v.growth} büyüyor: ~${v.turns} turn sonra compaction. Uygun bir noktada /compact yaparsan neyin kalacağını sen seçersin.`,
  'ui.ok': () => 'Tamam',
  'ui.on': () => 'model-coach açık.',
  'ui.off': () => "model-coach kapalı. (Routing kuralları sistem prompt'undan yeni thread'de veya /compact sonrası düşer.)",
  'ui.usage': () => 'Kullanım: /model-coach on | off | status | report | rules | mute <kural> | unmute <kural> | lang en|tr|auto',
  'ui.state': v => `durum: ${v.on ? 'açık' : 'kapalı'} · dil: ${v.lang} · katalog: ${v.catalog}`,
  'ui.now': v => `model: ${v.model} · effort: ${v.effort} · context: ${v.ctx}`,
  'ui.fired': v => `tetiklenen: ${v.list}`,
  'ui.muted': v => `susturulan: ${v.list}`,
  'ui.thresholds': v => `eşikler: switch>${v.sw}, lean>${v.lean}, effort>${v.effort}, limit>%${v.rate}, hata≥${v.err}`,
  'ui.noEffort': () => 'henüz istek yok',
  'ui.none': () => '—',
  'ui.muteOk': v => `${v.rule} susturuldu.`,
  'ui.unmuteOk': v => `${v.rule} tekrar açık.`,
  'ui.unknownRule': v => `Bilinmeyen kural "${v.rule}". Kurallar: ${v.list}`,
  'ui.lang': v => `Dil: ${v.lang}.`,
  'ui.rulesHead': () => 'Kurallar (✓ açık · ✗ susturuldu · • bu oturumda tetiklendi):',
  'ui.reportHead': v => `Pit raporu · oturum maliyeti ${v.total}${v.estimated}`,
  'ui.reportRow': v => `  ${v.who} ${v.model}: ${v.turns} turn · girdi ${v.inTok} · çıktı ${v.outTok} · cache isabeti %${v.hit} · ~${v.cost}`,
  'ui.reportMain': () => 'ana',
  'ui.reportSub': () => 'alt',
  'ui.reportEmpty': () => '  Henüz sayılan turn yok.',
  'ui.reportSave': v => `  İpucu: subagent'lar ~${v.spent} harcadı; ${v.target} ile ~${v.would} olurdu (−${v.save}).`,
  'ui.reportNote': () => '  Maliyetler katalogdaki liste fiyatlarından tahmindir.',
  'ui.estimated': () => ' (tahmini)',
  'ui.error': () => 'model-coach: komut çalışırken hata oluştu.',
}

const TABLES: Record<Lang, Record<MsgKey, Msg>> = { en, tr }

export function t(lang: Lang, key: MsgKey, vars: V = {}): string {
  return TABLES[lang][key](vars)
}

/** The language the model writes its layer-2 tip line in. */
export const LANG_NAME: Record<Lang, string> = { en: 'English', tr: 'Turkish' }
