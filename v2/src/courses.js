// Bibliothèque pédagogique GA Coaching.
// Les fiches sont des copies exactes des cours HTML de la branche main,
// rangées dans public/cours. Aucune donnée athlète n'est lue ou modifiée.
export const COURSES = Object.freeze([
  { id: 'trepied', title: 'Le trépied du pied au squat', group: 'Squat', description: 'Appuis du pied et répartition de la pression.', icon: '🦶', file: 'trepied-pied-squat.html', source: 'Cours · Le trépied du pied au squat.html' },
  { id: 'buste', title: 'Le buste qui plonge au squat', group: 'Squat', description: 'Coordination entre genoux, hanches et buste.', icon: '🏋️', file: 'buste-qui-plonge-squat.html', source: 'Cours · Le buste qui plonge au squat.html' },
  { id: 'foot-pressure', title: 'Flat vs Heels : foot pressure', group: 'Squat', description: 'Chaussures, talon et stabilité du pied.', icon: '👟', file: 'flat-vs-heels-foot-pressure.html', source: 'Flat vs Heels _ le cours foot pressure.html' },
  { id: 'coude', title: 'Le coude au squat', group: 'Squat', description: 'Placement de la barre, dos et coudes.', icon: '💪', file: 'coude-squat.html', source: 'coude-squat.html' },
  { id: 'stack', title: 'Le stack et la rétroversion du bassin', group: 'Squat', description: 'Placement du bassin et organisation du tronc.', icon: '🧱', file: 'stack-retroversion-bassin-squat.html', source: 'le-stack-retroversion-du-bassin-au-squat.html' },
  { id: 'hook-grip', title: 'Hook grip : le cours', group: 'Technique', description: 'Comprendre et travailler la prise hook grip.', icon: '✊', file: 'hook-grip.html', source: 'hook-grip-le-cours.html' },
  { id: 'anneaux', title: 'Muscle-up aux anneaux', group: 'Technique', description: 'Cours préparé pour Kaoutar.', icon: '⭕', file: 'muscle-up-anneaux.html', source: 'Cours pour Kaoutar · Muscle-up aux anneaux.html' },
  { id: 'hanche', title: 'Mobilité de hanche', group: 'Mobilité & réhab', description: 'Applications au squat, sumo et bench.', icon: '🔄', file: 'mobilite-hanche-squat-sumo-bench.html', source: 'Mobilité de hanche · Squat, sumo, bench.html' },
  { id: 'genou', title: 'Réhab genou : reprise progressive', group: 'Mobilité & réhab', description: 'Fiche de reprise et de progression.', icon: '🦵', file: 'rehab-genou.html', source: 'Réhab genou · Reprise progressive.html' },
  { id: 'sacro', title: 'Réhab sacro-iliaque : Pokédex', group: 'Mobilité & réhab', description: 'Bibliothèque d’exercices pour la région sacro-iliaque.', icon: '🧩', file: 'rehab-sacro-iliaque.html', source: 'rehab-sacro-iliaque-pokedex.html' },
  { id: 'stabilite', title: 'La Stabilité — yoga avec Sabine', group: 'Yoga & respiration', description: 'Cours de yoga consacré à la stabilité.', icon: '🧘', file: 'yoga-stabilite-sabine.html', source: 'La Stabilité · Cours de yoga · Sabine.html' },
  { id: 'respirer', title: 'Respirer le mouvement', group: 'Yoga & respiration', description: 'Cours de Sabine Anzalone sur la respiration et le mouvement.', icon: '🌬️', file: 'respirer-le-mouvement.html', source: 'Respirer le mouvement _ Sabine Anzalone.html' },
  { id: 'roue', title: 'Vers la posture de la Roue', group: 'Yoga & respiration', description: 'Cours de Sabine Anzalone.', icon: '🌙', file: 'posture-de-la-roue.html', source: 'Vers la posture de la Roue _ Sabine Anzalone.html' },
])

export const COURSE_GROUPS = Object.freeze(['Tous', 'Squat', 'Technique', 'Mobilité & réhab', 'Yoga & respiration'])

export function courseUrl(course) {
  const base = (import.meta.env?.BASE_URL || '/').replace(/\/?$/, '/')
  return base + 'cours/' + course.file
}

export function filterCourses(query = '', group = 'Tous') {
  const clean = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
  const term = clean(query)
  return COURSES.filter(course => {
    if (group !== 'Tous' && course.group !== group) return false
    return !term || clean([course.title, course.group, course.description].join(' ')).includes(term)
  })
}

function node(tag, className = '', content = '') {
  const element = document.createElement(tag)
  if (className) element.className = className
  if (content) element.textContent = content
  return element
}

function backButton(label) {
  const button = node('button', 'back-button', label)
  button.type = 'button'
  button.dataset.coursesBack = 'true'
  return button
}

function header(label) {
  const top = node('header', 'topbar courses-topbar')
  top.append(backButton(label))
  const heading = node('div')
  heading.append(node('span', 'version', 'LA BRIGADE DE L’ARAIGNÉE'))
  heading.append(node('h1', '', 'Cours'))
  top.append(heading)
  return top
}

