import { mountProgramEditor } from './program-editor.js'
import { mountRpg } from './rpg.js'
import { getAthleteProgress, xpProgressFromTotal } from './xp.js'
import './style.css'
import './theme-spider.css'
import { getRecentActivities, getCurrentActivityUserId, toggleActivityLike } from './activity.js'

import {
  spiderMenuIcon,
} from './spider-menu-icons.js'

import {
  loadHomeLiveDashboard,
  startPresenceHeartbeat,
  stopPresenceHeartbeat,
} from './home-live.js'

import {
  createSbdLeaderboardState,
  isSbdLeaderboardLift,
  isSbdLeaderboardReps,
  loadSbdLeaderboard,
  renderSbdLeaderboard,
} from './sbd-leaderboard.js'

import {
  createStepsLeaderboardState,
  isStepsLeaderboardPeriod,
  isStepsLeaderboardYear,
  loadStepsLeaderboard,
  renderStepsLeaderboard,
} from './steps-leaderboard.js'

/* GA V1.2 HOME LIVE + SPIDER ICONS V7 */

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
  getAthleteTheme,
} from './athlete-themes.js'

import {
  signIn,
  getCurrentAuth,
  signOut,
} from './auth.js'

const app =
  document.querySelector('#app')

let currentUser = null
let currentMember = null
let sbdLeaderboardState =
  createSbdLeaderboardState()
let stepsLeaderboardState =
  createStepsLeaderboardState()
let leaderboardMode =
  localStorage.getItem('ga-leaderboard-mode-v1') === 'steps'
    ? 'steps'
    : 'gl'

function setAppBackdrop(
  athleteSlug = ''
) {
  const athleteTheme =
    athleteSlug
      ? getAthleteTheme(
          athleteSlug
        )
      : null

  document.body.dataset.appBackdrop =
    athleteTheme?.variant
      ? 'custom-athlete'
      : 'brigade'
}

