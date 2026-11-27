import { supabase } from './supabase.js'

export const ADVENT_DAY19_UNLOCK = '2026-12-19'
export const ADVENT_DAY19_TABLE = 'advent_day19_tcg_suggestions_2026'

export function parisDay(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const byType = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return [byType.year, byType.month, byType.day].join('-')
}

export function day19Unlocked(date = new Date()) {
  return parisDay(date) >= ADVENT_DAY19_UNLOCK
}

export function cleanSuggestion(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 120)
}

export function groupDay19Suggestions(votes) {
  const groups = new Map()
  for (const vote of votes) {
    const suggestion = cleanSuggestion(vote.suggestion)
    if (!suggestion) continue
    const key = suggestion.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('fr')
    if (!groups.has(key)) groups.set(key, { name: suggestion, votes: 0 })
    groups.get(key).votes++
  }
  return Array.from(groups.values())
    .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name, 'fr'))
}

function element(tag, cls, content = '') {
  const el = document.createElement(tag)
  if (cls) el.className = cls
  if (content) el.textContent = content
  return el
}

function button(label, action, cls = '') {
  const b = element('button', cls, label)
  b.type = 'button'
  b.dataset.adventAction = action
  return b
}

function dateLabel(value) {
  if (!value) return ''
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  }).format(d)
}

function status(target, message, type = '') {
  target.textContent = message
  target.className = 'advent19-status' + (type ? ' advent19-status--' + type : '')
}

function renderShell(root, back) {
  root.replaceChildren()
  const main = element('main', 'app-shell advent-day19')
  const top = element('header', 'topbar advent19-topbar')
  top.append(button('← Accueil', 'back', 'back-button'))
  const heading = element('div')
  heading.append(element('span', 'version', 'GA COACHING · NOËL 2026'))
  heading.append(element('h1', '', 'Calendrier de l’Avent'))
  top.append(heading)
  main.append(top)

  const hero = element('section', 'advent19-hero')
  hero.append(element('span', 'advent19-eyebrow', '19 DÉCEMBRE · CADEAU N° 19'))
  hero.append(element('h2', '', 'La prochaine carte TCG, c’est vous qui choisissez.'))
  hero.append(element('p', '', 'Écris le personnage que tu voudrais découvrir sur une future carte exclusive de l’équipe.'))
  main.append(hero)
  root.append(main)

  root.onclick = event => {
    const action = event.target.closest('[data-advent-action]')?.dataset.adventAction
    if (action === 'back') {
      root.onclick = null
      root.onsubmit = null
      back()
    }
  }
  return main
}