function courseCard(course) {
  const button = node('button', 'courses-card')
  button.type = 'button'
  button.dataset.courseId = course.id
  const top = node('div', 'courses-card__top')
  top.append(node('span', 'courses-card__icon', course.icon))
  top.append(node('span', 'courses-card__group', course.group))
  button.append(top)
  button.append(node('strong', 'courses-card__title', course.title))
  button.append(node('p', 'courses-card__desc', course.description))
  const footer = node('div', 'courses-card__footer')
  footer.append(node('span', '', 'Lire le cours'))
  footer.append(node('span', '', '↗'))
  button.append(footer)
  return button
}

export function mountCourses(root, onBack) {
  let query = ''
  let group = 'Tous'
  let selected = null
  let grid = null
  let resultCount = null
  let filters = null

  function updateResults() {
    if (!grid) return
    const results = filterCourses(query, group)
    grid.replaceChildren()
    if (resultCount) {
      resultCount.textContent = results.length + ' cours'
    }
    if (!results.length) {
      grid.append(node('p', 'courses-empty', 'Aucun cours ne correspond à la recherche.'))
    } else {
      results.forEach(course => grid.append(courseCard(course)))
    }
    if (filters) {
      filters.querySelectorAll('[data-course-group]').forEach(button => {
        const active = button.dataset.courseGroup === group
        button.setAttribute('aria-pressed', String(active))
        button.classList.toggle('is-active', active)
      })
    }
  }

  function renderCatalog() {
    selected = null
    root.replaceChildren()
    const main = node('main', 'app-shell courses-page')
    main.append(header('← Accueil'))

    const hero = node('section', 'courses-hero')
    hero.append(node('span', 'courses-eyebrow', 'GA COACHING · ACADÉMIE'))
    hero.append(node('h2', '', 'La bibliothèque des cours'))
    hero.append(node('p', '', 'Technique, force, mobilité et yoga. Retrouve les fiches pédagogiques de l’équipe au même endroit.'))
    main.append(hero)

    const tools = node('section', 'courses-tools')
    const searchLabel = node('label', 'courses-search-label')
    searchLabel.append(node('span', '', 'Rechercher un cours'))
    const search = node('input', 'courses-search')
    search.type = 'search'
    search.placeholder = 'Squat, hook grip, mobilité…'
    search.autocomplete = 'off'
    search.dataset.courseSearch = 'true'
    search.value = query
    searchLabel.append(search)
    tools.append(searchLabel)

    filters = node('div', 'courses-filters')
    filters.setAttribute('aria-label', 'Filtrer les cours')
    COURSE_GROUPS.forEach(category => {
      const button = node('button', 'courses-filter', category)
      button.type = 'button'
      button.dataset.courseGroup = category
      filters.append(button)
    })
    tools.append(filters)
    main.append(tools)

    const meta = node('div', 'courses-results-meta')
    meta.append(node('h3', '', 'Tous les cours'))
    resultCount = node('span', '', '')
    meta.append(resultCount)
    main.append(meta)
    grid = node('div', 'courses-grid')
    main.append(grid)
    const foot = node('p', 'courses-source-note', 'Fiches issues du dépôt GitHub Coaching, branche main. Versions intégrées dans l’application.')
    main.append(foot)
    root.append(main)
    updateResults()
  }

  function renderReader(course) {
    selected = course
    grid = null
    filters = null
    root.replaceChildren()
    const main = node('main', 'app-shell courses-page courses-page--reader')
    main.append(header('← Tous les cours'))

    const summary = node('section', 'courses-reader-intro')
    summary.append(node('span', 'courses-eyebrow', course.group))
    summary.append(node('h2', '', course.title))
    summary.append(node('p', '', course.description))
    const actions = node('div', 'courses-reader-actions')
    const full = node('a', 'courses-full-link', 'Ouvrir en pleine page ↗')
    full.href = courseUrl(course)
    full.target = '_blank'
    full.rel = 'noopener noreferrer'
    actions.append(full)
    summary.append(actions)
    main.append(summary)

    const frameBox = node('section', 'courses-frame-wrap')
    const iframe = node('iframe', 'courses-frame')
    iframe.title = 'Cours : ' + course.title
    iframe.src = courseUrl(course)
    iframe.loading = 'eager'
    iframe.setAttribute('sandbox', 'allow-scripts allow-forms allow-popups')
    iframe.setAttribute('referrerpolicy', 'no-referrer')
    frameBox.append(iframe)
    main.append(frameBox)
    main.append(node('p', 'courses-reader-tip', 'Tu peux faire défiler le cours dans la fenêtre, ou l’ouvrir en pleine page sur ton téléphone.'))
    root.append(main)
  }

  root.onclick = event => {
    const back = event.target.closest('[data-courses-back]')
    if (back) {
      if (selected) renderCatalog()
      else {
        root.onclick = null
        root.oninput = null
        onBack()
      }
      return
    }
    const filter = event.target.closest('[data-course-group]')
    if (filter) {
      group = filter.dataset.courseGroup
      updateResults()
      return
    }
    const card = event.target.closest('[data-course-id]')
    if (card) {
      const course = COURSES.find(item => item.id === card.dataset.courseId)
      if (course) renderReader(course)
    }
  }

  root.oninput = event => {
    if (event.target.matches('[data-course-search]')) {
      query = event.target.value
      updateResults()
    }
  }

  renderCatalog()
}
