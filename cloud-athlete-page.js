(function () {
  'use strict';

  const cfg = window.COACHING_ATHLETE || {};
  if (!cfg.slug || !cfg.name || !cfg.programKey || !cfg.adapter) {
    console.error('Configuration athlète incomplète.', cfg);
    return;
  }

  let cloudReady = false;
  let setChannel = null;
  let remoteRows = new Map();
  let reconcileTimer = null;
  let syncingRemote = false;
  let mutationObserver = null;
  let dayDurationTimer = null;
  let chronoGuardTimer = null;
  let fallbackRestInterval = null;
  let fallbackRestRemaining = 180;
  let fallbackRestTotal = 180;

  const cacheKey = `ga-cloud-inputs:${cfg.slug}:${cfg.programKey}`;
  let inputCache = readCache();

  const style = document.createElement('style');
  style.textContent = `
    .cloud-athlete-rpe,.cloud-athlete-load{width:58px;min-width:0;padding:5px 5px;border-radius:7px;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.05);color:inherit;font:700 11px Inter,system-ui,sans-serif;text-align:center;outline:none}
    .cloud-athlete-rpe:focus,.cloud-athlete-load:focus{border-color:var(--accent,#55b9e6)}
    .cloud-athlete-panel{display:none;position:fixed;z-index:390;left:50%;transform:translateX(-50%);top:58px;bottom:61px;width:100%;max-width:430px;padding:12px 16px 18px;overflow-y:auto;background:var(--bg,#0a0e18);color:var(--text,#e8ecf5)}
    .cloud-athlete-panel.show{display:block}.cloud-athlete-panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:2px 0 12px}.cloud-athlete-panel-head h2{margin:0;font-size:16px}.cloud-athlete-panel-head button{border:0;border-radius:9px;background:var(--surface-2,#1c2438);color:inherit;padding:7px 10px;font-weight:800;cursor:pointer}
    .cloud-athlete-nav.active{color:var(--accent-light,var(--accent,#55b9e6))!important}
    .cloud-status.cloud-injected-status{margin-left:auto}
    .set-row .cloud-athlete-rpe,.set-row .cloud-athlete-load{flex:0 0 58px}
    .set-row{flex-wrap:wrap}.cloud-load-interval{order:20;flex:1 0 100%;display:flex;align-items:center;justify-content:flex-end;gap:5px;padding:4px 2px 0;color:var(--text-muted,#667696);font-size:9px}.cloud-load-interval strong{margin-right:auto;color:var(--text-dim,#a0abc0);font-size:9px}.cloud-interval-min,.cloud-interval-max{width:52px;padding:4px 4px;border-radius:7px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.035);color:inherit;font:750 10px Inter,system-ui,sans-serif;text-align:center;outline:none}.cloud-interval-min:focus,.cloud-interval-max:focus{border-color:var(--accent,#55b9e6)}.cloud-interval-min:disabled,.cloud-interval-max:disabled{opacity:.72;color:var(--text-dim,#a0abc0)}
    .cloud-feed-switch{display:grid;grid-template-columns:1fr 1fr;gap:5px;padding:4px;margin-bottom:10px;border:1px solid rgba(255,255,255,.05);border-radius:12px;background:rgba(255,255,255,.025)}.cloud-feed-switch button{border:0;border-radius:9px;padding:9px;background:transparent;color:var(--text-muted,#667696);font-weight:900;font-size:10px;cursor:pointer}.cloud-feed-switch button.active{background:var(--surface-2,#1c2438);color:var(--accent,#f0c44d)}.cloud-athlete-feed-view.hidden{display:none}
    .day-tab.cloud-day-complete{background:rgba(45,198,83,.16)!important;border-color:rgba(45,198,83,.38)!important;color:#65e781!important}.cloud-day-duration{display:block;margin-top:3px;font-size:7px;line-height:1;color:var(--text-muted,#667696);font-weight:800;white-space:nowrap}.day-tab.cloud-day-complete .cloud-day-duration{color:#65e781}.cloud-fallback-rest{display:none;position:fixed;inset:0;z-index:8000;background:rgba(4,7,13,.96);align-items:center;justify-content:center;padding:20px}.cloud-fallback-rest.visible{display:flex}.cloud-fallback-rest-card{width:min(100%,360px);padding:25px;border-radius:22px;text-align:center;background:#101725;border:1px solid rgba(255,255,255,.09);box-shadow:0 30px 70px rgba(0,0,0,.55)}.cloud-fallback-rest-card h2{margin:0 0 8px;font-size:14px}.cloud-fallback-time{font-size:48px;font-weight:950;color:var(--accent,#f0c44d);font-variant-numeric:tabular-nums}.cloud-fallback-actions{display:flex;justify-content:center;gap:8px;margin-top:14px}.cloud-fallback-actions button{border:0;border-radius:10px;padding:10px 13px;background:var(--surface-2,#1c2438);color:inherit;font-weight:850}.cloud-fallback-actions .primary{background:var(--accent,#f0c44d);color:#111722}
    @media (max-width:370px){.cloud-athlete-rpe,.cloud-athlete-load{width:50px;flex-basis:50px!important;font-size:10px}.set-row{gap:5px!important}.cloud-interval-min,.cloud-interval-max{width:47px}}
  `;
  document.head.appendChild(style);

  function readCache() {
    try {
      const parsed = JSON.parse(localStorage.getItem(cacheKey) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function writeCache() {
    try { localStorage.setItem(cacheKey, JSON.stringify(inputCache)); } catch (_) {}
  }

  function parseNumber(value) {
    const normalized = String(value ?? '').trim().replace(',', '.');
    if (!normalized) return null;
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }

  function currentIndices() {
    try {
      if (cfg.adapter === 'state' && typeof state !== 'undefined') {
        return { w: Number(state.w) || 0, d: Number(state.d) || 0 };
      }
      if (cfg.adapter === 'boolean' && typeof W !== 'undefined' && typeof D !== 'undefined') {
        return { w: Number(W) || 0, d: Number(D) || 0 };
      }
      if (cfg.adapter === 'legacy' && typeof S !== 'undefined') {
        return { w: Number(S.w) || 0, d: Number(S.d) || 0 };
      }
    } catch (error) {
      console.error(error);
    }
    const weeks = [...document.querySelectorAll('.week-btn')];
    const days = [...document.querySelectorAll('.day-tab')];
    return {
      w: Math.max(0, weeks.findIndex(el => el.classList.contains('active'))),
      d: Math.max(0, days.findIndex(el => el.classList.contains('active')))
    };
  }

  function dayKey(w, d) { return `${w}-${d}`; }
  function valueKey(w, d, idx) { return `${w}-${d}-${idx}`; }
  function remoteKey(w, d, idx) { return `${w}|${d}|${idx}`; }
  function activitySetKey(w, d, idx) { return `${cfg.slug}|${cfg.programKey}|${w}|${d}|${idx}`; }


  function dayStartKey(w, d) { return `ga-day-start:${cfg.slug}:${cfg.programKey}:${w}:${d}`; }
  function dayEndKey(w, d) { return `ga-day-end:${cfg.slug}:${cfg.programKey}:${w}:${d}`; }

  function programDay(w, d) {
    try { return typeof P !== 'undefined' ? P?.weeks?.[w]?.days?.[d] || null : null; }
    catch (_) { return null; }
  }

  function totalSetsForDay(w, d) {
    const day = programDay(w, d);
    if (!day?.exercises) return 0;
    return day.exercises.reduce((total, exercise) => total + (exercise.blocks || []).reduce((sum, block) => sum + (Number(block.s) || 0), 0), 0);
  }

  function formatSessionDuration(seconds) {
    const value = Math.max(0, Math.floor(Number(seconds) || 0));
    const h = Math.floor(value / 3600);
    const m = Math.floor((value % 3600) / 60);
    const sec = value % 60;
    if (h > 0) return `${h}h${String(m).padStart(2, '0')}min`;
    if (m > 0) return `${m}min${String(sec).padStart(2, '0')}s`;
    return `${sec}s`;
  }

  function rememberDayStart(w, d) {
    const key = dayStartKey(w, d);
    if (!localStorage.getItem(key)) localStorage.setItem(key, String(Date.now()));
    localStorage.removeItem(dayEndKey(w, d));
  }

  function dayRemoteRows(w, d) {
    return [...remoteRows.values()].filter(row => Number(row.week_index) === w && Number(row.day_index) === d);
  }

  function dayTiming(w, d) {
    const total = totalSetsForDay(w, d);
    const remote = dayRemoteRows(w, d);
    const completedRows = remote.filter(row => row.completed);
    let completedCount = new Set(completedRows.map(row => Number(row.set_index))).size;
    const current = currentIndices();
    if (current.w === w && current.d === d) {
      completedCount = Math.max(completedCount, rows().filter((row, idx) => originalCompleted(w, d, idx, row)).length);
    }

    const startKey = dayStartKey(w, d);
    const endKey = dayEndKey(w, d);
    if (completedCount <= 0) {
      localStorage.removeItem(startKey);
      localStorage.removeItem(endKey);
      return { total, completedCount: 0, isComplete: false, startedAt: 0, endedAt: 0, seconds: 0 };
    }

    const timestamps = completedRows
      .map(row => new Date(row.completed_at || row.updated_at || 0).getTime())
      .filter(value => Number.isFinite(value) && value > 0)
      .sort((a, b) => a - b);

    let startedAt = Number(localStorage.getItem(startKey)) || 0;
    if (!startedAt) {
      startedAt = timestamps[0] || Date.now();
      localStorage.setItem(startKey, String(startedAt));
    }

    // Une ancienne valeur globale ne doit jamais contaminer une nouvelle journée.
    // Tant que la journée n'est pas terminée, on remet à zéro les départs vieux de plus de 12 h.
    const twelveHours = 12 * 60 * 60 * 1000;
    const isComplete = total > 0 && completedCount >= total;
    if (!isComplete && Date.now() - startedAt > twelveHours) {
      startedAt = timestamps.length && Date.now() - timestamps[0] <= twelveHours ? timestamps[0] : Date.now();
      localStorage.setItem(startKey, String(startedAt));
      localStorage.removeItem(endKey);
    }

    let endedAt = Number(localStorage.getItem(endKey)) || 0;
    if (isComplete) {
      if (!endedAt) {
        endedAt = timestamps.at(-1) || Date.now();
        if (endedAt < startedAt) endedAt = Date.now();
        localStorage.setItem(endKey, String(endedAt));
      }
    } else {
      localStorage.removeItem(endKey);
      endedAt = Date.now();
    }

    return {
      total,
      completedCount,
      isComplete,
      startedAt,
      endedAt,
      seconds: Math.max(0, Math.floor((endedAt - startedAt) / 1000))
    };
  }

  function renderCurrentSessionChrono() {
    const chrono = document.getElementById('chrono');
    if (!chrono) return;
    const { w, d } = currentIndices();
    const timing = dayTiming(w, d);
    // Une fois toutes les séries cochées, le chrono principal revient à 00:00.
    // La durée finale reste affichée sous l'onglet du jour terminé.
    const seconds = timing.isComplete ? 0 : (timing.completedCount > 0 ? timing.seconds : 0);
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    chrono.textContent = `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
    chrono.dataset.cloudDayTimer = 'true';
    chrono.title = timing.isComplete
      ? `Journée terminée en ${formatSessionDuration(seconds)}`
      : timing.completedCount > 0
        ? `Séance en cours depuis ${formatSessionDuration(seconds)}`
        : 'Timer de la journée : 00:00';
  }

  function renderDayDurations() {
    const { w } = currentIndices();
    const tabs = [...document.querySelectorAll('.day-tab')];
    tabs.forEach((tab, d) => {
      const timing = dayTiming(w, d);
      const label = timing.completedCount > 0 ? formatSessionDuration(timing.seconds) : '';
      let duration = tab.querySelector('.cloud-day-duration');
      if (!duration) {
        duration = document.createElement('span');
        duration.className = 'cloud-day-duration';
        tab.appendChild(duration);
      }
      duration.textContent = label;
      tab.classList.toggle('cloud-day-complete', timing.isComplete);
      tab.title = timing.isComplete
        ? `Journée terminée en ${label || 'durée inconnue'}`
        : (label ? `Séance en cours depuis ${label}` : 'Journée non commencée');
    });
    renderCurrentSessionChrono();
  }

  function ensureFallbackRestOverlay() {
    let overlay = document.getElementById('cloudFallbackRest');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'cloudFallbackRest';
    overlay.className = 'cloud-fallback-rest';
    overlay.innerHTML = `<div class="cloud-fallback-rest-card"><h2>Repos avant la prochaine série</h2><div class="cloud-fallback-time" id="cloudFallbackRestTime">3:00</div><div class="cloud-fallback-actions"><button type="button" data-cloud-rest-add>+30 s</button><button type="button" data-cloud-rest-close class="primary">Reprendre</button></div></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('[data-cloud-rest-add]').addEventListener('click', () => { fallbackRestRemaining += 30; fallbackRestTotal += 30; updateFallbackRest(); });
    overlay.querySelector('[data-cloud-rest-close]').addEventListener('click', stopFallbackRest);
    return overlay;
  }

  function updateFallbackRest() {
    const el = document.getElementById('cloudFallbackRestTime');
    if (!el) return;
    const m = Math.floor(Math.max(0, fallbackRestRemaining) / 60);
    const sec = Math.max(0, fallbackRestRemaining) % 60;
    el.textContent = `${m}:${String(sec).padStart(2, '0')}`;
  }

  function stopFallbackRest() {
    clearInterval(fallbackRestInterval);
    document.getElementById('cloudFallbackRest')?.classList.remove('visible');
  }

  function startFallbackRest() {
    const overlay = ensureFallbackRestOverlay();
    fallbackRestRemaining = fallbackRestTotal = 180;
    updateFallbackRest();
    overlay.classList.add('visible');
    clearInterval(fallbackRestInterval);
    fallbackRestInterval = setInterval(() => {
      fallbackRestRemaining -= 1;
      updateFallbackRest();
      if (fallbackRestRemaining <= 0) {
        stopFallbackRest();
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      }
    }, 1000);
  }

  function restOverlayVisible() {
    const nativeOverlay = document.getElementById('timerOverlay');
    return !!(nativeOverlay && (nativeOverlay.classList.contains('visible') || getComputedStyle(nativeOverlay).display !== 'none'));
  }

  function ensureRestTimerStarted(setIndex) {
    setTimeout(() => {
      if (restOverlayVisible() || document.getElementById('cloudFallbackRest')?.classList.contains('visible')) return;
      try {
        if (typeof window.showTimer === 'function') window.showTimer(setIndex);
        else if (typeof window.startR === 'function') window.startR();
        else if (typeof window.startRest === 'function') window.startRest();
      } catch (error) { console.warn('Timer natif indisponible :', error); }
      setTimeout(() => {
        if (!restOverlayVisible() && !document.getElementById('cloudFallbackRest')?.classList.contains('visible')) startFallbackRest();
      }, 40);
    }, 120);
  }

  function exerciseContainer() {
    return document.getElementById('exerciseList') || document.getElementById('exercises');
  }

  function rows() {
    const container = exerciseContainer();
    return container ? [...container.querySelectorAll('.set-row')] : [];
  }


  function sessionStructure() {
    const { w, d } = currentIndices();
    const currentRows = rows();
    let sbdSets = 0;
    currentRows.forEach((row, idx) => {
      const meta = rowMeta(row, idx, w, d);
      if (['sq', 'bn', 'dl'].includes(meta.code)) sbdSets += 1;
    });
    return {
      totalSets: currentRows.length,
      sbdSets,
      accessorySets: Math.max(0, currentRows.length - sbdSets)
    };
  }

  function checkboxFor(row) {
    return row?.querySelector('.set-check,.check-btn') || null;
  }

  function extractBooleanSetKey(row) {
    const checkbox = checkboxFor(row);
    const onclick = checkbox?.getAttribute('onclick') || '';
    const match = onclick.match(/tog\(\s*['"]([^'"]+)['"]/i);
    return match ? match[1] : null;
  }

  function extractBooleanLoadKey(row) {
    const input = row?.querySelector('.load-input,.set-load');
    const onchange = input?.getAttribute('onchange') || '';
    const match = onchange.match(/(?:sL|setLd)\(\s*['"]([^'"]+)['"]/i);
    if (match) return match[1];
    const setKey = extractBooleanSetKey(row);
    return setKey ? `${setKey}_ld` : null;
  }

  function originalCompleted(w, d, idx, row) {
    try {
      if (cfg.adapter === 'state' && typeof state !== 'undefined') {
        return !!state.sets?.[dayKey(w, d)]?.includes(idx);
      }
      if (cfg.adapter === 'boolean' && typeof sets !== 'undefined') {
        const key = extractBooleanSetKey(row);
        return key ? !!sets[key] : !!checkboxFor(row)?.classList.contains('checked');
      }
      if (cfg.adapter === 'legacy' && typeof S !== 'undefined') {
        return !!S.sets?.[dayKey(w, d)]?.includes(idx);
      }
    } catch (error) {
      console.error(error);
    }
    const box = checkboxFor(row);
    return !!(box?.classList.contains('checked') || row?.classList.contains('completed') || row?.classList.contains('done'));
  }

  function setOriginalCompleted(w, d, idx, completed, row) {
    try {
      if (cfg.adapter === 'state' && typeof state !== 'undefined') {
        const key = dayKey(w, d);
        if (!state.sets) state.sets = {};
        if (!Array.isArray(state.sets[key])) state.sets[key] = [];
        const pos = state.sets[key].indexOf(idx);
        if (completed && pos < 0) state.sets[key].push(idx);
        if (!completed && pos >= 0) state.sets[key].splice(pos, 1);
        return true;
      }
      if (cfg.adapter === 'boolean' && typeof sets !== 'undefined') {
        const key = extractBooleanSetKey(row);
        if (!key) return false;
        sets[key] = !!completed;
        return true;
      }
      if (cfg.adapter === 'legacy' && typeof S !== 'undefined') {
        const key = dayKey(w, d);
        if (!S.sets) S.sets = {};
        if (!Array.isArray(S.sets[key])) S.sets[key] = [];
        const pos = S.sets[key].indexOf(idx);
        if (completed && pos < 0) S.sets[key].push(idx);
        if (!completed && pos >= 0) S.sets[key].splice(pos, 1);
        return true;
      }
    } catch (error) {
      console.error(error);
    }
    return false;
  }

  function setOriginalLoad(w, d, idx, value, row) {
    if (value === null || value === undefined || value === '') return;
    try {
      if (cfg.adapter === 'state' && typeof state !== 'undefined') {
        if (!state.loads) state.loads = {};
        state.loads[valueKey(w, d, idx)] = String(value);
      } else if (cfg.adapter === 'boolean' && typeof loads !== 'undefined') {
        const key = extractBooleanLoadKey(row);
        if (key) loads[key] = String(value);
      }
    } catch (error) {
      console.error(error);
    }
  }

  function persistOriginal() {
    try {
      if (cfg.adapter === 'state' && typeof saveState === 'function') saveState();
      else if ((cfg.adapter === 'boolean' || cfg.adapter === 'legacy') && typeof save === 'function') save();
    } catch (error) {
      console.error(error);
    }
  }

  function renderOriginal() {
    try {
      if ((cfg.adapter === 'state' || cfg.adapter === 'boolean') && typeof render === 'function') render();
      else if (cfg.adapter === 'legacy' && typeof renderWorkout === 'function') renderWorkout();
    } catch (error) {
      console.error(error);
    }
  }

  function inferPrescribedLoad(row) {
    const input = row.querySelector('.load-input,.set-load');
    if (input?.value) return input.value;
    if (input?.placeholder && /^\d+(?:[.,]\d+)?$/.test(input.placeholder.trim())) return input.placeholder.trim();
    const info = row.querySelector('.set-info');
    if (!info) return '';
    const clone = info.cloneNode(true);
    clone.querySelector('strong')?.remove();
    const match = clone.textContent.match(/\b(\d+(?:[.,]\d+)?)\b/);
    return match ? match[1] : '';
  }

  function inferPrescribedInterval(row) {
    const info = row?.querySelector('.set-info');
    let text = '';
    if (info) {
      const clone = info.cloneNode(true);
      clone.querySelector('strong')?.remove();
      text = clone.textContent || '';
    }
    if (!text.trim()) {
      const block = row?.closest('.exercise-block');
      text = [...(block?.querySelectorAll('.exercise-meta .meta-chip') || [])].map(el => el.textContent || '').join(' ');
    }
    const range = text.match(/(\d+(?:[.,]\d+)?)\s*(?:-|–|—|à)\s*(\d+(?:[.,]\d+)?)/i);
    if (range) return { min: parseNumber(range[1]), max: parseNumber(range[2]) };
    const fixed = text.match(/(\d+(?:[.,]\d+)?)\s*(?:kg)?/i);
    if (fixed) {
      const value = parseNumber(fixed[1]);
      return { min: value, max: value };
    }
    const existing = row?.querySelector('.load-input,.set-load');
    const placeholder = parseNumber(existing?.placeholder);
    return placeholder !== null ? { min: placeholder, max: placeholder } : { min: null, max: null };
  }

  function intervalIsValid(meta) {
    return meta.intervalMin === null || meta.intervalMax === null || meta.intervalMin <= meta.intervalMax;
  }

  function ensureInputs(row, idx, w, d) {
    row.dataset.cloudSetIndex = String(idx);
    const box = checkboxFor(row);
    if (!box) return;
    box.dataset.cloudCheckbox = '1';

    let loadInput = row.querySelector('.load-input,.set-load,.cloud-athlete-load');
    if (!loadInput) {
      loadInput = document.createElement('input');
      loadInput.type = 'number';
      loadInput.inputMode = 'decimal';
      loadInput.step = '0.5';
      loadInput.min = '0';
      loadInput.className = 'cloud-athlete-load';
      loadInput.placeholder = inferPrescribedLoad(row) || 'kg';
      loadInput.setAttribute('aria-label', 'Charge réalisée en kilogrammes');
      box.before(loadInput);
    }
    loadInput.dataset.cloudLoad = '1';

    let rpeInput = row.querySelector('.cloud-athlete-rpe');
    if (!rpeInput) {
      rpeInput = document.createElement('input');
      rpeInput.type = 'number';
      rpeInput.inputMode = 'decimal';
      rpeInput.step = '0.5';
      rpeInput.min = '1';
      rpeInput.max = '10';
      rpeInput.className = 'cloud-athlete-rpe';
      rpeInput.placeholder = 'RPE';
      rpeInput.setAttribute('aria-label', 'RPE de la série');
      box.before(rpeInput);
    }

    let intervalWrap = row.querySelector('.cloud-load-interval');
    if (!intervalWrap) {
      intervalWrap = document.createElement('div');
      intervalWrap.className = 'cloud-load-interval';
      intervalWrap.innerHTML = `<strong>Plage cible</strong><input type="number" inputmode="decimal" step="0.5" min="0" class="cloud-interval-min" aria-label="Charge minimale prévue"><span>à</span><input type="number" inputmode="decimal" step="0.5" min="0" class="cloud-interval-max" aria-label="Charge maximale prévue"><span>kg</span>`;
      row.appendChild(intervalWrap);
    }
    const intervalMinInput = intervalWrap.querySelector('.cloud-interval-min');
    const intervalMaxInput = intervalWrap.querySelector('.cloud-interval-max');
    const coachCanEdit = cloudReady && CoachingCloud.member?.role === 'coach';
    intervalMinInput.disabled = !coachCanEdit;
    intervalMaxInput.disabled = !coachCanEdit;

    const key = valueKey(w, d, idx);
    const cached = inputCache[key] || {};
    const inferred = inferPrescribedInterval(row);
    if (!loadInput.value && cached.load !== undefined && cached.load !== null) loadInput.value = cached.load;
    if (!rpeInput.value && cached.rpe !== undefined && cached.rpe !== null) rpeInput.value = cached.rpe;
    const cachedMin = cached.intervalMin !== undefined && cached.intervalMin !== null && cached.intervalMin !== '' ? cached.intervalMin : null;
    const cachedMax = cached.intervalMax !== undefined && cached.intervalMax !== null && cached.intervalMax !== '' ? cached.intervalMax : null;
    if (cachedMin !== null) intervalMinInput.value = cachedMin;
    else if (!intervalMinInput.value) intervalMinInput.value = inferred.min ?? '';
    if (cachedMax !== null) intervalMaxInput.value = cachedMax;
    else if (!intervalMaxInput.value) intervalMaxInput.value = inferred.max ?? '';
  }

  function rowMeta(row, idx, w, d) {
    const block = row.closest('.exercise-block');
    const badge = block?.querySelector('.exercise-badge');
    const badgeClass = badge?.className || '';
    const badgeText = (badge?.textContent || '').toLowerCase();
    let code = 'ac';
    if (/badge-sq/.test(badgeClass) || /squat|\bsq\b/.test(badgeText)) code = 'sq';
    else if (/badge-bn/.test(badgeClass) || /bench|\bbn\b/.test(badgeText)) code = 'bn';
    else if (/badge-dl/.test(badgeClass) || /dead|\bdl\b/.test(badgeText)) code = 'dl';

    const exerciseName = block?.querySelector('.exercise-name')?.textContent?.trim() || badge?.textContent?.trim() || 'Exercice';
    const variantName = [
      block?.querySelector('.variant')?.textContent,
      block?.querySelector('.exercise-intention')?.textContent,
      badge?.textContent
    ].filter(Boolean).join(' ').trim();
    const repsText = row.querySelector('.set-info strong')?.textContent || row.querySelector('.set-info')?.textContent || '1';
    const repsMatch = String(repsText).match(/\d+/);
    const reps = Math.max(1, Number(repsMatch?.[0]) || 1);
    const weekButton = document.querySelector('.week-btn.active');
    const dayButton = document.querySelector('.day-tab.active');
    const weekLabel = weekButton?.textContent?.trim() || `S${w + 1}`;
    const dayName = (dayButton?.textContent || `Jour ${d + 1}`).replace(/\s+/g, ' ').trim();
    const loadInput = row.querySelector('[data-cloud-load],.load-input,.set-load,.cloud-athlete-load');
    const rpeInput = row.querySelector('.cloud-athlete-rpe');
    const intervalMinInput = row.querySelector('.cloud-interval-min');
    const intervalMaxInput = row.querySelector('.cloud-interval-max');
    return {
      w, d, idx, code, exerciseName, variantName, reps, weekLabel, dayName,
      load: parseNumber(loadInput?.value),
      rpe: parseNumber(rpeInput?.value),
      intervalMin: parseNumber(intervalMinInput?.value),
      intervalMax: parseNumber(intervalMaxInput?.value),
      loadInput, rpeInput, intervalMinInput, intervalMaxInput
    };
  }

  function cacheInputs(meta) {
    const key = valueKey(meta.w, meta.d, meta.idx);
    inputCache[key] = {
      load: meta.loadInput?.value ?? '',
      rpe: meta.rpeInput?.value ?? '',
      intervalMin: meta.intervalMinInput?.value ?? '',
      intervalMax: meta.intervalMaxInput?.value ?? ''
    };
    writeCache();
  }

  function injectStatus() {
    if (document.querySelector('[data-cloud-status],#cloudStatus')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cloud-status cloud-injected-status';
    button.dataset.cloudStatus = '1';
    button.textContent = 'Mode local';
    const target = document.querySelector('.header-top') || document.querySelector('.header') || document.querySelector('.app');
    target?.appendChild(button);
  }

  function injectActivityPanel() {
    if (document.getElementById('cloudAthleteActivity')) return;
    const panel = document.createElement('section');
    panel.id = 'cloudAthleteActivity';
    panel.className = 'cloud-athlete-panel';
    panel.innerHTML = `
      <div class="cloud-athlete-panel-head">
        <h2>🔔 Activité de l'équipe</h2>
        <button type="button" id="cloudActivityClose">Fermer</button>
      </div>
      <div class="cloud-feed-switch"><button type="button" class="active" data-cloud-feed-mode="lift">🏋️ Lift</button><button type="button" data-cloud-feed-mode="adventure">⚔️ Aventure</button></div>
      <div id="cloudAthleteFeedLift" class="cloud-athlete-feed-view"><div class="cloud-feed-empty">Connecte-toi pour afficher les performances.</div></div>
      <div id="cloudAthleteFeedAdventure" class="cloud-athlete-feed-view hidden"><div class="cloud-feed-empty">Connecte-toi pour afficher les aventures.</div></div>`;
    document.body.appendChild(panel);

    const nav = document.querySelector('.bottom-nav');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'nav-item cloud-athlete-nav';
    button.innerHTML = '<span>🔔 Activité</span>';
    if (nav) nav.appendChild(button);
    else {
      button.style.position = 'fixed';
      button.style.right = '12px';
      button.style.bottom = '12px';
      button.style.zIndex = '395';
      document.body.appendChild(button);
    }

    const close = () => {
      panel.classList.remove('show');
      button.classList.remove('active');
    };
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      panel.classList.toggle('show');
      button.classList.toggle('active', panel.classList.contains('show'));
    });
    document.getElementById('cloudActivityClose').addEventListener('click', close);
    panel.querySelector('.cloud-feed-switch')?.addEventListener('click', event => {
      const modeButton = event.target.closest('[data-cloud-feed-mode]');
      if (!modeButton) return;
      const mode = modeButton.dataset.cloudFeedMode;
      panel.querySelectorAll('[data-cloud-feed-mode]').forEach(el => el.classList.toggle('active', el === modeButton));
      document.getElementById('cloudAthleteFeedLift')?.classList.toggle('hidden', mode !== 'lift');
      document.getElementById('cloudAthleteFeedAdventure')?.classList.toggle('hidden', mode !== 'adventure');
    });
    nav?.addEventListener('click', event => {
      if (!event.target.closest('.cloud-athlete-nav')) close();
    });
  }

  function enrichAndReconcile() {
    clearTimeout(reconcileTimer);
    reconcileTimer = setTimeout(() => {
      if (syncingRemote) return;
      const { w, d } = currentIndices();
      const currentRows = rows();
      if (!currentRows.length) return;

      currentRows.forEach((row, idx) => ensureInputs(row, idx, w, d));
      if (!cloudReady) return;

      let needsRender = false;
      syncingRemote = true;
      for (let idx = 0; idx < currentRows.length; idx++) {
        const row = currentRows[idx];
        const remote = remoteRows.get(remoteKey(w, d, idx));
        if (!remote) continue;
        const key = valueKey(w, d, idx);
        inputCache[key] = {
          load: remote.load_kg ?? inputCache[key]?.load ?? '',
          rpe: remote.rpe ?? inputCache[key]?.rpe ?? '',
          intervalMin: remote.prescribed_load_min_kg ?? inputCache[key]?.intervalMin,
          intervalMax: remote.prescribed_load_max_kg ?? inputCache[key]?.intervalMax
        };
        setOriginalLoad(w, d, idx, remote.load_kg, row);
        if (originalCompleted(w, d, idx, row) !== !!remote.completed) {
          if (setOriginalCompleted(w, d, idx, !!remote.completed, row)) needsRender = true;
        }
      }
      writeCache();
      if (needsRender) {
        persistOriginal();
        renderOriginal();
        syncingRemote = false;
        scheduleReconcile();
        return;
      }
      persistOriginal();
      currentRows.forEach((row, idx) => ensureInputs(row, idx, w, d));
      syncingRemote = false;
    }, 45);
  }

  function scheduleReconcile() { enrichAndReconcile(); }

  async function loadCloudState() {
    if (!cloudReady) return;
    let result = await CoachingCloud.client
      .from('workout_sets')
      .select('week_index,day_index,set_index,load_kg,rpe,completed,completed_at,updated_at,prescribed_load_min_kg,prescribed_load_max_kg')
      .eq('athlete_slug', cfg.slug)
      .eq('program_key', cfg.programKey);
    if (result.error && /completed_at|updated_at/i.test(result.error.message || '')) {
      result = await CoachingCloud.client
        .from('workout_sets')
        .select('week_index,day_index,set_index,load_kg,rpe,completed,prescribed_load_min_kg,prescribed_load_max_kg')
        .eq('athlete_slug', cfg.slug)
        .eq('program_key', cfg.programKey);
    }
    if (result.error) {
      console.error(result.error);
      CoachingCloud.toast(`Chargement impossible : ${result.error.message}`, true);
      return;
    }
    remoteRows = new Map((result.data || []).map(row => [remoteKey(row.week_index, row.day_index, row.set_index), row]));
    scheduleReconcile();
    renderDayDurations();
  }

  async function syncSet(meta, completed, options = {}) {
    if (!cloudReady) return;
    if (!CoachingCloud.canEditAthlete(cfg.slug)) {
      CoachingCloud.toast(`Ce compte ne peut pas modifier la programmation de ${cfg.name}.`, true);
      await loadCloudState();
      return;
    }

    cacheInputs(meta);
    const now = new Date().toISOString();
    const payload = {
      athlete_slug: cfg.slug,
      athlete_name: cfg.name,
      program_key: cfg.programKey,
      week_index: meta.w,
      day_index: meta.d,
      set_index: meta.idx,
      exercise_code: meta.code,
      exercise_name: meta.exerciseName,
      reps: meta.reps,
      load_kg: meta.load,
      rpe: meta.rpe,
      prescribed_load_min_kg: meta.intervalMin,
      prescribed_load_max_kg: meta.intervalMax,
      completed: !!completed,
      completed_by: CoachingCloud.session.user.id,
      completed_at: completed ? now : null
    };
    const result = await CoachingCloud.client.from('workout_sets').upsert(payload, {
      onConflict: 'athlete_slug,program_key,week_index,day_index,set_index'
    });
    if (result.error) {
      console.error(result.error);
      CoachingCloud.toast(`Synchronisation impossible : ${result.error.message}`, true);
      await loadCloudState();
      return;
    }

    const setKey = activitySetKey(meta.w, meta.d, meta.idx);
    const publishActivity = completed && meta.load !== null && meta.rpe !== null;
    let prResult = null;
    if (publishActivity && options.checkPr && window.CoachingPR) {
      prResult = await CoachingPR.registerIfBetter(meta, now);
    }
    let xpResult = null;
    if (completed && options.awardXp && window.CoachingXP) {
      xpResult = await CoachingXP.awardForSet(meta, prResult, sessionStructure());
    }
    if (publishActivity) {
      const activity = {
        set_key: setKey,
        athlete_slug: cfg.slug,
        athlete_name: cfg.name,
        athlete_emoji: cfg.emoji || '🏋️',
        program_key: cfg.programKey,
        week_index: meta.w,
        week_label: meta.weekLabel,
        day_index: meta.d,
        day_name: meta.dayName,
        set_index: meta.idx,
        exercise_code: meta.code,
        exercise_name: meta.exerciseName,
        reps: meta.reps,
        load_kg: meta.load,
        rpe: meta.rpe,
        prescribed_load_min_kg: meta.intervalMin,
        prescribed_load_max_kg: meta.intervalMax,
        created_by: CoachingCloud.session.user.id,
        updated_at: now
      };
      if (prResult?.isPr && prResult.persisted) {
        activity.activity_type = 'pr';
        activity.previous_pr_kg = prResult.previousLoad;
        activity.new_pr_kg = prResult.newLoad;
        activity.estimated_1rm_kg = prResult.estimated1RM;
      }
      if (xpResult) {
        activity.xp_points = Number(xpResult.setPoints || 0) + Number(xpResult.speedBonus || 0);
        activity.level_after = xpResult.level;
        activity.speed_multiplier = xpResult.speedMultiplier;
        activity.details_text = xpResult.speedBonus > 0
          ? `Bonus vitesse ×${Number(xpResult.speedMultiplier).toFixed(2)} : +${Number(xpResult.speedBonus).toFixed(2)} XP`
          : null;
      }
      const activityResult = await CoachingCloud.client
        .from('workout_activities')
        .upsert(activity, { onConflict: 'set_key' });
      if (activityResult.error) {
        console.error(activityResult.error);
        CoachingCloud.toast(`Série enregistrée, activité non publiée : ${activityResult.error.message}`, true);
      } else if (prResult?.isPr && window.CoachingPR) {
        CoachingPR.celebrate(prResult);
      }
    } else {
      const activityResult = await CoachingCloud.client.from('workout_activities').delete().eq('set_key', setKey);
      if (activityResult.error) console.error(activityResult.error);
    }
    await loadCloudState();
  }

  function bindInteractions() {
    document.addEventListener('click', event => {
      const checkbox = event.target.closest('[data-cloud-checkbox],.set-check,.check-btn');
      const row = checkbox?.closest('.set-row');
      if (!checkbox || !row || !exerciseContainer()?.contains(row)) return;

      const idx = Number(row.dataset.cloudSetIndex);
      if (!Number.isInteger(idx)) return;
      const { w, d } = currentIndices();
      const wasCompleted = originalCompleted(w, d, idx, row);
      const meta = rowMeta(row, idx, w, d);

      if (cloudReady && !CoachingCloud.canEditAthlete(cfg.slug)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        CoachingCloud.toast(`Ce compte ne peut pas modifier la programmation de ${cfg.name}.`, true);
        return;
      }

      if (!wasCompleted && ['sq', 'bn', 'dl'].includes(meta.code)) {
        if (meta.load === null) {
          event.preventDefault();
          event.stopImmediatePropagation();
          CoachingCloud.toast('Renseigne la charge réalisée avant de valider.', true);
          meta.loadInput?.focus();
          return;
        }
        if (meta.rpe === null || meta.rpe < 1 || meta.rpe > 10) {
          event.preventDefault();
          event.stopImmediatePropagation();
          CoachingCloud.toast('Renseigne un RPE compris entre 1 et 10.', true);
          meta.rpeInput?.focus();
          return;
        }
      }

      if (!intervalIsValid(meta)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        CoachingCloud.toast('La charge minimale ne peut pas dépasser la charge maximale.', true);
        meta.intervalMinInput?.focus();
        return;
      }
      cacheInputs(meta);
      const nextCompleted = !wasCompleted;
      if (nextCompleted) {
        rememberDayStart(w, d);
        ensureRestTimerStarted(idx);
      }
      setTimeout(() => {
        renderDayDurations();
        syncSet(meta, nextCompleted, {
          checkPr: !wasCompleted && nextCompleted,
          awardXp: !wasCompleted && nextCompleted
        });
      }, 70);
    }, true);

    document.addEventListener('change', async event => {
      const input = event.target.closest('[data-cloud-load],.cloud-athlete-rpe,.cloud-athlete-load,.cloud-interval-min,.cloud-interval-max');
      const row = input?.closest('.set-row');
      if (!input || !row || !exerciseContainer()?.contains(row)) return;
      const idx = Number(row.dataset.cloudSetIndex);
      if (!Number.isInteger(idx)) return;
      const { w, d } = currentIndices();
      const meta = rowMeta(row, idx, w, d);
      const isIntervalInput = input.matches('.cloud-interval-min,.cloud-interval-max');
      if (isIntervalInput && CoachingCloud.member?.role !== 'coach') {
        CoachingCloud.toast('Seul le coach peut modifier la plage cible.', true);
        await loadCloudState();
        return;
      }
      if (!intervalIsValid(meta)) {
        CoachingCloud.toast('La charge minimale ne peut pas dépasser la charge maximale.', true);
        input.focus();
        return;
      }
      cacheInputs(meta);
      if (cloudReady && (isIntervalInput || originalCompleted(w, d, idx, row))) {
        syncSet(meta, originalCompleted(w, d, idx, row), { checkPr: false, awardXp: false });
      }
    }, true);

    document.addEventListener('click', event => {
      if (!event.target.closest('.week-btn,.day-tab')) return;
      setTimeout(renderDayDurations, 20);
      setTimeout(renderCurrentSessionChrono, 120);
    }, true);
  }

  function observeRenders() {
    const container = exerciseContainer();
    if (!container) return;
    mutationObserver = new MutationObserver(() => { scheduleReconcile(); renderDayDurations(); });
    mutationObserver.observe(container, { childList: true, subtree: true });
    scheduleReconcile();
  }

  function subscribe() {
    if (setChannel) CoachingCloud.client.removeChannel(setChannel);
    let timer;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(loadCloudState, 120);
    };
    setChannel = CoachingCloud.client
      .channel(`ga-sets-${cfg.slug}-${String(cfg.programKey).replace(/[^a-z0-9_-]/gi, '-')}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'workout_sets', filter: `athlete_slug=eq.${cfg.slug}`
      }, refresh)
      .subscribe();
  }

  injectStatus();
  injectActivityPanel();
  bindInteractions();
  observeRenders();
  renderDayDurations();
  clearInterval(dayDurationTimer);
  dayDurationTimer = setInterval(renderDayDurations, 1000);
  clearInterval(chronoGuardTimer);
  // Les pages historiques ont parfois leur propre chrono global. On réécrit
  // régulièrement l'affichage avec le chrono de la journée active afin qu'une
  // ancienne séance ne puisse plus afficher des centaines d'heures.
  chronoGuardTimer = setInterval(renderCurrentSessionChrono, 250);

  CoachingCloud.onReady(async () => {
    cloudReady = true;
    await loadCloudState();
    subscribe();
    await Promise.all([CoachingCloud.mountActivityFeed('cloudAthleteFeedLift', 60, { category: 'lift' }), CoachingCloud.mountActivityFeed('cloudAthleteFeedAdventure', 60, { category: 'adventure' })]);
  });
  CoachingCloud.boot();
})();
