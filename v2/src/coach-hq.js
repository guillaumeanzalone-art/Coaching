import { supabase } from './supabase.js'

export const COACH_HQ_FILTERS = Object.freeze(['all', 'high', 'watch', 'missing'])
export const COACH_HQ_SORTS = Object.freeze(['over8', 'over85', 'recent', 'name'])
const safeNum = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0

export function normalizeCoachSnapshot(payload) {
  if (!payload || !Array.isArray(payload.athletes)) throw new Error('Réponse Coach HQ invalide')
  return {
    generatedAt: String(payload.generated_at || ''),
    athletes: payload.athletes.map(row => ({
      slug: String(row.slug || '').trim().toLowerCase(),
      name: String(row.name || row.slug || 'Athlète'),
      emoji: String(row.emoji || '🏋️'),
      block: String(row.block_title || 'Sans bloc actif'),
      weeks: safeNum(row.total_weeks),
      week: row.week_number === null ? 0 : safeNum(row.week_number),
      completedDays: safeNum(row.completed_days),
      plannedDays: safeNum(row.planned_days),
      rated: safeNum(row.rated_sets),
      over8: safeNum(row.over_8),
      over85: safeNum(row.over_85),
      lastOver8: safeNum(row.last_over_8),
      lastOver85: safeNum(row.last_over_85),
      lastAt: String(row.last_session_at || ''),
      sessions7d: safeNum(row.sessions_7d),
      exercises: Array.isArray(row.top_exercises)
        ? row.top_exercises.map(ex => ({
          name: String(ex.name || 'Exercice'),
          over8: safeNum(ex.over_8),
          over85: safeNum(ex.over_85),
        }))
        : [],
    })).filter(row => row.slug),
  }
}

export function coachHqPriority(row) {
  if (row.rated === 0) return 'missing'
  if (row.over85 >= 5 || row.over8 >= 10) return 'high'
  if (row.over85 >= 2 || row.over8 >= 5) return 'watch'
  return 'normal'
}

export function coachHqRows(rows, { search = '', filter = 'all', sort = 'over8' } = {}) {
  const norm = value => String(value || '').toLocaleLowerCase('fr')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  const keyword = norm(search)
  const filtered = rows.filter(row => {
    if (keyword && !norm(row.name + ' ' + row.slug + ' ' + row.block).includes(keyword)) return false
    return filter === 'all' || coachHqPriority(row) === filter
  })
  const date = row => Number.isFinite(Date.parse(row.lastAt)) ? Date.parse(row.lastAt) : 0
  const alpha = (a, b) => a.name.localeCompare(b.name, 'fr')
  return filtered.sort((a, b) => {
    if (sort === 'name') return alpha(a, b)
    if (sort === 'recent') return date(b) - date(a) || alpha(a, b)
    if (sort === 'over85') return b.over85 - a.over85 || b.over8 - a.over8 || alpha(a, b)
    return b.over8 - a.over8 || b.over85 - a.over85 || alpha(a, b)
  })
}

export function coachHqSummary(rows) {
  return {
    athletes: rows.length,
    over8: rows.reduce((s, a) => s + a.over8, 0),
    over85: rows.reduce((s, a) => s + a.over85, 0),
    sessions7d: rows.reduce((s, a) => s + a.sessions7d, 0),
  }
}

function esc(value) {
  return String(value ?? '').replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

function displayDate(value) {
  const date = new Date(value)
  if (!value || Number.isNaN(date.getTime())) return 'Aucune séance sur ce bloc'
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  }).format(date)
}

const labels = {
  high: 'À examiner en priorité',
  watch: 'À surveiller',
  missing: 'RPE non disponibles',
  normal: 'RPE habituels',
}