function clearAppHandlers() {
  setAppBackdrop()

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

  stopPresenceHeartbeat()
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

  startPresenceHeartbeat({
    userId:
      currentUser?.id,
    member:
      currentMember,
  })

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

      <section class="cards">
        <button
          class="card"
          data-action="athletes"
        >
          <span class="card-icon card-icon--spider card-icon--athletes">
            ${spiderMenuIcon('athletes')}
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
          <span class="card-icon card-icon--spider card-icon--activity">
            ${spiderMenuIcon('activity')}
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

                ${
          currentMember?.role === 'coach'
            ? `
        <button
          class="card"
          data-action="program-editor"
          type="button"
        >
          <span class="card-icon card-icon--spider card-icon--editor">
            ${spiderMenuIcon('editor')}
          </span>

          <div>
            <strong>
              Éditeur Coach
            </strong>

            <span>
              Créer, modifier et publier les programmations
            </span>
          </div>

          <span class="arrow">
            ›
          </span>
        </button>
              `
            : ''
        }
        <button
          class="card"
          data-action="rpg"
        >
          <span class="card-icon card-icon--spider card-icon--rpg">
            ${spiderMenuIcon('rpg')}
          </span>

          <div>
            <strong>
              RPG
            </strong>

            <span>
              Ouvrir le hub RPG
            </span>
          </div>

          <span class="arrow">
            ›
          </span>
        </button>

        <button
          class="card"
          data-action="leaderboard"
          type="button"
        >
          <span class="card-icon card-icon--spider card-icon--leaderboard">
            ${spiderMenuIcon('leaderboard')}
          </span>

          <div>
            <strong>
              Leaderboards
            </strong>

            <span>
              GL SBD · Steps jour / semaine / mois / année
            </span>
          </div>

          <span class="arrow">
            ›
          </span>
        </button>
      </section>

      <section
        class="home-live-dashboard home-live-dashboard--bottom"
        data-home-live
      >
        <div class="home-live-loading">
          Chargement du groupe…
        </div>
      </section>
    </main>
  `

  void loadHomeLiveDashboard({
    athletes:
      visibleAthletes(),
  })

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
      stopPresenceHeartbeat()
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
      action.dataset.action ===
      'home-live-tab'
    ) {
      const tab =
        action.dataset.tab

      app.querySelectorAll(
        '[data-action="home-live-tab"]'
      ).forEach(button => {
        const active =
          button.dataset.tab === tab

        button.classList.toggle(
          'active',
          active
        )
        button.setAttribute(
          'aria-selected',
          String(active)
        )
      })

      app.querySelectorAll(
        '[data-home-live-panel]'
      ).forEach(panel => {
        const active =
          panel.dataset.homeLivePanel === tab

        panel.hidden = !active
        panel.classList.toggle(
          'active',
          active
        )
      })

      return
    }


    if (
      action.dataset.action ===
      'program-editor'
    ) {
      renderProgramEditorScreen()
      return
    }

    if (
      action.dataset.action === 'rpg'
    ) {
      await renderRpgScreen()
      return
    }

    if (
      action.dataset.action ===
      'leaderboard'
    ) {
      await renderSbdLeaderboardScreen()
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


async function renderSbdLeaderboardScreen() {
  clearAppHandlers()

  const renderLeaderboardBody = () => (
    leaderboardMode === 'steps'
      ? renderStepsLeaderboard({
          state:
            stepsLeaderboardState,
        })
      : renderSbdLeaderboard({
          state:
            sbdLeaderboardState,
        })
  )

  app.innerHTML = `
    <main class="app-shell leaderboard-shell">
      <header class="topbar">
        <button
          class="back-button"
          data-action="home"
          type="button"
        >
          ← Accueil
        </button>

        <div>
          <span class="version">LA BRIGADE DE L’ARAIGNÉE</span>
          <h1>Leaderboards</h1>
        </div>
      </header>

      <div
        class="sbd-leaderboard__lifts"
        style="grid-template-columns:repeat(2,minmax(0,1fr));margin-bottom:14px"
        role="tablist"
        aria-label="Type de classement"
      >
        <button
          type="button"
          role="tab"
          class="${leaderboardMode === 'gl' ? 'active' : ''}"
          aria-selected="${leaderboardMode === 'gl' ? 'true' : 'false'}"
          data-action="leaderboard-mode"
          data-mode="gl"
        >
          <b>🏋️ GL</b>
          <span>SBD par mouvement</span>
        </button>

        <button
          type="button"
          role="tab"
          class="${leaderboardMode === 'steps' ? 'active' : ''}"
          aria-selected="${leaderboardMode === 'steps' ? 'true' : 'false'}"
          data-action="leaderboard-mode"
          data-mode="steps"
        >
          <b>👟 Steps</b>
          <span>Classement du jour</span>
        </button>
      </div>

      <div data-leaderboard-body>
        ${renderLeaderboardBody()}
      </div>
    </main>
  `

  const rerender = () => {
    app
      .querySelectorAll(
        '[data-action="leaderboard-mode"]'
      )
      .forEach(button => {
        const active =
          button.dataset.mode ===
          leaderboardMode

        button.classList.toggle(
          'active',
          active
        )

        button.setAttribute(
          'aria-selected',
          String(active)
        )
      })

    const container =
      app.querySelector(
        '[data-leaderboard-body]'
      )

    if (container) {
      container.innerHTML =
        renderLeaderboardBody()
    }
  }

  const loadActiveLeaderboard =
    async ({
      force = false,
    } = {}) => {
      if (
        leaderboardMode ===
        'steps'
      ) {
        await loadStepsLeaderboard({
          state:
            stepsLeaderboardState,
          athletes:
            visibleAthletes(),
          force,
        })
      } else {
        await loadSbdLeaderboard({
          state:
            sbdLeaderboardState,
          athletes:
            visibleAthletes(),
          force,
        })
      }
    }

  app.onclick = async event => {
    const action =
      event.target.closest(
        '[data-action]'
      )

    if (!action) return

    if (
      action.dataset.action ===
      'home'
    ) {
      renderHome()
      return
    }

    if (
      action.dataset.action ===
      'leaderboard-mode'
    ) {
      const nextMode =
        action.dataset.mode ===
          'steps'
          ? 'steps'
          : 'gl'

      if (
        nextMode ===
        leaderboardMode
      ) {
        return
      }

      leaderboardMode =
        nextMode

      localStorage.setItem(
        'ga-leaderboard-mode-v1',
        leaderboardMode
      )

      rerender()
      await loadActiveLeaderboard()
      rerender()
      return
    }

    if (
      action.dataset.action ===
      'leaderboard-lift'
    ) {
      if (
        isSbdLeaderboardLift(
          action.dataset.lift
        )
      ) {
        sbdLeaderboardState.lift =
          action.dataset.lift
        rerender()
      }
      return
    }

    if (
      action.dataset.action ===
      'leaderboard-reps'
    ) {
      if (
        isSbdLeaderboardReps(
          action.dataset.reps
        )
      ) {
        sbdLeaderboardState.reps =
          Number(
            action.dataset.reps
          )
        rerender()
      }
      return
    }

    if (
      action.dataset.action ===
      'leaderboard-refresh'
    ) {
      rerender()

      await loadSbdLeaderboard({
        state:
          sbdLeaderboardState,
        athletes:
          visibleAthletes(),
        force: true,
      })

      rerender()
      return
    }

    if (
      action.dataset.action ===
      'steps-period'
    ) {
      const period =
        action.dataset.period

      if (
        isStepsLeaderboardPeriod(
          period
        ) &&
        stepsLeaderboardState.period !==
          period
      ) {
        stepsLeaderboardState.period =
          period

        localStorage.setItem(
          'ga-steps-period-v2',
          period
        )

        stepsLeaderboardState.loaded =
          false
        stepsLeaderboardState.rows =
          []

        rerender()

        await loadStepsLeaderboard({
          state:
            stepsLeaderboardState,
          athletes:
            visibleAthletes(),
          force: true,
        })

        rerender()
      }

      return
    }

    if (
      action.dataset.action ===
      'steps-year'
    ) {
      const year =
        Number(
          action.dataset.year
        )

      if (
        isStepsLeaderboardYear(
          year
        ) &&
        Number(
          stepsLeaderboardState.year
        ) !==
          year
      ) {
        stepsLeaderboardState.year =
          year

        localStorage.setItem(
          'ga-steps-year-v2',
          String(year)
        )

        stepsLeaderboardState.loaded =
          false
        stepsLeaderboardState.rows =
          []

        rerender()

        await loadStepsLeaderboard({
          state:
            stepsLeaderboardState,
          athletes:
            visibleAthletes(),
          force: true,
        })

        rerender()
      }

      return
    }

    if (
      action.dataset.action ===
      'steps-leaderboard-refresh'
    ) {
      rerender()

      await loadStepsLeaderboard({
        state:
          stepsLeaderboardState,
        athletes:
          visibleAthletes(),
        force: true,
      })

      rerender()
    }
  }

  await loadActiveLeaderboard()
  rerender()
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


/* PROGRAM EDITOR V1 */

function renderProgramEditorScreen() {
  if (
    currentMember?.role !==
    'coach'
  ) {
    renderHome()
    return
  }

  clearAppHandlers()

  mountProgramEditor(
    app,
    {
      athletes:
        visibleAthletes(),

      onBack:
        () => {
          renderHome()
        },
    }
  )
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
  clemence: '/avatar-clemence.png?v=20260916-v251',
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


/* ATHLETE PROGRAM CARD META V3 */

function normalizeArray(value) {
  return Array.isArray(value) ? value : []
}

function countExerciseSets(exercise) {
  if (Array.isArray(exercise?.sets)) {
    return exercise.sets.length
  }

  if (Array.isArray(exercise?.series)) {
    return exercise.series.length
  }

  const numericSets = Number(
    exercise?.setCount ??
    exercise?.setsCount ??
    exercise?.numberOfSets
  )

  return Number.isFinite(numericSets)
    ? numericSets
    : 0
}

function summarizeAthleteProgram(program) {
  const directBlocks = normalizeArray(program?.blocks)

  const blocks = directBlocks.length
    ? directBlocks
    : [{
        weeks: normalizeArray(program?.weeks),
      }]

  const lastBlock = blocks[blocks.length - 1] || {}
  const weeks = normalizeArray(lastBlock?.weeks)

  let totalSets = 0
  let totalDays = 0

  for (const week of weeks) {
    const days = normalizeArray(
      week?.days ??
      week?.sessions
    )

    totalDays += days.length

    for (const day of days) {
      const exercises = normalizeArray(
        day?.exercises ??
        day?.items
      )

      for (const exercise of exercises) {
        totalSets += countExerciseSets(exercise)
      }
    }
  }

  const blockNumber = blocks.length
  const weekCount = weeks.length

  const declaredCurrentWeek = Number(
    program?.currentWeek ??
    program?.current_week ??
    lastBlock?.currentWeek ??
    lastBlock?.current_week
  )

  const currentWeek =
    Number.isFinite(declaredCurrentWeek) &&
    declaredCurrentWeek > 0
      ? Math.min(declaredCurrentWeek, Math.max(weekCount, 1))
      : null

  return {
    primary: currentWeek
      ? 'Bloc ' +
        blockNumber +
        ' · Semaine ' +
        currentWeek +
        '/' +
        Math.max(weekCount, currentWeek)
      : 'Dernier bloc ' +
        blockNumber +
        ' · ' +
        weekCount +
        ' semaine' +
        (weekCount === 1 ? '' : 's'),

    secondary:
      'Total bloc : ' +
      totalSets +
      ' series · ' +
      totalDays +
      ' seance' +
      (totalDays === 1 ? '' : 's'),
  }
}

async function buildAthleteCardMeta(list) {
  const entries = await Promise.all(
    list.map(async athlete => {
      try {
        const program =
          await getProgramForAthlete(
            athlete.id
          )

        return [
          athlete.id,
          summarizeAthleteProgram(program),
        ]
      } catch (error) {
        console.warn(
          'Resume programme indisponible :',
          athlete.id,
          error
        )

        return [
          athlete.id,
          {
            primary: 'Programme indisponible',
            secondary: 'Aucun total',
          },
        ]
      }
    })
  )

  return new Map(entries)
}

async function renderAthletes() {
  clearAppHandlers()

  const list =
    visibleAthletes()

  

  const athleteCardMeta =
    await buildAthleteCardMeta(
      list
    )

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

              <div class="athlete-card-copy">
                <strong>
                  ${athlete.name}
                </strong>

                <span class="athlete-card-program">
                  ${
                    athleteCardMeta.get(
                      athlete.id
                    )?.primary ||
                    'Programme'
                  }
                </span>

                <small class="athlete-card-total">
                  ${
                    athleteCardMeta.get(
                      athlete.id
                    )?.secondary ||
                    'Aucun total'
                  }
                </small>
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

  setAppBackdrop(
    athlete.cloudSlug ||
    athlete.slug ||
    athlete.id
  )

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

    const athleteSlug =
      athlete.cloudSlug ||
      athlete.slug ||
      athlete.id

    setAppBackdrop(
      athleteSlug
    )

    mountTraining(
      app,
      () => {
        renderAthletes()
      },
      program,
      {
        cloudAthleteSlug:
          athleteSlug,

        bodyWeight:
          athlete.bodyWeight,

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
