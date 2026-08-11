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

const app =
  document.querySelector('#app')

function clearAppHandlers() {
  app.onclick = null
  app.onchange = null
  app.oninput = null
}

function renderHome() {
  clearAppHandlers()

  app.innerHTML = `
    <main class="app-shell">
      <header class="topbar">
        <div>
          <span class="version">
            GA COACHING · V2
          </span>
          <h1>Coaching</h1>
        </div>

        <div class="status">
          <span class="status-dot"></span>
          Local
        </div>
      </header>

      <section class="hero">
        <span class="eyebrow">
          NOUVELLE APPLICATION
        </span>

        <h2>
          Une base propre.<br>
          Un moteur stable.
        </h2>

        <p>
          Les programmes sont chargés uniquement
          lorsque l'athlète est ouvert.
        </p>
      </section>

      <section class="cards">
        <button
          class="card"
          data-action="athletes"
        >
          <span class="card-icon">👤</span>
          <div>
            <strong>Athlètes</strong>
            <span>${athletes.length} profils importés</span>
          </div>
          <span class="arrow">›</span>
        </button>

        <button class="card disabled">
          <span class="card-icon">📊</span>
          <div>
            <strong>Activité</strong>
            <span>Bientôt disponible</span>
          </div>
          <span class="arrow">›</span>
        </button>

        <button class="card disabled">
          <span class="card-icon">⚔️</span>
          <div>
            <strong>RPG</strong>
            <span>On le remettra plus tard</span>
          </div>
          <span class="arrow">›</span>
        </button>
      </section>
    </main>
  `

  app.onclick = (event) => {
    const action =
      event.target.closest('[data-action]')

    if (
      action?.dataset.action ===
      'athletes'
    ) {
      renderAthletes()
    }
  }
}

function renderAthletes() {
  clearAppHandlers()

  app.innerHTML = `
    <main class="app-shell">
      <header class="topbar">
        <div>
          <span class="version">
            GA COACHING · V2
          </span>
          <h1>Athlètes</h1>
        </div>

        <button
          class="back-button"
          data-action="home"
        >
          ← Accueil
        </button>
      </header>

      <section class="hero athletes-hero">
        <span class="eyebrow">
          PROFILS
        </span>

        <h2>
          Choisir un athlète.
        </h2>

        <p>
          ${athletes.length} profils utilisent maintenant
          le même moteur V2.
        </p>
      </section>

      <section class="cards athlete-list">
        ${athletes.map(
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

              <span class="arrow">›</span>
            </button>
          `
        ).join('')}
      </section>
    </main>
  `

  app.onclick = (event) => {
    const action =
      event.target.closest('[data-action]')

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

function renderLoadingAthlete(athlete) {
  clearAppHandlers()

  app.innerHTML = `
    <main class="app-shell">
      <header class="topbar">
        <div>
          <span class="version">
            GA COACHING · V2
          </span>
          <h1>${athlete.name}</h1>
        </div>
      </header>

      <section class="hero">
        <span class="eyebrow">
          CHARGEMENT
        </span>
        <h2>Programme…</h2>
        <p>
          Chargement du programme de ${athlete.name}.
        </p>
      </section>
    </main>
  `
}

async function openAthlete(
  athleteId
) {
  const athlete =
    athletes.find(
      (item) =>
        item.id === athleteId
    )

  if (!athlete) {
    window.alert(
      'Athlète introuvable.'
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
      renderAthletes,
      program
    )
  } catch (error) {
    console.error(error)

    window.alert(
      `Impossible de charger le programme de ${athlete.name}.`
    )

    renderAthletes()
  }
}

renderHome()