function cardHtml(row, maximum) {
  const p = coachHqPriority(row)
  const week = row.week
    ? 'S' + row.week + '/' + (row.weeks || '—') + ' · '
      + row.completedDays + '/' + (row.plannedDays || '?') + ' séances terminées'
    : 'Aucune séance terminée sur le bloc actif'
  const percent = Math.min(100, Math.round(row.over8 / Math.max(1, maximum) * 100))
  const exercises = row.exercises.length
    ? '<details class="coach-hq-exercise-details"><summary>Voir les exercices concernés</summary>'
      + '<div class="coach-hq-exercises">'
      + row.exercises.map(ex => '<span>' + esc(ex.name) + ' · <b>'
        + ex.over8 + ' &gt; 8</b>' + (ex.over85 ? ' · ' + ex.over85 + ' &gt; 8,5' : '') + '</span>').join('')
      + '</div></details>'
    : ''
  return [
    '<article class="coach-hq-athlete coach-hq-athlete--' + p + '">',
    '<div class="coach-hq-athlete__head">',
    '<span class="coach-hq-avatar" aria-hidden="true">' + esc(row.emoji) + '</span>',
    '<div class="coach-hq-name"><h3>' + esc(row.name) + '</h3>',
    '<span>' + esc(row.block) + ' · ' + esc(week) + '</span></div>',
    '<span class="coach-hq-tag coach-hq-tag--' + p + '">' + labels[p] + '</span></div>',
    '<div class="coach-hq-counts">',
    '<div class="coach-hq-count"><strong>' + row.over8 + '</strong><span>RPE &gt; 8</span>',
    '<div class="coach-hq-meter"><i style="width:' + percent + '%"></i></div></div>',
    '<div class="coach-hq-count"><strong>' + row.over85 + '</strong><span>RPE &gt; 8,5</span></div>',
    '<div class="coach-hq-count"><strong>' + row.rated + '</strong><span>Séries notées</span></div>',
    '</div><div class="coach-hq-footer">',
    '<div class="coach-hq-session"><span><b>Dernière séance :</b> ' + esc(displayDate(row.lastAt)) + '</span>',
    '<span><b>Sur cette séance :</b> ' + row.lastOver8 + ' &gt; 8 · ' + row.lastOver85 + ' &gt; 8,5</span></div>',
    '<button type="button" class="coach-hq-open" data-hq-action="open" data-hq-id="' + esc(row.slug) + '">Voir le profil ↗</button>',
    '</div>' + exercises + '</article>',
  ].join('')
}

function statsHtml(rows) {
  const s = coachHqSummary(rows)
  const cards = [
    [s.athletes, 'Athlètes suivis', 'Blocs actifs et profils'],
    [s.over8, 'Séries RPE > 8', 'Dernière semaine de chaque athlète'],
    [s.over85, 'Séries RPE > 8,5', 'Incluses dans le total > 8'],
    [s.sessions7d, 'Séances · 7 jours', 'Séances terminées des blocs actifs'],
  ]
  return cards.map((item, i) => '<div class="coach-hq-stat coach-hq-stat--' + i
    + '"><span>' + esc(item[1]) + '</span><strong>' + item[0]
    + '</strong><small>' + esc(item[2]) + '</small></div>').join('')
}

