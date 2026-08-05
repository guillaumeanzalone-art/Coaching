(function () {
  'use strict';

  const cfg = window.COACHING_ATHLETE || {};
  if (!cfg.slug) return;

  const seedRoot = window.GA_PR_SEED || {};
  const seed = seedRoot[cfg.slug] || { sq: {}, bn: {}, dl: {}, source: 'Aucune donnée initiale' };
  const records = { sq: new Map(), bn: new Map(), dl: new Map() };
  let panel = null;
  let channel = null;

  const liftLabels = { sq: 'SQUAT', bn: 'BENCH', dl: 'DEADLIFT' };
  const formatNames = {
    1: 'single',
    2: 'doublé',
    3: 'triplé',
    4: 'quadruplé',
    5: 'quintuplé',
    6: 'sextuplé',
    7: 'septuplé',
    8: 'octuplé',
    9: 'nonuplé',
    10: 'décuplé'
  };

  const css = `
    .pr-panel{display:none;position:fixed;z-index:410;left:50%;transform:translateX(-50%);top:56px;bottom:62px;width:100%;max-width:430px;padding:13px 16px 22px;overflow-y:auto;background:var(--bg,#05070d);color:var(--text,#eef2f7)}
    .pr-panel.show{display:block}.pr-panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:2px 0 12px}.pr-panel-head h2{margin:0;font-size:17px}.pr-panel-head button{border:1px solid rgba(255,255,255,.07);border-radius:10px;background:var(--surface-2,#141c2d);color:inherit;padding:8px 11px;font-weight:800;cursor:pointer}
    .pr-source{padding:9px 11px;margin-bottom:11px;border:1px solid rgba(240,196,77,.12);border-radius:12px;background:rgba(240,196,77,.05);color:var(--text-dim,#a0abc0);font-size:10px;line-height:1.45}
    .pr-lift{margin-bottom:12px;border:1px solid rgba(255,255,255,.06);border-radius:16px;background:linear-gradient(145deg,rgba(255,255,255,.03),rgba(255,255,255,.012));overflow:hidden}
    .pr-lift-title{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.05);font-size:12px;font-weight:900;letter-spacing:.04em}.pr-lift-title span{color:var(--accent,#f0c44d);font-size:10px}
    .pr-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;background:rgba(255,255,255,.04)}
    .pr-cell{min-width:0;padding:10px 11px;background:var(--surface,#0e1421)}.pr-format{font-size:10px;font-weight:900;color:var(--text-muted,#5d6780);text-transform:uppercase}.pr-load{margin-top:3px;font-size:17px;font-weight:900;color:var(--text,#eef2f7)}.pr-load.empty{color:var(--text-muted,#5d6780)}.pr-date{margin-top:3px;min-height:13px;font-size:9px;color:var(--text-muted,#5d6780);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .pr-nav.active{color:var(--accent-light,var(--accent,#f0c44d))!important}
    .pr-celebration{display:none;position:fixed;inset:0;z-index:7000;align-items:center;justify-content:center;padding:20px;background:rgba(2,4,8,.88);backdrop-filter:blur(12px)}
    .pr-celebration.show{display:flex}.pr-celebration-card{position:relative;width:min(100%,390px);overflow:hidden;border:1px solid rgba(240,196,77,.34);border-radius:22px;padding:24px 20px 20px;text-align:center;background:radial-gradient(circle at 50% 0,rgba(183,26,40,.24),transparent 52%),#0e1421;box-shadow:0 24px 80px rgba(0,0,0,.55)}
    .pr-celebration-card:before{content:'✦  ✦  ✦';display:block;margin-bottom:9px;color:var(--accent,#f0c44d);letter-spacing:8px}.pr-celebration h2{margin:0;color:var(--accent,#f0c44d);font-size:22px;line-height:1.1}.pr-celebration p{margin:12px 0 0;color:var(--text,#eef2f7);font-size:14px;line-height:1.58}.pr-celebration strong{color:var(--accent-light,var(--accent,#f0c44d))}.pr-celebration button{margin-top:18px;border:0;border-radius:12px;padding:11px 18px;background:var(--accent,#f0c44d);color:#11151d;font-weight:900;cursor:pointer}
    @media(max-width:370px){.pr-grid{grid-template-columns:1fr}.pr-panel{top:52px}}
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  function number(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function fr(value) {
    const n = number(value);
    return n === null ? '—' : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n);
  }

  function estimated1RM(load, reps) {
    const weight = Number(load);
    const count = Number(reps);
    if (!(weight > 0) || !(count > 0)) return null;
    const raw = count === 1 ? weight : weight * (1 + count / 30);
    return Math.round(raw * 2) / 2;
  }

  function formatName(reps) {
    const count = Number(reps);
    return formatNames[count] || `${count} répétitions`;
  }

  function normalizeRecord(raw, sourceFallback = '') {
    if (!raw) return null;
    const load = number(raw.load ?? raw.load_kg);
    if (!(load > 0)) return null;
    return {
      load,
      label: String(raw.date || raw.source_label || sourceFallback || '').trim(),
      achievedAt: raw.achieved_at || null
    };
  }

  function loadSeed() {
    ['sq', 'bn', 'dl'].forEach(code => {
      const sourceRows = seed[code] || {};
      Object.entries(sourceRows).forEach(([reps, raw]) => {
        const record = normalizeRecord(raw, seed.source);
        if (record) records[code].set(Number(reps), record);
      });
    });
  }

  function mergeCloudRows(rows) {
    (rows || []).forEach(row => {
      const code = row.exercise_code;
      const reps = Number(row.reps);
      if (!records[code] || !(reps > 0)) return;
      const incoming = normalizeRecord(row, row.source_label);
      if (!incoming) return;
      const current = records[code].get(reps);
      if (!current || incoming.load >= current.load) records[code].set(reps, incoming);
    });
    renderPanel();
  }

  function recordFor(code, reps) {
    return records[code]?.get(Number(reps)) || null;
  }

  function isEligible(meta) {
    const code = meta?.code;
    const name = `${meta?.exerciseName || ''} ${meta?.variantName || ''}`.toLowerCase();
    if (!['sq', 'bn', 'dl'].includes(code)) return false;
    if (code === 'sq' && /(tempo|pause|high\s*bar|front|box|pin|hack|belt)/i.test(name)) return false;
    if (code === 'bn' && /(larsen|2ct|pause|spoto|tempo|incliné|incline|close|serré|floor|pin)/i.test(name)) return false;
    if (code === 'dl' && /(pause|déficit|deficit|rdl|roumain|tempo|block|rack|snatch)/i.test(name)) return false;
    return true;
  }

  function displayLabel(record) {
    if (!record) return '';
    if (record.achievedAt) {
      const d = new Date(record.achievedAt);
      if (!Number.isNaN(d.getTime())) return d.toLocaleDateString('fr-FR');
    }
    return record.label || '';
  }

  function injectPanel() {
    if (document.getElementById('prPanel')) return;
    panel = document.createElement('section');
    panel.id = 'prPanel';
    panel.className = 'pr-panel';
    panel.innerHTML = `
      <div class="pr-panel-head">
        <h2>🏆 Records par format</h2>
        <button type="button" id="prPanelClose">Fermer</button>
      </div>
      <div class="pr-source" id="prSource"></div>
      <div id="prPanelContent"></div>`;
    document.body.appendChild(panel);

    const nav = document.querySelector('.bottom-nav');
    let button;
    if (nav?.querySelector('.nav-tab')) {
      button = document.createElement('div');
      button.className = 'nav-tab pr-nav';
      button.textContent = '🏆 PR';
      button.setAttribute('role', 'button');
    } else {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'nav-item pr-nav';
      button.innerHTML = '<span>🏆 PR</span>';
    }
    if (nav) nav.appendChild(button);
    else {
      button.style.position = 'fixed';
      button.style.left = '12px';
      button.style.bottom = '12px';
      button.style.zIndex = '405';
      document.body.appendChild(button);
    }

    const close = () => {
      panel.classList.remove('show');
      button.classList.remove('active');
    };
    button.addEventListener('click', event => {
      event.preventDefault();
      panel.classList.toggle('show');
      button.classList.toggle('active', panel.classList.contains('show'));
      renderPanel();
    });
    document.getElementById('prPanelClose').addEventListener('click', close);
  }

  function renderPanel() {
    if (!panel) return;
    const source = document.getElementById('prSource');
    if (source) {
      source.textContent = `${seed.source || 'Données initiales non disponibles'} · Les nouveaux records validés dans l’application remplacent automatiquement ces valeurs. e1RM calculé avec la formule d’Epley.`;
    }
    const content = document.getElementById('prPanelContent');
    if (!content) return;
    content.innerHTML = ['sq', 'bn', 'dl'].map(code => {
      const best = [...records[code].values()].sort((a, b) => b.load - a.load)[0];
      const cells = Array.from({ length: 10 }, (_, index) => {
        const reps = index + 1;
        const record = recordFor(code, reps);
        return `<div class="pr-cell">
          <div class="pr-format">${formatName(reps)}</div>
          <div class="pr-load ${record ? '' : 'empty'}">${record ? `${fr(record.load)} kg` : '—'}</div>
          <div class="pr-date">${record ? displayLabel(record) : 'Aucun record enregistré'}</div>
        </div>`;
      }).join('');
      return `<section class="pr-lift">
        <div class="pr-lift-title">${liftLabels[code]}<span>${best ? `MAX ${fr(best.load)} kg` : 'AUCUNE DONNÉE'}</span></div>
        <div class="pr-grid">${cells}</div>
      </section>`;
    }).join('');
  }

  function ensureCelebration() {
    let overlay = document.getElementById('prCelebration');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'prCelebration';
    overlay.className = 'pr-celebration';
    overlay.innerHTML = `
      <div class="pr-celebration-card">
        <h2>FÉLICITATIONS BG !</h2>
        <p id="prCelebrationText"></p>
        <button type="button" id="prCelebrationClose">Énorme !</button>
      </div>`;
    document.body.appendChild(overlay);
    document.getElementById('prCelebrationClose').addEventListener('click', () => overlay.classList.remove('show'));
    overlay.addEventListener('click', event => {
      if (event.target === overlay) overlay.classList.remove('show');
    });
    return overlay;
  }

  function celebrationText(result) {
    const format = formatName(result.reps);
    const lift = liftLabels[result.code] || 'MOUVEMENT';
    if (result.previousLoad > 0) {
      return `T’as PR sur le ${format} de ${lift}. Ton ancien ${format} était à ${fr(result.previousLoad)} kg et ton nouveau est à ${fr(result.newLoad)} kg. Ton e1RM potentiel est maintenant de ${fr(result.estimated1RM)} kg.`;
    }
    return `T’as établi ton premier ${format} enregistré sur le ${lift} à ${fr(result.newLoad)} kg. Ton e1RM potentiel est maintenant de ${fr(result.estimated1RM)} kg.`;
  }

  function celebrate(result) {
    if (!result?.isPr) return;
    const overlay = ensureCelebration();
    document.getElementById('prCelebrationText').textContent = celebrationText(result);
    overlay.classList.add('show');
    if (navigator.vibrate) navigator.vibrate([150, 70, 220, 70, 300]);
    clearTimeout(celebrate.timer);
    celebrate.timer = setTimeout(() => overlay.classList.remove('show'), 12000);
  }

  async function registerIfBetter(meta, achievedAt) {
    if (!isEligible(meta)) return { isPr: false };
    const reps = Math.max(1, Math.min(10, Number(meta.reps) || 0));
    const load = number(meta.load);
    if (!(reps > 0) || !(load > 0)) return { isPr: false };

    const localBefore = recordFor(meta.code, reps);
    if (localBefore && load <= localBefore.load) return { isPr: false, previousLoad: localBefore.load };

    const fallbackResult = {
      isPr: true,
      previousLoad: localBefore?.load || null,
      newLoad: load,
      estimated1RM: estimated1RM(load, reps),
      reps,
      code: meta.code,
      persisted: false
    };

    if (window.CoachingCloud?.client && window.CoachingCloud?.session?.user) {
      try {
        const { data, error } = await CoachingCloud.client.rpc('register_pr_if_better', {
          p_athlete_slug: cfg.slug,
          p_exercise_code: meta.code,
          p_reps: reps,
          p_load_kg: load,
          p_source_label: 'GA Coaching App'
        });
        if (!error) {
          const row = Array.isArray(data) ? data[0] : data;
          if (!row?.is_pr) {
            if (row?.new_load_kg) {
              records[meta.code].set(reps, {
                load: Number(row.new_load_kg),
                label: 'GA Coaching App',
                achievedAt: achievedAt || new Date().toISOString()
              });
              renderPanel();
            }
            return { isPr: false, previousLoad: Number(row?.previous_load_kg) || localBefore?.load || null };
          }
          const result = {
            isPr: true,
            previousLoad: Number(row.previous_load_kg) || null,
            newLoad: Number(row.new_load_kg) || load,
            estimated1RM: Number(row.estimated_1rm_kg) || estimated1RM(load, reps),
            reps,
            code: meta.code,
            persisted: true
          };
          records[meta.code].set(reps, {
            load: result.newLoad,
            label: 'GA Coaching App',
            achievedAt: achievedAt || new Date().toISOString()
          });
          renderPanel();
          return result;
        }
        console.warn('PR Supabase non disponible :', error.message);
      } catch (error) {
        console.warn('PR Supabase non disponible :', error);
      }
    }

    records[meta.code].set(reps, {
      load,
      label: 'Appareil local',
      achievedAt: achievedAt || new Date().toISOString()
    });
    renderPanel();
    return fallbackResult;
  }

  async function loadCloudRecords() {
    if (!window.CoachingCloud?.client || !window.CoachingCloud?.session?.user) return;
    const { data, error } = await CoachingCloud.client
      .from('athlete_prs')
      .select('exercise_code,reps,load_kg,source_label,achieved_at')
      .eq('athlete_slug', cfg.slug);
    if (error) {
      console.warn('Table athlete_prs non disponible :', error.message);
      return;
    }
    mergeCloudRows(data);
    if (!channel) {
      channel = CoachingCloud.client
        .channel(`ga-prs-${cfg.slug}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'athlete_prs',
          filter: `athlete_slug=eq.${cfg.slug}`
        }, loadCloudRecords)
        .subscribe();
    }
  }

  loadSeed();
  injectPanel();
  renderPanel();

  window.CoachingPR = {
    isEligible,
    registerIfBetter,
    celebrate,
    formatName,
    estimated1RM,
    refresh: loadCloudRecords,
    recordFor
  };

  if (window.CoachingCloud?.onReady) CoachingCloud.onReady(loadCloudRecords);
})();
