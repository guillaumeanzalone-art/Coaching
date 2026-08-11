import './style.css'
import { mountTraining } from './training.js'

const app = document.querySelector('#app')

function renderHome() {
  app.innerHTML = `
    <main class="app-shell">

      <header class="topbar">
        <div>
          <span class="version">GA COACHING · V2</span>
          <h1>Coaching</h1>
        </div>

        <div class="status">
          <span class="status-dot"></span>
          Local
        </div>
      </header>

      <section class="hero">
        <span class="eyebrow">NOUVELLE APPLICATION</span>

        <h2>
          Une base propre.<br>
          Un moteur stable.
        </h2>

        <p>
          On reconstruit progressivement le suivi d'entraînement
          sans les anciens patchs.
        </p>
      </section>

      <section class="cards">

        <button class="card" id="trainingButton">
          <span class="card-icon">🏋️</span>

          <div>
            <strong>Entraînement</strong>
            <span>Ouvrir une séance</span>
          </div>

          <span class="arrow">›</span>
        </button>

        <button class="card disabled">
          <span class="card-icon">👤</span>

          <div>
            <strong>Athlètes</strong>
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

  document
    .querySelector('#trainingButton')
    .addEventListener('click', () => {
      mountTraining(app, renderHome)
    })
}

renderHome()