export function mountCoachHQ(root, { member, onBack, onOpenAthlete }) {
  if (member?.role !== 'coach') {
    root.innerHTML = '<main class="app-shell">Coach HQ réservé au compte coach.</main>'
    return
  }
  let data = null
  let isLoading = false
  let disposed = false
  let search = ''
  let sort = 'over8'
  let filter = 'all'
  let showAll = false
  const FIRST_PAGE_SIZE = 8

  root.innerHTML = [
    '<main class="app-shell coach-hq" data-coach-hq>',
    '<header class="topbar coach-hq-topbar">',
    '<button class="back-button" type="button" data-hq-action="home">← Accueil</button>',
    '<div><span class="version">GA COACHING · ESPACE COACH</span><h1>Coach HQ</h1></div>',
    '</header><section class="coach-hq-hero"><div>',
    '<span class="coach-hq-eyebrow">TEAM GA · COMMAND CENTER</span>',
    '<h2>Tous tes athlètes. Une seule vision.</h2>',
    '<p>Identifie les séries difficiles et les séances enregistrées, sans mélanger les anciens blocs aux programmes actuels.</p>',
    '</div><button type="button" class="coach-hq-refresh" data-hq-action="refresh">↻ Actualiser</button>',
    '</section><p class="coach-hq-source" data-hq-source aria-live="polite">Connexion à Supabase…</p>',
    '<section class="coach-hq-stats" data-hq-stats aria-label="Indicateurs Coach HQ"></section>',
    '<section class="coach-hq-panel"><div class="coach-hq-heading">',
    '<div><span class="coach-hq-eyebrow">SUIVI DES RPE</span><h2>Les priorités du coach</h2></div>',
    '<span data-hq-count>—</span></div>',
    '<div class="coach-hq-toolbar">',
    '<label><span>Rechercher</span><input type="search" data-hq-search placeholder="Nom de l’athlète…" autocomplete="off"></label>',
    '<label><span>Classer par</span><select data-hq-sort>',
    '<option value="over8">Nombre de RPE &gt; 8</option>',
    '<option value="over85">Nombre de RPE &gt; 8,5</option>',
    '<option value="recent">Séance la plus récente</option><option value="name">Nom A à Z</option>',
    '</select></label></div>',
    '<div class="coach-hq-filters" role="group" aria-label="Filtres">',
    '<button type="button" data-hq-filter="all" aria-pressed="true">Tous</button>',
    '<button type="button" data-hq-filter="high" aria-pressed="false">Priorité haute</button>',
    '<button type="button" data-hq-filter="watch" aria-pressed="false">À surveiller</button>',
    '<button type="button" data-hq-filter="missing" aria-pressed="false">Sans RPE</button>',
    '</div><div class="coach-hq-list" data-hq-list aria-live="polite">',
    '<p class="coach-hq-empty">Chargement des statistiques…</p></div></section>',
    '<p class="coach-hq-notice">Périmètre : dernière semaine avec une séance terminée dans le bloc actif de chaque athlète (une semaine peut être partielle). Seules les séries terminées, notées avec un RPE valide et rattachées à une séance terminée sont comptées. RPE &gt; 8,5 est inclus dans RPE &gt; 8. Les séries non synchronisées sont exclues. Une intensité élevée ne signifie pas automatiquement que la prescription a été dépassée.</p>',
    '</main>',
  ].join('')

  const find = selector => root.querySelector(selector)
  const mounted = () => !disposed && Boolean(find('[data-coach-hq]'))
  const source = find('[data-hq-source]')
  const refreshButton = find('[data-hq-action="refresh"]')

  function draw() {
    if (!data || !mounted()) return
    const rows = coachHqRows(data.athletes, { search, sort, filter })
    const maximum = Math.max(1, ...data.athletes.map(a => a.over8))
    const visible = showAll ? rows : rows.slice(0, FIRST_PAGE_SIZE)
    const pagination = rows.length > FIRST_PAGE_SIZE
      ? '<button type="button" class="coach-hq-more" data-hq-action="show-all">'
        + (showAll ? 'Réduire la liste ↑' : 'Afficher les ' + (rows.length - FIRST_PAGE_SIZE) + ' autres athlètes ↓')
        + '</button>'
      : ''
    find('[data-hq-list]').innerHTML = rows.length
      ? visible.map(a => cardHtml(a, maximum)).join('') + pagination
      : '<p class="coach-hq-empty">Aucun athlète ne correspond aux filtres.</p>'
    find('[data-hq-count]').textContent = rows.length + ' profil' + (rows.length > 1 ? 's' : '')
    root.querySelectorAll('[data-hq-filter]').forEach(button => {
      const active = button.dataset.hqFilter === filter
      button.classList.toggle('active', active)
      button.setAttribute('aria-pressed', String(active))
    })
  }

  async function refresh() {
    if (isLoading) return
    isLoading = true
    refreshButton.disabled = true
    source.textContent = 'Calcul des séries dans Supabase…'
    try {
      const { data: response, error } = await supabase.rpc('coach_hq_snapshot_v1')
      if (error) throw error
      const snapshot = normalizeCoachSnapshot(response)
      if (!mounted()) return
      data = snapshot
      find('[data-hq-stats]').innerHTML = statsHtml(data.athletes)
      source.textContent = 'Synchronisé le ' + displayDate(data.generatedAt)
        + ' · Dernière semaine enregistrée par bloc actif'
      draw()
    } catch (error) {
      console.error('Coach HQ:', error)
      if (!mounted()) return
      source.textContent = 'Impossible de charger les chiffres. Vérifie la connexion et actualise.'
      if (!data) find('[data-hq-list]').innerHTML =
        '<p class="coach-hq-empty">Statistiques momentanément indisponibles. Aucun chiffre fictif n’est affiché.</p>'
    } finally {
      isLoading = false
      if (mounted()) refreshButton.disabled = false
    }
  }

  root.onclick = event => {
    const action = event.target.closest('[data-hq-action]')
    if (action) {
      const kind = action.dataset.hqAction
      if (kind === 'refresh') { void refresh(); return }
      if (kind === 'show-all') {
        showAll = !showAll
        draw()
        return
      }
      if (kind === 'home' || kind === 'open') {
        disposed = true
        root.onclick = null
        root.oninput = null
        root.onchange = null
        if (kind === 'home') onBack()
        else onOpenAthlete(action.dataset.hqId)
        return
      }
    }
    const button = event.target.closest('[data-hq-filter]')
    if (button) { filter = button.dataset.hqFilter; showAll = false; draw() }
  }
  root.oninput = event => {
    if (event.target.matches('[data-hq-search]')) { search = event.target.value; showAll = false; draw() }
  }
  root.onchange = event => {
    if (event.target.matches('[data-hq-sort]')) { sort = event.target.value; showAll = false; draw() }
  }
  void refresh()
}
