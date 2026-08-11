import { mountRpg } from './rpg.js'
import { getAthleteProgress, xpProgressFromTotal } from './xp.js'
import './style.css'
import './theme-spider.css'
import { getRecentActivities, getCurrentActivityUserId, toggleActivityLike } from './activity.js'

import {
  athletes,
} from './athletes.js'

import {
  getProgramForAthlete,
} from './program.js'

import {
  mountTraining,
} from './training.js'

import {
  signIn,
  getCurrentAuth,
  signOut,
} from './auth.js'

const app =
  document.querySelector('#app')

let currentUser = null
let currentMember = null

function clearAppHandlers() {
  app.onclick = null
  app.onchange = null
  app.oninput = null
  app.onsubmit = null
}

function normalizeSlug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '')
}

function resolveAthleteIdFromMember() {
  if (
    !currentMember ||
    currentMember.role !== 'athlete'
  ) {
    return null
  }

  const requested =
    normalizeSlug(
      currentMember.athlete_slug
    )

  const exact =
    athletes.find(
      (athlete) =>
        normalizeSlug(
          athlete.id
        ) === requested ||
        normalizeSlug(
          athlete.cloudSlug
        ) === requested
    )

  if (exact) {
    return exact.id
  }

  const aliases = {
    anzalone: 'guillaume',
    guillaume: 'guillaume',
    yannick: 'yann',
    yann: 'yann',
    theflop: 'flop',
    flop: 'flop',
    clarametaknight: 'metaknight',
  }

  return aliases[requested] || null
}

function visibleAthletes() {
  if (
    currentMember?.role === 'coach' ||
    currentMember?.role === 'athlete'
  ) {
    return athletes
  }

  return []
}

function renderLoading() {
  clearAppHandlers()

  app.innerHTML = `
    <main class="app-shell auth-shell">
      <section class="auth-card">
        <span class="eyebrow">
          GA COACHING · V2
        </span>

        <h1>
          Chargement…
        </h1>

        <p class="auth-copy">
          Vérification de ta session.
        </p>
      </section>
    </main>
  `
}

function renderLogin(
  message = '',
  isError = false
) {
  currentUser = null
  currentMember = null

  clearAppHandlers()

  app.innerHTML = `
    <main class="app-shell auth-shell">
      <section class="auth-card">
        <div class="auth-brand">
          <span class="version">
            GA COACHING · V2
          </span>

          <h1>
            Connexion
          </h1>

          <p class="auth-copy">
            Connecte-toi avec le même compte
            que sur l'application actuelle.
          </p>
        </div>

        <form
          class="auth-form"
          id="loginForm"
        >
          <label class="auth-field">
            <span>E-mail</span>

            <input
              id="loginEmail"
              type="email"
              autocomplete="email"
              required
              placeholder="nom@email.com"
            >
          </label>

          <label class="auth-field">
            <span>Mot de passe</span>

            <input
              id="loginPassword"
              type="password"
              autocomplete="current-password"
              required
              placeholder="••••••••"
            >
          </label>

          <button
            class="auth-submit"
            type="submit"
          >
            Se connecter
          </button>

          <p
            class="auth-message ${
              isError
                ? 'auth-message--error'
                : ''
            }"
            id="authMessage"
          >
            ${message}
          </p>
        </form>
      </section>
    </main>
  `

  app.onsubmit = async (
    event
  ) => {
    if (
      event.target.id !==
      'loginForm'
    ) {
      return
    }

    event.preventDefault()

    const email =
      document
        .querySelector(
          '#loginEmail'
        )
        ?.value || ''

    const password =
      document
        .querySelector(
          '#loginPassword'
        )
        ?.value || ''

    const button =
      event.target.querySelector(
        '.auth-submit'
      )

    const messageElement =
      document.querySelector(
        '#authMessage'
      )

    button.disabled = true
    button.textContent =
      'Connexion…'

    if (messageElement) {
      messageElement.textContent = ''
      messageElement.classList.remove(
        'auth-message--error'
      )
    }

    const result =
      await signIn(
        email,
        password
      )

    if (result.error) {
      button.disabled = false
      button.textContent =
        'Se connecter'

      if (messageElement) {
        messageElement.textContent =
          result.error.message ||
          'Connexion impossible.'

        messageElement.classList.add(
          'auth-message--error'
        )
      }

      return
    }

    currentUser =
      result.user

    currentMember =
      result.member

    routeAuthenticatedUser()
  }
}

