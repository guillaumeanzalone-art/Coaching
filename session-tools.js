/* GA Coaching — bilan de séance + aperçu de la prochaine série
   Build: 2026-07-31-session-v2
*/
(function () {
  'use strict';

  const cfg = window.COACHING_ATHLETE || {};
  if (!cfg.slug || !cfg.programKey) return;

  const BUILD = '2026-07-31-session-v2';
  const checkinCachePrefix = `ga-session-checkin:${cfg.slug}:${cfg.programKey}`;
  let cloudReady = false;
  let cloudUnavailable = false;
  let saveTimer = null;
  let lastClickedIndex = -1;
  let lastContextKey = '';
  let previewTimer = null;

  const style = document.createElement('style');
  style.textContent = `
    .ga-session-checkin{margin:14px 16px 22px;padding:16px;border-radius:16px;background:var(--surface,#141a2a);border:1px solid rgba(255,255,255,.07);box-shadow:0 14px 34px rgba(0,0,0,.16)}
    .ga-session-checkin.ga-hidden{display:none}.ga-session-checkin-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:13px}.ga-session-checkin h2{margin:0;font-size:14px;font-weight:900;color:var(--text,#e8ecf5)}.ga-session-checkin p{margin:4px 0 0;font-size:9px;line-height:1.4;color:var(--text-muted,#667696)}
    .ga-checkin-status{flex:none;font-size:9px;font-weight:850;color:var(--text-muted,#667696);padding:5px 8px;border-radius:999px;background:rgba(255,255,255,.04)}.ga-checkin-status.saved{color:var(--green,#4ae06a);background:rgba(74,224,106,.1)}.ga-checkin-status.error{color:#ff9292;background:rgba(240,72,72,.11)}
    .ga-checkin-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.ga-checkin-field{display:flex;flex-direction:column;gap:5px}.ga-checkin-field:last-child{grid-column:1/-1}.ga-checkin-field label{font-size:9px;font-weight:850;color:var(--text-dim,#8898b8)}.ga-checkin-input-wrap{display:flex;align-items:center;gap:6px;padding:0 9px;border-radius:10px;background:var(--surface-2,#1c2438);border:1px solid rgba(255,255,255,.065)}.ga-checkin-input-wrap:focus-within{border-color:var(--accent,#f0c44d)}.ga-checkin-input-wrap input{width:100%;min-width:0;padding:10px 0;border:0;outline:0;background:transparent;color:var(--text,#e8ecf5);font:800 13px Inter,system-ui,sans-serif}.ga-checkin-unit{flex:none;font-size:9px;font-weight:850;color:var(--text-muted,#667696)}
    .ga-rest-preview{width:min(100%,340px);padding:12px 14px;border-radius:13px;background:var(--surface,#141a2a);border:1px solid rgba(255,255,255,.08);text-align:center;margin:0 auto 8px}.ga-rest-preview-label{font-size:8px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:var(--text-muted,#667696)}.ga-rest-preview-exercise{margin-top:5px;font-size:14px;font-weight:950;color:var(--accent,#f0c44d);line-height:1.25}.ga-rest-preview-details{margin-top:4px;font-size:11px;font-weight:800;color:var(--text-dim,#a0abc0);line-height:1.35}
    #cloudFallbackRest .ga-rest-preview{margin-bottom:16px;background:rgba(255,255,255,.045)}
    @media(max-width:370px){.ga-checkin-grid{grid-template-columns:1fr}.ga-checkin-field:last-child{grid-column:auto}.ga-session-checkin{margin-left:12px;margin-right:12px}}
  `;
  document.head.appendChild(style);

  function currentIndices() {
    try {
      if (cfg.adapter === 'state' && typeof state !== 'undefined') return { w: Number(state.w) || 0, d: Number(state.d) || 0 };
      if (cfg.adapter === 'boolean' && typeof W !== 'undefined' && typeof D !== 'undefined') return { w: Number(W) || 0, d: Number(D) || 0 };
      if ((cfg.adapter === 'legacy' || cfg.adapter === 'custom') && typeof S !== 'undefined') return { w: Number(S.w) || 0, d: Number(S.d) || 0 };
      if (cfg.adapter === 'custom' && typeof state !== 'undefined') return { w: Number(state.w) || 0, d: Number(state.d) || 0 };
    } catch (_) {}
    const weeks = [...document.querySelectorAll('.week-btn')];
    const days = [...document.querySelectorAll('.day-tab')];
    return {
      w: Math.max(0, weeks.findIndex(el => el.classList.contains('active'))),
      d: Math.max(0, days.findIndex(el => el.classList.contains('active')))
    };
  }

  function contextKey() {
    const { w, d } = currentIndices();
    return `${w}-${d}`;
  }

  function cacheKey() { return `${checkinCachePrefix}:${contextKey()}`; }

  function parseNumber(value) {
    const text = String(value ?? '').trim().replace(',', '.');
    if (!text) return null;
    const number = Number(text);
    return Number.isFinite(number) ? number : null;
  }

  function readLocal() {
    try {
      const data = JSON.parse(localStorage.getItem(cacheKey()) || '{}');
      return data && typeof data === 'object' ? data : {};
    } catch (_) { return {}; }
  }

  function writeLocal(data) {
    try { localStorage.setItem(cacheKey(), JSON.stringify({ ...data, updatedAt: new Date().toISOString(), build: BUILD })); }
    catch (_) {}
  }

  function exerciseContainer() {
    return document.getElementById('exerciseList') || document.getElementById('exercises');
  }

  function checkinCard() { return document.getElementById('gaSessionCheckin'); }

  function injectCheckin() {
    const container = exerciseContainer();
    if (!container || checkinCard()) return;
    const card = document.createElement('section');
    card.id = 'gaSessionCheckin';
    card.className = 'ga-session-checkin';
    card.innerHTML = `
      <div class="ga-session-checkin-head">
        <div><h2>📝 Bilan de la séance</h2><p>Les données sont enregistrées pour la semaine et le jour sélectionnés.</p></div>
        <span class="ga-checkin-status" id="gaCheckinStatus">Local</span>
      </div>
      <div class="ga-checkin-grid">
        <div class="ga-checkin-field"><label for="gaHydration">Hydratation</label><div class="ga-checkin-input-wrap"><input id="gaHydration" data-checkin="hydration_liters" type="number" inputmode="decimal" min="0" max="15" step="0.25" placeholder="0"><span class="ga-checkin-unit">L</span></div></div>
        <div class="ga-checkin-field"><label for="gaSleep">Sommeil</label><div class="ga-checkin-input-wrap"><input id="gaSleep" data-checkin="sleep_hours" type="number" inputmode="decimal" min="0" max="24" step="0.5" placeholder="0"><span class="ga-checkin-unit">h</span></div></div>
        <div class="ga-checkin-field"><label for="gaUpperPain">Douleur upper</label><div class="ga-checkin-input-wrap"><input id="gaUpperPain" data-checkin="upper_pain" type="number" inputmode="numeric" min="0" max="10" step="1" placeholder="0"><span class="ga-checkin-unit">/10</span></div></div>
        <div class="ga-checkin-field"><label for="gaLowerPain">Douleur lower</label><div class="ga-checkin-input-wrap"><input id="gaLowerPain" data-checkin="lower_pain" type="number" inputmode="numeric" min="0" max="10" step="1" placeholder="0"><span class="ga-checkin-unit">/10</span></div></div>
        <div class="ga-checkin-field"><label for="gaSteps">Nombre de steps</label><div class="ga-checkin-input-wrap"><input id="gaSteps" data-checkin="steps" type="number" inputmode="numeric" min="0" max="100000" step="100" placeholder="0"><span class="ga-checkin-unit">pas</span></div></div>
      </div>`;
    container.insertAdjacentElement('afterend', card);
    card.addEventListener('input', onCheckinInput);
    card.addEventListener('change', onCheckinChange);
    loadCheckinForCurrentDay();
    syncCheckinVisibility();
  }

  function setStatus(text, type = '') {
    const el = document.getElementById('gaCheckinStatus');
    if (!el) return;
    el.textContent = text;
    el.classList.remove('saved', 'error');
    if (type) el.classList.add(type);
  }

  function valuesFromCard() {
    const values = {};
    document.querySelectorAll('#gaSessionCheckin [data-checkin]').forEach(input => {
      values[input.dataset.checkin] = parseNumber(input.value);
    });
    return values;
  }

  function fillCard(values) {
    document.querySelectorAll('#gaSessionCheckin [data-checkin]').forEach(input => {
      const value = values?.[input.dataset.checkin];
      input.value = value === null || value === undefined ? '' : String(value);
    });
  }

  function validate(values) {
    const checks = [
      ['hydration_liters', 0, 15, 'Hydratation : valeur comprise entre 0 et 15 L.'],
      ['sleep_hours', 0, 24, 'Sommeil : valeur comprise entre 0 et 24 h.'],
      ['upper_pain', 0, 10, 'Douleur upper : note comprise entre 0 et 10.'],
      ['lower_pain', 0, 10, 'Douleur lower : note comprise entre 0 et 10.'],
      ['steps', 0, 100000, 'Steps : valeur comprise entre 0 et 100 000.']
    ];
    for (const [key, min, max, message] of checks) {
      const value = values[key];
      if (value !== null && (value < min || value > max)) return message;
    }
    return '';
  }

  function onCheckinInput() {
    const values = valuesFromCard();
    const error = validate(values);
    if (error) return setStatus('Valeur invalide', 'error');
    writeLocal(values);
    setStatus(cloudReady && !cloudUnavailable ? 'À synchroniser' : 'Enregistré local', 'saved');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveCloudCheckin, 650);
  }

  function onCheckinChange() {
    clearTimeout(saveTimer);
    saveCloudCheckin();
  }

  async function loadCloudCheckin() {
    if (!cloudReady || cloudUnavailable || !window.CoachingCloud?.client) return;
    const { w, d } = currentIndices();
    const { data, error } = await CoachingCloud.client
      .from('workout_checkins')
      .select('hydration_liters,upper_pain,lower_pain,sleep_hours,steps,updated_at')
      .eq('athlete_slug', cfg.slug)
      .eq('program_key', String(cfg.programKey))
      .eq('week_index', w)
      .eq('day_index', d)
      .maybeSingle();
    if (error) {
      if (/workout_checkins|schema cache|does not exist|relation/i.test(error.message || '')) {
        cloudUnavailable = true;
        setStatus('Migration requise', 'error');
      } else {
        setStatus('Erreur cloud', 'error');
        console.warn('Bilan de séance indisponible :', error.message);
      }
      return;
    }
    if (data) {
      const values = {
        hydration_liters: data.hydration_liters,
        upper_pain: data.upper_pain,
        lower_pain: data.lower_pain,
        sleep_hours: data.sleep_hours,
        steps: data.steps
      };
      fillCard(values);
      writeLocal(values);
    }
    setStatus('Synchronisé', 'saved');
  }

  async function saveCloudCheckin() {
    const values = valuesFromCard();
    const validationError = validate(values);
    if (validationError) {
      setStatus('Valeur invalide', 'error');
      window.CoachingCloud?.toast?.(validationError, true);
      return;
    }
    writeLocal(values);
    if (!cloudReady || cloudUnavailable || !window.CoachingCloud?.client || !CoachingCloud.session?.user) {
      setStatus(cloudUnavailable ? 'Migration requise' : 'Enregistré local', cloudUnavailable ? 'error' : 'saved');
      return;
    }
    if (!CoachingCloud.canEditAthlete(cfg.slug)) {
      setStatus('Lecture seule', 'error');
      return;
    }
    const { w, d } = currentIndices();
    setStatus('Synchronisation…');
    const payload = {
      athlete_slug: cfg.slug,
      athlete_name: cfg.name || cfg.slug,
      program_key: String(cfg.programKey),
      week_index: w,
      day_index: d,
      hydration_liters: values.hydration_liters,
      upper_pain: values.upper_pain,
      lower_pain: values.lower_pain,
      sleep_hours: values.sleep_hours,
      steps: values.steps,
      updated_by: CoachingCloud.session.user.id
    };
    const { error } = await CoachingCloud.client.from('workout_checkins').upsert(payload, {
      onConflict: 'athlete_slug,program_key,week_index,day_index'
    });
    if (error) {
      if (/workout_checkins|schema cache|does not exist|relation/i.test(error.message || '')) {
        cloudUnavailable = true;
        setStatus('Migration requise', 'error');
      } else {
        setStatus('Erreur cloud', 'error');
        console.warn('Sauvegarde du bilan impossible :', error.message);
      }
      return;
    }
    setStatus('Synchronisé', 'saved');
  }

  function loadCheckinForCurrentDay() {
    lastContextKey = contextKey();
    fillCard(readLocal());
    setStatus(cloudReady && !cloudUnavailable ? 'Chargement…' : 'Enregistré local', cloudReady && !cloudUnavailable ? '' : 'saved');
    if (cloudReady) loadCloudCheckin();
  }

  function syncCheckinVisibility() {
    const card = checkinCard();
    const container = exerciseContainer();
    if (!card || !container) return;
    const workoutView = container.closest('.workout-view,#workoutView');
    const hidden = container.classList.contains('hide') || container.classList.contains('hidden') ||
      workoutView?.classList.contains('hidden') || getComputedStyle(container).display === 'none';
    card.classList.toggle('ga-hidden', !!hidden);
  }

  function rows() {
    const container = exerciseContainer();
    return container ? [...container.querySelectorAll('.set-row')] : [];
  }

  function rowCompleted(row) {
    const checkbox = row.querySelector('.set-check,.check-btn');
    return row.classList.contains('completed') || row.classList.contains('done') ||
      checkbox?.classList.contains('checked') || checkbox?.getAttribute('aria-checked') === 'true';
  }

  function rowExerciseName(row) {
    const block = row.closest('.exercise-block');
    const name = block?.querySelector('.exercise-name')?.textContent?.trim() || 'Prochaine série';
    const variant = block?.querySelector('.exercise-intention,.variant')?.textContent?.trim();
    return variant && !name.toLowerCase().includes(variant.toLowerCase()) ? `${name} · ${variant}` : name;
  }

  function rowSetNumber(row) {
    const sameBlockRows = [...(row.closest('.exercise-block')?.querySelectorAll('.set-row') || [])];
    const index = sameBlockRows.indexOf(row);
    return index >= 0 ? index + 1 : 1;
  }

  function rowReps(row) {
    const strong = row.querySelector('.set-info strong')?.textContent || '';
    const text = strong || row.querySelector('.set-info')?.textContent || '';
    const match = text.match(/\d+(?:[.,]\d+)?/);
    if (!match) return '';
    const value = match[0].replace('.', ',');
    return `${value} rep${Number(match[0].replace(',', '.')) > 1 ? 's' : ''}`;
  }

  function normalizeLoadText(text) {
    let value = String(text || '').replace(/\s+/g, ' ').trim();
    if (!value) return '';
    value = value.replace(/(\d)\s*[-–—]\s*(\d)/g, '$1–$2');
    if (/^\d+(?:[.,]\d+)?(?:–\d+(?:[.,]\d+)?)?$/.test(value)) value += ' kg';
    return value;
  }

  function rowLoad(row) {
    const input = row.querySelector('.load-input,.set-load,.cloud-athlete-load,[data-cloud-load]');
    if (input?.value?.trim()) return normalizeLoadText(input.value);
    const min = row.querySelector('.cloud-interval-min')?.value?.trim();
    const max = row.querySelector('.cloud-interval-max')?.value?.trim();
    if (min || max) return normalizeLoadText(min && max && min !== max ? `${min}–${max}` : (min || max));
    if (input?.placeholder?.trim() && /^\d+(?:[.,]\d+)?$/.test(input.placeholder.trim())) return normalizeLoadText(input.placeholder);

    const block = row.closest('.exercise-block');
    const chips = [...(block?.querySelectorAll('.exercise-meta .meta-chip') || [])].map(el => el.textContent.trim()).reverse();
    for (const chip of chips) {
      if (/\b(?:pdc|amrap|sec|min|mètres?|m)\b/i.test(chip)) return normalizeLoadText(chip);
      const range = chip.match(/\d+(?:[.,]\d+)?\s*[-–—à]\s*\d+(?:[.,]\d+)?(?:\s*kg)?/i);
      if (range) return normalizeLoadText(range[0]);
      const kg = chip.match(/\d+(?:[.,]\d+)?\s*kg/i);
      if (kg) return normalizeLoadText(kg[0]);
    }

    const directText = [...row.childNodes]
      .filter(node => node.nodeType === Node.ELEMENT_NODE && !node.matches?.('.set-num,.set-info,.set-check,.check-btn,input,.cloud-load-interval'))
      .map(node => node.textContent.trim()).join(' ');
    const directLoad = directText.match(/(?:pdc|\d+(?:[.,]\d+)?(?:\s*[-–—à]\s*\d+(?:[.,]\d+)?)?\s*kg)/i);
    return normalizeLoadText(directLoad?.[0] || '');
  }

  function nextSetData() {
    const currentRows = rows();
    if (!currentRows.length) return null;
    currentRows.forEach((row, index) => { if (!row.dataset.gaSetIndex) row.dataset.gaSetIndex = String(index); });
    let next = currentRows.find((row, index) => index > lastClickedIndex && !rowCompleted(row));
    if (!next) next = currentRows.find(row => !rowCompleted(row));
    if (!next) return { complete: true };
    return {
      complete: false,
      exercise: rowExerciseName(next),
      setNumber: rowSetNumber(next),
      reps: rowReps(next),
      load: rowLoad(next)
    };
  }

  function setText(element, value) {
    if (element && element.textContent !== value) element.textContent = value;
  }

  function previewDetails(data) {
    if (!data || data.complete) return 'Toutes les séries sont terminées.';
    return [`Série ${data.setNumber}`, data.reps, data.load].filter(Boolean).join(' · ');
  }

  function ensurePreviewBox(overlay) {
    if (!overlay) return null;
    let box = overlay.querySelector('.ga-rest-preview');
    if (box) return box;
    box = document.createElement('div');
    box.className = 'ga-rest-preview';
    box.innerHTML = '<div class="ga-rest-preview-label">Prochaine série</div><div class="ga-rest-preview-exercise">—</div><div class="ga-rest-preview-details">—</div>';
    const card = overlay.querySelector('.cloud-fallback-rest-card');
    if (card) {
      const time = card.querySelector('.cloud-fallback-time');
      card.insertBefore(box, time || card.firstChild);
    } else {
      const nativePreview = overlay.querySelector('.timer-next');
      const ring = overlay.querySelector('.timer-ring-big,.timer-ring,.timer-circle,.timer-time')?.parentElement;
      if (!nativePreview) overlay.insertBefore(box, ring || overlay.firstChild);
    }
    return box;
  }

  function updateRestPreview() {
    const data = nextSetData();
    const overlays = [document.getElementById('timerOverlay'), document.getElementById('cloudFallbackRest')].filter(Boolean);
    overlays.forEach(overlay => {
      const box = ensurePreviewBox(overlay);
      if (box) {
        setText(box.querySelector('.ga-rest-preview-exercise'), data?.complete ? 'Séance terminée ✅' : (data?.exercise || 'Prochaine série'));
        setText(box.querySelector('.ga-rest-preview-details'), previewDetails(data));
      }
      const nextEx = overlay.querySelector('#timerNextEx');
      const nextSet = overlay.querySelector('#timerNextSet');
      if (nextEx) setText(nextEx, data?.complete ? 'Séance terminée ✅' : (data?.exercise || 'Prochaine série'));
      if (nextSet) {
        const splitLayout = !!nextEx;
        setText(nextSet, splitLayout
          ? previewDetails(data)
          : (data?.complete ? 'Séance terminée ✅' : `${data?.exercise || 'Prochaine série'} · ${previewDetails(data)}`));
      }
    });
  }

  function restOverlayVisible() {
    return [document.getElementById('timerOverlay'), document.getElementById('cloudFallbackRest')].some(overlay => {
      if (!overlay) return false;
      const style = getComputedStyle(overlay);
      return overlay.classList.contains('visible') || overlay.classList.contains('show') || (style.display !== 'none' && style.visibility !== 'hidden');
    });
  }

  function startPreviewWatcher() {
    clearInterval(previewTimer);
    previewTimer = setInterval(() => {
      if (restOverlayVisible()) updateRestPreview();
      const key = contextKey();
      if (key !== lastContextKey) loadCheckinForCurrentDay();
      syncCheckinVisibility();
    }, 300);
  }

  document.addEventListener('click', event => {
    const checkbox = event.target.closest('.set-check,.check-btn,[data-cloud-checkbox]');
    const row = checkbox?.closest('.set-row');
    if (row && exerciseContainer()?.contains(row)) {
      const currentRows = rows();
      lastClickedIndex = currentRows.indexOf(row);
      setTimeout(updateRestPreview, 30);
      setTimeout(updateRestPreview, 160);
    }
    if (event.target.closest('.week-btn,.day-tab,.nav-item')) {
      setTimeout(() => {
        injectCheckin();
        if (contextKey() !== lastContextKey) loadCheckinForCurrentDay();
        syncCheckinVisibility();
      }, 80);
    }
  }, true);

  const bodyObserver = new MutationObserver(() => {
    injectCheckin();
    updateRestPreview();
    syncCheckinVisibility();
  });
  bodyObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  injectCheckin();
  startPreviewWatcher();

  if (window.CoachingCloud?.onReady) {
    CoachingCloud.onReady(() => {
      cloudReady = true;
      cloudUnavailable = false;
      loadCloudCheckin();
    });
  }
})();
