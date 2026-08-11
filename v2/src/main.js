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

          <h1>
            Coaching
          </h1>
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
          Le nouveau moteur d'entraînement
          est maintenant séparé des profils
          et des programmes.
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
              Choisir un profil
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

  app.onclick = (event) => {
    const action =
      event.target.closest(
        '[data-action]'
      )

    if (!action) {
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

      <section class="hero athletes-hero">

        <span class="eyebrow">
          PROFILS
        </span>

        <h2>
          Choisir un athlète.
        </h2>

        <p>
          Chaque profil possède son propre
          programme et sa propre progression.
        </p>

      </section>

      <section class="cards athlete-list">

        ${athletes
          .map(
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
                  </span>

                </div>

                <span class="arrow">
                  ›
                </span>

              </button>
            `
          )
          .join('')}

      </section>

    </main>
  `

  app.onclick = (event) => {
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
      const athleteId =
        action.dataset.athleteId

      openAthlete(
        athleteId
      )
    }
  }
}

function openAthlete(
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

  const program =
    getProgramForAthlete(
      athlete.id
    )

  if (!program) {
    window.alert(
      `Aucun programme disponible pour ${athlete.name}.`
    )

    return
  }

  clearAppHandlers()

  mountTraining(
    app,

    () => {
      renderAthletes()
    },

    program
  )
}

renderHome()