function renderPending() {
  clearAppHandlers()

  app.innerHTML = `
    <main class="app-shell auth-shell">
      <section class="auth-card">
        <span class="eyebrow">
          COMPTE CONNECTÉ
        </span>

        <h1>
          Accès à valider
        </h1>

        <p class="auth-copy">
          Ton compte Supabase est bien connecté,
          mais son accès GA Coaching n'est pas encore
          autorisé dans app_users.
        </p>

        <button
          class="auth-submit"
          data-action="logout"
        >
          Se déconnecter
        </button>
      </section>
    </main>
  `

  app.onclick =
    handleLogoutClick
}

function renderNoAthlete() {
  clearAppHandlers()

  app.innerHTML = `
    <main class="app-shell auth-shell">
      <section class="auth-card">
        <span class="eyebrow">
          PROFIL ATHLÈTE
        </span>

        <h1>
          Profil introuvable
        </h1>

        <p class="auth-copy">
          Ton compte est bien autorisé,
          mais athlete_slug ne correspond
          à aucun profil importé dans la V2.
        </p>

        <button
          class="auth-submit"
          data-action="logout"
        >
          Se déconnecter
        </button>
      </section>
    </main>
  `

  app.onclick =
    handleLogoutClick
}

async function handleLogoutClick(
  event
) {
  const action =
    event.target.closest(
      '[data-action]'
    )

  if (
    action?.dataset.action !==
    'logout'
  ) {
    return
  }

  await signOut()
  renderLogin(
    'Tu es déconnecté.'
  )
}

function routeAuthenticatedUser() {
  if (
    !currentUser ||
    !currentMember ||
    !currentMember.role ||
    currentMember.role ===
      'pending'
  ) {
    renderPending()
    return
  }

  if (
    currentMember.role ===
    'athlete'
  ) {
    const athleteId =
      resolveAthleteIdFromMember()

    if (!athleteId) {
      renderNoAthlete()
      return
    }

    renderHome()
    return
  }

  renderHome()
}


function homeProgressSlug() {
  let slug =
    currentMember?.athlete_slug ||
    currentMember?.athleteSlug ||
    ''

  if (
    !slug &&
    currentMember?.role === 'athlete'
  ) {
    const athletes =
      visibleAthletes()

    if (athletes.length === 1) {
      slug =
        athletes[0]?.slug ||
        athletes[0]?.id ||
        ''
    }
  }

  return String(slug || '')
    .trim()
    .toLowerCase()
}

function formatXpValue(
  value,
  digits = 1
) {
  return Number(value || 0)
    .toLocaleString(
      'fr-FR',
      {
        maximumFractionDigits:
          digits,
      }
    )
}

