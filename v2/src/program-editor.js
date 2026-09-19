import { supabase } from './supabase.js'
import {
  clearProgramCloudCache,
  getAthleteBlocksV3,
} from './program-cloud.js'
import {
  createImportedProgram,
  parseProgramSheet,
} from './program-importer.js'

const STYLE_ID = 'ga-program-importer-v2-style'

const esc = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')

const cleanSlug = (value = '') => String(value)
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 70) || 'bloc'

function todayKey() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

function installStyles() {
  if (document.getElementById(STYLE_ID)) return

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
.program-importer-shell{width:min(1180px,calc(100% - 28px));margin:0 auto;padding:18px 0 56px;color:#eef3fb}
.program-importer-topbar{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:18px}
.program-importer-kicker{display:block;margin-bottom:5px;color:#f0c34a;font-size:11px;font-weight:900;letter-spacing:.13em;text-transform:uppercase}
.program-importer-title{margin:0;font-size:clamp(24px,4vw,38px);line-height:1}.program-importer-subtitle{max-width:700px;margin:8px 0 0;color:#9aa8bd;font-size:13px;line-height:1.55}
.program-importer-back,.program-importer-button{border:1px solid rgba(245,198,74,.28);border-radius:12px;color:#edf1f8;background:rgba(15,21,33,.94);font:inherit;font-weight:850;cursor:pointer}
.program-importer-back{padding:10px 14px}.program-importer-button{min-height:44px;padding:10px 15px}.program-importer-button.primary{border-color:rgba(255,225,137,.75);color:#17120a;background:linear-gradient(180deg,#f8d96d,#dda52e)}
.program-importer-button:disabled{cursor:not-allowed;filter:grayscale(1);opacity:.45}.program-importer-layout{display:grid;grid-template-columns:minmax(250px,320px) minmax(0,1fr);gap:18px;align-items:start}
.program-importer-sidebar,.program-importer-card{border:1px solid rgba(130,145,170,.16);border-radius:18px;background:radial-gradient(circle at 100% 0,rgba(89,40,79,.18),transparent 38%),rgba(10,15,25,.97);box-shadow:0 18px 42px rgba(0,0,0,.22)}
.program-importer-sidebar{position:sticky;top:14px;padding:15px}.program-importer-main{display:grid;gap:14px}.program-importer-card{padding:16px}.program-importer-card h2,.program-importer-card h3,.program-importer-card h4{margin:0;color:#f3f6fb}
.program-importer-field{display:grid;gap:6px}.program-importer-field+ .program-importer-field{margin-top:11px}.program-importer-field label{color:#9ba6ba;font-size:11px;font-weight:850;letter-spacing:.06em;text-transform:uppercase}
.program-importer-input,.program-importer-select,.program-importer-paste{width:100%;box-sizing:border-box;border:1px solid rgba(137,151,176,.2);border-radius:11px;outline:none;color:#f2f5fa;background:#101725;font:inherit}
.program-importer-input,.program-importer-select{min-height:42px;padding:9px 11px}.program-importer-paste{min-height:280px;resize:vertical;padding:13px;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.program-importer-input:focus,.program-importer-select:focus,.program-importer-paste:focus{border-color:rgba(245,198,74,.62);box-shadow:0 0 0 3px rgba(245,198,74,.08)}
.program-importer-source{margin-top:12px;padding:11px;border-radius:12px;color:#abb5c8;background:rgba(255,255,255,.03);font-size:12px;line-height:1.5}.program-importer-source strong{color:#f4c956}
.program-importer-actions{display:grid;gap:8px;margin-top:14px}.program-importer-row{display:flex;align-items:center;justify-content:space-between;gap:12px}.program-importer-row p{margin:7px 0 0;color:#9aa8bd;font-size:12px;line-height:1.5}
.program-importer-status{min-height:20px;margin-top:12px;color:#9ba6ba;font-size:12px;line-height:1.45}.program-importer-status.ok{color:#76e8ad}.program-importer-status.error{color:#ff9ba6}
.program-importer-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-top:14px}.program-importer-stat{padding:12px;border:1px solid rgba(130,145,170,.14);border-radius:13px;background:rgba(255,255,255,.025)}
.program-importer-stat span{display:block;color:#8998ad;font-size:10px;font-weight:850;text-transform:uppercase}.program-importer-stat strong{display:block;margin-top:4px;color:#f5cf64;font-size:22px}
.program-importer-maxes{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}.program-importer-max{padding:7px 10px;border-radius:999px;background:rgba(240,195,74,.1);color:#f6d77d;font-size:12px;font-weight:800}
.program-importer-week{border:1px solid rgba(130,145,170,.14);border-radius:14px;background:rgba(255,255,255,.018);overflow:hidden}.program-importer-week+ .program-importer-week{margin-top:10px}.program-importer-week>summary{cursor:pointer;list-style:none;padding:13px 14px;color:#f2ca58;font-weight:900}.program-importer-week>summary::-webkit-details-marker{display:none}
.program-importer-week-body{display:grid;gap:9px;padding:0 12px 12px}.program-importer-day{padding:11px;border-radius:12px;background:rgba(8,13,22,.7)}.program-importer-day h4{font-size:14px}.program-importer-exercise{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;padding:8px 0;border-bottom:1px solid rgba(130,145,170,.09)}.program-importer-exercise:last-child{border-bottom:0}
.program-importer-exercise small{display:block;margin-top:3px;color:#8391a5}.program-importer-prescription{text-align:right;color:#c9d6e7;font-size:12px;font-weight:800;white-space:nowrap}.program-importer-empty{padding:24px;text-align:center;color:#8e9aab}
@media(max-width:820px){.program-importer-layout{grid-template-columns:1fr}.program-importer-sidebar{position:static}.program-importer-summary{grid-template-columns:1fr 1fr}}
@media(max-width:520px){.program-importer-shell{width:min(100% - 18px,1180px)}.program-importer-topbar{align-items:flex-start}.program-importer-summary{grid-template-columns:1fr 1fr}.program-importer-exercise{grid-template-columns:1fr}.program-importer-prescription{text-align:left;white-space:normal}}
`
  document.head.appendChild(style)
}

async function loadCloudMeta(athleteSlug) {
  const { data, error } = await supabase
    .from('program_versions_v2')
    .select('id,program_key,version,status,published_at,updated_at')
    .eq('athlete_slug', athleteSlug)
    .order('version', { ascending: false })
    .limit(30)

  if (error) throw error
  const rows = Array.isArray(data) ? data : []
  return {
    rows,
    active: rows.find((row) => row.status === 'active') || null,
    draft: rows.find((row) => row.status === 'draft') || null,
  }
}

function loadText(set) {
  const range = set.loadRange ? `${set.loadRange} kg` : ''
  const intensity = set.percent !== null && set.percent !== undefined
    ? `${set.percent}%`
    : set.intensity || ''
  return [intensity, range].filter(Boolean).join(' · ') || 'Charge libre'
}

function previewHtml(imported) {
  if (!imported) return '<div class="program-importer-empty">Colle puis analyse une programmation pour afficher l’aperçu.</div>'

  return imported.block.weeks.map((week, weekIndex) => `
    <details class="program-importer-week" ${weekIndex === 0 ? 'open' : ''}>
      <summary>Semaine ${week.number} · ${week.days.length} séances</summary>
      <div class="program-importer-week-body">
        ${week.days.map((day) => `
          <section class="program-importer-day">
            <h4>${esc(day.emoji)} ${esc(day.name)}</h4>
            ${day.exercises.map((exercise) => `
              <div class="program-importer-exercise">
                <div>
                  <strong>${esc(exercise.name)}</strong>
                  <small>${esc(exercise.type)}${exercise.variant ? ` · ${esc(exercise.variant)}` : ''}</small>
                </div>
                <div class="program-importer-prescription">
                  ${exercise.sets.length} × ${esc(exercise.sets[0]?.reps || '—')}
                  <br>${esc(loadText(exercise.sets[0] || {}))}
                </div>
              </div>
            `).join('')}
          </section>
        `).join('')}
      </div>
    </details>
  `).join('')
}

export function mountProgramEditor(root, options = {}) {
  installStyles()

  const athletes = Array.isArray(options.athletes) ? options.athletes : []
  const onBack = typeof options.onBack === 'function' ? options.onBack : () => {}
  const state = {
    athlete: athletes[0] || null,
    cloudMeta: null,
    history: [],
    loading: false,
    busy: false,
    paste: '',
    parsed: null,
    imported: null,
    blockNumber: 1,
    blockLabel: 'Bloc 1',
    blockKey: '',
    status: '',
    statusKind: '',
  }

  const athleteSlug = () => state.athlete?.cloudSlug || state.athlete?.slug || state.athlete?.id || ''

  function setStatus(message, kind = '') {
    state.status = message || ''
    state.statusKind = kind
    const element = root.querySelector('[data-program-import-status]')
    if (element) {
      element.textContent = state.status
      element.className = `program-importer-status ${kind}`
    }
  }

  function setBlockDefaults(nextNumber) {
    const number = Math.max(1, Number(nextNumber) || 1)
    state.blockNumber = number
    state.blockLabel = `Bloc ${number}`
    state.blockKey = `${cleanSlug(athleteSlug())}-block-${number}-${todayKey()}`
  }

  async function loadAthlete(athleteId) {
    const athlete = athletes.find((item) => item.id === athleteId)
    if (!athlete) return

    state.athlete = athlete
    state.loading = true
    state.imported = null
    state.parsed = null
    state.status = ''
    state.statusKind = ''
    render()

    try {
      const slugValue = athleteSlug()
      const [cloudMeta, history] = await Promise.all([
        loadCloudMeta(slugValue),
        getAthleteBlocksV3(slugValue).catch(() => []),
      ])
      state.cloudMeta = cloudMeta
      state.history = history
      const highest = history.reduce(
        (value, item) => Math.max(value, Number(item.block_number) || 0),
        0,
      )
      setBlockDefaults(highest + 1)
    } catch (error) {
      console.error(error)
      state.cloudMeta = { rows: [], active: null, draft: null }
      state.history = []
      setBlockDefaults(1)
      state.status = 'Métadonnées cloud indisponibles. Le collage reste utilisable.'
      state.statusKind = 'error'
    } finally {
      state.loading = false
      render()
    }
  }

  function prepareImport() {
    if (!state.athlete) throw new Error('Choisis un athlète.')
    state.parsed = parseProgramSheet(state.paste)
    state.imported = createImportedProgram({
      parsed: state.parsed,
      athlete: state.athlete,
      blockNumber: state.blockNumber,
      blockLabel: state.blockLabel,
      blockKey: state.blockKey,
    })
    return state.imported
  }

  function render() {
    const active = state.cloudMeta?.active
    const draft = state.cloudMeta?.draft
    const summary = state.imported?.overview?.summary
    const maxes = state.parsed?.metrics?.maxes || {}

    root.innerHTML = `
      <main class="program-importer-shell">
        <header class="program-importer-topbar">
          <div>
            <span class="program-importer-kicker">COACH · PROGRAM CLOUD</span>
            <h1 class="program-importer-title">Importateur Google Sheets</h1>
            <p class="program-importer-subtitle">Copie tout le tableau de programmation, colle-le ici, vérifie l’aperçu puis publie-le directement pour l’athlète.</p>
          </div>
          <button class="program-importer-back" type="button" data-import-action="back">← Accueil</button>
        </header>

        <div class="program-importer-layout">
          <aside class="program-importer-sidebar">
            <div class="program-importer-field">
              <label>Athlète</label>
              <select class="program-importer-select" data-import-athlete ${state.busy ? 'disabled' : ''}>
                ${athletes.map((athlete) => `<option value="${esc(athlete.id)}" ${athlete.id === state.athlete?.id ? 'selected' : ''}>${esc(athlete.name)}</option>`).join('')}
              </select>
            </div>

            ${state.loading ? '<div class="program-importer-source">Chargement…</div>' : `
              <div class="program-importer-source">
                <strong>${esc(state.athlete?.name || '')}</strong><br>
                Version active : ${active?.version ?? '—'}<br>
                Brouillon récent : ${draft?.version ?? '—'}<br>
                Blocs enregistrés : ${state.history.length}
              </div>

              <div class="program-importer-field">
                <label>Numéro du nouveau bloc</label>
                <input class="program-importer-input" type="number" min="1" value="${state.blockNumber}" data-import-field="blockNumber">
              </div>
              <div class="program-importer-field">
                <label>Nom du bloc</label>
                <input class="program-importer-input" value="${esc(state.blockLabel)}" data-import-field="blockLabel">
              </div>
              <div class="program-importer-field">
                <label>Clé technique</label>
                <input class="program-importer-input" value="${esc(state.blockKey)}" data-import-field="blockKey">
              </div>

              <div class="program-importer-actions">
                <button class="program-importer-button" type="button" data-import-action="analyze" ${state.busy ? 'disabled' : ''}>Analyser le tableau</button>
                <button class="program-importer-button" type="button" data-import-action="draft" ${!state.imported || state.busy ? 'disabled' : ''}>Enregistrer brouillon</button>
                <button class="program-importer-button primary" type="button" data-import-action="publish" ${!state.imported || state.busy ? 'disabled' : ''}>Publier pour l’athlète</button>
              </div>
              <div class="program-importer-status ${state.statusKind}" data-program-import-status>${esc(state.status)}</div>
            `}
          </aside>

          <section class="program-importer-main">
            <div class="program-importer-card">
              <div class="program-importer-row">
                <div>
                  <h2>Coller la programmation</h2>
                  <p>Dans Google Sheets : sélectionne tout le tableau, copie, puis colle ci-dessous sans modifier le contenu.</p>
                </div>
              </div>
              <textarea class="program-importer-paste" data-import-paste placeholder="Clique ici puis Ctrl+V…">${esc(state.paste)}</textarea>
            </div>

            ${state.imported ? `
              <div class="program-importer-card">
                <h3>Aperçu détecté</h3>
                <div class="program-importer-summary">
                  <div class="program-importer-stat"><span>Semaines</span><strong>${summary.weekCount}</strong></div>
                  <div class="program-importer-stat"><span>Séances</span><strong>${summary.dayCount}</strong></div>
                  <div class="program-importer-stat"><span>Exercices</span><strong>${summary.exerciseCount}</strong></div>
                  <div class="program-importer-stat"><span>Séries</span><strong>${summary.setCount}</strong></div>
                </div>
                <div class="program-importer-maxes">
                  <span class="program-importer-max">Squat ${maxes.squat ?? '—'} kg</span>
                  <span class="program-importer-max">Bench ${maxes.bench ?? '—'} kg</span>
                  <span class="program-importer-max">Deadlift ${maxes.deadlift ?? '—'} kg</span>
                </div>
              </div>
              <div class="program-importer-card">
                ${previewHtml(state.imported)}
              </div>
            ` : ''}
          </section>
        </div>
      </main>
    `
  }

  async function saveDraft() {
    const imported = prepareImport()
    state.busy = true
    setStatus('Enregistrement du brouillon…')

    try {
      const { error } = await supabase.rpc('save_program_version_v2', {
        p_athlete_slug: athleteSlug(),
        p_program_key: imported.program.programKey,
        p_program_json: imported.program,
        p_current_week: 1,
        p_publish: false,
        p_notes: 'Brouillon depuis l’importateur Google Sheets',
      })
      if (error) throw error
      state.cloudMeta = await loadCloudMeta(athleteSlug())
      setStatus(`Brouillon enregistré · version ${state.cloudMeta.draft?.version ?? ''}`, 'ok')
    } catch (error) {
      console.error(error)
      setStatus(error?.message || 'Erreur lors de l’enregistrement.', 'error')
    } finally {
      state.busy = false
      render()
    }
  }

  async function publish() {
    const imported = prepareImport()
    const confirmed = window.confirm(
      `Publier ${state.blockLabel} pour ${state.athlete.name} ?\n\nLe bloc actuel sera archivé et restera consultable dans l’historique.`,
    )
    if (!confirmed) return

    state.busy = true
    setStatus('Publication dans Supabase…')

    try {
      const { data, error } = await supabase.rpc('publish_imported_program_v1', {
        p_athlete_slug: athleteSlug(),
        p_program_key: imported.program.programKey,
        p_program_json: imported.program,
        p_block_key: imported.block.id,
        p_block_number: Math.max(1, Number(state.blockNumber) || 1),
        p_title: state.blockLabel,
        p_overview_json: imported.overview,
        p_notes: 'Publication depuis l’importateur Google Sheets',
      })
      if (error) throw error

      clearProgramCloudCache(state.athlete.id)
      const [cloudMeta, history] = await Promise.all([
        loadCloudMeta(athleteSlug()),
        getAthleteBlocksV3(athleteSlug()),
      ])
      state.cloudMeta = cloudMeta
      state.history = history
      setStatus(
        `Publié avec succès · version ${data?.version ?? cloudMeta.active?.version ?? ''} · ${state.blockLabel}`,
        'ok',
      )
    } catch (error) {
      console.error(error)
      setStatus(error?.message || 'Erreur lors de la publication.', 'error')
    } finally {
      state.busy = false
      render()
    }
  }

  root.oninput = (event) => {
    const target = event.target
    if (target.matches('[data-import-paste]')) {
      state.paste = target.value
      return
    }

    const field = target.dataset.importField
    if (!field) return
    state[field] = field === 'blockNumber'
      ? Math.max(1, Number(target.value) || 1)
      : target.value
    state.imported = null
  }

  root.onchange = async (event) => {
    if (event.target.matches('[data-import-athlete]')) {
      await loadAthlete(event.target.value)
    }
  }

  root.onclick = async (event) => {
    const button = event.target.closest('[data-import-action]')
    if (!button) return
    const action = button.dataset.importAction

    if (action === 'back') {
      root.onclick = null
      root.onchange = null
      root.oninput = null
      onBack()
      return
    }

    if (action === 'analyze') {
      try {
        prepareImport()
        state.status = `${state.parsed.summary.weekCount} semaines et ${state.parsed.summary.exerciseCount} lignes reconnues. Vérifie l’aperçu.`
        state.statusKind = 'ok'
      } catch (error) {
        state.imported = null
        state.parsed = null
        state.status = error.message
        state.statusKind = 'error'
      }
      render()
      return
    }

    if (action === 'draft') await saveDraft()
    if (action === 'publish') await publish()
  }

  render()
  if (state.athlete) void loadAthlete(state.athlete.id)
}
