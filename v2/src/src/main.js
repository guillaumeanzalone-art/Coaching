import './style.css'

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
    currentMember?.role === 'coach'
  ) {
    return athletes
  }

  if (
    currentMember?.role === 'athlete'
  ) {
    const athleteId =
      resolveAthleteIdFromMember()

    if (!athleteId) {
      return []
    }

    return athletes.filter(
      (athlete) =>
        athlete.id === athleteId
    )
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

    openAthlete(
      athleteId
    )

    return
  }

  renderHome()
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
          class="card disabled"
        >
          <span class="card-icon">
            📊
          </span>

          <div>
            <strong>
              Activité
            </strong>

            <span>
              Bientôt disponible
            </span>
          </div>

          <span class="arrow">
            ›
          </span>
        </button>

        <button
          class="card disabled"
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
  }
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
              <span class="card-icon">
                ${athlete.emoji}
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
        if (
          currentMember?.role ===
          'athlete'
        ) {
          renderHome()
          return
        }

        renderAthletes()
      },
      program,
      {
        cloudAthleteSlug:
          currentMember?.role === 'athlete'
            ? currentMember.athlete_slug
            : athlete.cloudSlug,
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