function homeXpCardHtml(
  progress
) {
  const xp =
    Number(
      progress?.xp_total || 0
    )

  const calculated =
    xpProgressFromTotal(xp)

  const level =
    Math.max(
      1,
      Math.floor(
        Number(
          progress?.level || 1
        )
      ),
      calculated.level
    )

  const into =
    calculated.into

  const cost =
    Math.max(
      1,
      calculated.cost
    )

  const percent =
    Math.max(
      0,
      Math.min(
        100,
        into / cost * 100
      )
    )

  const gl =
    Number(
      progress?.gl_points || 0
    )

  const multiplier =
    Number(
      progress?.gl_multiplier || 1
    )

  const gold =
    Number(
      progress?.gold_balance || 0
    )

  const packs =
    Number(
      progress?.unopened_packs || 0
    )

  return `
    <div class="home-xp-head">
      <div>
        <span class="home-xp-label">
          PROGRESSION RPG
        </span>

        <strong>
          Niveau ${level}
        </strong>
      </div>

      <span class="home-xp-pack">
        🎁 ${formatXpValue(packs, 0)}
      </span>
    </div>

    <div class="home-xp-total">
      ${formatXpValue(xp, 1)}
      <small>
        XP au total
      </small>
    </div>

    <div class="home-xp-progress">
      <span
        style="width:${percent}%"
      ></span>
    </div>

    <div class="home-xp-next">
      <span>
        ${formatXpValue(into, 1)}
        /
        ${formatXpValue(cost, 0)}
        XP
      </span>

      <span>
        Niveau ${level + 1}
      </span>
    </div>

    <div class="home-xp-stats">
      <div>
        <b>
          ${gl > 0
            ? formatXpValue(gl, 1)
            : '—'}
        </b>
        <span>GL Points</span>
      </div>

      <div>
        <b>
          ×${formatXpValue(
            multiplier,
            2
          )}
        </b>
        <span>Coefficient GL</span>
      </div>

      <div>
        <b>
          🪙 ${formatXpValue(
            gold,
            0
          )}
        </b>
        <span>Gold</span>
      </div>

      <div>
        <b>
          🎁 ${formatXpValue(
            packs,
            0
          )}
        </b>
        <span>Packs</span>
      </div>
    </div>
  `
}

async function loadHomeProgress() {
  const container =
    document.querySelector(
      '[data-home-xp]'
    )

  if (!container) {
    return
  }

  const slug =
    homeProgressSlug()

  if (!slug) {
    container.innerHTML = `
      <div class="home-xp-empty">
        <strong>
          Progression RPG
        </strong>

        <span>
          Les statistiques XP apparaissent
          ici sur un profil athlète.
        </span>
      </div>
    `

    return
  }

  try {
    const progress =
      await getAthleteProgress(
        slug
      )

    if (!progress) {
      container.innerHTML =
        homeXpCardHtml({
          xp_total: 0,
          level: 1,
          unopened_packs: 0,
          gl_points: 0,
          gl_multiplier: 1,
          gold_balance: 0,
        })

      return
    }

    container.innerHTML =
      homeXpCardHtml(
        progress
      )
  } catch (error) {
    console.error(
      'Progression accueil impossible :',
      error
    )

    container.innerHTML = `
      <div class="home-xp-empty">
        Progression RPG indisponible.
      </div>
    `
  }
}

function renderHome() {
  clearAppHandlers()

  const displayName =
    currentMember?.display_name ||
    currentMember?.email ||
    'Coach'

  app.innerHTML = `
    <main class="app-shell">
      <header class="topbar">
        <div>
          <span class="version">
            GA COACHING · V2
          </span>

          <h1>
            Coaching
          </h1>
        </div>

        <button
          class="status status-button"
          data-action="logout"
          type="button"
        >
          <span class="status-dot"></span>
          ${displayName}
        </button>
      </header>

      <section class="hero">
        <span class="eyebrow">
          SESSION CONNECTÉE
        </span>

        <h2>
          Une base propre.<br>
          Un moteur stable.
        </h2>

        <p>
          Supabase Auth est maintenant connecté
          à la nouvelle application.
        </p>
      </section>

            <section
        class="home-xp-card"
        data-home-xp
      >
        <div class="home-xp-loading">
          Chargement de la progression...
        </div>
      </section>

      <section class="cards">
        <button
          class="card"
          data-action="athletes"
        >
          <span class="card-icon">
            👤
          </span>

          <div>
            <strong>
              Athlètes
            </strong>

            <span>
              ${visibleAthletes().length}
              profil(s) accessible(s)
            </span>
          </div>

          <span class="arrow">
            ›
          </span>
        </button>

        <button
          class="card"
          data-action="activity"
        >
          <span class="card-icon">
            📊
          </span>

          <div>
            <strong>
              Activité
            </strong>

            <span>
              Voir les derni&egrave;res s&eacute;ances
            </span>
          </div>

          <span class="arrow">
            ›
          </span>
        </button>

        <button
          class="card disabled"
          data-action="rpg"
        >
          <span class="card-icon">
            ⚔️
          </span>

          <div>
            <strong>
              RPG
            </strong>

            <span>
              On le remettra plus tard
            </span>
          </div>

          <span class="arrow">
            ›
          </span>
        </button>
      </section>
    </main>
  `

  void loadHomeProgress()

  app.onclick = async (
    event
  ) => {
    const action =
      event.target.closest(
        '[data-action]'
      )

    if (!action) {
      return
    }

    if (
      action.dataset.action ===
      'logout'
    ) {
      await signOut()

      renderLogin(
        'Tu es déconnecté.'
      )

      return
    }

    if (
      action.dataset.action ===
      'athletes'
    ) {
      renderAthletes()
    }

    if (
      action.dataset.action === 'rpg'
    ) {
      await renderRpgScreen()
      return
    }

    if (
      action.dataset.action === 'activity'
    ) {
      await renderActivities()
      return
    }
  }
}