async function loadOwnVote(userId) {
  const { data, error } = await supabase
    .from(ADVENT_DAY19_TABLE)
    .select('id, suggestion, updated_at')
    .eq('voter_id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}

async function saveOwnVote(userId, currentVote, suggestion) {
  if (currentVote) {
    const { data, error } = await supabase
      .from(ADVENT_DAY19_TABLE)
      .update({ suggestion, updated_at: new Date().toISOString() })
      .eq('id', currentVote.id)
      .eq('voter_id', userId)
      .select('id, suggestion, updated_at')
      .single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabase
    .from(ADVENT_DAY19_TABLE)
    .insert({ voter_id: userId, suggestion })
    .select('id, suggestion, updated_at')
    .single()
  if (error) throw error
  return data
}

function addChatMessage(container, message, kind, time = '') {
  const bubble = element('div', 'advent19-bubble advent19-bubble--' + kind)
  bubble.append(element('span', 'advent19-bubble__who', kind === 'coach' ? 'COACH GUILLAUME' : 'TOI'))
  bubble.append(element('p', '', message))
  if (time) bubble.append(element('span', 'advent19-bubble__date', dateLabel(time)))
  container.append(bubble)
}

function mountAthleteChat(main, user) {
  const section = element('section', 'advent19-chat')
  section.append(element('h3', '', 'Le chat du jour 19'))

  const chat = element('div', 'advent19-conversation')
  addChatMessage(chat, 'Qui mériterait sa propre carte TCG ? Donne-moi ton choix : je récupérerai les propositions directement sur mon compte coach.', 'coach')
  section.append(chat)

  const info = element('p', 'advent19-help')
  if (!day19Unlocked()) {
    info.textContent = 'Ce cadeau se débloque le 19 décembre 2026. Tu pourras alors envoyer ta réponse au coach.'
    section.append(info)
  }

  const form = element('form', 'advent19-form')
  const label = element('label', 'advent19-label', 'Ton personnage pour la prochaine carte')
  label.htmlFor = 'advent19-message'
  const input = element('textarea', 'advent19-textarea')
  input.id = 'advent19-message'
  input.placeholder = 'Ex. : une carte divine pour…'
  input.rows = 2
  input.maxLength = 120
  input.disabled = !day19Unlocked()
  const send = element('button', 'advent19-send', 'Envoyer à Guillaume ↗')
  send.type = 'submit'
  send.disabled = !day19Unlocked()
  const feedback = element('p', 'advent19-status')
  feedback.setAttribute('role', 'status')
  feedback.setAttribute('aria-live', 'polite')
  form.append(label, input, send, feedback)
  section.append(form)
  section.append(element('p', 'advent19-help', 'Une seule proposition par athlète ; tu peux modifier ton message après l’avoir envoyé. Les réponses des autres restent privées.'))
  main.append(section)

  let currentVote = null
  let sending = false
  const myBubble = element('div', 'advent19-my-messages')
  chat.append(myBubble)

  async function refresh() {
    status(feedback, 'Chargement de ta réponse…')
    try {
      currentVote = await loadOwnVote(user.id)
      myBubble.replaceChildren()
      if (currentVote) {
        addChatMessage(myBubble, currentVote.suggestion, 'athlete', currentVote.updated_at)
        input.value = currentVote.suggestion
        send.textContent = 'Modifier mon choix ↗'
        status(feedback, 'Ton choix est enregistré et visible dans le compte coach.', 'success')
      } else {
        status(feedback, day19Unlocked() ? 'Ton vote n’a pas encore été envoyé.' : '')
      }
    } catch (error) {
      console.error('Advent day19: unable to load vote', error)
      status(feedback, 'Impossible de charger ta réponse. Vérifie la connexion.', 'error')
    }
  }

  main.parentElement.onsubmit = async event => {
    if (event.target !== form) return
    event.preventDefault()
    if (sending) return
    if (!day19Unlocked()) {
      status(feedback, 'Le jour 19 n’est pas encore ouvert.', 'error')
      return
    }
    const suggestion = cleanSuggestion(input.value)
    if (suggestion.length < 2) {
      status(feedback, 'Entre le nom d’un personnage (2 caractères minimum).', 'error')
      input.focus()
      return
    }
    sending = true
    send.disabled = true
    status(feedback, 'Envoi de ton choix…')
    try {
      currentVote = await saveOwnVote(user.id, currentVote, suggestion)
      myBubble.replaceChildren()
      addChatMessage(myBubble, currentVote.suggestion, 'athlete', currentVote.updated_at)
      send.textContent = 'Modifier mon choix ↗'
      status(feedback, 'Message envoyé à Guillaume ! Tu peux encore le modifier.', 'success')
    } catch (error) {
      console.error('Advent day19: unable to save vote', error)
      status(feedback, 'Envoi impossible. Réessaie lorsque la connexion fonctionne.', 'error')
    } finally {
      sending = false
      send.disabled = !day19Unlocked()
    }
  }
  void refresh()
}

async function fetchCoachVotes() {
  const { data: votes, error } = await supabase
    .from(ADVENT_DAY19_TABLE)
    .select('id, voter_id, suggestion, created_at, updated_at')
    .order('updated_at', { ascending: false })
  if (error) throw error
  const ids = [...new Set((votes || []).map(v => v.voter_id))]
  let members = []
  if (ids.length) {
    const memberResult = await supabase
      .from('app_users')
      .select('user_id, display_name, athlete_slug')
      .in('user_id', ids)
    if (memberResult.error) throw memberResult.error
    members = memberResult.data || []
  }
  return {
    votes: votes || [],
    members: new Map(members.map(m => [m.user_id, m])),
  }
}

function mountCoachInbox(main) {
  const section = element('section', 'advent19-inbox')
  const head = element('div', 'advent19-inbox__head')
  const heading = element('div')
  heading.append(element('span', 'advent19-eyebrow', 'ESPACE COACH · PRIVÉ'))
  heading.append(element('h3', '', 'Les propositions de l’équipe'))
  head.append(heading, button('↻ Actualiser', 'refresh', 'advent19-refresh'))
  section.append(head)
  section.append(element('p', 'advent19-help', 'Chaque athlète écrit librement un personnage. Tu vois toutes les réponses ici, avec un classement automatique des noms identiques.'))
  const info = element('p', 'advent19-status')
  info.setAttribute('role', 'status')
  section.append(info)

  const counters = element('div', 'advent19-stats')
  section.append(counters)
  const tallyTitle = element('h4', '', 'Résultats regroupés')
  section.append(tallyTitle)
  const tally = element('div', 'advent19-tally')
  section.append(tally)
  section.append(element('h4', '', 'Messages reçus'))
  const feed = element('div', 'advent19-feed')
  section.append(feed)
  main.append(section)

  let loading = false
  async function refresh() {
    if (loading) return
    loading = true
    status(info, 'Synchronisation des réponses…')
    try {
      const { votes, members } = await fetchCoachVotes()
      counters.replaceChildren()
      const total = element('div', 'advent19-stat')
      total.append(element('strong', '', String(votes.length)))
      total.append(element('span', '', 'athlètes ayant répondu'))
      counters.append(total)
      const unique = groupDay19Suggestions(votes)
      const count = element('div', 'advent19-stat')
      count.append(element('strong', '', String(unique.length)))
      count.append(element('span', '', 'propositions distinctes'))
      counters.append(count)
      tally.replaceChildren()
      feed.replaceChildren()
      if (!votes.length) {
        tally.append(element('p', 'advent19-empty', 'Aucune réponse pour le moment. Les messages apparaîtront ici dès le 19 décembre.'))
        feed.append(element('p', 'advent19-empty', 'La boîte de réception est prête.'))
      } else {
        unique.forEach((item, i) => {
          const line = element('div', 'advent19-tally__item')
          line.append(element('span', 'advent19-tally__rank', String(i + 1)))
          line.append(element('strong', '', item.name))
          line.append(element('span', 'advent19-tally__count', item.votes + (item.votes > 1 ? ' votes' : ' vote')))
          tally.append(line)
        })
        votes.forEach(vote => {
          const member = members.get(vote.voter_id)
          const card = element('article', 'advent19-message')
          const top = element('div', 'advent19-message__top')
          top.append(element('strong', '', member?.display_name || member?.athlete_slug || 'Athlète'))
          top.append(element('time', '', dateLabel(vote.updated_at)))
          card.append(top, element('p', '', vote.suggestion))
          feed.append(card)
        })
      }
      status(info, votes.length + (votes.length > 1 ? ' réponses enregistrées.' : ' réponse enregistrée.'), 'success')
    } catch (error) {
      console.error('Advent day19: unable to fetch coach inbox', error)
      status(info, 'Impossible de récupérer les réponses. Vérifie la connexion.', 'error')
    } finally {
      loading = false
    }
  }

  section.addEventListener('click', event => {
    if (event.target.closest('[data-advent-action="refresh"]')) void refresh()
  })
  void refresh()
}

export function mountAdventDay19(root, { member, user, onBack }) {
  if (!root || !member || !user) return
  const main = renderShell(root, onBack)
  if (member.role === 'coach') {
    mountCoachInbox(main)
  } else if (member.role === 'athlete') {
    mountAthleteChat(main, user)
  } else {
    main.append(element('p', 'advent19-help', 'Cette page est réservée aux membres de l’équipe.'))
  }
}
