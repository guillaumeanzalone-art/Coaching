// Timothée: scripture-first Protestant page theme.
// Text: Louis Segond 1910 (public domain). Read on every profile visit,
// stable throughout that visit so changing exercise tabs never replaces it.

export const TIMOTHEE_VERSES = Object.freeze([
  {
    reference: 'Josué 1:9',
    text: 'Ne t’ai-je pas donné cet ordre: Fortifie-toi et prends courage? Ne t’effraie point et ne t’épouvante point, car l’Éternel, ton Dieu, est avec toi dans tout ce que tu entreprendras.',
  },
  {
    reference: '2 Timothée 1:7',
    text: 'Car ce n’est pas un esprit de timidité que Dieu nous a donné, mais un esprit de force, d’amour et de sagesse.',
  },
  {
    reference: 'Psaumes 119:105',
    text: 'Ta parole est une lampe à mes pieds, Et une lumière sur mon sentier.',
  },
  {
    reference: 'Philippiens 4:13',
    text: 'Je puis tout par celui qui me fortifie.',
  },
  {
    reference: 'Ésaïe 40:31',
    text: 'Mais ceux qui se confient en l’Éternel renouvellent leur force. Ils prennent le vol comme les aigles; Ils courent, et ne se lassent point, Ils marchent, et ne se fatiguent point.',
  },
  {
    reference: '1 Corinthiens 16:13',
    text: 'Veillez, demeurez fermes dans la foi, soyez des hommes, fortifiez-vous.',
  },
  {
    reference: 'Proverbes 3:5',
    text: 'Confie-toi en l’Éternel de tout ton cœur, Et ne t’appuie pas sur ta sagesse',
  },
  {
    reference: 'Psaumes 27:1',
    text: 'L’Éternel est ma lumière et mon salut: De qui aurais-je crainte? L’Éternel est le soutien de ma vie: De qui aurais-je peur?',
  },
])

const LAST_VERSE_KEY = 'ga-v2-timothee-last-verse-v1'

export function pickTimotheeVerse(previousReference = '', random = Math.random) {
  const available = TIMOTHEE_VERSES.filter(
    verse => verse.reference !== previousReference
  )
  const choices = available.length ? available : TIMOTHEE_VERSES
  const value = Number(random())
  const normalized = Number.isFinite(value)
    ? Math.max(0, Math.min(0.999999999, value))
    : 0

  return choices[Math.floor(normalized * choices.length)]
}

// One invocation when the athlete page is opened (mount or no-program state).
// sessionStorage prevents the same verse appearing on consecutive visits,
// including if the page was refreshed. Storage failure is harmless.
export function getTimotheeVisitVerse(
  storage = typeof sessionStorage === 'undefined' ? null : sessionStorage,
  random = Math.random
) {
  let previousReference = ''
  try {
    previousReference = storage?.getItem(LAST_VERSE_KEY) || ''
  } catch { /* Storage access is optional, e.g. privacy mode. */ }

  const verse = pickTimotheeVerse(previousReference, random)

  try {
    storage?.setItem(LAST_VERSE_KEY, verse.reference)
  } catch { /* Keep the current verse even without writable storage. */ }

  return verse
}

function escapeText(value) {
  return String(value || '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char])
}

export function renderTimotheeThemeHero() {
  return [
    '<section class="athlete-theme-banner athlete-theme-banner--timothee-covenant"',
    '  aria-label="Timothée : fresque biblique, la foi et la force">',
    '  <picture class="timothee-covenant__picture">',
    '    <source media="(max-width: 650px)" srcset="/timothee-bible-epic-mobile.webp">',
    '    <img class="timothee-covenant__hero"',
    '      src="/timothee-bible-epic-wide.webp"',
    '      alt="Fresque biblique : Moïse, David et Goliath, Daniel et les lions, arche de Noé, Bible ouverte et lumière de la résurrection"',
    '      width="1536" height="865" loading="eager" decoding="async">',
    '  </picture>',
    '  <div class="timothee-covenant__rays" aria-hidden="true"><i></i><i></i><i></i></div>',
    '  <div class="timothee-covenant__stars" aria-hidden="true">',
    '    <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>',
    '  </div>',
    '  <div class="timothee-covenant__light" aria-hidden="true"></div>',
    '  <div class="timothee-covenant__frame" aria-hidden="true"></div>',
    '</section>',
  ].join('\n')
}

export function renderTimotheeVersePanel(verse) {
  const selected = verse || TIMOTHEE_VERSES[0]

  return [
    '<section class="timothee-covenant__scripture" aria-label="Verset biblique pour cette visite">',
    '  <div class="timothee-covenant__scripture-ornament" aria-hidden="true">✦</div>',
    '  <div class="timothee-covenant__scripture-kicker">LA PAROLE · À CHAQUE VISITE</div>',
    '  <blockquote class="timothee-covenant__scripture-text">« ' + escapeText(selected.text) + ' »</blockquote>',
    '  <div class="timothee-covenant__scripture-footer">',
    '    <strong>' + escapeText(selected.reference) + '</strong>',
    '    <span>BIBLE LOUIS SEGOND 1910</span>',
    '  </div>',
    '</section>',
  ].join('\n')
}