async function renderRpgScreen() {
  clearAppHandlers()

  const list =
    visibleAthletes()

  const ownId =
    resolveAthleteIdFromMember()

  const ownAthlete =
    list.find(
      (athlete) =>
        athlete.id === ownId
    )

  const ownSlug =
    String(
      ownAthlete?.cloudSlug ||
      ownAthlete?.slug ||
      ownAthlete?.id ||
      currentMember?.athlete_slug ||
      ''
    )

  const isCoach =
    currentMember?.role === 'coach'

  await mountRpg(
    app,
    {
      athletes: list,

      initialSlug:
        isCoach
          ? ''
          : ownSlug,

      allowAthleteSelection:
        isCoach,

      canEditAthlete:
        (slug) => {
          if (isCoach) {
            return true
          }

          return (
            normalizeSlug(slug) ===
            normalizeSlug(ownSlug)
          )
        },

      onBack:
        renderHome,
    }
  )
}

function escapeActivityHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function formatActivityDate(value) {
  if (!value) return ''

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat(
    'fr-FR',
    {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }
  ).format(date)
}

async function renderActivities() {
  clearAppHandlers()

  app.innerHTML = `
    <main class="app-shell">
      <header class="topbar activity-topbar">
        <button
          class="back-button"
          data-action="home"
          type="button"
        >
          &lsaquo; Accueil
        </button>

        <h1>Activit&eacute;s</h1>
      </header>

      <section class="hero activity-hero">
        <span class="eyebrow">
          FIL D'ACTIVIT&Eacute;
        </span>

        <h2>
          Les derni&egrave;res performances
        </h2>
      </section>

      <section class="cloud-feed">
        <div class="cloud-feed-empty">
          Chargement...
        </div>
      </section>
    </main>
  `

  app.onclick = async (event) => {
    const action = event.target.closest('[data-action]')

    if (!action) return

    if (action.dataset.action === 'home') {
      renderHome()
      return
    }

    if (action.dataset.action === 'activity-like') {
      const activityId = action.dataset.activityId
      const liked = action.dataset.liked === '1'

      action.disabled = true

      try {
        await toggleActivityLike(activityId, liked)
        await renderActivities()
      } catch (error) {
        console.error('Erreur like:', error)
        action.disabled = false
      }
    }
  }

  try {
    const activities =
      await getRecentActivities(50)

    const userId =
      await getCurrentActivityUserId()

    const feed =
      document.querySelector('.cloud-feed')

    if (!feed) return

    if (!activities.length) {
      feed.innerHTML = `
        <div class="cloud-feed-empty">
          Aucune activit&eacute; pour le moment.
        </div>
      `
      return
    }

    feed.innerHTML = activities.map((activity) => {
      const reps =
        activity.actual_reps ??
        activity.reps

      const details = [
        activity.load_kg != null
          ? `${activity.load_kg} kg`
          : '',
        reps != null
          ? `${reps} reps`
          : '',
        activity.rpe != null
          ? `RPE ${activity.rpe}`
          : '',
        activity.new_pr
          ? 'Nouveau PR'
          : ''
      ].filter(Boolean).join(' &middot; ')

      const isPr =
        activity.activity_type === 'pr' ||
        activity.activity_type === 'accessory_pr' ||
        Boolean(activity.new_pr)

      const likes =
        Array.isArray(activity.activity_likes)
          ? activity.activity_likes
          : []

      const liked =
        Boolean(
          userId &&
          likes.some(
            (like) => like.user_id === userId
          )
        )

      return `
        <article class="cloud-activity${isPr ? ' cloud-activity-pr' : ''}">
          <div class="cloud-activity-emoji">
            ${escapeActivityHtml(
              activity.athlete_emoji || '\u{1F3CB}\uFE0F'
            )}
          </div>

          <div class="cloud-activity-body">
            <div class="cloud-activity-text">
              <strong>
                ${isPr ? '<span class="activity-pr-badge">PR</span>' : ''}
                ${escapeActivityHtml(
                  activity.athlete_name ||
                  activity.athlete_slug ||
                  'Athlete'
                )}
              </strong>

              <span>
                ${escapeActivityHtml(
                  activity.exercise_name ||
                  activity.details_text ||
                  'Entrainement'
                )}
              </span>
            </div>

            <div class="cloud-activity-meta">
              <span>${details}</span>
              <span>
                ${formatActivityDate(activity.created_at)}
              </span>
            </div>

            <button
              class="cloud-like${liked ? ' liked' : ''}"
              data-action="activity-like"
              data-activity-id="${activity.id}"
              data-liked="${liked ? '1' : '0'}"
              type="button"
            >
              ${liked ? '&#9829;' : '&#9825;'}
              ${likes.length}
            </button>
          </div>
        </article>
      `
    }).join('')
  } catch (error) {
    console.error(error)

    const feed =
      document.querySelector('.cloud-feed')

    if (feed) {
      feed.innerHTML = `
        <div class="cloud-feed-empty">
          Impossible de charger les activit&eacute;s.
        </div>
      `
    }
  }
}


const ATHLETE_CHOICE_AVATARS = {
  alexandre: '/avatar-alexandre.png',
  benoit: '/avatar-benoit.png',
  celia: '/avatar-celia.png',
  charles: '/avatar-charles.png',
  clemosaurus: '/avatar-clemosaurus.png',
  dorian: '/avatar-dorian.png',
  duane: '/avatar-duane.png',
  flop: '/avatar-flop.png',
  gibertini: '/avatar-gibertini.png',
  guillaume: '/avatar-guillaume.png',
  hugo: '/avatar-hugo.png',
  janel: '/avatar-janel.png',
  jolan: '/avatar-jolan.png',
  jonathan: '/avatar-jonathan.png',
  kaoutar: '/avatar-kaoutar.png',
  killian: '/avatar-killian.png',
  lou: '/avatar-lou.png',
  louis: '/avatar-louis.png',
  lucine: '/avatar-lucine.png',
  magicarpe: '/avatar-magicapre.png',
  malo: '/avatar-malo.png',
  marvin: '/avatar-marvin-v202.png',
  matthieu: '/avatar-Matthieu.png',
  maxence: '/avatar-Maxence.png',
  metaknight: '/avatar-Metaknight.png',
  noe: '/avatar-Noe.png',
  sarah: '/avatar-sarah.png',
  saya: '/avatar-saya.png',
  serena: '/avatar-serena.png',
  tom: '/avatar-tom.png',
  yann: '/avatar-yann.png',
}

function athleteChoiceKey(
  athlete
) {
  return String(
    athlete?.cloudSlug ||
    athlete?.slug ||
    athlete?.id ||
    ''
  )
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function athleteChoiceAvatar(
  athlete
) {
  return (
    ATHLETE_CHOICE_AVATARS[
      athleteChoiceKey(
        athlete
      )
    ] || ''
  )
}

function athleteChoiceAvatarHtml(
  athlete
) {
  const src =
    athleteChoiceAvatar(
      athlete
    )

  if (!src) {
    return `
      <span class="athlete-choice-fallback">
        ${athlete?.emoji || '???'}
      </span>
    `
  }

  return `
    <img
      src="${src}"
      alt=""
      loading="lazy"
    >
  `
}

function renderAthletes() {
  clearAppHandlers()

  const list =
    visibleAthletes()

  app.innerHTML = `
    <main class="app-shell">
      <header class="topbar">
        <div>
          <span class="version">
            GA COACHING · V2
          </span>

          <h1>
            Athlètes
          </h1>
        </div>

        <button
          class="back-button"
          data-action="home"
        >
          ← Accueil
        </button>
      </header>

      <section
        class="hero athletes-hero"
      >
        <span class="eyebrow">
          PROFILS
        </span>

        <h2>
          Choisir un athlète.
        </h2>

        <p>
          ${list.length}
          profil(s) accessible(s)
          avec ce compte.
        </p>
      </section>

      <section
        class="cards athlete-list"
      >
        ${list.map(
          (athlete) => `
            <button
              class="card athlete-card"
              data-action="athlete"
              data-athlete-id="${athlete.id}"
            >
              <span class="card-icon athlete-choice-avatar">
                ${athleteChoiceAvatarHtml(
                  athlete
                )}
              </span>

              <div>
                <strong>
                  ${athlete.name}
                </strong>

                <span>
                  ${
                    athlete.bodyWeight
                      ? `${athlete.bodyWeight} kg`
                      : 'Poids non renseigné'
                  }
                  ${
                    athlete.blockCount > 1
                      ? ` · ${athlete.blockCount} blocs`
                      : ''
                  }
                </span>
              </div>

              <span class="arrow">
                ›
              </span>
            </button>
          `
        ).join('')}
      </section>
    </main>
  `

  app.onclick = (
    event
  ) => {
    const action =
      event.target.closest(
        '[data-action]'
      )

    if (!action) {
      return
    }

    if (
      action.dataset.action ===
      'home'
    ) {
      renderHome()
      return
    }

    if (
      action.dataset.action ===
      'athlete'
    ) {
      openAthlete(
        action.dataset.athleteId
      )
    }
  }
}

function renderLoadingAthlete(
  athlete
) {
  clearAppHandlers()

  app.innerHTML = `
    <main class="app-shell">
      <section class="auth-card">
        <span class="eyebrow">
          CHARGEMENT
        </span>

        <h1>
          ${athlete.name}
        </h1>

        <p class="auth-copy">
          Chargement du programme…
        </p>
      </section>
    </main>
  `
}

async function openAthlete(
  athleteId
) {
  const allowedAthletes =
    visibleAthletes()

  const athlete =
    allowedAthletes.find(
      (item) =>
        item.id === athleteId
    )

  if (!athlete) {
    window.alert(
      'Accès à cet athlète non autorisé.'
    )

    return
  }

  renderLoadingAthlete(
    athlete
  )

  try {
    const program =
      await getProgramForAthlete(
        athlete.id
      )

    if (!program) {
      throw new Error(
        'Programme introuvable'
      )
    }

    clearAppHandlers()

    mountTraining(
      app,
      () => {
        renderAthletes()
      },
      program,
      {
        cloudAthleteSlug:
          athlete.cloudSlug ||
          athlete.slug ||
          athlete.id,

        canEdit:
          currentMember?.role === 'coach' ||
          (
            currentMember?.role === 'athlete' &&
            athlete.id ===
              resolveAthleteIdFromMember()
          ),
      }
    )
  } catch (error) {
    console.error(error)

    window.alert(
      `Impossible de charger le programme de ${athlete.name}.`
    )

    routeAuthenticatedUser()
  }
}

async function boot() {
  renderLoading()

  const result =
    await getCurrentAuth()

  if (
    result.error &&
    !result.user
  ) {
    renderLogin()
    return
  }

  if (!result.user) {
    renderLogin()
    return
  }

  currentUser =
    result.user

  currentMember =
    result.member

  routeAuthenticatedUser()
}

boot()
