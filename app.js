window.GA_VALIDATION_SERIES_BUILD = 'V113';
window.GA_APP_VERSION = 'V132';
/* GA Coaching — bundle unifié
   Build: 2026-07-31-session-v2
   Contient: cloud-common, données PR, PR manuels/automatiques, RPG/XP et synchronisation athlète.
*/
window.GA_APP_BUILD = '2026-08-05-v132-sprites-boss-fix';


/* --------------------------------------------------------------------------
   IDENTITÉS ATHLÈTES — V72

   Les noms de fichiers GitHub Pages conservent leur casse exacte, tandis que
   les slugs Supabase restent canoniques en minuscules. Metaknight ne doit plus
   être convertie vers l'ancienne sauvegarde `clara`.
---------------------------------------------------------------------------- */
(function normalizeAthleteIdentityV72() {
  const cfg = window.COACHING_ATHLETE;
  if (!cfg) return;

  const slugify = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  let fileStem = '';
  try {
    fileStem = decodeURIComponent(String(window.location.pathname || '').split('/').pop() || '')
      .replace(/\.html?$/i, '');
  } catch (_) {
    fileStem = String(window.location.pathname || '').split('/').pop() || '';
  }

  const signals = [cfg.name, cfg.slug, cfg.programKey, fileStem]
    .map(slugify)
    .filter(Boolean);

  const hasSignal = pattern => signals.some(value => pattern.test(value));
  const isMagicarpe = hasSignal(/^(?:clara-)?magicarpe(?:-|$)/);
  const isMetaknight = hasSignal(/^(?:clara-)?(?:chevalier|metaknight|meta-knight|chouchou)(?:-|$)/)
    || fileStem.toLowerCase() === 'metaknight';

  const normalizeProgramKey = (identity, value) => {
    const key = String(value || '').trim();
    if (!key) return key;
    if (identity === 'magicarpe') {
      return key
        .replace(/^clara[-_ ]*magicarpe(?=$|[-_ ])/i, 'magicarpe')
        .replace(/^clara(?=$|[-_ ])/i, 'magicarpe');
    }
    if (identity === 'metaknight') {
      return key
        .replace(/^clara[-_ ]*(?:chevalier|metaknight|meta[-_ ]*knight|chouchou)?(?=$|[-_ ])/i, 'metaknight')
        .replace(/^meta[-_ ]*knight(?=$|[-_ ])/i, 'metaknight');
    }
    return key;
  };

  if (isMagicarpe) {
    cfg.slug = 'magicarpe';
    cfg.name = 'Magicarpe';
    cfg.programKey = normalizeProgramKey('magicarpe', cfg.programKey);
    if (cfg.baseProgramKey) cfg.baseProgramKey = normalizeProgramKey('magicarpe', cfg.baseProgramKey);
    return;
  }

  if (isMetaknight) {
    cfg.slug = 'metaknight';
    cfg.name = 'Metaknight';
    cfg.programKey = normalizeProgramKey('metaknight', cfg.programKey);
    if (cfg.baseProgramKey) cfg.baseProgramKey = normalizeProgramKey('metaknight', cfg.baseProgramKey);
    return;
  }

  if (!cfg.slug) {
    const inferred = slugify(cfg.name);
    const aliases = {
      'guillaume-anzalone': 'guillaume',
      'guillaume': 'guillaume',
      'the-flop': 'flop',
      'jolan-faux-noe': 'jolan'
    };
    cfg.slug = aliases[inferred] || inferred || null;
  }

  /*
     Les slugs Supabase sont canoniques et enregistrés en minuscules.
     Une ancienne page pouvait déclarer "Maxence", "Lucine", "Noe"…
     et créer une lecture distincte de la vraie sauvegarde `maxence`, `lucine`,
     `noe`. On normalise avant tout accès à athlete_progress, inventaire,
     combats, séries et temps réel.
  */
  if (cfg.slug) cfg.slug = slugify(cfg.slug);
})();


/* --------------------------------------------------------------------------
   PROGRAMMES MULTIPLES POUR UN MÊME ATHLÈTE

   Une page secondaire nommée Clara2.html, Clara-bloc-2.html, Clara3.html, etc.
   reçoit automatiquement une clé de programme distincte, même si elle a été
   copiée depuis la page principale avec le même COACHING_ATHLETE.programKey.

   Exemple :
     Clara.html  + programKey "clara-v2"  -> "clara-v2"
     Clara2.html + programKey "clara-v2"  -> "clara-v2-bloc-2"

   Ainsi, les séries, chronos, activités et bonus de séance de plusieurs blocs
   peuvent être remplis le même jour sans qu'un bloc écrase l'autre.
---------------------------------------------------------------------------- */
(function prepareProgramInstanceKey() {
  const cfg = window.COACHING_ATHLETE;
  if (!cfg || !cfg.slug || !cfg.programKey) return;

  let fileName = '';
  try {
    fileName = decodeURIComponent(String(window.location.pathname || '').split('/').pop() || '');
  } catch (_) {
    fileName = String(window.location.pathname || '').split('/').pop() || '';
  }

  const stem = fileName.replace(/\.html?$/i, '').trim();
  if (!stem) return;

  // Reconnaît Clara2, Clara-2, Clara_bloc2, Clara-bloc-2, Clara-programme-2…
  const match = stem.match(/(?:[\s_-]*(?:bloc|block|programme|program|prog))?[\s_-]*(\d+)$/i);
  if (!match) return;

  const blockNumber = Number(match[1]);
  if (!Number.isInteger(blockNumber) || blockNumber < 2) return;

  const currentKey = String(cfg.programKey).trim();
  const explicitBlockPattern = new RegExp(`(?:bloc|block|programme|program|prog)[\\s_-]*${blockNumber}$`, 'i');
  if (explicitBlockPattern.test(currentKey)) return;

  cfg.baseProgramKey = cfg.baseProgramKey || currentKey;
  cfg.programBlock = blockNumber;
  cfg.programKey = `${currentKey}-bloc-${blockNumber}`;
})();

(function () {
  'use strict';
window.GA_APP_BUILD = 'V132-sprites-boss-fix';

  const config = window.COACHING_SUPABASE || {};
  const configured = /^https:\/\/.+\.supabase\.co\/?$/i.test(String(config.url || ''))
    && !/VOTRE-PROJET/i.test(String(config.url || ''))
    && String(config.publishableKey || '').length > 20
    && !/VOTRE_CLE/i.test(String(config.publishableKey || ''));

  let client = null;
  let session = null;
  let member = null;
  let booted = false;
  let activityChannel = null;
  const activityFeeds = new Set();
  const readyCallbacks = [];

  const css = `
    .cloud-status{display:inline-flex;align-items:center;gap:5px;padding:5px 8px;border-radius:999px;background:rgba(136,152,184,.12);color:#8898b8;font-size:10px;font-weight:800;white-space:nowrap;cursor:pointer;border:0}
    .cloud-status.online{background:rgba(74,224,106,.12);color:#4ae06a}.cloud-status.pending{background:rgba(245,197,24,.13);color:#f5c518}.cloud-status.error{background:rgba(240,72,72,.12);color:#ff8f8f}
    .cloud-auth-overlay{position:fixed;inset:0;z-index:5000;background:rgba(4,7,14,.88);display:none;align-items:center;justify-content:center;padding:18px;backdrop-filter:blur(10px)}
    .cloud-auth-overlay.show{display:flex}.cloud-auth-card{width:min(100%,390px);background:#141a2a;border:1px solid #243048;border-radius:18px;padding:20px;color:#e8ecf5;font-family:Inter,system-ui,sans-serif}
    .cloud-auth-card h2{font-size:20px;margin:0 0 6px}.cloud-auth-card p{font-size:12px;line-height:1.5;color:#8898b8;margin:0 0 14px}
    .cloud-auth-card label{display:block;font-size:11px;font-weight:800;color:#8898b8;margin:10px 0 5px}.cloud-auth-card input{width:100%;border:1px solid #2b3650;background:#0e1422;color:#e8ecf5;border-radius:10px;padding:11px 12px;font:inherit;outline:none}.cloud-auth-card input:focus{border-color:#55b9e6}
    .cloud-auth-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}.cloud-auth-actions button,.cloud-auth-secondary{border:0;border-radius:10px;padding:11px;font-weight:800;cursor:pointer}
    .cloud-auth-primary{background:#55b9e6;color:#080c18}.cloud-auth-create{background:#243048;color:#e8ecf5}.cloud-auth-secondary{width:100%;margin-top:8px;background:transparent;color:#8898b8;border:1px solid #243048}
    .cloud-auth-message{min-height:18px;margin-top:10px;font-size:11px;color:#ff9d9d}.cloud-auth-message.ok{color:#4ae06a}.cloud-auth-hidden{display:none!important}
    .cloud-feed{display:flex;flex-direction:column;gap:9px}.cloud-feed-empty{padding:24px 14px;text-align:center;color:#8898b8;font-size:12px;line-height:1.5}
    .cloud-activity{display:flex;align-items:flex-start;gap:10px;background:#141a2a;border-radius:14px;padding:12px;border:1px solid transparent}.cloud-activity.pr{border-color:rgba(245,197,24,.34);background:linear-gradient(135deg,rgba(245,197,24,.08),rgba(141,20,32,.08)),#141a2a}.cloud-activity.pr .cloud-activity-text{font-size:12.5px}.cloud-activity.pr .cloud-activity-meta{color:#a58b44}.cloud-activity-emoji{width:38px;height:38px;flex:none;border-radius:10px;background:#1c2438;display:flex;align-items:center;justify-content:center;font-size:20px}
    .cloud-activity-body{flex:1;min-width:0}.cloud-activity-text{font-size:12px;line-height:1.45;color:#e8ecf5}.cloud-activity-text strong{font-weight:900}.cloud-activity-meta{font-size:10px;color:#667696;margin-top:5px}
    .cloud-like{flex:none;border:0;border-radius:999px;background:#1c2438;color:#8898b8;padding:7px 9px;font-size:11px;font-weight:900;cursor:pointer}.cloud-like.liked{background:rgba(240,72,72,.14);color:#ff7272}.cloud-like:disabled{opacity:.5;cursor:wait}
    .cloud-toast{position:fixed;left:50%;bottom:84px;z-index:6000;transform:translate(-50%,15px);opacity:0;pointer-events:none;background:#1c2438;color:#e8ecf5;border:1px solid #2b3650;border-radius:10px;padding:10px 14px;font:700 12px Inter,system-ui,sans-serif;transition:.22s;max-width:calc(100% - 32px);text-align:center}.cloud-toast.show{opacity:1;transform:translate(-50%,0)}.cloud-toast.error{color:#ff9d9d}
  `;

  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  function numberFr(value, maxDigits = 2) {
    const n = Number(value);
    return Number.isFinite(n)
      ? new Intl.NumberFormat('fr-FR', { maximumFractionDigits: maxDigits }).format(n)
      : '—';
  }

  function relativeDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const seconds = Math.round((date.getTime() - Date.now()) / 1000);
    const abs = Math.abs(seconds);
    const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
    if (abs < 60) return rtf.format(seconds, 'second');
    if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute');
    if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour');
    if (abs < 604800) return rtf.format(Math.round(seconds / 86400), 'day');
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  }

  function exerciseLabel(code, name) {
    if (code === 'sq') return 'SQUAT';
    if (code === 'bn') return 'BENCH';
    if (code === 'dl') return 'DEADLIFT';
    return String(name || 'EXERCICE').toUpperCase();
  }

  function repFormatName(reps) {
    const names = {
      1: 'single', 2: 'doublé', 3: 'triplé', 4: 'quadruplé', 5: 'quintuplé',
      6: 'sextuplé', 7: 'septuplé', 8: 'octuplé', 9: 'nonuplé', 10: 'décuplé'
    };
    const count = Number(reps) || 0;
    return names[count] || `${count} répétitions`;
  }

  function toast(message, isError = false) {
    let el = document.getElementById('cloudToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'cloudToast';
      el.className = 'cloud-toast';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.toggle('error', isError);
    el.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function setStatus(text, type = '') {
    document.querySelectorAll('[data-cloud-status],#cloudStatus').forEach(el => {
      el.textContent = text;
      el.classList.remove('online', 'pending', 'error');
      if (type) el.classList.add(type);
    });
  }

  function injectAuth() {
    if (document.getElementById('cloudAuthOverlay')) return;
    const wrap = document.createElement('div');
    wrap.id = 'cloudAuthOverlay';
    wrap.className = 'cloud-auth-overlay';
    wrap.innerHTML = `
      <div class="cloud-auth-card" role="dialog" aria-modal="true" aria-labelledby="cloudAuthTitle">
        <h2 id="cloudAuthTitle">Connexion GA Coaching</h2>
        <p id="cloudAuthIntro">Connecte-toi pour synchroniser les séries, voir l'activité et liker les performances.</p>
        <div id="cloudAuthForm">
          <label for="cloudDisplayName">Prénom / nom affiché</label>
          <input id="cloudDisplayName" autocomplete="name" placeholder="Ex. Jolan">
          <label for="cloudEmail">Adresse e-mail</label>
          <input id="cloudEmail" type="email" autocomplete="email" placeholder="nom@exemple.fr">
          <label for="cloudPassword">Mot de passe</label>
          <input id="cloudPassword" type="password" autocomplete="current-password" minlength="8" placeholder="8 caractères minimum">
          <div class="cloud-auth-actions">
            <button type="button" class="cloud-auth-primary" id="cloudLoginBtn">Se connecter</button>
            <button type="button" class="cloud-auth-create" id="cloudSignupBtn">Créer le compte</button>
          </div>
        </div>
        <div id="cloudPendingBox" class="cloud-auth-hidden">
          <p>Ton compte existe, mais Guillaume doit encore lui attribuer le rôle <strong>coach</strong> ou l'athlète correspondant dans Supabase.</p>
          <button type="button" class="cloud-auth-secondary" id="cloudRetryBtn">Vérifier à nouveau</button>
        </div>
        <div class="cloud-auth-message" id="cloudAuthMessage" aria-live="polite"></div>
        <button type="button" class="cloud-auth-secondary" id="cloudCloseBtn">Continuer temporairement en local</button>
      </div>`;
    document.body.appendChild(wrap);

    document.getElementById('cloudLoginBtn').addEventListener('click', signInFromForm);
    document.getElementById('cloudSignupBtn').addEventListener('click', signUpFromForm);
    document.getElementById('cloudRetryBtn').addEventListener('click', resolveMember);
    document.getElementById('cloudCloseBtn').addEventListener('click', hideAuth);
    document.getElementById('cloudPassword').addEventListener('keydown', e => {
      if (e.key === 'Enter') signInFromForm();
    });
  }

  function showAuth(message = '') {
    injectAuth();
    const overlay = document.getElementById('cloudAuthOverlay');
    overlay.classList.add('show');
    if (message) setAuthMessage(message, false);
  }

  function hideAuth() {
    document.getElementById('cloudAuthOverlay')?.classList.remove('show');
  }

  function setAuthMessage(text, ok = false) {
    const el = document.getElementById('cloudAuthMessage');
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('ok', ok);
  }

  function formValues() {
    return {
      name: document.getElementById('cloudDisplayName')?.value.trim() || '',
      email: document.getElementById('cloudEmail')?.value.trim() || '',
      password: document.getElementById('cloudPassword')?.value || ''
    };
  }

  async function signInFromForm() {
    const { email, password } = formValues();
    if (!email || !password) return setAuthMessage('Renseigne l’e-mail et le mot de passe.');
    setAuthMessage('Connexion…', true);
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) return setAuthMessage(error.message);
    session = data.session;
    await resolveMember();
  }

  async function signUpFromForm() {
    const { name, email, password } = formValues();
    if (!name || !email || password.length < 8) {
      return setAuthMessage('Renseigne ton nom, ton e-mail et un mot de passe de 8 caractères minimum.');
    }
    setAuthMessage('Création du compte…', true);
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: { display_name: name } }
    });
    if (error) return setAuthMessage(error.message);
    session = data.session;
    if (!session) {
      setAuthMessage('Compte créé. Confirme l’e-mail reçu, puis connecte-toi.', true);
      return;
    }
    await resolveMember();
  }

  function showPending() {
    document.getElementById('cloudAuthForm')?.classList.add('cloud-auth-hidden');
    document.getElementById('cloudPendingBox')?.classList.remove('cloud-auth-hidden');
    setStatus('Accès à valider', 'pending');
    showAuth();
    setAuthMessage('Compte connecté, autorisation en attente.', true);
  }

  function showForm() {
    document.getElementById('cloudAuthForm')?.classList.remove('cloud-auth-hidden');
    document.getElementById('cloudPendingBox')?.classList.add('cloud-auth-hidden');
  }

  async function resolveMember() {
    if (!session?.user) return;
    const { data, error } = await client
      .from('app_users')
      .select('user_id,email,display_name,role,athlete_slug')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (error) {
      setStatus('Erreur cloud', 'error');
      setAuthMessage(error.message);
      return;
    }
    member = data || null;
    if (!member || member.role === 'pending') {
      showPending();
      return;
    }
    hideAuth();
    showForm();
    setStatus(`En ligne · ${window.GA_APP_VERSION || 'V75'}`, 'online');
    setAuthMessage('');
    readyCallbacks.splice(0).forEach(cb => safeCall(cb));
    window.dispatchEvent(new CustomEvent('coaching-cloud-ready', { detail: { client, session, member } }));
  }

  function safeCall(cb) {
    try { cb({ client, session, member }); } catch (error) { console.error(error); }
  }

  async function boot() {
    if (booted) return;
    booted = true;
    injectAuth();

    document.querySelectorAll('[data-cloud-status],#cloudStatus').forEach(el => {
      el.addEventListener('click', () => {
        if (!configured) return toast('Configure d’abord supabase-config.js.', true);
        if (member) {
          const answer = window.confirm(`Connecté comme ${member.display_name || member.email}. Se déconnecter ?`);
          if (answer) signOut();
        } else showAuth();
      });
    });

    if (!configured) {
      setStatus('Mode local · V59', 'pending');
      return;
    }
    if (!window.supabase?.createClient) {
      setStatus('Librairie absente', 'error');
      return;
    }

    client = window.supabase.createClient(config.url, config.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });

    const { data, error } = await client.auth.getSession();
    if (error) {
      setStatus('Erreur connexion', 'error');
      return;
    }
    session = data.session;
    client.auth.onAuthStateChange((_event, nextSession) => {
      session = nextSession;
      if (!nextSession) {
        member = null;
        setStatus('Connexion requise', 'pending');
      }
    });

    if (!session) {
      setStatus('Connexion requise', 'pending');
      showAuth();
      return;
    }
    await resolveMember();
  }

  async function signOut() {
    if (!client) return;
    await client.auth.signOut();
    session = null;
    member = null;
    setStatus('Connexion requise', 'pending');
    showAuth('Tu es déconnecté.');
  }

  function onReady(callback) {
    if (member && client && session) safeCall(callback);
    else readyCallbacks.push(callback);
  }

  function athleteSlugAliases(slug) {
    const normalized = String(slug || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
    const groups = [
      ['guillaume', 'anzalone'],
      ['yann', 'yannick'],
      ['flop', 'the flop'],
      ['metaknight', 'clara', 'clara metaknight']
    ];
    const group = groups.find(items => items.includes(normalized));
    return new Set(group || [normalized]);
  }

  function canEditAthlete(slug) {
    if (!member) return false;
    if (member.role === 'coach') return true;
    if (member.role !== 'athlete') return false;
    const requested = athleteSlugAliases(slug);
    const assigned = athleteSlugAliases(member.athlete_slug);
    return [...requested].some(alias => assigned.has(alias));
  }

  function activityCategory(row) {
    const type = String(row?.activity_type || 'set').toLowerCase();
    return ['combat', 'loot', 'level', 'class', 'boss'].includes(type) ? 'adventure' : 'lift';
  }

  async function fetchActivities(limit = 50, category = 'all') {
    if (!client || !session) return [];
    const safeLimit = Math.max(1, Number(limit) || 50);
    const queryLimit = category === 'all' ? safeLimit : Math.min(300, Math.max(120, safeLimit * 5));
    const { data, error } = await client
      .from('workout_activities')
      .select('*,activity_likes(user_id)')
      .order('created_at', { ascending: false })
      .limit(queryLimit);
    if (error) throw error;
    const rows = data || [];
    return category === 'all' ? rows.slice(0, safeLimit) : rows.filter(row => activityCategory(row) === category).slice(0, safeLimit);
  }

  const ACTIVITY_DISPLAY = {
    noe: { name: 'Noé', emoji: '🪽' },
    flop: { name: 'The Flop', emoji: '🎰' },
    saya: { name: 'Saya', emoji: '🇷🇪' },
    serena: { name: 'Serena', emoji: '👑' },
    matthieu: { name: 'Matthieu', emoji: '🎣' },
    malo: { name: 'Malo', emoji: '🔥' },
    lou: { name: 'Lou', emoji: '🐉' },
    killian: { name: 'Killian', emoji: '🦅' },
    kaoutar: { name: 'Kaoutar', emoji: '🇲🇦' },
    jolan: { name: 'Jolan (Faux Noé)', emoji: '🐿️' },
    janel: { name: 'Janel', emoji: '🍪' },
    clara: { name: 'Clara', emoji: '⚔️' },
    magicarpe: { name: 'Magicarpe', emoji: '🐟' },
    charles: { name: 'Charles', emoji: '🎲' },
    benoit: { name: 'Benoît', emoji: '✝️' },
    celia: { name: 'Celia', emoji: '🐈‍⬛' }
  };

  function activityDisplay(row) {
    const override = ACTIVITY_DISPLAY[String(row.athlete_slug || '').toLowerCase()] || {};
    return {
      name: override.name || row.athlete_name || 'Athlète',
      emoji: Object.prototype.hasOwnProperty.call(override, 'emoji') ? override.emoji : (row.athlete_emoji || '🏋️')
    };
  }

  function renderActivityFeed(container, rows, category = 'all') {
    if (!container) return;
    if (!rows.length) {
      const message = category === 'adventure' ? 'Aucune aventure publiée pour le moment.<br>Le prochain combat, niveau ou loot apparaîtra ici.' : category === 'lift' ? 'Aucune activité Lift pour le moment.<br>La prochaine série ou le prochain PR apparaîtra ici.' : 'Aucune activité pour le moment.';
      container.innerHTML = `<div class="cloud-feed-empty">${message}</div>`;
      return;
    }
    const userId = session?.user?.id;
    container.innerHTML = rows.map(row => {
      const likes = Array.isArray(row.activity_likes) ? row.activity_likes : [];
      const liked = likes.some(like => like.user_id === userId);
      const reps = Number(row.reps) || 0;
      const repLabel = reps > 1 ? 'reps' : 'rep';
      const display = activityDisplay(row);
      const type = String(row.activity_type || 'set');
      const isPr = type === 'pr';
      const isAccessoryPr = type === 'accessory_pr';
      const actualReps = Number(row.actual_reps) || reps;
      const durationSeconds = Number(row.duration_seconds) || 0;
      const durationText = durationSeconds > 0 ? (durationSeconds >= 60 ? `${Math.floor(durationSeconds / 60)}:${String(durationSeconds % 60).padStart(2,'0')}` : `${durationSeconds}s`) : '';
      const isLevel = type === 'level';
      const isSession = type === 'session';
      const isCombat = type === 'combat';
      const isLoot = type === 'loot';
      const oldPr = Number(row.previous_pr_kg);
      const newPr = Number(row.new_pr_kg || row.load_kg);
      const e1rm = Number(row.estimated_1rm_kg);
      const xp = Number(row.xp_points || 0);
      const format = repFormatName(reps);
      const intervalMin = Number(row.prescribed_load_min_kg);
      const intervalMax = Number(row.prescribed_load_max_kg);
      const hasMin = Number.isFinite(intervalMin) && intervalMin > 0;
      const hasMax = Number.isFinite(intervalMax) && intervalMax > 0;
      const targetLabel = hasMin || hasMax
        ? ` · objectif ${hasMin ? numberFr(intervalMin) : '—'}${hasMax && (!hasMin || intervalMax !== intervalMin) ? `–${numberFr(intervalMax)}` : ''} kg`
        : '';
      let activityText;
      if (isLevel || isSession || isCombat || isLoot) {
        activityText = escapeHtml(row.details_text || `${display.name} progresse.`);
      } else if (isPr) {
        activityText = oldPr > 0
          ? `<strong>${escapeHtml(display.name)}</strong> a battu son record sur le <strong>${escapeHtml(format)} de ${escapeHtml(exerciseLabel(row.exercise_code, row.exercise_name))}</strong> : <strong>${numberFr(oldPr)} → ${numberFr(newPr)} kg</strong>${e1rm > 0 ? ` · e1RM ${numberFr(e1rm)} kg` : ''}`
          : `<strong>${escapeHtml(display.name)}</strong> a établi son premier repère sur le <strong>${escapeHtml(format)} de ${escapeHtml(exerciseLabel(row.exercise_code, row.exercise_name))}</strong> à <strong>${numberFr(newPr)} kg</strong>${e1rm > 0 ? ` · e1RM ${numberFr(e1rm)} kg` : ''}`;
      } else if (isAccessoryPr) {
        const performance = durationSeconds > 0
          ? `${durationText}${Number(row.load_kg) > 0 ? ` à ${numberFr(row.load_kg)} kg` : ''}`
          : `${actualReps} ${actualReps > 1 ? 'reps' : 'rep'}${Number(row.load_kg) > 0 ? ` à ${numberFr(row.load_kg)} kg` : ' au poids du corps'}`;
        activityText = `<strong>${escapeHtml(display.name)}</strong> a établi un <strong>nouveau PR accessoire</strong> sur <strong>${escapeHtml(row.exercise_name || 'un accessoire')}</strong> : <strong>${performance}</strong>`;
      } else if (String(row.exercise_code || '') === 'ac') {
        const loadText = Number(row.load_kg) > 0 ? `${numberFr(row.load_kg)} kg` : 'au poids du corps';
        const repsText = actualReps > 0 ? `${actualReps} ${actualReps > 1 ? 'reps' : 'rep'}` : '';
        const timeText = durationSeconds > 0 ? durationText : '';
        const performance = [loadText, repsText, timeText].filter(Boolean).join(' · ');
        activityText = `<strong>${escapeHtml(display.name)}</strong> a réussi sa série de <strong>${escapeHtml(row.exercise_name || 'accessoire')}</strong> : <strong>${performance}</strong>`;
      } else {
        activityText = `<strong>${escapeHtml(display.name)}</strong> a réussi sa série de <strong>${escapeHtml(exerciseLabel(row.exercise_code, row.exercise_name))}</strong> à <strong>${numberFr(row.load_kg)} kg</strong> · ${reps} ${repLabel} · RPE ${numberFr(row.rpe, 1)}${targetLabel}`;
      }
      const typeLabel = isAccessoryPr ? '🏆 PR ACCESSOIRE · ' : isPr ? '🏆 NOUVEAU PR · ' : isLevel ? '🆙 LEVEL UP · ' : isSession ? '⚡ SÉANCE RAPIDE · ' : isCombat ? '⚔️ VICTOIRE RPG · ' : isLoot ? '🎁 LOOT RPG · ' : '';
      const xpLabel = xp > 0 ? ` · +${numberFr(xp, 2)} XP` : '';
      return `<article class="cloud-activity ${(isPr || isAccessoryPr || isLevel || isSession || isCombat || isLoot) ? 'pr' : ''}">
        ${display.emoji ? `<div class="cloud-activity-emoji">${escapeHtml(display.emoji)}</div>` : ''}
        <div class="cloud-activity-body">
          <div class="cloud-activity-text">${activityText}</div>
          <div class="cloud-activity-meta">${typeLabel}${escapeHtml(row.week_label || '')}${row.day_name ? ' · ' + escapeHtml(row.day_name) : ''}${xpLabel} · ${escapeHtml(relativeDate(row.created_at))}</div>
        </div>
        <button type="button" class="cloud-like ${liked ? 'liked' : ''}" data-activity-like="${row.id}" data-liked="${liked ? '1' : '0'}" aria-label="${liked ? 'Retirer le like' : 'Liker'}">♥ ${likes.length}</button>
      </article>`;
    }).join('');
  }

  async function toggleLike(button) {
    if (!client || !session?.user) return showAuth('Connecte-toi pour liker.');
    const activityId = Number(button.dataset.activityLike);
    const liked = button.dataset.liked === '1';
    button.disabled = true;
    let result;
    if (liked) {
      result = await client.from('activity_likes')
        .delete()
        .eq('activity_id', activityId)
        .eq('user_id', session.user.id);
    } else {
      result = await client.from('activity_likes')
        .insert({ activity_id: activityId, user_id: session.user.id });
    }
    button.disabled = false;
    if (result.error) toast(result.error.message, true);
  }

  async function mountActivityFeed(containerOrId, limit = 50, options = {}) {
    const container = typeof containerOrId === 'string'
      ? document.getElementById(containerOrId)
      : containerOrId;
    if (!container) return;
    const category = typeof options === 'string'
      ? options
      : String(options?.category || container.dataset.activityCategory || 'all');
    container.classList.add('cloud-feed');
    container.dataset.activityCategory = category;

    const feed = {
      container,
      limit: Math.max(1, Number(limit) || 50),
      category,
      refresh: null
    };

    const refresh = async () => {
      try {
        const rows = await fetchActivities(feed.limit, feed.category);
        renderActivityFeed(container, rows, feed.category);
      } catch (error) {
        console.error(error);
        container.innerHTML = `<div class="cloud-feed-empty">Impossible de charger l’activité.<br>${escapeHtml(error.message || '')}</div>`;
      }
    };
    feed.refresh = refresh;
    activityFeeds.add(feed);

    if (!container.dataset.likeBound) {
      container.dataset.likeBound = '1';
      container.addEventListener('click', async event => {
        const button = event.target.closest('[data-activity-like]');
        if (!button) return;
        await toggleLike(button);
        await Promise.all([...activityFeeds].map(item => item.refresh()));
      });
    }

    await refresh();
    if (!activityChannel) {
      let timer;
      const debounceRefresh = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          [...activityFeeds].forEach(item => item.refresh());
        }, 120);
      };
      activityChannel = client
        .channel('ga-coaching-activity-feed')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'workout_activities' }, debounceRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_likes' }, debounceRefresh)
        .subscribe();
    }
    return refresh;
  }

  window.CoachingCloud = {
    get configured() { return configured; },
    get client() { return client; },
    get session() { return session; },
    get member() { return member; },
    boot,
    onReady,
    showAuth,
    signOut,
    canEditAthlete,
    mountActivityFeed,
    fetchActivities,
    toast,
    numberFr
  };
})();


/* Records initiaux importés depuis les onglets Statistiques des Google Sheets.
   Matthieu : le Google Sheet connecté ne contient pas d'onglet Statistiques ;
   seuls les 1RM visibles dans son HTML ont pu être repris. */
window.GA_PR_SEED = {"guillaume":{"sq":{"1":{"load":320.0,"date":""},"2":{"load":297.5,"date":""},"3":{"load":290.0,"date":""},"4":{"load":285.0,"date":""},"5":{"load":280.0,"date":""},"6":{"load":275.0,"date":""},"7":{"load":270.0,"date":""},"8":{"load":250.0,"date":""},"9":{"load":240.0,"date":""},"10":{"load":240.0,"date":""}},"bn":{"1":{"load":210.0,"date":""},"2":{"load":200.0,"date":""},"3":{"load":187.5,"date":""},"4":{"load":180.0,"date":""},"5":{"load":180.0,"date":""},"6":{"load":160.0,"date":""},"7":{"load":157.5,"date":""},"8":{"load":140.0,"date":""}},"dl":{"1":{"load":340.0,"date":""},"2":{"load":310.0,"date":""},"3":{"load":300.0,"date":""},"5":{"load":280.0,"date":""},"6":{"load":220.0,"date":""},"7":{"load":195.0,"date":""}},"source":"Google Sheets — Statistiques"},"benoit":{"sq":{},"bn":{},"dl":{"2":{"load":200.0,"date":""},"3":{"load":200.0,"date":""},"4":{"load":200.0,"date":"19/07/2025"},"5":{"load":190.0,"date":""},"6":{"load":190.0,"date":""}},"source":"Google Sheets — Statistiques"},"celia":{"sq":{"1":{"load":100.0,"date":"AFFRONT"},"5":{"load":77.5,"date":""}},"bn":{"2":{"load":53.5,"date":""}},"dl":{},"source":"Google Sheets — Statistiques"},"charles":{"sq":{"1":{"load":200.0,"date":"25/04/26"},"2":{"load":175.0,"date":"B11"},"3":{"load":152.5,"date":"B12"},"4":{"load":165.0,"date":"B2 TDAH"},"5":{"load":165.0,"date":"B13"},"6":{"load":155.0,"date":"B2 TDAH"},"7":{"load":147.5,"date":"Bloc 5"},"8":{"load":140.0,"date":"Bloc 4"}},"bn":{"1":{"load":120.0,"date":"25/04/26"},"2":{"load":110.0,"date":""},"3":{"load":112.5,"date":"B14"},"4":{"load":105.0,"date":"B Suite Squat"},"5":{"load":107.5,"date":"B11"},"6":{"load":102.5,"date":"Bloc 5"},"7":{"load":102.5,"date":"Bloc 9"},"8":{"load":100.0,"date":"B4 TDAH"}},"dl":{"1":{"load":210.0,"date":"25/04/26"},"2":{"load":182.5,"date":"Bloc 5"},"3":{"load":175.0,"date":"B13"},"4":{"load":180.0,"date":"B2 TDAH"},"5":{"load":175.0,"date":"B10"},"6":{"load":180.0,"date":"B4 TDAH"}},"source":"Google Sheets — Statistiques"},"clara":{"sq":{"1":{"load":137.5,"date":"17/04"},"2":{"load":125.0,"date":""},"3":{"load":122.5,"date":""},"4":{"load":120.0,"date":""},"5":{"load":117.5,"date":""},"6":{"load":107.5,"date":""},"7":{"load":105.0,"date":""}},"bn":{"1":{"load":75.0,"date":"05/03"},"2":{"load":71.0,"date":""},"3":{"load":70.0,"date":""},"4":{"load":67.5,"date":""},"5":{"load":65.0,"date":""},"6":{"load":60.0,"date":""}},"dl":{"1":{"load":170.0,"date":""},"2":{"load":150.0,"date":""},"3":{"load":145.0,"date":""},"5":{"load":135.0,"date":""}},"source":"Google Sheets — Statistiques"},"clemosaurus":{"sq":{"1":{"load":165.0,"date":""},"2":{"load":160.0,"date":""},"3":{"load":132.5,"date":""},"5":{"load":145.0,"date":""},"6":{"load":125.0,"date":""},"7":{"load":135.0,"date":""}},"bn":{"1":{"load":130.0,"date":""},"2":{"load":117.5,"date":""},"5":{"load":95.0,"date":""},"6":{"load":100.0,"date":""},"8":{"load":105.0,"date":""}},"dl":{"1":{"load":200.0,"date":""},"2":{"load":200.0,"date":""},"3":{"load":192.5,"date":""},"4":{"load":165.0,"date":""},"5":{"load":182.5,"date":""}},"source":"Google Sheets — Statistiques"},"dorian":{"sq":{"1":{"load":220.0,"date":""},"2":{"load":200.0,"date":""},"3":{"load":200.0,"date":""},"4":{"load":200.0,"date":""},"5":{"load":200.0,"date":""},"6":{"load":170.0,"date":""},"7":{"load":175.0,"date":""},"8":{"load":170.0,"date":""},"9":{"load":170.0,"date":""},"10":{"load":170.0,"date":""}},"bn":{"1":{"load":120.0,"date":""},"2":{"load":115.0,"date":""},"3":{"load":110.0,"date":""},"4":{"load":110.0,"date":"11/09/2025"},"5":{"load":110.0,"date":""},"6":{"load":100.0,"date":""},"7":{"load":85.0,"date":""}},"dl":{"1":{"load":220.0,"date":""},"2":{"load":210.0,"date":""},"3":{"load":210.0,"date":"11/09/2025"},"4":{"load":200.0,"date":""},"5":{"load":175.0,"date":""},"6":{"load":165.0,"date":""}},"source":"Google Sheets — Statistiques"},"duane":{"sq":{"1":{"load":320.0,"date":""},"3":{"load":290.0,"date":""}},"bn":{"1":{"load":220.0,"date":""},"3":{"load":200.0,"date":""},"10":{"load":100.0,"date":""}},"dl":{"1":{"load":275.0,"date":""},"2":{"load":270.0,"date":""},"3":{"load":260.0,"date":""},"4":{"load":245.0,"date":""},"5":{"load":245.0,"date":""},"6":{"load":220.0,"date":""},"7":{"load":195.0,"date":""}},"source":"Google Sheets — Statistiques"},"flop":{"sq":{"1":{"load":125.0,"date":""},"4":{"load":112.0,"date":"02/09/2025"}},"bn":{},"dl":{},"source":"Google Sheets — Statistiques"},"gibertini":{"sq":{"1":{"load":260.0,"date":"02/2026"},"2":{"load":240.0,"date":""},"4":{"load":235.0,"date":"02/2026"},"5":{"load":215.0,"date":""}},"bn":{"1":{"load":155.0,"date":"04/2026"},"2":{"load":142.5,"date":"10/2025"},"3":{"load":145.0,"date":"27/07/26"},"4":{"load":135.0,"date":""},"5":{"load":130.0,"date":""},"6":{"load":125.0,"date":""}},"dl":{"1":{"load":305.0,"date":"05/2025"},"2":{"load":300.0,"date":"10/2025"},"4":{"load":285.0,"date":"02/2026"},"5":{"load":270.0,"date":"08/2025"},"6":{"load":260.0,"date":""}},"source":"Google Sheets — Statistiques"},"janel":{"sq":{"1":{"load":140.0,"date":"24/12/25"},"2":{"load":130.0,"date":""},"3":{"load":162.5,"date":""},"4":{"load":162.5,"date":""},"5":{"load":155.0,"date":""},"6":{"load":150.0,"date":""},"7":{"load":155.0,"date":""}},"bn":{"1":{"load":70.0,"date":"24/12/25"},"2":{"load":115.0,"date":"22/11/25"},"3":{"load":112.5,"date":"02/04/26"},"4":{"load":110.0,"date":""},"5":{"load":102.5,"date":""},"6":{"load":101.0,"date":""}},"dl":{"1":{"load":180.0,"date":""},"2":{"load":190.0,"date":""},"3":{"load":187.5,"date":""},"5":{"load":180.0,"date":""}},"source":"Google Sheets — Statistiques"},"jolan":{"sq":{"1":{"load":230.0,"date":""},"2":{"load":215.0,"date":""},"3":{"load":215.0,"date":""},"4":{"load":200.0,"date":""},"5":{"load":200.0,"date":""},"6":{"load":195.0,"date":""},"7":{"load":185.0,"date":""}},"bn":{"1":{"load":180.0,"date":""},"2":{"load":170.0,"date":""},"3":{"load":170.0,"date":""},"5":{"load":160.0,"date":""},"6":{"load":150.0,"date":""},"7":{"load":140.0,"date":""}},"dl":{"1":{"load":275.0,"date":""},"2":{"load":270.0,"date":""},"3":{"load":260.0,"date":""},"5":{"load":250.0,"date":""}},"source":"Google Sheets — Statistiques"},"jonathan":{"sq":{"1":{"load":200.0,"date":""},"2":{"load":170.0,"date":"26/11"},"3":{"load":170.0,"date":"26/11"},"4":{"load":170.0,"date":"26/11"},"5":{"load":180.0,"date":"03/12"}},"bn":{"1":{"load":162.5,"date":""},"2":{"load":140.0,"date":"03/12/2024"},"3":{"load":150.0,"date":"26/01/24"},"5":{"load":142.5,"date":"06/12/24"},"6":{"load":130.0,"date":"09/12/24"}},"dl":{"1":{"load":210.0,"date":""},"2":{"load":215.0,"date":"06/12/24"},"5":{"load":180.0,"date":"08/12/24"}},"source":"Google Sheets — Statistiques"},"kaoutar":{"sq":{"1":{"load":95.0,"date":""},"5":{"load":90.0,"date":""},"10":{"load":85.0,"date":""}},"bn":{"1":{"load":60.0,"date":""},"2":{"load":60.0,"date":""},"5":{"load":55.0,"date":""}},"dl":{"1":{"load":137.5,"date":"17/08/2025"},"2":{"load":130.0,"date":""},"3":{"load":120.0,"date":""}},"source":"Google Sheets — Statistiques"},"killian":{"sq":{"1":{"load":180.0,"date":"24/12/25"},"2":{"load":170.0,"date":""},"3":{"load":162.5,"date":""},"4":{"load":162.5,"date":""},"5":{"load":155.0,"date":""},"6":{"load":150.0,"date":""},"7":{"load":155.0,"date":""}},"bn":{"1":{"load":120.0,"date":"24/12/25"},"2":{"load":115.0,"date":"22/11/25"},"3":{"load":112.5,"date":"02/04/26"},"4":{"load":110.0,"date":""},"5":{"load":102.5,"date":""},"6":{"load":101.0,"date":""}},"dl":{"1":{"load":200.0,"date":""},"2":{"load":190.0,"date":""},"3":{"load":187.5,"date":""},"5":{"load":180.0,"date":""}},"source":"Google Sheets — Statistiques"},"lou":{"sq":{"1":{"load":95.0,"date":""},"2":{"load":90.0,"date":""},"4":{"load":82.5,"date":""},"5":{"load":77.5,"date":""}},"bn":{"1":{"load":57.5,"date":""},"2":{"load":55.0,"date":""},"3":{"load":52.5,"date":""},"4":{"load":50.0,"date":""},"5":{"load":50.0,"date":""}},"dl":{"1":{"load":120.0,"date":""},"2":{"load":110.0,"date":""},"4":{"load":100.0,"date":""},"5":{"load":97.5,"date":""}},"source":"Google Sheets — Statistiques"},"lucine":{"sq":{"1":{"load":150.0,"date":""},"2":{"load":140.0,"date":"20/09/2025"},"3":{"load":137.5,"date":""},"4":{"load":137.5,"date":""},"5":{"load":132.5,"date":""},"6":{"load":120.0,"date":""},"7":{"load":115.0,"date":""},"8":{"load":110.0,"date":""}},"bn":{"1":{"load":87.5,"date":"20/10/2025"},"2":{"load":80.0,"date":""},"3":{"load":80.0,"date":""},"4":{"load":77.5,"date":""},"5":{"load":75.0,"date":""},"6":{"load":70.0,"date":""},"7":{"load":62.5,"date":""},"8":{"load":60.0,"date":""}},"dl":{"1":{"load":187.5,"date":""},"2":{"load":180.0,"date":""},"3":{"load":175.0,"date":""},"4":{"load":167.5,"date":""},"5":{"load":160.0,"date":""},"6":{"load":155.0,"date":""},"7":{"load":140.0,"date":""}},"source":"Google Sheets — Statistiques"},"magicarpe":{"sq":{"1":{"load":155.0,"date":"30/10/25"},"2":{"load":150.0,"date":"30/08/25"},"3":{"load":147.5,"date":"27/09/25"},"4":{"load":132.5,"date":""},"5":{"load":130.0,"date":""}},"bn":{"1":{"load":95.0,"date":"23/05/26"},"2":{"load":90.0,"date":"30/08/25"},"3":{"load":90.0,"date":"27/09/25"},"5":{"load":80.0,"date":""}},"dl":{"1":{"load":187.5,"date":"30/10/25"},"2":{"load":170.0,"date":""},"3":{"load":170.0,"date":"15/05/25"},"4":{"load":160.0,"date":"25/08/25"}},"source":"Google Sheets — Statistiques"},"malo":{"sq":{"1":{"load":210.0,"date":""},"2":{"load":180.0,"date":""},"3":{"load":175.0,"date":""},"4":{"load":175.0,"date":""},"5":{"load":175.0,"date":""},"6":{"load":175.0,"date":""},"7":{"load":175.0,"date":""}},"bn":{"1":{"load":145.0,"date":""},"2":{"load":132.5,"date":""},"3":{"load":125.0,"date":""},"4":{"load":125.0,"date":""},"5":{"load":105.0,"date":""},"6":{"load":105.0,"date":""}},"dl":{"1":{"load":240.0,"date":""},"2":{"load":200.0,"date":""},"3":{"load":200.0,"date":""},"4":{"load":200.0,"date":"19/07/2025"},"5":{"load":190.0,"date":""},"6":{"load":190.0,"date":""}},"source":"Google Sheets — Statistiques"},"marvin":{"sq":{"1":{"load":286.0,"date":""},"2":{"load":250.0,"date":""},"3":{"load":250.0,"date":""},"4":{"load":240.0,"date":""},"5":{"load":235.0,"date":""},"6":{"load":220.0,"date":""},"7":{"load":205.0,"date":"16/07/2025*"},"8":{"load":190.0,"date":""}},"bn":{"1":{"load":185.0,"date":""},"2":{"load":170.0,"date":""},"3":{"load":165.0,"date":""},"4":{"load":150.0,"date":""},"5":{"load":150.0,"date":"16/07/2025"},"6":{"load":142.5,"date":""},"8":{"load":130.0,"date":""}},"dl":{"1":{"load":300.0,"date":""},"2":{"load":260.0,"date":""},"3":{"load":260.0,"date":""},"4":{"load":250.0,"date":""},"5":{"load":250.0,"date":""},"6":{"load":230.0,"date":""}},"source":"Google Sheets — Statistiques"},"matthieu":{"sq":{"1":{"load":210.0,"date":""}},"bn":{"1":{"load":115.0,"date":""}},"dl":{"1":{"load":260.0,"date":""}},"source":"Profil HTML — aucun onglet « Statistiques » trouvé dans le Google Sheet Matthieu BF"},"maxence":{"sq":{"1":{"load":215.0,"date":"04/01/26"},"2":{"load":200.0,"date":"04/12/25"},"3":{"load":200.0,"date":"04/12/25"},"4":{"load":180.0,"date":"03/25"},"5":{"load":192.5,"date":"06/05/26"},"6":{"load":170.0,"date":"24/02/26"},"7":{"load":180.0,"date":"10/05/26"},"8":{"load":140.0,"date":""},"9":{"load":100.0,"date":""},"10":{"load":100.0,"date":""}},"bn":{"1":{"load":143.0,"date":"06/05/26"},"2":{"load":132.5,"date":"04/05/26"},"3":{"load":130.0,"date":"06/05/26"},"4":{"load":122.5,"date":"04/25"},"5":{"load":122.5,"date":"18/05/26"},"6":{"load":112.5,"date":"04/25"},"7":{"load":110.0,"date":"04/25"},"8":{"load":100.0,"date":""},"9":{"load":100.0,"date":""},"10":{"load":100.0,"date":""}},"dl":{"1":{"load":250.0,"date":"01/02/26"},"2":{"load":230.0,"date":"02/12/25"},"3":{"load":225.0,"date":"06/06/26"},"4":{"load":215.0,"date":"28/12/25"},"5":{"load":210.0,"date":"19/02/26"},"6":{"load":182.5,"date":"04/25"},"7":{"load":180.0,"date":""},"8":{"load":180.0,"date":"27/05/25"},"9":{"load":192.5,"date":"11/01/26"},"10":{"load":180.0,"date":""}},"source":"Google Sheets — Statistiques"},"noe":{"sq":{"1":{"load":245.0,"date":""},"2":{"load":235.0,"date":""},"3":{"load":230.0,"date":""},"4":{"load":230.0,"date":""},"5":{"load":220.0,"date":""}},"bn":{"1":{"load":160.0,"date":""},"2":{"load":155.0,"date":"06/02/2025"},"3":{"load":150.0,"date":""},"5":{"load":140.0,"date":""},"10":{"load":100.0,"date":""}},"dl":{"1":{"load":275.0,"date":""},"2":{"load":270.0,"date":""},"3":{"load":260.0,"date":""},"4":{"load":245.0,"date":""},"5":{"load":245.0,"date":""},"6":{"load":220.0,"date":""},"7":{"load":195.0,"date":""}},"source":"Google Sheets — Statistiques"},"saya":{"sq":{"1":{"load":172.5,"date":""},"2":{"load":150.0,"date":""},"3":{"load":152.5,"date":""},"4":{"load":155.0,"date":""},"5":{"load":140.0,"date":""},"6":{"load":147.5,"date":""},"7":{"load":140.0,"date":""},"8":{"load":140.0,"date":""}},"bn":{"1":{"load":82.5,"date":""},"2":{"load":75.0,"date":"Block 12"},"3":{"load":75.0,"date":""},"4":{"load":70.0,"date":""},"5":{"load":75.0,"date":"18/07/26"},"7":{"load":65.0,"date":""}},"dl":{"1":{"load":185.0,"date":""},"2":{"load":170.0,"date":""},"3":{"load":170.0,"date":""},"4":{"load":140.0,"date":""},"5":{"load":157.5,"date":""},"6":{"load":145.0,"date":""}},"source":"Google Sheets — Statistiques"},"serena":{"sq":{"1":{"load":170.0,"date":"FR JNR 26"},"4":{"load":152.5,"date":"PREPA JNR 26"},"6":{"load":147.5,"date":""}},"bn":{"1":{"load":85.0,"date":"FR JNR 26"},"2":{"load":82.5,"date":"PREPA QUALIF"},"3":{"load":79.0,"date":"PREPA QUALIF"},"5":{"load":80.0,"date":"PREPA JNR 26"}},"dl":{"1":{"load":215.0,"date":"FR JNR 26"},"2":{"load":190.0,"date":"PREPA QUALIF"},"5":{"load":200.0,"date":"PREPA JNR 26"}},"source":"Google Sheets — Statistiques"},"tom":{"sq":{"1":{"load":285.0,"date":""},"2":{"load":265.0,"date":""},"3":{"load":265.0,"date":""},"4":{"load":250.0,"date":""},"5":{"load":252.5,"date":""},"6":{"load":242.5,"date":""},"7":{"load":232.5,"date":""},"8":{"load":230.0,"date":""}},"bn":{"1":{"load":167.5,"date":""},"2":{"load":160.0,"date":""},"3":{"load":155.0,"date":""},"4":{"load":145.0,"date":""},"5":{"load":145.0,"date":""},"6":{"load":145.0,"date":""}},"dl":{"1":{"load":307.5,"date":""},"2":{"load":290.0,"date":""},"3":{"load":280.0,"date":""},"4":{"load":260.0,"date":""},"5":{"load":250.0,"date":""}},"source":"Google Sheets — Statistiques"},"yann":{"sq":{"1":{"load":320.0,"date":""},"3":{"load":300.0,"date":""},"5":{"load":280.0,"date":"20/04"},"6":{"load":260.0,"date":""}},"bn":{"1":{"load":222.5,"date":""},"2":{"load":207.5,"date":""},"3":{"load":200.0,"date":""},"5":{"load":200.0,"date":"01/07/26"},"10":{"load":100.0,"date":""}},"dl":{"1":{"load":336.0,"date":"RBC 2026"},"3":{"load":312.5,"date":""},"4":{"load":300.0,"date":"04/07/26"},"5":{"load":290.0,"date":""}},"source":"Google Sheets — Statistiques"},"sarah":{"sq":{"1":{"load":130.0,"date":""}},"bn":{"1":{"load":88.0,"date":""}},"dl":{"1":{"load":152.5,"date":""}},"source":"Google Sheets Sarah — Sarah retour vacances dev"}};


(function () {
  'use strict';

  const cfg = window.COACHING_ATHLETE || {};
  if (!cfg.slug) return;

  const seedRoot = window.GA_PR_SEED || {};
  const seed = seedRoot[cfg.slug] || { sq: {}, bn: {}, dl: {}, source: 'Aucune donnée initiale' };
  const records = { sq: new Map(), bn: new Map(), dl: new Map() };
  const manualStorageKey = `ga-manual-prs-v126-${cfg.slug}`;
  const manualKeys = new Set();
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
    .pr-manual-toggle{width:100%;margin:0 0 10px;border:1px solid rgba(240,196,77,.24);border-radius:12px;padding:11px 13px;background:rgba(240,196,77,.08);color:var(--accent-light,var(--accent,#f0c44d));font:inherit;font-size:11px;font-weight:900;cursor:pointer}.pr-manual-toggle.active{background:rgba(240,196,77,.16)}
    .pr-manual-form{display:none;margin:0 0 12px;padding:12px;border:1px solid rgba(255,255,255,.07);border-radius:14px;background:var(--surface,#0e1421)}.pr-manual-form.show{display:block}.pr-manual-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.pr-manual-field{display:flex;flex-direction:column;gap:5px}.pr-manual-field.full{grid-column:1/-1}.pr-manual-field label{font-size:9px;font-weight:900;color:var(--text-muted,#5d6780);text-transform:uppercase;letter-spacing:.04em}.pr-manual-field select,.pr-manual-field input{width:100%;min-width:0;border:1px solid rgba(255,255,255,.09);border-radius:10px;padding:10px;background:var(--surface-2,#141c2d);color:var(--text,#eef2f7);font:inherit;font-size:12px;font-weight:800;outline:none}.pr-manual-field select:focus,.pr-manual-field input:focus{border-color:var(--accent,#f0c44d)}.pr-manual-hint{min-height:15px;margin:9px 1px 0;color:var(--text-dim,#a0abc0);font-size:9px;line-height:1.4}.pr-manual-actions{display:flex;gap:8px;margin-top:10px}.pr-manual-save{flex:1;border:0;border-radius:11px;padding:11px;background:var(--accent,#f0c44d);color:#11151d;font:inherit;font-size:11px;font-weight:900;cursor:pointer}.pr-manual-save:disabled{opacity:.55;cursor:wait}.pr-manual-status{margin-top:8px;min-height:14px;font-size:9px;font-weight:800}.pr-manual-status.ok{color:#70d19b}.pr-manual-status.error{color:#ff7e85}
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
    const label = String(raw.date || raw.source_label || sourceFallback || '').trim();
    return {
      load,
      label,
      achievedAt: raw.achieved_at || raw.achievedAt || null,
      manual: raw.manual === true || /saisie manuelle/i.test(label)
    };
  }

  function manualKey(code, reps) {
    return `${code}:${Number(reps)}`;
  }

  function readManualStore() {
    try {
      const parsed = JSON.parse(localStorage.getItem(manualStorageKey) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      console.warn('PR manuels locaux illisibles :', error);
      return {};
    }
  }

  function writeManualStore(store) {
    try {
      localStorage.setItem(manualStorageKey, JSON.stringify(store));
    } catch (error) {
      console.warn('PR manuels locaux non sauvegardés :', error);
    }
  }

  function loadManualRecords() {
    const store = readManualStore();
    ['sq', 'bn', 'dl'].forEach(code => {
      Object.entries(store[code] || {}).forEach(([repsValue, raw]) => {
        const reps = Number(repsValue);
        const record = normalizeRecord({ ...raw, manual: true }, 'Saisie manuelle');
        if (!record || !(reps >= 1 && reps <= 10)) return;
        record.manual = true;
        records[code].set(reps, record);
        manualKeys.add(manualKey(code, reps));
      });
    });
  }

  function saveManualRecordLocal(code, reps, load, achievedAt) {
    const store = readManualStore();
    store[code] = store[code] || {};
    store[code][String(reps)] = {
      load,
      achievedAt,
      source_label: 'Saisie manuelle',
      manual: true
    };
    writeManualStore(store);
    manualKeys.add(manualKey(code, reps));
    records[code].set(reps, {
      load,
      label: 'Saisie manuelle',
      achievedAt,
      manual: true
    });
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
      const key = manualKey(code, reps);
      const current = records[code].get(reps);
      if (incoming.manual) {
        manualKeys.add(key);
        records[code].set(reps, incoming);
        return;
      }
      if (manualKeys.has(key)) return;
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
      <button type="button" class="pr-manual-toggle" id="prManualToggle">✍️ Ajouter ou modifier un PR</button>
      <form class="pr-manual-form" id="prManualForm" novalidate>
        <div class="pr-manual-grid">
          <div class="pr-manual-field"><label for="prManualLift">Mouvement</label><select id="prManualLift"><option value="sq">Squat</option><option value="bn">Bench</option><option value="dl">Deadlift</option></select></div>
          <div class="pr-manual-field"><label for="prManualReps">Format</label><select id="prManualReps">${Array.from({ length: 10 }, (_, index) => `<option value="${index + 1}">${index + 1} rep${index ? 's' : ''}</option>`).join('')}</select></div>
          <div class="pr-manual-field"><label for="prManualLoad">Charge réalisée</label><input id="prManualLoad" type="text" inputmode="decimal" autocomplete="off" placeholder="Ex. 180"></div>
          <div class="pr-manual-field"><label for="prManualDate">Date du record</label><input id="prManualDate" type="date"></div>
        </div>
        <div class="pr-manual-hint" id="prManualHint"></div>
        <div class="pr-manual-actions"><button type="submit" class="pr-manual-save" id="prManualSave">Enregistrer ce PR</button></div>
        <div class="pr-manual-status" id="prManualStatus" aria-live="polite"></div>
      </form>
      <div id="prPanelContent"></div>`;
    document.body.appendChild(panel);

    const nav = document.querySelector('.bottom-nav');

    // Certaines anciennes pages contiennent déjà un onglet PR dans leur HTML.
    // On les retire tous avant d'ajouter l'unique bouton géré par app.js.
    const isPrNavEntry = element => {
      if (!element) return false;
      const label = String(element.textContent || '')
        .replace(/🏆/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
      return element.classList?.contains('pr-nav')
        || element.dataset?.gaPrNav === '1'
        || label === 'PR';
    };

    if (nav) {
      Array.from(nav.children)
        .filter(isPrNavEntry)
        .forEach(entry => entry.remove());
    }

    let button;
    if (nav?.querySelector('.nav-tab')) {
      button = document.createElement('div');
      button.className = 'nav-tab pr-nav';
      button.textContent = '🏆 PR';
      button.setAttribute('role', 'button');
      button.setAttribute('tabindex', '0');
    } else {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'nav-item pr-nav';
      button.innerHTML = '<span>🏆 PR</span>';
    }
    button.dataset.gaPrNav = '1';

    if (nav) {
      nav.appendChild(button);

      // Si un ancien script recrée son propre onglet après le chargement,
      // il est supprimé immédiatement afin de toujours garder un seul PR.
      const prNavObserver = new MutationObserver(() => {
        Array.from(nav.children)
          .filter(entry => entry !== button && isPrNavEntry(entry))
          .forEach(entry => entry.remove());
        if (!button.isConnected) nav.appendChild(button);
      });
      prNavObserver.observe(nav, { childList: true });
    } else {
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
    bindManualForm();
  }

  function toDateInputValue(record) {
    if (!record?.achievedAt) return '';
    const date = new Date(record.achievedAt);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  }

  function updateManualFormHint() {
    const code = document.getElementById('prManualLift')?.value;
    const reps = Number(document.getElementById('prManualReps')?.value);
    const current = recordFor(code, reps);
    const hint = document.getElementById('prManualHint');
    if (hint) {
      hint.textContent = current
        ? `PR actuel : ${fr(current.load)} kg sur ${formatName(reps)}${displayLabel(current) ? ` · ${displayLabel(current)}` : ''}. La saisie remplacera cette valeur.`
        : `Aucun ${formatName(reps)} enregistré sur le ${liftLabels[code] || 'mouvement'}.`;
    }
    const loadInput = document.getElementById('prManualLoad');
    const dateInput = document.getElementById('prManualDate');
    if (loadInput) loadInput.value = current ? String(current.load).replace('.', ',') : '';
    if (dateInput) dateInput.value = toDateInputValue(current);
    const status = document.getElementById('prManualStatus');
    if (status) { status.textContent = ''; status.className = 'pr-manual-status'; }
  }

  function manualDateIso(value) {
    if (!value) return new Date().toISOString();
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  }

  async function persistManualRecord(code, reps, load, achievedAt) {
    saveManualRecordLocal(code, reps, load, achievedAt);
    renderPanel();

    const client = window.CoachingCloud?.client;
    const user = window.CoachingCloud?.session?.user;
    if (!client || !user) return { persisted: false, message: 'PR enregistré sur cet appareil. Il sera synchronisé dès que le compte sera connecté.' };

    const payload = {
      athlete_slug: cfg.slug,
      exercise_code: code,
      reps,
      load_kg: load,
      source_label: 'Saisie manuelle',
      achieved_at: achievedAt
    };

    try {
      const rpc = await client.rpc('set_manual_pr', {
        p_athlete_slug: cfg.slug,
        p_exercise_code: code,
        p_reps: reps,
        p_load_kg: load,
        p_achieved_at: achievedAt
      });
      if (!rpc.error) {
        await loadCloudRecords();
        return { persisted: true, message: 'PR enregistré et synchronisé.' };
      }
      console.warn('RPC set_manual_pr indisponible :', rpc.error.message);

      const { error } = await client
        .from('athlete_prs')
        .upsert(payload, { onConflict: 'athlete_slug,exercise_code,reps' });
      if (!error) {
        await loadCloudRecords();
        return { persisted: true, message: 'PR enregistré et synchronisé.' };
      }
      console.warn('Upsert manuel PR refusé :', error.message);

      const fallback = await client.rpc('register_pr_if_better', {
        p_athlete_slug: cfg.slug,
        p_exercise_code: code,
        p_reps: reps,
        p_load_kg: load,
        p_source_label: 'Saisie manuelle'
      });
      if (!fallback.error) {
        await loadCloudRecords();
        return { persisted: true, message: 'PR enregistré et synchronisé.' };
      }
      console.warn('RPC manuel PR indisponible :', fallback.error.message);
      return { persisted: false, message: 'PR conservé sur cet appareil. La synchronisation cloud sera réessayée plus tard.' };
    } catch (error) {
      console.warn('Sauvegarde manuelle PR impossible :', error);
      return { persisted: false, message: 'PR conservé sur cet appareil. La synchronisation cloud sera réessayée plus tard.' };
    }
  }

  function bindManualForm() {
    const toggle = document.getElementById('prManualToggle');
    const form = document.getElementById('prManualForm');
    const lift = document.getElementById('prManualLift');
    const reps = document.getElementById('prManualReps');
    const load = document.getElementById('prManualLoad');
    const save = document.getElementById('prManualSave');
    const status = document.getElementById('prManualStatus');
    if (!toggle || !form || !lift || !reps || !load || !save || !status) return;

    toggle.addEventListener('click', () => {
      form.classList.toggle('show');
      toggle.classList.toggle('active', form.classList.contains('show'));
      if (form.classList.contains('show')) {
        updateManualFormHint();
        setTimeout(() => load.focus(), 50);
      }
    });
    lift.addEventListener('change', updateManualFormHint);
    reps.addEventListener('change', updateManualFormHint);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const code = lift.value;
      const repCount = Number(reps.value);
      const loadValue = Number(String(load.value || '').trim().replace(',', '.'));
      if (!['sq', 'bn', 'dl'].includes(code) || !(repCount >= 1 && repCount <= 10) || !(loadValue > 0)) {
        status.textContent = 'Renseigne un mouvement, un format et une charge valide.';
        status.className = 'pr-manual-status error';
        load.focus();
        return;
      }
      save.disabled = true;
      status.textContent = 'Enregistrement…';
      status.className = 'pr-manual-status';
      const achievedAt = manualDateIso(document.getElementById('prManualDate')?.value || '');
      const result = await persistManualRecord(code, repCount, loadValue, achievedAt);
      save.disabled = false;
      status.textContent = result.message;
      status.className = `pr-manual-status ${result.persisted ? 'ok' : 'error'}`;
      updateManualFormHint();
      status.textContent = result.message;
      status.className = `pr-manual-status ${result.persisted ? 'ok' : 'error'}`;
    });
  }

  function renderPanel() {
    if (!panel) return;
    const source = document.getElementById('prSource');
    if (source) {
      source.textContent = `${seed.source || 'Données initiales non disponibles'} · Tu peux ajouter ou corriger un PR manuellement. Les PR réalisés sur une série de compétition continuent aussi à se mettre à jour automatiquement. e1RM calculé avec la formule d’Epley.`;
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
  loadManualRecords();
  injectPanel();
  renderPanel();

  window.CoachingPR = {
    isEligible,
    registerIfBetter,
    celebrate,
    formatName,
    estimated1RM,
    refresh: loadCloudRecords,
    recordFor,
    setManual: persistManualRecord
  };

  if (window.CoachingCloud?.onReady) CoachingCloud.onReady(loadCloudRecords);
})();


(function () {
  'use strict';

  const cfg = window.COACHING_ATHLETE || {};
  if (!cfg.slug) return;

  let progress = null;
  let inventory = [];
  let monsterCatalog = [];
  let monsterCollection = [];
  let itemCatalog = [];
  let itemCollection = [];
  let channel = null;
  let panel = null;
  let chip = null;
  let combat = null;
  let combatTimer = null;
  let damageTrial = null;
  let damageTrialTimer = null;
  let damageTrialHardStopTimer = null;
  let raid = null;
  let raidParticipants = [];
  let raidBattle = null;
  let raidBattleTimer = null;
  let raidPollTimer = null;
  let raidClockTimer = null;
  let activeTab = 'progress';
  let collectionSubTab = 'bestiary';
  let collectionBusy = false;
  let transferBusy = false;
  let transferRecipients = [];
  let transferModalItemId = null;
  let openingCase = false;
  let inventorySort = localStorage.getItem(`rpg_inventory_sort_${cfg.slug}`) || 'rarity';
  let inventorySlotFilter = localStorage.getItem(`rpg_inventory_slot_${cfg.slug}`) || 'all';
  let inventoryTypeFilter = localStorage.getItem(`rpg_inventory_type_${cfg.slug}`) || 'all';
  let bestiarySearch = '';
  let bestiaryRarityFilter = 'all';
  let bestiaryCategoryFilter = 'all';
  let bestiaryStatusFilter = 'all';
  let selectedDifficulty = Math.max(1, Math.floor(Number(localStorage.getItem(`rpg_difficulty_${cfg.slug}`)) || 1));
  let selectedCaseLevel = Math.max(1, Math.floor(Number(localStorage.getItem(`rpg_case_level_${cfg.slug}`)) || 1));
  const serverCasePrices = new Map();
  const casePriceLoadingLevels = new Set();
  let casePriceReloadTimer = null;
  const CASE_COUNTS = [1, 10, 100, 500];
  const CASE_RPC_BATCH_SIZE = 100;
  const REACTION_TARGET_COUNT = 24; // conservé uniquement pour les anciens affichages de résultat
  const REACTION_BASE_INTERVAL_MS = 1100;
  const RUSH_TARGET_MULTIPLIER = 4;
  const RUSH_MAX_SIMULTANEOUS_TARGETS = 5;
  const BLUE_BURST_TARGET_COUNT = 14;
  const BLUE_BURST_DURATION_MS = 5000;
  const ASSUMPTIO_SOUND_SRC = 'https://mirror.irowiki.org/ragnarok/effects/Assumptio.wav';
  const ASSUMPTIO_COOLDOWN_COMBATS = 5;
  // Le cooldown est basé sur le compteur serveur de combats terminés.
  // Il faut terminer exactement 5 combats APRÈS le combat où Assumptio a été utilisé.
  const ASSUMPTIO_COOLDOWN_TARGET_KEY = `rpg_assumptio_cooldown_target_${cfg.slug}`;
  const ASSUMPTIO_LEGACY_COOLDOWN_KEY = `rpg_assumptio_cooldown_remaining_${cfg.slug}`;
  const ASSUMPTIO_COOLDOWN_VERSION_KEY = `rpg_assumptio_cooldown_version_${cfg.slug}`;
  let assumptioSound = null;

  function completedCombatCount(source = progress) {
    return Math.max(
      0,
      Math.floor(n(source?.combat_wins)) + Math.floor(n(source?.combat_losses))
    );
  }

  function migrateAssumptioCooldownToFive() {
    if (localStorage.getItem(ASSUMPTIO_COOLDOWN_VERSION_KEY) === '5') return;

    const currentCount = completedCombatCount();
    const storedTarget = Math.floor(
      Number(localStorage.getItem(ASSUMPTIO_COOLDOWN_TARGET_KEY)) || 0
    );
    const storedRemaining = Math.max(0, storedTarget - currentCount);
    const legacyRemaining = Math.max(
      0,
      Math.floor(Number(localStorage.getItem(ASSUMPTIO_LEGACY_COOLDOWN_KEY)) || 0)
    );
    const remaining = Math.min(
      ASSUMPTIO_COOLDOWN_COMBATS,
      Math.max(storedRemaining, legacyRemaining)
    );

    if (remaining > 0) {
      localStorage.setItem(
        ASSUMPTIO_COOLDOWN_TARGET_KEY,
        String(currentCount + remaining)
      );
    } else {
      localStorage.removeItem(ASSUMPTIO_COOLDOWN_TARGET_KEY);
    }

    localStorage.removeItem(ASSUMPTIO_LEGACY_COOLDOWN_KEY);
    localStorage.setItem(ASSUMPTIO_COOLDOWN_VERSION_KEY, '5');
  }

  function assumptioCooldownTarget() {
    migrateAssumptioCooldownToFive();

    const currentCount = completedCombatCount();
    const storedTarget = Math.floor(
      Number(localStorage.getItem(ASSUMPTIO_COOLDOWN_TARGET_KEY)) || 0
    );

    if (storedTarget > currentCount) return storedTarget;

    localStorage.removeItem(ASSUMPTIO_COOLDOWN_TARGET_KEY);
    return 0;
  }

  function assumptioCooldownRemaining() {
    const currentCount = completedCombatCount();
    const targetCount = assumptioCooldownTarget();
    const remaining = Math.max(0, targetCount - currentCount);

    if (remaining <= 0) {
      localStorage.removeItem(ASSUMPTIO_COOLDOWN_TARGET_KEY);
      return 0;
    }

    return Math.min(ASSUMPTIO_COOLDOWN_COMBATS, remaining);
  }

  function startAssumptioCooldown() {
    // Cible provisoire pendant le combat d'activation.
    // Elle sera recalée exactement à 5 à la validation du combat.
    const targetCount =
      completedCombatCount() + ASSUMPTIO_COOLDOWN_COMBATS + 1;

    localStorage.setItem(ASSUMPTIO_COOLDOWN_TARGET_KEY, String(targetCount));
    localStorage.removeItem(ASSUMPTIO_LEGACY_COOLDOWN_KEY);
    localStorage.setItem(ASSUMPTIO_COOLDOWN_VERSION_KEY, '5');
    return ASSUMPTIO_COOLDOWN_COMBATS;
  }

  function registerCompletedCombatForAssumptio(session) {
    if (session?.assumptioActivatedThisCombat) {
      session.assumptioActivatedThisCombat = false;

      // Le compteur serveur inclut désormais le combat d'activation.
      // Les 5 combats suivants constituent le vrai cooldown.
      const targetCount =
        completedCombatCount() + ASSUMPTIO_COOLDOWN_COMBATS;

      localStorage.setItem(ASSUMPTIO_COOLDOWN_TARGET_KEY, String(targetCount));
      localStorage.setItem(ASSUMPTIO_COOLDOWN_VERSION_KEY, '5');
    }

    return assumptioCooldownRemaining();
  }

  function normalizeAssumptioCooldown() {
    return assumptioCooldownRemaining();
  }

  function ensureAssumptioSound() {
    if (assumptioSound) return assumptioSound;
    const audio = document.createElement('audio');
    audio.id = 'rpgAssumptioSound';
    audio.preload = 'none';
    audio.playsInline = true;
    audio.setAttribute('playsinline', '');
    audio.setAttribute('webkit-playsinline', '');
    audio.volume = effectiveSfxVolume(0.9);
    audio.src = ASSUMPTIO_SOUND_SRC;
    audio.style.display = 'none';
    document.body.appendChild(audio);
    assumptioSound = audio;
    return audio;
  }

  function playAssumptioFallback() {
    if (!sfxAllowed()) return false;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const context = window.__rpgAudioContext || (window.__rpgAudioContext = new AudioContextClass());
      if (context.state === 'suspended') context.resume();
      const now = context.currentTime;
      [523.25, 659.25, 783.99].forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, now + index * 0.08);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, effectiveSfxVolume(0.20)), now + index * 0.08 + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.08 + 0.36);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(now + index * 0.08);
        oscillator.stop(now + index * 0.08 + 0.38);
      });
    } catch (_) {}
  }

  function playAssumptioSound() {
    if (!sfxAllowed()) return false;
    try {
      const audio = ensureAssumptioSound();
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
      audio.volume = effectiveSfxVolume(0.9);
      const promise = audio.play();
      if (promise?.catch) {
        promise.catch(error => {
          console.warn('Lecture Assumptio impossible :', error?.message || error);
          playAssumptioFallback();
        });
      }
    } catch (error) {
      console.warn('Initialisation Assumptio impossible :', error?.message || error);
      playAssumptioFallback();
    }
  }
  const RARITY_RANK = { normal:1, common:2, uncommon:3, rare:4, epic:5, legendary:6, mythic:7, ultra_mythic:8, abyssal:9 };
  const RARITY_COLORS = { normal:'#c4cad4', common:'#61d38b', uncommon:'#5ca9ff', rare:'#aa73ff', epic:'#ff8b49', legendary:'#ffd04f', mythic:'#ff5368', ultra_mythic:'#f2a7ff', abyssal:'#20e3ff' };

  
const RPG_AUDIO_BUILD = '2026-08-05-audio-settings-v60';
window.RPG_AUDIO_BUILD = RPG_AUDIO_BUILD;

// Les MP3 sont déposés directement à la racine du dépôt (branche main),
// au même niveau que app.js. Chaque piste accepte :
// 1) le nom court conseillé ;
// 2) le nom exact provenant du ZIP WeTransfer/Zippy (#U....) ;
// 3) le nom Unicode lisible, au cas où GitHub l'aurait décodé.
const MENU_MUSIC_PATHS = [
  'main-menu.mp3'
];
const MENU_MUSIC_VOLUME = 0.42;
let menuMusic = null;
let menuMusicSourceIndex = 0;
let menuMusicWantedPlaying = false;

// V60 — réglages audio persistants et compatibles avec l'écoute de Spotify.
// Les réglages sont partagés entre toutes les pages athlètes du même domaine.
const RPG_AUDIO_SETTINGS_KEY = 'ga_rpg_audio_settings_v2';
const RPG_AUDIO_DEFAULTS = Object.freeze({
  musicEnabled: true,
  sfxEnabled: true,
  musicVolume: 1,
  sfxVolume: 1
});

function clampAudioSetting(value, fallback = 1) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : fallback;
}

function loadRpgAudioSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(RPG_AUDIO_SETTINGS_KEY) || '{}');
    return {
      musicEnabled: stored.musicEnabled !== false,
      sfxEnabled: stored.sfxEnabled !== false,
      musicVolume: clampAudioSetting(stored.musicVolume, 1),
      sfxVolume: clampAudioSetting(stored.sfxVolume, 1)
    };
  } catch (_) {
    return { ...RPG_AUDIO_DEFAULTS };
  }
}

let rpgAudioSettings = loadRpgAudioSettings();

function saveRpgAudioSettings() {
  try { localStorage.setItem(RPG_AUDIO_SETTINGS_KEY, JSON.stringify(rpgAudioSettings)); } catch (_) {}
}

function musicAllowed() {
  return rpgAudioSettings.musicEnabled === true && rpgAudioSettings.musicVolume > 0;
}

function sfxAllowed() {
  return rpgAudioSettings.sfxEnabled === true && rpgAudioSettings.sfxVolume > 0;
}

function effectiveMusicVolume(baseVolume) {
  return clampAudioSetting(baseVolume, MENU_MUSIC_VOLUME) * rpgAudioSettings.musicVolume;
}

function effectiveSfxVolume(baseVolume) {
  return clampAudioSetting(baseVolume, 1) * rpgAudioSettings.sfxVolume;
}

function duckedMusicVolume(baseVolume = MENU_MUSIC_VOLUME) {
  return Math.min(
    effectiveMusicVolume(baseVolume),
    effectiveMusicVolume(ABYSSAL_MUSIC_DUCK_VOLUME)
  );
}

// V42 : noms ASCII stables. Les 26 MP3 correspondants sont fournis à la
// racine de main, au même niveau que app.js. On ne dépend plus des accents,
// apostrophes typographiques, emojis ou normalisations Unicode de GitHub.
const AUDIO_TRACKS = {
  menu: ['main-menu.mp3'],
  battle_normal: ['combat-normal.mp3'],
  battle_epic: ['mobs-epiques.mp3'],
  battle_stage_67: ['palier-67.mp3'],
  battle_boss_1_9: ['boss-1-9.mp3'],
  battle_boss_10_19: ['boss-10-19.mp3'],
  battle_boss_20_29: ['boss-20-29.mp3'],
  battle_boss_30_39: ['boss-30-39.mp3'],
  battle_boss_40_49: ['boss-40-49.mp3'],
  battle_boss_50_59: ['boss-50-59.mp3'],
  battle_boss_60_69: ['boss-60-69.mp3'],
  battle_boss_70_79: ['boss-70-79.mp3', 'boss-60-69.mp3'],
  battle_boss_80_89: ['boss-80-89.mp3', 'boss-100.mp3'],
  battle_boss_90_99: ['boss-90-99.mp3', 'boss-100.mp3'],
  battle_boss_100: ['boss-100.mp3'],
  damage_trial: ['test-degats.mp3'],
  raid: ['raid.mp3', 'sweatiershop-boss-theme.mp3'],
  case_opening: ['casino.mp3'],
  jackpot: ['jackpot.mp3'],
  theme_noah: ['theme-noah.mp3'],
  theme_hanzalone: ['theme-hanzalone.mp3'],
  theme_kali: ['theme-kali.mp3'],
  theme_greg: ['theme-greg.mp3'],
  theme_jo: ['theme-jo.mp3'],
  theme_rich: ['theme-rich.mp3'],
  theme_val: ['theme-val.mp3']
};

function audioVersionedUrl(relativePath) {
  const url = new URL(rpgAssetUrl(relativePath), document.baseURI || location.href);
  url.searchParams.set('v', RPG_AUDIO_BUILD);
  return url.href;
}


// V51 — annonce vocale abyssale.
// La voix utilise un lecteur SFX séparé : elle se superpose à la musique sans
// changer sa piste ni sa position. Le volume de la BGM est temporairement baissé.
const ABYSSAL_VOICE_PATHS = ['Abyssal (1).mp3', 'Abyssal.mp3'];
const ABYSSAL_VOICE_VOLUME = 1;
const ABYSSAL_MUSIC_DUCK_VOLUME = 0.16;
let abyssalVoice = null;
let abyssalVoiceSourceIndex = 0;
let abyssalVoiceUnlocked = false;
let abyssalVoiceRestoreTimer = null;

const PERE_DE_NOE_VOICE_PATHS = ['Le Père de Noé.mp3', 'Le Pere de Noe.mp3'];
const PERE_DE_NOE_VOICE_VOLUME = 1;
let pereDeNoeVoice = null;
let pereDeNoeVoiceSourceIndex = 0;
let pereDeNoeVoiceUnlocked = false;

function specialAnnouncementPlaying() {
  return !!(
    (abyssalVoice && !abyssalVoice.paused && !abyssalVoice.ended)
    || (pereDeNoeVoice && !pereDeNoeVoice.paused && !pereDeNoeVoice.ended)
  );
}

function specialAnnouncementRestoreDelay(audio, fallbackMs = 180000) {
  const duration = Number(audio?.duration);
  return Number.isFinite(duration) && duration > 0
    ? Math.ceil(duration * 1000) + 1500
    : fallbackMs;
}

function pereDeNoeVoiceUrls() {
  return [...new Set(PERE_DE_NOE_VOICE_PATHS.map(audioVersionedUrl))];
}

function isPereDeNoeMonsterName(value) {
  const name = normalizeAudioMatch(value);
  return name.includes('le pere de noe') || name.includes('grand deltoide masque');
}

function abyssalVoiceUrls() {
  return [...new Set(ABYSSAL_VOICE_PATHS.map(audioVersionedUrl))];
}

function restoreMusicAfterAbyssalVoice() {
  if (abyssalVoiceRestoreTimer) clearTimeout(abyssalVoiceRestoreTimer);
  abyssalVoiceRestoreTimer = null;
  if (menuMusic && !menuMusic.paused) {
    menuMusic.volume = effectiveMusicVolume(Number(sharedMusicVolume) || MENU_MUSIC_VOLUME);
  }
}

function ensureAbyssalVoice() {
  if (abyssalVoice) return abyssalVoice;
  const audio = document.createElement('audio');
  audio.id = 'rpgAbyssalVoice';
  configureAudioElement(audio, { preload:'none' });
  audio.loop = false;
  audio.volume = effectiveSfxVolume(ABYSSAL_VOICE_VOLUME);
  audio.style.display = 'none';

  audio.addEventListener('ended', restoreMusicAfterAbyssalVoice);
  audio.addEventListener('pause', () => {
    if (audio.currentTime > 0 && !audio.ended) return;
    restoreMusicAfterAbyssalVoice();
  });
  audio.addEventListener('error', () => {
    const urls = abyssalVoiceUrls();
    if (abyssalVoiceSourceIndex + 1 < urls.length) {
      abyssalVoiceSourceIndex += 1;
      audio.src = urls[abyssalVoiceSourceIndex];
      audio.load();
      return;
    }
    console.warn('Son abyssal introuvable dans main : Abyssal (1).mp3 / Abyssal.mp3');
    restoreMusicAfterAbyssalVoice();
  });

  const urls = abyssalVoiceUrls();
  if (urls.length) audio.src = urls[0];
  document.body.appendChild(audio);
  abyssalVoice = audio;
  return audio;
}

function ensurePereDeNoeVoice() {
  if (pereDeNoeVoice) return pereDeNoeVoice;
  const audio = document.createElement('audio');
  audio.id = 'rpgPereDeNoeVoice';
  configureAudioElement(audio, { preload:'none' });
  audio.loop = false;
  audio.volume = effectiveSfxVolume(PERE_DE_NOE_VOICE_VOLUME);
  audio.style.display = 'none';

  audio.addEventListener('ended', restoreMusicAfterAbyssalVoice);
  audio.addEventListener('pause', () => {
    if (audio.currentTime > 0 && !audio.ended) return;
    restoreMusicAfterAbyssalVoice();
  });
  audio.addEventListener('error', () => {
    const urls = pereDeNoeVoiceUrls();
    if (pereDeNoeVoiceSourceIndex + 1 < urls.length) {
      pereDeNoeVoiceSourceIndex += 1;
      audio.src = urls[pereDeNoeVoiceSourceIndex];
      audio.load();
      return;
    }
    console.warn('Son du Père de Noé introuvable dans main : Le Père de Noé.mp3');
    restoreMusicAfterAbyssalVoice();
  });

  const urls = pereDeNoeVoiceUrls();
  if (urls.length) audio.src = urls[0];
  document.body.appendChild(audio);
  pereDeNoeVoice = audio;
  return audio;
}

function primePereDeNoeVoice() {
  if (!sfxAllowed()) return false;
  try {
    const audio = ensurePereDeNoeVoice();
    if (pereDeNoeVoiceUnlocked || !audio.src) return;
    const previousMuted = audio.muted;
    const previousVolume = audio.volume;
    audio.muted = true;
    audio.volume = 0;
    audio.currentTime = 0;
    const playback = audio.play();
    if (playback?.then) {
      playback.then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = previousMuted;
        audio.volume = previousVolume || effectiveSfxVolume(PERE_DE_NOE_VOICE_VOLUME);
        pereDeNoeVoiceUnlocked = true;
      }).catch(() => {
        audio.muted = previousMuted;
        audio.volume = previousVolume || effectiveSfxVolume(PERE_DE_NOE_VOICE_VOLUME);
      });
    }
  } catch (error) {
    console.warn('Préchargement du son du Père de Noé impossible :', error?.message || error);
  }
}

function playPereDeNoeVoice() {
  if (!sfxAllowed()) return false;
  try {
    const audio = ensurePereDeNoeVoice();
    if (!audio.src) return false;

    if (abyssalVoice && !abyssalVoice.paused) {
      try { abyssalVoice.pause(); abyssalVoice.currentTime = 0; } catch (_) {}
    }
    if (menuMusic && !menuMusic.paused) {
      menuMusic.volume = duckedMusicVolume(sharedMusicVolume || MENU_MUSIC_VOLUME);
    }

    if (abyssalVoiceRestoreTimer) clearTimeout(abyssalVoiceRestoreTimer);
    abyssalVoiceRestoreTimer = setTimeout(
      restoreMusicAfterAbyssalVoice,
      specialAnnouncementRestoreDelay(audio)
    );

    audio.pause();
    audio.currentTime = 0;
    audio.loop = false;
    audio.muted = false;
    audio.volume = effectiveSfxVolume(PERE_DE_NOE_VOICE_VOLUME);
    const playback = audio.play();
    if (playback?.catch) {
      playback.catch(error => {
        console.warn('Lecture du son du Père de Noé impossible :', error?.name, error?.message);
        restoreMusicAfterAbyssalVoice();
      });
    }
    return true;
  } catch (error) {
    console.warn('Initialisation du son du Père de Noé impossible :', error?.message || error);
    restoreMusicAfterAbyssalVoice();
    return false;
  }
}

// Appelée directement dans le clic Combat/Coffre pour autoriser le lecteur
// sur iPhone et sur les navigateurs qui bloquent les sons lancés après Supabase.
function primeAbyssalVoice() {
  if (!sfxAllowed()) return false;
  try {
    const audio = ensureAbyssalVoice();
    if (abyssalVoiceUnlocked || !audio.src) return;
    const previousMuted = audio.muted;
    const previousVolume = audio.volume;
    audio.muted = true;
    audio.volume = 0;
    audio.currentTime = 0;
    const playback = audio.play();
    if (playback?.then) {
      playback.then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = previousMuted;
        audio.volume = previousVolume || effectiveSfxVolume(ABYSSAL_VOICE_VOLUME);
        abyssalVoiceUnlocked = true;
      }).catch(() => {
        audio.muted = previousMuted;
        audio.volume = previousVolume || effectiveSfxVolume(ABYSSAL_VOICE_VOLUME);
      });
    }
  } catch (error) {
    console.warn('Préchargement du son abyssal impossible :', error?.message || error);
  }
  primePereDeNoeVoice();
}

function playAbyssalVoice() {
  if (!sfxAllowed()) return false;
  try {
    const audio = ensureAbyssalVoice();
    if (!audio.src) return false;

    if (pereDeNoeVoice && !pereDeNoeVoice.paused) {
      try { pereDeNoeVoice.pause(); pereDeNoeVoice.currentTime = 0; } catch (_) {}
    }
    if (menuMusic && !menuMusic.paused) {
      menuMusic.volume = duckedMusicVolume(sharedMusicVolume || MENU_MUSIC_VOLUME);
    }

    if (abyssalVoiceRestoreTimer) clearTimeout(abyssalVoiceRestoreTimer);
    abyssalVoiceRestoreTimer = setTimeout(
      restoreMusicAfterAbyssalVoice,
      specialAnnouncementRestoreDelay(audio)
    );

    audio.pause();
    audio.currentTime = 0;
    audio.loop = false;
    audio.muted = false;
    audio.volume = effectiveSfxVolume(ABYSSAL_VOICE_VOLUME);
    const playback = audio.play();
    if (playback?.catch) {
      playback.catch(error => {
        console.warn('Lecture de la voix abyssale impossible :', error?.name, error?.message);
        restoreMusicAfterAbyssalVoice();
      });
    }
    return true;
  } catch (error) {
    console.warn('Initialisation de la voix abyssale impossible :', error?.message || error);
    restoreMusicAfterAbyssalVoice();
    return false;
  }
}

function menuMusicUrls() {
  return [...new Set(MENU_MUSIC_PATHS.map(audioVersionedUrl))];
}

function trackUrls(key) {
  return [...new Set((AUDIO_TRACKS[key] || []).map(audioVersionedUrl))];
}

function rpgAudioButtonLabel() {
  const musicActive = musicAllowed();
  const sfxActive = sfxAllowed();
  if (!musicActive && !sfxActive) return '🎧 Spotify';
  if (!musicActive) return '🔔 Effets';
  if (menuMusic && !menuMusic.paused && !menuMusic.ended) return '🔊 Audio';
  return '🎵 Audio';
}

function rpgAudioStatusText() {
  const musicActive = musicAllowed();
  const sfxActive = sfxAllowed();
  if (!musicActive && !sfxActive) {
    return 'Mode Spotify : le jeu reste totalement silencieux.';
  }
  if (!musicActive && sfxActive) {
    return 'Musique coupée, effets actifs. Sur certains téléphones, un effet peut brièvement baisser Spotify.';
  }
  if (musicActive && !sfxActive) {
    return 'Musique active, effets coupés.';
  }
  return 'Musique et effets actifs.';
}

function updateRpgAudioToggle(_text = '', state = '') {
  const toggle = document.getElementById('rpgAudioToggle');
  if (toggle) {
    toggle.textContent = rpgAudioButtonLabel();
    toggle.dataset.audioState = state;
    toggle.setAttribute('aria-label', rpgAudioStatusText());
    toggle.title = rpgAudioStatusText();
  }
  renderRpgAudioSettings();
}

function renderRpgAudioSettings() {
  const musicToggle = document.getElementById('rpgMusicEnabled');
  const sfxToggle = document.getElementById('rpgSfxEnabled');
  const musicRange = document.getElementById('rpgMusicVolume');
  const sfxRange = document.getElementById('rpgSfxVolume');
  const musicValue = document.getElementById('rpgMusicVolumeValue');
  const sfxValue = document.getElementById('rpgSfxVolumeValue');
  const status = document.getElementById('rpgAudioStatus');
  if (musicToggle) musicToggle.checked = rpgAudioSettings.musicEnabled;
  if (sfxToggle) sfxToggle.checked = rpgAudioSettings.sfxEnabled;
  if (musicRange) {
    musicRange.value = String(Math.round(rpgAudioSettings.musicVolume * 100));
    musicRange.disabled = !rpgAudioSettings.musicEnabled;
  }
  if (sfxRange) {
    sfxRange.value = String(Math.round(rpgAudioSettings.sfxVolume * 100));
    sfxRange.disabled = !rpgAudioSettings.sfxEnabled;
  }
  if (musicValue) musicValue.textContent = `${Math.round(rpgAudioSettings.musicVolume * 100)} %`;
  if (sfxValue) sfxValue.textContent = `${Math.round(rpgAudioSettings.sfxVolume * 100)} %`;
  if (status) status.textContent = rpgAudioStatusText();
}

function configureAudioElement(audio, { preload = 'metadata', loop = true } = {}) {
  audio.preload = preload;
  audio.loop = loop;
  audio.playsInline = true;
  audio.setAttribute('playsinline', '');
  audio.setAttribute('webkit-playsinline', '');
  audio.setAttribute('aria-hidden', 'true');
}

// Un seul lecteur BGM est utilisé pour toutes les musiques.
// Une fois autorisé par le clic d'ouverture du RPG, il peut changer de piste
// après une réponse Supabase sans créer un nouvel Audio bloqué par iOS/Chrome.
const BATTLE_MUSIC_VOLUME = 0.58;
const EVENT_MUSIC_VOLUME = 0.64;
let battleMusic = null;
let eventMusic = null;
let sharedMusicMode = 'menu';
let sharedMusicKey = 'menu';
let sharedMusicSourceIndex = 0;
let sharedMusicWantedPlaying = false;
let sharedMusicLoop = true;
let sharedMusicVolume = MENU_MUSIC_VOLUME;

// V46 — continuité musicale des combats.
// La piste de combat reste active entre l'écran de résultat et le combat
// suivant. Elle ne repart à 0 que lorsqu'une autre piste doit réellement
// prendre la main (boss, monstre spécial, raid, etc.).
let battleContinuityKey = null;
let battleContinuityTime = 0;
let battleContinuityWasPlaying = false;

// V50 — transition après combat.
// V51 — voix abyssale sur apparition d’un monstre ou coffre abyssal.
// La piste de combat reste audible 25 secondes après le résultat, puis la
// taverne reprend. La position de la piste de combat est conservée afin que
// le prochain combat utilisant exactement la même piste reprenne au même point.
const POST_COMBAT_BATTLE_HOLD_MS = 25000;
let postCombatMusicReturnTimer = null;
let postCombatMenuReturnPending = false;

function cancelPostCombatMusicReturn() {
  if (postCombatMusicReturnTimer) clearTimeout(postCombatMusicReturnTimer);
  postCombatMusicReturnTimer = null;
  postCombatMenuReturnPending = false;
}

async function returnToTavernAfterCombat() {
  if (!musicAllowed()) return false;
  postCombatMusicReturnTimer = null;

  // Ne coupe jamais une nouvelle activité lancée pendant les 25 secondes.
  const activeCombat = !!(combat && !combat.finishing);
  if (activeCombat || raidBattle || damageTrial) return false;

  // Une animation musicale ponctuelle (jackpot, coffre…) garde la priorité.
  // Dès qu'elle se termine, la taverne prendra la main au lieu de relancer le combat.
  if (openingCase || sharedMusicMode === 'event') {
    postCombatMenuReturnPending = true;
    return false;
  }

  if (sharedMusicMode === 'battle') rememberBattleMusicPosition();
  postCombatMenuReturnPending = false;
  return playSharedMusic('menu', 'menu', {
    restart: false,
    loop: true,
    volume: MENU_MUSIC_VOLUME
  });
}

function schedulePostCombatMusicReturn() {
  if (!musicAllowed()) return;
  if (postCombatMusicReturnTimer) clearTimeout(postCombatMusicReturnTimer);
  postCombatMenuReturnPending = false;
  postCombatMusicReturnTimer = setTimeout(() => {
    void returnToTavernAfterCombat();
  }, POST_COMBAT_BATTLE_HOLD_MS);
}

function rememberBattleMusicPosition() {
  if (!menuMusic || sharedMusicMode !== 'battle' || !sharedMusicKey) return;
  battleContinuityKey = sharedMusicKey;
  battleContinuityTime = Number.isFinite(menuMusic.currentTime) ? Math.max(0, menuMusic.currentTime) : 0;
  battleContinuityWasPlaying = !menuMusic.paused && !menuMusic.ended;
}

async function resumeBattleMusicContinuity({ volume = BATTLE_MUSIC_VOLUME } = {}) {
  if (!musicAllowed()) return false;
  if (!battleContinuityKey || !trackUrls(battleContinuityKey).length) return false;
  const audio = ensureMenuMusic();
  const key = battleContinuityKey;
  const restoreTime = Math.max(0, Number(battleContinuityTime) || 0);
  const changed = sharedMusicMode !== 'battle' || sharedMusicKey !== key || !audio.src;
  if (changed && !setSharedMusicSource('battle', key, 0)) return false;
  try {
    audio.loop = true;
    audio.muted = false;
    audio.defaultMuted = false;
    const requestedVolume = Math.max(0, Math.min(1, Number(volume) || BATTLE_MUSIC_VOLUME));
    audio.volume = specialAnnouncementPlaying()
      ? duckedMusicVolume(requestedVolume)
      : effectiveMusicVolume(requestedVolume);
    if (restoreTime > 0 && Number.isFinite(audio.duration) && audio.duration > 0) {
      audio.currentTime = restoreTime % audio.duration;
    } else if (restoreTime > 0) {
      audio.currentTime = restoreTime;
    }
    sharedMusicMode = 'battle';
    sharedMusicKey = key;
    sharedMusicWantedPlaying = true;
    sharedMusicLoop = true;
    sharedMusicVolume = Math.max(0, Math.min(1, Number(volume) || BATTLE_MUSIC_VOLUME));
    if (battleContinuityWasPlaying !== false) {
      const playback = audio.play();
      if (playback && typeof playback.then === 'function') await playback;
    }
    return true;
  } catch (error) {
    console.warn('Reprise de la musique de combat impossible :', error?.name, error?.message);
    return false;
  }
}

function clearBattleMusicContinuity() {
  battleContinuityKey = null;
  battleContinuityTime = 0;
  battleContinuityWasPlaying = false;
}

function sharedMusicUrls(mode, key) {
  return mode === 'menu' ? menuMusicUrls() : trackUrls(key);
}

function ensureMenuMusic() {
  if (menuMusic) {
    battleMusic = menuMusic;
    eventMusic = menuMusic;
    return menuMusic;
  }

  const audio = new Audio();
  audio.id = 'rpgMusicPlayer';
  configureAudioElement(audio);
  audio.volume = effectiveMusicVolume(MENU_MUSIC_VOLUME);
  audio.style.display = 'none';

  audio.addEventListener('playing', () => {
    if (sharedMusicMode === 'menu') updateRpgAudioToggle('🔊 Musique active · V60', 'playing');
  });
  audio.addEventListener('pause', () => {
    if (sharedMusicMode === 'menu' && !audio.ended) updateRpgAudioToggle('🔇 Musique coupée', 'paused');
  });
  audio.addEventListener('waiting', () => {
    if (sharedMusicMode === 'menu') updateRpgAudioToggle('⏳ Chargement musique…', 'loading');
  });
  audio.addEventListener('error', async () => {
    const urls = sharedMusicUrls(sharedMusicMode, sharedMusicKey);
    const nextIndex = sharedMusicSourceIndex + 1;
    console.warn('Piste RPG non chargée :', sharedMusicMode, sharedMusicKey, audio.src, audio.error);
    if (nextIndex < urls.length) {
      setSharedMusicSource(sharedMusicMode, sharedMusicKey, nextIndex);
      if (sharedMusicWantedPlaying) {
        try {
          audio.muted = false;
          audio.volume = specialAnnouncementPlaying()
            ? duckedMusicVolume(sharedMusicVolume)
            : effectiveMusicVolume(sharedMusicVolume);
          await audio.play();
        } catch (error) {
          console.warn('Nouvel essai audio bloqué :', error?.name, error?.message);
          if (sharedMusicMode === 'menu') updateRpgAudioToggle('🔇 Retoucher pour relancer', 'retry');
        }
      }
    } else {
      console.warn('Aucun fichier compatible trouvé pour :', sharedMusicKey);
      if (sharedMusicMode === 'menu') updateRpgAudioToggle('⚠️ MP3 introuvable dans main · V60', 'error');
      try { CoachingCloud.toast(`Musique introuvable : ${sharedMusicKey}. Version audio V60 chargée.`, true); } catch (_) {}
    }
  });
  audio.addEventListener('ended', () => {
    if (sharedMusicMode !== 'event' || sharedMusicLoop) return;
    sharedMusicWantedPlaying = false;
    if (postCombatMenuReturnPending) {
      postCombatMenuReturnPending = false;
      void returnToTavernAfterCombat();
      return;
    }
    if (battleContinuityKey) {
      void resumeBattleMusicContinuity();
      return;
    }
    if (panel?.classList.contains('show') && !combat && !raidBattle && !damageTrial && !openingCase) {
      void playMenuMusic({ restart:true });
    }
  });

  document.body.appendChild(audio);
  menuMusic = audio;
  battleMusic = audio;
  eventMusic = audio;
  setSharedMusicSource('menu', 'menu', 0);
  return audio;
}

function setSharedMusicSource(mode, key, index = 0) {
  const audio = menuMusic || ensureMenuMusic();
  const urls = sharedMusicUrls(mode, key);
  if (!audio || !urls.length) return false;

  sharedMusicMode = mode;
  sharedMusicKey = key;
  sharedMusicSourceIndex = Math.max(0, Math.min(urls.length - 1, index));
  const nextSrc = urls[sharedMusicSourceIndex];

  if (audio.src !== nextSrc) {
    try { audio.pause(); } catch (_) {}
    audio.src = nextSrc;
    audio.preload = 'metadata';
    audio.load();
  }
  return true;
}

async function playSharedMusic(mode, key, {
  restart = false,
  loop = true,
  volume = MENU_MUSIC_VOLUME
} = {}) {
  if (!musicAllowed()) {
    sharedMusicWantedPlaying = false;
    updateRpgAudioToggle('', 'disabled');
    return false;
  }
  const audio = ensureMenuMusic();
  const changed = sharedMusicMode !== mode || sharedMusicKey !== key || !audio.src;
  if (changed && !setSharedMusicSource(mode, key, 0)) return false;

  sharedMusicWantedPlaying = true;
  sharedMusicLoop = !!loop;
  sharedMusicVolume = Math.max(0, Math.min(1, Number(volume) || MENU_MUSIC_VOLUME));

  try {
    audio.loop = sharedMusicLoop;
    audio.muted = false;
    audio.defaultMuted = false;
    audio.volume = specialAnnouncementPlaying()
      ? duckedMusicVolume(sharedMusicVolume)
      : effectiveMusicVolume(sharedMusicVolume);
    if (restart || changed) audio.currentTime = 0;
    const playback = audio.play();
    if (playback && typeof playback.then === 'function') await playback;
    if (mode === 'menu') updateRpgAudioToggle('🔊 Musique active · V60', 'playing');
    return true;
  } catch (error) {
    console.warn('Lecture musique RPG impossible :', mode, key, error?.name, error?.message, audio.src);
    if (mode === 'menu') {
      const blocked = error?.name === 'NotAllowedError';
      updateRpgAudioToggle(blocked ? '🔇 Retoucher pour autoriser' : '⚠️ Son indisponible', blocked ? 'blocked' : 'error');
    }
    return false;
  }
}

async function playMenuMusic({ restart = false, userGesture = false } = {}) {
  if (!musicAllowed()) return false;
  menuMusicWantedPlaying = true;
  if (!panel?.classList.contains('show') || combat || raidBattle || damageTrial || openingCase) return false;
  return playSharedMusic('menu', 'menu', { restart, loop:true, volume:MENU_MUSIC_VOLUME });
}

function unlockRpgAudio() {
  if (musicAllowed()) {
    try { ensureMenuMusic(); } catch (_) {}
  }
  if (sfxAllowed()) {
    try { ensureAssumptioSound(); } catch (_) {}
  }
}

function pauseMenuMusic({ userChoice = false } = {}) {
  menuMusicWantedPlaying = false;
  if (!menuMusic || sharedMusicMode !== 'menu') return;
  sharedMusicWantedPlaying = false;
  try { menuMusic.pause(); } catch (_) {}
  if (userChoice) updateRpgAudioToggle('🔇 Musique coupée', 'paused');
}

function stopMenuMusic() {
  menuMusicWantedPlaying = false;
  if (!menuMusic || sharedMusicMode !== 'menu') return;
  sharedMusicWantedPlaying = false;
  try {
    menuMusic.pause();
    menuMusic.currentTime = 0;
    menuMusic.volume = MENU_MUSIC_VOLUME;
  } catch (_) {}
  updateRpgAudioToggle('🔊 Musique', 'stopped');
}

function pauseAllRpgSfx({ reset = true } = {}) {
  [assumptioSound, abyssalVoice, pereDeNoeVoice, ...firstSpellAudioCache.values()].forEach(audio => {
    if (!audio) return;
    try {
      audio.pause();
      if (reset) audio.currentTime = 0;
    } catch (_) {}
  });
  restoreMusicAfterAbyssalVoice();
}

function pauseSharedMusicForUserChoice() {
  if (!menuMusic) return;
  if (sharedMusicMode === 'battle') rememberBattleMusicPosition();
  sharedMusicWantedPlaying = false;
  menuMusicWantedPlaying = false;
  try { menuMusic.pause(); } catch (_) {}
}

async function resumeMusicForCurrentContext() {
  if (!musicAllowed()) return false;
  if (menuMusic && menuMusic.src && !menuMusic.paused) {
    menuMusic.volume = specialAnnouncementPlaying()
      ? duckedMusicVolume(sharedMusicVolume)
      : effectiveMusicVolume(sharedMusicVolume);
    return true;
  }
  if (combat) return playBattleMusic({ mode:'combat', ...combat }, false);
  if (raidBattle) return playBattleMusic({ mode:'raid', bossName:raid?.boss_name, raidLevel:raid?.raid_level, isBoss:true, isEliteSpecial:true }, false);
  if (damageTrial) return playBattleMusic({ mode:'trial' }, false);
  if (openingCase && sharedMusicKey && sharedMusicMode === 'event') {
    return playSharedMusic('event', sharedMusicKey, { restart:false, loop:sharedMusicLoop, volume:sharedMusicVolume });
  }
  if (panel?.classList.contains('show')) return playMenuMusic({ restart:false, userGesture:true });
  return false;
}

function applyRpgAudioSettings(next = {}, { resumeMusic = false } = {}) {
  const previousMusicAllowed = musicAllowed();
  rpgAudioSettings = {
    musicEnabled: next.musicEnabled === undefined ? rpgAudioSettings.musicEnabled : !!next.musicEnabled,
    sfxEnabled: next.sfxEnabled === undefined ? rpgAudioSettings.sfxEnabled : !!next.sfxEnabled,
    musicVolume: next.musicVolume === undefined ? rpgAudioSettings.musicVolume : clampAudioSetting(next.musicVolume, rpgAudioSettings.musicVolume),
    sfxVolume: next.sfxVolume === undefined ? rpgAudioSettings.sfxVolume : clampAudioSetting(next.sfxVolume, rpgAudioSettings.sfxVolume)
  };
  saveRpgAudioSettings();

  if (!musicAllowed()) {
    pauseSharedMusicForUserChoice();
  } else if (menuMusic && !menuMusic.paused) {
    menuMusic.volume = specialAnnouncementPlaying()
      ? duckedMusicVolume(sharedMusicVolume)
      : effectiveMusicVolume(sharedMusicVolume);
  }

  if (!sfxAllowed()) pauseAllRpgSfx();
  else {
    if (assumptioSound) assumptioSound.volume = effectiveSfxVolume(0.9);
    if (abyssalVoice) abyssalVoice.volume = effectiveSfxVolume(ABYSSAL_VOICE_VOLUME);
    if (pereDeNoeVoice) pereDeNoeVoice.volume = effectiveSfxVolume(PERE_DE_NOE_VOICE_VOLUME);
    firstSpellAudioCache.forEach(audio => { audio.volume = effectiveSfxVolume(1); });
  }

  updateRpgAudioToggle('', musicAllowed() ? 'enabled' : 'disabled');
  if (resumeMusic && !previousMusicAllowed && musicAllowed()) void resumeMusicForCurrentContext();
}

function bindRpgAudioSettings() {
  const menu = document.getElementById('rpgAudioSettings');
  const openButton = document.getElementById('rpgAudioToggle');
  const closeButton = document.getElementById('rpgAudioSettingsClose');
  if (!menu || !openButton || openButton.dataset.bound === '1') return;
  openButton.dataset.bound = '1';

  const setOpen = open => {
    menu.hidden = !open;
    openButton.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) renderRpgAudioSettings();
  };

  openButton.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    setOpen(menu.hidden);
  });
  closeButton?.addEventListener('click', () => setOpen(false));

  document.getElementById('rpgMusicEnabled')?.addEventListener('change', event => {
    applyRpgAudioSettings({ musicEnabled:event.target.checked }, { resumeMusic:event.target.checked });
  });
  document.getElementById('rpgSfxEnabled')?.addEventListener('change', event => {
    applyRpgAudioSettings({ sfxEnabled:event.target.checked });
  });
  document.getElementById('rpgMusicVolume')?.addEventListener('input', event => {
    const volume = Number(event.target.value) / 100;
    applyRpgAudioSettings({ musicVolume:volume }, { resumeMusic:volume > 0 });
  });
  document.getElementById('rpgSfxVolume')?.addEventListener('input', event => {
    applyRpgAudioSettings({ sfxVolume:Number(event.target.value) / 100 });
  });
  document.getElementById('rpgSpotifyMode')?.addEventListener('click', () => {
    applyRpgAudioSettings({ musicEnabled:false, sfxEnabled:false });
  });
  document.getElementById('rpgAudioEnableAll')?.addEventListener('click', () => {
    applyRpgAudioSettings({ musicEnabled:true, sfxEnabled:true }, { resumeMusic:true });
  });

  renderRpgAudioSettings();
}

function normalizeAudioMatch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr')
    .replace(/[’'`]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function resolveBattleMusicKey(context = {}) {
  const name = normalizeAudioMatch(context?.monsterName || context?.bossName || '');
  const difficulty = Math.max(1, Math.trunc(n(context?.difficulty || context?.raidLevel, 1)));
  const cycleDifficulty = ((difficulty - 1) % 100) + 1;

  if (/\bnoah\b/.test(name) || /nain furtif/.test(name)) return 'theme_noah';
  if (/\bhanzalone\b/.test(name)) return 'theme_hanzalone';
  if (/kali muscleton/.test(name) || /prisonnier proteine/.test(name)) return 'theme_kali';
  if (/greg doucette de porc/.test(name) || /crieur hypocalorique/.test(name)) return 'theme_greg';
  if (/jo lindner/.test(name) || /jo lindnergarten/.test(name) || /jardinier veineux/.test(name)) return 'theme_jo';
  if (/rich piano/.test(name) || /musicien a huit repas/.test(name)) return 'theme_rich';
  if (/\bkazuto\b/.test(name) || /lonely shadow cowboy/.test(name) || /^val\b/.test(name)) return 'theme_val';

  if (context?.mode === 'trial') return 'damage_trial';
  if (context?.mode === 'raid') return 'raid';
  if (cycleDifficulty === 67) return 'battle_stage_67';

  if (context?.isBoss) {
    if (cycleDifficulty === 100) return 'battle_boss_100';
    if (cycleDifficulty >= 90) return 'battle_boss_90_99';
    if (cycleDifficulty >= 80) return 'battle_boss_80_89';
    if (cycleDifficulty >= 70) return 'battle_boss_70_79';
    if (cycleDifficulty >= 60) return 'battle_boss_60_69';
    if (cycleDifficulty >= 50) return 'battle_boss_50_59';
    if (cycleDifficulty >= 40) return 'battle_boss_40_49';
    if (cycleDifficulty >= 30) return 'battle_boss_30_39';
    if (cycleDifficulty >= 20) return 'battle_boss_20_29';
    if (cycleDifficulty >= 10) return 'battle_boss_10_19';
    return 'battle_boss_1_9';
  }

  return context?.isEliteSpecial ? 'battle_epic' : 'battle_normal';
}

function setBattleMusicSource(key, index = 0) {
  return setSharedMusicSource('battle', key, index);
}

function ensureBattleMusic(key = 'battle_normal') {
  const audio = ensureMenuMusic();
  if (sharedMusicMode !== 'battle' || sharedMusicKey !== key || !audio.src) setSharedMusicSource('battle', key, 0);
  return audio;
}

function primeBattleMusic(context = {}) {
  if (!musicAllowed()) return false;
  const key = resolveBattleMusicKey(context);
  if (!key) return;
  cancelPostCombatMusicReturn();

  // Si la même piste tourne encore pendant les 25 secondes de transition,
  // elle continue sans aucune coupure ni remise à zéro.
  if (menuMusic && sharedMusicMode === 'battle' && sharedMusicKey === key && !menuMusic.paused) {
    battleContinuityKey = key;
    battleContinuityWasPlaying = true;
    return;
  }

  // Si la taverne a déjà repris, on recharge la même piste de combat à la
  // seconde mémorisée. Le volume très faible conserve l'autorisation audio
  // pendant l'attente de Supabase sans provoquer un redémarrage à 0:00.
  if (battleContinuityKey === key && battleContinuityTime > 0) {
    battleContinuityWasPlaying = true;
    void resumeBattleMusicContinuity({ volume: 0.02 });
    return;
  }

  // Nouvelle piste présumée : elle démarre au début. Si le serveur renvoie
  // ensuite un monstre spécial, playBattleMusic sélectionnera sa vraie piste.
  void playSharedMusic('battle', key, { restart:true, loop:true, volume:0.02 });
}

function playBattleMusic(context = {}, restart = false) {
  if (!musicAllowed()) return false;
  const key = resolveBattleMusicKey(context);
  if (!key) return false;
  cancelPostCombatMusicReturn();

  const sameTrack = sharedMusicMode === 'battle' && sharedMusicKey === key;
  const canResumeStoredTrack = !sameTrack
    && battleContinuityKey === key
    && battleContinuityTime > 0
    && !restart;

  if (canResumeStoredTrack) {
    battleContinuityWasPlaying = true;
    return resumeBattleMusicContinuity({ volume: BATTLE_MUSIC_VOLUME });
  }

  battleContinuityKey = key;
  battleContinuityWasPlaying = true;
  if (!sameTrack) battleContinuityTime = 0;
  return playSharedMusic('battle', key, {
    restart: !!restart || !sameTrack,
    loop: true,
    volume: BATTLE_MUSIC_VOLUME
  });
}

function stopBattleMusic({ reset = true, resumeMenu = true, clearContinuity = true } = {}) {
  cancelPostCombatMusicReturn();
  if (!menuMusic || sharedMusicMode !== 'battle') {
    if (clearContinuity) clearBattleMusicContinuity();
    return;
  }
  rememberBattleMusicPosition();
  sharedMusicWantedPlaying = false;
  try {
    menuMusic.pause();
    if (reset) menuMusic.currentTime = 0;
    menuMusic.volume = BATTLE_MUSIC_VOLUME;
  } catch (_) {}
  if (clearContinuity) clearBattleMusicContinuity();
  if (resumeMenu && panel?.classList.contains('show') && !combat && !raidBattle && !damageTrial && !openingCase) void playMenuMusic();
}

function setEventMusicSource(key, index = 0) {
  return setSharedMusicSource('event', key, index);
}

function ensureEventMusic(key, { loop = false } = {}) {
  const audio = ensureMenuMusic();
  if (sharedMusicMode !== 'event' || sharedMusicKey !== key || !audio.src) setSharedMusicSource('event', key, 0);
  audio.loop = !!loop;
  return audio;
}

function primeEventMusic(key) {
  if (!musicAllowed()) return false;
  if (!trackUrls(key).length) return;
  void playSharedMusic('event', key, { restart:true, loop:true, volume:0.02 });
}

function playEventMusic(key, { restart = true, loop = false, volume = EVENT_MUSIC_VOLUME } = {}) {
  if (!musicAllowed()) return false;
  if (!trackUrls(key).length) return false;
  if (sharedMusicMode === 'battle') rememberBattleMusicPosition();
  void playSharedMusic('event', key, { restart, loop, volume });
  return true;
}

function stopEventMusic({ resumeMenu = false, resumeBattle = true } = {}) {
  const wasEvent = !!(menuMusic && sharedMusicMode === 'event');
  if (wasEvent) {
    sharedMusicWantedPlaying = false;
    try {
      menuMusic.pause();
      menuMusic.currentTime = 0;
      menuMusic.loop = false;
      menuMusic.volume = EVENT_MUSIC_VOLUME;
    } catch (_) {}
  }
  if (wasEvent && postCombatMenuReturnPending) {
    postCombatMenuReturnPending = false;
    void returnToTavernAfterCombat();
    return;
  }
  if (wasEvent && resumeBattle && battleContinuityKey) {
    void resumeBattleMusicContinuity();
    return;
  }
  if (wasEvent && resumeMenu && panel?.classList.contains('show') && !combat && !raidBattle && !damageTrial && !openingCase) void playMenuMusic();
}


  function monsterDisplayName(value) {
    const original = String(value || '').trim();
    const normalized = original
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('fr')
      .replace(/[’'`´]/g, ' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');

    if (normalized === 'le grand deltoide masque') {
      return 'Le père de Noé';
    }
    if (normalized === 'roi du funk synthetique' || normalized === 'le roi du funk synthetique') {
      return 'Roi de la Funk Synthétique';
    }
    if (normalized === 'le mec en jeans') {
      return 'Roi de la Phonk';
    }
    if (normalized === 'le manager esn ultime') {
      return 'Le Manager ESN Ultime';
    }

    return original;
  }

  function canonicalMonsterRarity(monsterName, rarity, monsterKey = '') {
    const key = String(monsterKey || '').toLowerCase();
    const normalizedName = String(monsterName || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('fr')
      .replace(/[’'`´]/g, ' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');

    // Loïc appartient bien à la catégorie Rare : le client corrige aussi
    // l'affichage si une ancienne ligne Supabase renvoie encore "uncommon".
    if (key === 'archive_060_loic_gronfier_gardien_du_grip'
        || normalizedName === 'loic gronfier gardien du grip') {
      return 'rare';
    }

    return normalizedMonsterRarity(rarity || 'common');
  }

  function monsterCatalogMatch(row) {
    const key = String(row?.monster_key || '').toLowerCase();
    const name = monsterDisplayName(row?.monster_name).toLocaleLowerCase('fr');
    return monsterCatalog.find(monster => {
      const catalogKey = String(monster?.monster_key || '').toLowerCase();
      const catalogName = monsterDisplayName(monster?.monster_name).toLocaleLowerCase('fr');
      return (key && catalogKey === key) || (name && catalogName === name);
    }) || null;
  }

  function isEliteSpecialMonster(row) {
    const catalog = monsterCatalogMatch(row);
    const rarity = String(row?.monster_rarity || row?.rarity || catalog?.rarity || '').toLowerCase();
    const category = String(row?.monster_category || row?.category || catalog?.category || '').toLocaleLowerCase('fr');
    const name = String(row?.monster_name || catalog?.monster_name || '').toLocaleLowerCase('fr');
    const eliteRarity = ['epic', 'legendary', 'mythic', 'ultra_mythic', 'abyssal', 'secret'].includes(rarity);
    const eliteCategory = /élite|elite|spécial|special|secret|boss|mythique|légendaire|legendary/.test(category);
    const namedSpecial = /kazuto|lonely shadow cowboy|val,|hanzalone|noah/.test(name);
    return eliteRarity || eliteCategory || namedSpecial;
  }

  const CLASS_DEFS = {
    warrior: {
      icon: '⚔️', title: 'Guerrier', subtitle: 'Spécialiste Squat', lift: 'sq', liftName: 'squat',
      mainStat: 'Force', masteryStat: 'Chance', affinitySlot: 'weapon', affinityLabel: 'armes',
      perk: '+25 % d’XP sur les séries et PR de squat',
      combat: 'Affinité : statistiques des armes +25 %. Sort actif — Rage du colosse : pendant 5 s, les cibles réussies infligent +35 % de dégâts.'
    },
    archer: {
      icon: '🏹', title: 'Archer', subtitle: 'Spécialiste Bench', lift: 'bn', liftName: 'bench',
      mainStat: 'Précision', masteryStat: 'Chance', affinitySlot: 'armor', affinityLabel: 'armures',
      perk: '+25 % d’XP sur les séries et PR de bench',
      combat: 'Affinité : statistiques des armures +25 %. Sort actif — Œil du faucon : pendant 5 s, les zones sont plus larges et chaque cible valide devient parfaite.'
    },
    mage: {
      icon: '🔮', title: 'Mage', subtitle: 'Spécialiste Deadlift', lift: 'dl', liftName: 'deadlift',
      mainStat: 'Magie', masteryStat: 'Chance', affinitySlot: 'relic', affinityLabel: 'reliques',
      perk: '+25 % d’XP sur les séries et PR de deadlift',
      combat: 'Affinité : statistiques des reliques +25 %. Sort actif — Arrêt du temps : fige le chrono pendant 4 s pendant que tu continues à attaquer et ajoute 4 cibles. Aucun passif de dégâts.'
    }
  };

  const CLASS_ABILITIES = {
    warrior: { key: 'warrior_rage', icon: '🔥', name: 'Rage du colosse', durationMs: 5000, short: '+35 % dégâts pendant 5 s' },
    archer: { key: 'archer_focus', icon: '🦅', name: 'Œil du faucon', durationMs: 5000, short: 'Cibles parfaites pendant 5 s' },
    mage: { key: 'mage_time_stop', icon: '⏳', name: 'Arrêt du temps', durationMs: 4000, short: 'Chrono figé + 4 cibles bonus' }
  };

  const ABILITY_CUTIN_ASSETS = {
    warrior: {
      image: 'skill-cutin-warrior.webp',
      title: 'RAGE DU COLOSSE',
      subtitle: 'La hache fend l’arène',
      theme: 'warrior'
    },
    archer: {
      image: 'skill-cutin-archer.webp',
      title: 'ŒIL DU FAUCON',
      subtitle: 'Tir parfait en rafale',
      theme: 'archer'
    },
    mage: {
      image: 'skill-cutin-mage.webp',
      title: 'ARRÊT DU TEMPS',
      subtitle: 'Magie brillante et cœurs ensorcelés',
      theme: 'mage'
    }
  };

  let abilityCutinsPreloaded = false;
  function preloadAbilityCutins() {
    if (abilityCutinsPreloaded) return;
    abilityCutinsPreloaded = true;
    Object.values(ABILITY_CUTIN_ASSETS).forEach(asset => {
      const image = new Image();
      image.decoding = 'async';
      image.src = asset.image;
    });
  }

  const RARITY_DEFS = {
    normal: { label: 'Simple', chance: '48,889 %', rate: 48.889, icon: '⚪' },
    common: { label: 'Commun', chance: '25 %', rate: 25, icon: '🟢' },
    uncommon: { label: 'Peu commun', chance: '15 %', rate: 15, icon: '🔵' },
    rare: { label: 'Rare', chance: '7 %', rate: 7, icon: '🟣' },
    epic: { label: 'Épique', chance: '3 %', rate: 3, icon: '🟠' },
    legendary: { label: 'Légendaire', chance: '1 %', rate: 1, icon: '🟡' },
    mythic: { label: 'Mythique', chance: '0,1 %', rate: 0.1, icon: '🔴' },
    ultra_mythic: { label: 'Ultra méga mythique', chance: '0,01 %', rate: 0.01, icon: '🌟' },
    abyssal: { label: 'Abyssal', chance: '0,001 %', rate: 0.001, icon: '🫧' }
  };

  const ITEM_LEVEL_GROWTH = 1.20;
  const ITEM_RARITY_STAT_MULTIPLIER = {
    normal:1.00, common:1.78, uncommon:3.16, rare:5.62, epic:10.00,
    legendary:17.78, mythic:31.62, ultra_mythic:56.23, abyssal:100.00
  };

  const MONSTER_RARITY_DEFS = {
    normal: { label: 'Simple', bonus: 0, icon: '⚪' },
    common: { label: 'Commun', bonus: 1, icon: '🟢' },
    uncommon: { label: 'Peu commun', bonus: 2, icon: '🔵' },
    rare: { label: 'Rare', bonus: 5, icon: '🟣' },
    epic: { label: 'Épique', bonus: 10, icon: '🟠' },
    legendary: { label: 'Légendaire', bonus: 20, icon: '🟡' },
    mythic: { label: 'Mythique', bonus: 50, icon: '🔴' },
    ultra_mythic: { label: 'Ultra mythique', bonus: 15, icon: '🌟' },
    abyssal: { label: 'Abyssal', bonus: 30, icon: '🫧' },
    secret: { label: 'Ultra mythique', bonus: 15, icon: '🌟' }
  };

  const SLOT_DEFS = {
    weapon: { label: 'Arme', icon: '🗡️' },
    armor: { label: 'Armure', icon: '🛡️' },
    relic: { label: 'Relique', icon: '💎' }
  };


  const PASSIVE_DEFS = {
    epic_hunter: { icon: '👹', label: 'Chasseur épique', unit: '%', description: 'Augmente la probabilité de rencontrer tous les monstres Rares et supérieurs.' },
    case_luck: { icon: '🎁', label: 'Instinct du coffre', unit: '', description: 'Augmente très légèrement le poids des raretés supérieures dans les caisses.' },
    resale_bonus: { icon: '🪙', label: 'Marchandage', unit: '%', description: 'Augmente la valeur de revente des objets.' },
    epic_gold_bonus: { icon: '💰', label: 'Prime épique', unit: '%', description: 'Augmente l’or gagné contre les monstres épiques et supérieurs.' },
    relic_luck: { icon: '💎', label: 'Aura relique', unit: '', description: 'Augmente la qualité des récompenses de caisse.' }
  };

  const ITEM_VALUE_RARITY_MULTIPLIER = {
    normal:1, common:2, uncommon:4, rare:8, epic:15,
    legendary:30, mythic:60, ultra_mythic:120, abyssal:200
  };


  const css = `
    .xp-chip{flex:0 0 auto;border:1px solid rgba(240,196,77,.18);border-radius:11px;padding:6px 9px;background:rgba(240,196,77,.07);color:var(--accent,#f0c44d);font:900 10px Inter,system-ui,sans-serif;cursor:pointer;white-space:nowrap}
    .xp-panel{display:none;position:fixed;z-index:430;left:50%;transform:translateX(-50%);top:56px;bottom:62px;width:100%;max-width:430px;padding:13px 16px 22px;box-sizing:border-box;overflow-y:auto;overflow-x:hidden;background:var(--bg,#05070d);color:var(--text,#eef2f7)}.xp-panel *{box-sizing:border-box;min-width:0}
    .xp-panel.show{display:block}.xp-panel-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:2px 0 10px}.xp-panel-head h2{margin:0;font-size:17px}.xp-panel-head>div{display:flex;gap:6px;align-items:center}.xp-panel-head button{border:1px solid rgba(255,255,255,.07);border-radius:10px;background:var(--surface-2,#141c2d);color:inherit;padding:8px 10px;font-weight:800;cursor:pointer;white-space:nowrap}.rpg-audio-settings[hidden]{display:none}.rpg-audio-settings{margin:0 0 12px;padding:13px;border:1px solid rgba(112,178,255,.18);border-radius:16px;background:linear-gradient(145deg,rgba(57,102,177,.13),rgba(255,255,255,.02))}.rpg-audio-settings-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.rpg-audio-settings-head b{font-size:13px}.rpg-audio-settings-head button{border:0;background:transparent;color:#9ba8bd;font-weight:900;cursor:pointer}.rpg-audio-row{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;margin-top:11px;padding:10px 11px;border-radius:12px;background:rgba(255,255,255,.035)}.rpg-audio-row strong{display:block;font-size:11px}.rpg-audio-row small{display:block;margin-top:3px;font-size:8px;line-height:1.4;color:#8995aa}.rpg-audio-switch{width:42px;height:24px;appearance:none;border-radius:999px;background:#30394a;position:relative;cursor:pointer;transition:.2s}.rpg-audio-switch:after{content:'';position:absolute;width:18px;height:18px;top:3px;left:3px;border-radius:50%;background:#fff;transition:.2s}.rpg-audio-switch:checked{background:#5aa8ff}.rpg-audio-switch:checked:after{transform:translateX(18px)}.rpg-audio-slider{margin-top:8px;display:grid;grid-template-columns:1fr 42px;gap:8px;align-items:center}.rpg-audio-slider input{width:100%;accent-color:#6db4ff}.rpg-audio-slider span{text-align:right;font-size:9px;font-weight:900;color:#9fcaff}.rpg-audio-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:11px}.rpg-audio-actions button{border:1px solid rgba(255,255,255,.08);border-radius:11px;padding:10px 8px;background:#121a29;color:#eef4ff;font-weight:900;font-size:10px;cursor:pointer}.rpg-audio-actions button:first-child{border-color:rgba(76,190,130,.25);background:rgba(76,190,130,.09)}.rpg-audio-actions button:last-child{border-color:rgba(90,168,255,.25);background:rgba(90,168,255,.09)}.rpg-audio-status{margin-top:9px;font-size:8px;line-height:1.5;color:#8e9bb1}
    .xp-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-bottom:12px;padding:4px;border-radius:13px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.045)}.xp-tab{border:0;border-radius:10px;padding:9px 4px;background:transparent;color:var(--text-muted,#5d6780);font:850 10px Inter,system-ui,sans-serif;cursor:pointer}.xp-tab.active{background:var(--surface-2,#141c2d);color:var(--accent,#f0c44d);box-shadow:0 7px 16px rgba(0,0,0,.18)}
    .xp-hero{padding:17px;border:1px solid rgba(240,196,77,.16);border-radius:18px;background:radial-gradient(circle at 50% 0,rgba(179,27,42,.19),transparent 55%),linear-gradient(145deg,rgba(255,255,255,.035),rgba(255,255,255,.012));box-shadow:0 18px 38px rgba(0,0,0,.2)}
    .xp-level{font-size:11px;color:var(--text-muted,#5d6780);font-weight:900;letter-spacing:.08em;text-transform:uppercase}.xp-total{margin-top:4px;font-size:30px;font-weight:950;color:var(--accent,#f0c44d)}.xp-total small{font-size:12px;color:var(--text-dim,#a0abc0)}
    .xp-progress{height:8px;margin-top:12px;border-radius:999px;background:rgba(255,255,255,.06);overflow:hidden}.xp-progress span{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#cf2b3d,var(--accent,#f0c44d))}.xp-next{display:flex;justify-content:space-between;gap:8px;margin-top:6px;font-size:10px;color:var(--text-muted,#5d6780)}
    .xp-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:11px}.xp-stat{padding:10px 8px;border-radius:12px;background:rgba(255,255,255,.035);text-align:center}.xp-stat b{display:block;font-size:16px;color:var(--text,#eef2f7)}.xp-stat span{display:block;margin-top:3px;font-size:8px;color:var(--text-muted,#5d6780);text-transform:uppercase;letter-spacing:.05em}
    .xp-section{margin-top:12px;padding:14px;border:1px solid rgba(255,255,255,.055);border-radius:17px;background:linear-gradient(145deg,rgba(255,255,255,.032),rgba(255,255,255,.012))}.xp-section-title{font-size:12px;font-weight:950;letter-spacing:.06em;text-transform:uppercase;color:var(--accent,#f0c44d);margin-bottom:10px}
    .rpg-choice-intro{font-size:11px;line-height:1.55;color:var(--text-dim,#a0abc0);margin-bottom:10px}.rpg-warning{color:#ff8c95;font-weight:850}
    .rpg-class-grid{display:grid;gap:8px}.rpg-class-card{width:100%;text-align:left;border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:12px;background:rgba(255,255,255,.025);color:inherit;cursor:pointer}.rpg-class-card:active{transform:scale(.985)}.rpg-class-card strong{display:block;font-size:14px}.rpg-class-card small{display:block;margin-top:3px;color:var(--text-dim,#a0abc0);line-height:1.45}.rpg-class-icon{font-size:25px;float:left;margin-right:10px;line-height:1.2}
    .rpg-profile{display:flex;gap:12px;align-items:center}.rpg-avatar{position:relative;overflow:hidden;width:58px;height:58px;border-radius:17px;display:grid;place-items:center;font-size:31px;background:radial-gradient(circle at 50% 25%,rgba(240,196,77,.24),rgba(179,27,42,.12) 55%,rgba(255,255,255,.02));border:1px solid rgba(240,196,77,.18)}.rpg-avatar-fallback{position:relative;z-index:0}.rpg-avatar img{position:absolute;inset:0;z-index:1;width:100%;height:100%;object-fit:cover;display:block}.rpg-profile-copy{min-width:0}.rpg-profile-copy b{display:block;font-size:16px}.rpg-profile-copy span{display:block;margin-top:3px;font-size:10px;color:var(--text-dim,#a0abc0)}
    .rpg-statline{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:12px}.rpg-statbox{padding:9px 5px;text-align:center;border-radius:11px;background:rgba(255,255,255,.035);overflow:hidden}.rpg-statbox b{display:block;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rpg-statbox span{display:block;font-size:8px;color:var(--text-muted,#5d6780);text-transform:uppercase;letter-spacing:.04em}.rpg-statbox small{display:block;margin-top:3px;font-size:7px;line-height:1.35;color:#78849b;overflow-wrap:anywhere}.rpg-influence-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}.rpg-influence-card{padding:12px;border-radius:14px;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.028)}.rpg-influence-card .k{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted,#8a95ab);margin-bottom:6px}.rpg-influence-card .v{display:block;font-size:16px;font-weight:800;color:var(--accent,#f3c643);line-height:1.15}.rpg-influence-card .d{display:block;margin-top:6px;font-size:10px;line-height:1.45;color:var(--text-dim,#b4bed1)}.rpg-influence-card.force .v{color:#ff8c6a}.rpg-influence-card.chance .v{color:#6cc6ff}.rpg-influence-card.fortune .v{color:#f3c643}
    .rpg-combat-record{display:flex;justify-content:center;gap:14px;margin:10px 0 0;font-size:10px;color:var(--text-dim,#a0abc0)}.rpg-combat-record b{color:var(--text,#eef2f7)}.combo-loot-note{margin-top:10px;padding:10px 12px;border-radius:12px;border:1px solid rgba(240,196,77,.2);background:rgba(240,196,77,.055);color:#c4ccda;font-size:9px;line-height:1.55}
    .rpg-launch{display:block;width:100%;margin-top:12px;border:0;border-radius:13px;padding:13px 16px;background:linear-gradient(135deg,#cf2b3d,var(--accent,#f0c44d));color:#11151d;font-weight:950;font-size:13px;cursor:pointer;box-shadow:0 12px 28px rgba(207,43,61,.18)}.rpg-launch:disabled{opacity:.45;cursor:not-allowed}
    .difficulty-box{margin-top:12px;padding:12px;border-radius:14px;background:rgba(255,255,255,.028);border:1px solid rgba(255,255,255,.055)}.difficulty-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.difficulty-head b{font-size:12px}.difficulty-value{font-size:17px;color:var(--accent,#f0c44d);font-weight:950}.difficulty-box input[type=range]{width:100%;margin:10px 0 5px;accent-color:#f0c44d}.difficulty-mults{display:flex;justify-content:space-between;gap:8px;font-size:9px;color:var(--text-dim,#a0abc0)}.world-picker{margin-top:12px;padding:13px;border-radius:14px;background:linear-gradient(145deg,rgba(44,119,255,.09),rgba(255,255,255,.025));border:1px solid rgba(92,169,255,.18)}.world-picker-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px}.world-picker-head b{font-size:12px}.world-picker-head span{font-size:9px;color:#91bfff}.world-picker select,.world-picker input[type=number]{width:100%;border:1px solid rgba(255,255,255,.1);border-radius:11px;padding:10px 11px;background:var(--surface-2,#141c2d);color:var(--text,#eef2f7);font:800 11px Inter,system-ui,sans-serif;outline:none}.world-picker select:focus,.world-picker input[type=number]:focus{border-color:rgba(92,169,255,.55)}.world-picker input[type=range]{width:100%;margin:10px 0 2px;accent-color:var(--accent,#f0c44d)}.world-picker-note{margin-top:7px;font-size:9px;line-height:1.45;color:var(--text-dim,#a0abc0)}.boss-gate{margin-top:12px;padding:14px;border-radius:16px;background:radial-gradient(circle at 50% 0,rgba(207,43,61,.18),transparent 65%),rgba(255,255,255,.025);border:1px solid rgba(240,196,77,.16)}.boss-gate-head{display:flex;justify-content:space-between;align-items:center;gap:10px}.boss-gate-head b{font-size:12px}.boss-level{font-size:20px;font-weight:950;color:#f0c44d}.boss-progress{height:9px;margin:10px 0 6px;border-radius:999px;background:rgba(255,255,255,.06);overflow:hidden}.boss-progress span{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#cf2b3d,#f0c44d)}.boss-copy{font-size:9px;line-height:1.5;color:#a0abc0}.boss-mults{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:9px}.boss-mults span{padding:8px;border-radius:10px;background:rgba(255,255,255,.03);font-size:9px;text-align:center;color:#dbe2ef}.boss-launch{width:100%;margin-top:9px;border:1px solid rgba(240,196,77,.28);border-radius:12px;padding:11px;background:linear-gradient(135deg,rgba(207,43,61,.28),rgba(240,196,77,.15));color:#fff;font-weight:950;cursor:pointer}.boss-launch:disabled{opacity:.38;cursor:not-allowed}.boss-lock{margin-top:7px;font-size:8px;text-align:center;color:#77839a}
    .xp-rules{margin-top:12px;padding:13px;border:1px solid rgba(255,255,255,.05);border-radius:15px;background:rgba(255,255,255,.025);font-size:11px;line-height:1.62;color:var(--text-dim,#a0abc0)}.xp-rules strong{color:var(--text,#eef2f7)}
    .gold-wallet{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:15px 16px;border-radius:17px;border:1px solid rgba(240,196,77,.2);background:radial-gradient(circle at 0 0,rgba(240,196,77,.17),transparent 55%),rgba(255,255,255,.025)}.gold-wallet strong{font-size:23px;color:#ffd45d}.gold-wallet span{font-size:10px;color:var(--text-dim,#a0abc0)}
    .upgrade-grid{display:grid;gap:8px}.upgrade-card{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:12px;border-radius:13px;background:rgba(255,255,255,.028);border:1px solid rgba(255,255,255,.05)}.upgrade-card b{display:block;font-size:13px}.upgrade-card small{display:block;margin-top:3px;font-size:9px;color:var(--text-dim,#a0abc0);line-height:1.4}.upgrade-card button,.equip-button,.case-open-button{border:0;border-radius:10px;padding:9px 10px;background:var(--accent,#f0c44d);color:#11151d;font-weight:900;font-size:10px;cursor:pointer}.upgrade-card button:disabled,.equip-button:disabled,.case-open-button:disabled{opacity:.38;cursor:not-allowed}.upgrade-rank{color:var(--accent,#f0c44d)}
    .equipment-slots{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.equipment-slot{min-height:112px;padding:9px 7px;border-radius:13px;border:1px dashed rgba(255,255,255,.1);background:rgba(255,255,255,.018);text-align:center}.equipment-slot .slot-icon{font-size:23px}.equipment-slot .slot-label{display:block;margin-top:3px;font-size:8px;color:var(--text-muted,#5d6780);text-transform:uppercase}.equipment-slot .slot-item{display:block;margin-top:7px;font-size:9px;font-weight:800;line-height:1.3}.equipment-slot .slot-stats{display:block;margin-top:5px;font-size:8px;color:var(--text-dim,#a0abc0)}
    .inventory-list{display:grid;gap:8px}.inventory-card{padding:12px;border-radius:14px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.055)}.inventory-top{display:flex;justify-content:space-between;gap:9px;align-items:flex-start}.inventory-name{font-size:12px;font-weight:900;line-height:1.35}.inventory-meta{font-size:9px;color:var(--text-muted,#5d6780);margin-top:3px}.inventory-stats{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}.inventory-stats span{padding:4px 7px;border-radius:999px;background:rgba(255,255,255,.045);font-size:8px;color:var(--text-dim,#a0abc0)}.inventory-actions{display:flex;justify-content:flex-end;margin-top:8px}.inventory-card.equipped{border-color:rgba(240,196,77,.3);box-shadow:inset 0 0 0 1px rgba(240,196,77,.08)}.item-comparison{margin-top:10px;padding:10px 11px;border-radius:13px;border:1px solid rgba(255,255,255,.07);background:rgba(0,0,0,.16)}.item-comparison-title{display:flex;justify-content:space-between;gap:8px;align-items:center;font-size:9px;font-weight:900;color:var(--text-dim,#a0abc0)}.item-comparison-title strong{color:var(--text,#eef2f7);font-size:10px}.item-comparison-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:8px}.item-comparison-stat{display:flex;justify-content:space-between;gap:6px;padding:7px 8px;border-radius:9px;background:rgba(255,255,255,.035);font-size:9px}.item-comparison-stat b{font-size:10px}.item-comparison-stat.gain b{color:#65e58a}.item-comparison-stat.loss b{color:#ff7d88}.item-comparison-stat.equal b{color:#9aa6bb}.item-comparison-empty{margin-top:7px;font-size:8px;color:var(--text-muted,#5d6780)}.inventory-card.item-locked{border-color:rgba(101,176,255,.38);box-shadow:inset 0 0 0 1px rgba(101,176,255,.10),0 0 20px rgba(60,125,255,.08)}.inventory-card-status{display:flex;align-items:center;justify-content:flex-end;gap:6px;flex:0 0 auto}.item-lock-button{width:31px;height:31px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.09);border-radius:10px;background:rgba(255,255,255,.04);color:#8390a8;font-size:15px;cursor:pointer}.item-lock-button.active{border-color:rgba(101,176,255,.42);background:rgba(63,130,255,.15);color:#8fc2ff;box-shadow:0 0 14px rgba(63,130,255,.12)}.item-lock-button:disabled{opacity:.38;cursor:not-allowed}.inventory-lock-label{display:inline-flex;align-items:center;gap:4px;margin-top:5px;padding:3px 7px;border-radius:999px;background:rgba(63,130,255,.12);color:#8fc2ff;font-size:8px;font-weight:900}
    .stack-badge{display:inline-grid;place-items:center;min-width:28px;height:24px;padding:0 7px;border-radius:999px;background:rgba(240,196,77,.14);border:1px solid rgba(240,196,77,.24);color:#f0c44d;font-size:10px;font-weight:950}.inventory-copy-count{color:#f0c44d;font-weight:900}
    .rarity-normal{--rarity:#c4cad4}.rarity-common{--rarity:#61d38b}.rarity-uncommon{--rarity:#5ca9ff}.rarity-rare{--rarity:#aa73ff}.rarity-epic{--rarity:#ff8b49}.rarity-legendary{--rarity:#ffd04f}.rarity-mythic{--rarity:#ff5368}.rarity-ultra_mythic{--rarity:#f2a7ff}.rarity-abyssal{--rarity:#20e3ff}.inventory-card[class*="rarity-"],.case-result-card[class*="rarity-"]{border-color:color-mix(in srgb,var(--rarity) 38%,transparent)}.inventory-name,.case-result-rarity{color:var(--rarity,#eef2f7)}
    .odds-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:6px}.odds-row{display:flex;justify-content:space-between;gap:8px;padding:8px 9px;border-radius:10px;background:rgba(255,255,255,.025);font-size:9px}.odds-row b{color:var(--rarity,#eef2f7)}.case-note{font-size:9px;line-height:1.5;color:var(--text-muted,#5d6780);margin-top:9px}.case-list{display:grid;gap:9px}.case-card{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;padding:13px;border-radius:15px;border:1px solid rgba(255,255,255,.055);background:rgba(255,255,255,.025)}.case-card.locked{opacity:.48}.case-crate{font-size:30px}.case-card b{display:block;font-size:12px}.case-card small{display:block;margin-top:3px;font-size:9px;color:var(--text-dim,#a0abc0)}.case-level-picker{padding:13px;border-radius:15px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.06);margin-bottom:10px}.case-level-head{display:flex;justify-content:space-between;gap:10px;align-items:center}.case-level-head b{font-size:12px}.case-level-head strong{color:var(--accent,#f0c44d);font-size:18px}.case-level-picker input{width:100%;margin-top:10px;accent-color:var(--accent,#f0c44d)}.case-level-note{margin-top:7px;font-size:9px;line-height:1.45;color:var(--text-dim,#a0abc0)}.case-type-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.case-type-card{padding:12px;border-radius:14px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.025)}.case-type-card .case-icon{font-size:26px}.case-type-card b{display:block;margin-top:5px;font-size:11px}.case-type-card small{display:block;min-height:38px;margin:4px 0 8px;font-size:8px;line-height:1.4;color:var(--text-dim,#a0abc0)}.case-type-card .case-price{font-size:10px;font-weight:900;color:var(--accent,#f0c44d);margin-bottom:7px}.case-buy-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.case-buy-button{border:0;border-radius:9px;padding:8px 4px;background:var(--accent,#f0c44d);color:#11151d;font-weight:900;font-size:8px}.case-buy-button:disabled{opacity:.35}
    .empty-state{padding:18px 10px;text-align:center;color:var(--text-muted,#5d6780);font-size:10px;line-height:1.5}
    .xp-levelup{display:none;position:fixed;inset:0;z-index:7200;align-items:center;justify-content:center;padding:20px;background:rgba(2,4,8,.9);backdrop-filter:blur(12px)}.xp-levelup.show{display:flex}.xp-levelup-card{width:min(100%,380px);padding:25px 20px;border:1px solid rgba(240,196,77,.35);border-radius:22px;background:radial-gradient(circle at 50% 0,rgba(183,26,40,.25),transparent 55%),#0e1421;text-align:center;box-shadow:0 25px 80px rgba(0,0,0,.55)}.xp-levelup h2{margin:0;color:var(--accent,#f0c44d);font-size:25px}.xp-levelup p{margin:12px 0 0;line-height:1.55}.xp-levelup button{margin-top:18px;border:0;border-radius:12px;padding:11px 18px;background:var(--accent,#f0c44d);color:#11151d;font-weight:900;cursor:pointer}
    .rpg-overlay{display:none;position:fixed;inset:0;z-index:7600;background:radial-gradient(circle at 50% 25%,rgba(150,22,36,.21),transparent 38%),rgba(2,4,8,.97);backdrop-filter:blur(13px);color:#eef2f7;padding:18px}.rpg-overlay.show{display:flex;align-items:center;justify-content:center}.rpg-arena{width:min(100%,410px);text-align:center}.rpg-arena-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;font-size:11px;color:#a0abc0}.rpg-clock{font-size:27px;font-weight:950;color:#f0c44d;font-variant-numeric:tabular-nums}.rpg-monster-name{font-size:17px;font-weight:950}.rpg-hp{height:13px;margin:9px 0 4px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden;border:1px solid rgba(255,255,255,.05)}.rpg-hp span{display:block;height:100%;width:100%;background:linear-gradient(90deg,#b91f35,#f04f5f);transition:width .1s}.rpg-hp-label{font-size:10px;color:#a0abc0}.rpg-enemy-stage{position:relative;min-height:250px;display:grid;place-items:center;margin:6px 0}.rpg-enemy{width:190px;height:190px;border:0;border-radius:50%;background:radial-gradient(circle at 50% 42%,rgba(240,196,77,.16),rgba(180,25,41,.17) 45%,rgba(255,255,255,.02) 70%);font-size:105px;cursor:pointer;touch-action:manipulation;user-select:none;filter:drop-shadow(0 24px 30px rgba(0,0,0,.5));transition:transform .06s}.rpg-enemy:active,.rpg-enemy.hit{transform:scale(.91) rotate(-2deg)}.rpg-damage-pop{position:absolute;left:50%;top:35%;font-size:22px;font-weight:950;color:#ffd35a;pointer-events:none;animation:rpgPop .55s ease-out forwards;text-shadow:0 3px 12px #000}.rpg-damage-pop.crit{color:#ff6f7d;font-size:28px}.ro-hit-burst{position:absolute;z-index:55;left:50%;top:48%;width:190px;height:150px;transform:translate(-50%,-50%);pointer-events:none;display:grid;place-items:center;animation:roBurstLife .78s ease-out forwards}.ro-hit-star{position:absolute;width:118px;height:118px;background:radial-gradient(circle,#ffea6b 0 10%,#ff9b24 24%,#c91f32 52%,rgba(130,12,28,.2) 70%,transparent 72%);clip-path:polygon(50% 0,60% 28%,82% 8%,73% 37%,100% 33%,77% 52%,98% 69%,69% 67%,79% 96%,57% 75%,48% 100%,42% 74%,16% 94%,29% 65%,0 65%,25% 49%,3% 31%,31% 35%,23% 5%,45% 28%);filter:drop-shadow(0 0 14px rgba(255,73,36,.85));animation:roStar .55s cubic-bezier(.2,.9,.25,1.25)}.ro-hit-number{position:relative;z-index:3;font-size:34px;font-weight:1000;letter-spacing:-.06em;color:#ffe34f;-webkit-text-stroke:2px #492000;text-shadow:0 3px 0 #9d280d,0 0 8px #fff6b5,0 8px 14px rgba(0,0,0,.8);animation:roNumber .68s cubic-bezier(.15,.9,.2,1.2)}.ro-hit-critical .ro-hit-number{font-size:45px;color:#fff36a;-webkit-text-stroke:3px #4d1200}.ro-hit-label{position:absolute;z-index:4;top:3px;font-size:15px;font-weight:1000;letter-spacing:.08em;color:#fff;text-shadow:0 2px 0 #8b1424,0 0 10px #ff4b59;animation:roLabel .7s ease-out}.ro-hit-slash{position:absolute;z-index:2;width:145px;height:7px;border-radius:999px;background:linear-gradient(90deg,transparent,#fff 18%,#fff7a8 48%,#d8c9ff 72%,transparent);box-shadow:0 0 8px #fff,0 0 17px rgba(255,238,132,.95);transform-origin:center;animation:roSlash .48s ease-out forwards}.ro-hit-slash.s1{transform:rotate(38deg)}.ro-hit-slash.s2{transform:rotate(-42deg);animation-delay:.04s}.ro-hit-slash.s3{transform:rotate(7deg);animation-delay:.08s}.ro-hit-burst:not(.ro-hit-critical) .ro-hit-label,.ro-hit-burst:not(.ro-hit-critical) .ro-hit-star{display:none}@keyframes roBurstLife{0%{opacity:0}10%{opacity:1}72%{opacity:1}100%{opacity:0;transform:translate(-50%,-72%) scale(.92)}}@keyframes roStar{0%{transform:scale(.25) rotate(-18deg);opacity:0}45%{transform:scale(1.18) rotate(5deg);opacity:1}100%{transform:scale(.92);opacity:.45}}@keyframes roNumber{0%{transform:scale(.35) translateY(20px);opacity:0}35%{transform:scale(1.28) translateY(-5px);opacity:1}100%{transform:scale(1) translateY(-18px);opacity:1}}@keyframes roLabel{0%{transform:scale(.3) translateY(18px);opacity:0}40%{transform:scale(1.22) translateY(0);opacity:1}100%{transform:scale(1) translateY(-14px);opacity:0}}@keyframes roSlash{0%{opacity:0;scale:.15 1}35%{opacity:1;scale:1.2 1}100%{opacity:0;scale:1.55 .25}}.rpg-combat-info{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.rpg-combat-info div{padding:9px;border-radius:11px;background:rgba(255,255,255,.035);font-size:9px;color:#818da6}.rpg-combat-info b{display:block;color:#eef2f7;font-size:14px;margin-bottom:2px}.rpg-ability{width:100%;margin:9px 0 2px;padding:11px 12px;border:1px solid rgba(240,196,77,.32);border-radius:13px;background:linear-gradient(135deg,rgba(240,196,77,.15),rgba(110,168,255,.09));color:#fff;font:900 12px Inter,system-ui,sans-serif;cursor:pointer}.rpg-ability small{display:block;margin-top:3px;color:#aeb9ce;font-size:9px;font-weight:700}.rpg-ability:disabled{opacity:.45;cursor:not-allowed}.rpg-ability.active{border-color:#78d7ff;box-shadow:0 0 0 3px rgba(80,190,255,.12),0 0 25px rgba(80,190,255,.18)}.rpg-ability.used{background:rgba(255,255,255,.035);border-color:rgba(255,255,255,.08)}.reaction-target.ability-focus{width:108px!important;height:108px!important;border-width:3px!important;box-shadow:0 0 0 13px rgba(90,160,255,.18),0 0 48px rgba(90,160,255,.72)!important}.rpg-overlay.time-stopped{background:radial-gradient(circle at 50% 25%,rgba(38,139,190,.22),transparent 42%),rgba(2,4,8,.97)}.rpg-overlay.time-stopped .rpg-clock{color:#7de2ff;text-shadow:0 0 18px rgba(90,210,255,.7)}.reaction-hint{min-height:32px;margin:7px 0 3px;font-size:11px;font-weight:900;color:#dbe4f5}.reaction-live{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:6px 0}.reaction-live div{padding:7px 5px;border-radius:10px;background:rgba(255,255,255,.035);font-size:8px;color:#7f8ba2}.reaction-live b{display:block;font-size:13px;color:#fff;margin-bottom:2px}.reaction-target{position:absolute;z-index:20;width:84px;height:84px;transform:translate(-50%,-50%);border:2px solid rgba(255,255,255,.78);border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle,rgba(255,255,255,.96),rgba(110,168,255,.86) 48%,rgba(26,52,100,.96));color:#07101d;font-size:31px;font-weight:950;box-shadow:0 0 0 9px rgba(90,160,255,.12),0 0 36px rgba(90,160,255,.56);touch-action:none;user-select:none;cursor:pointer;animation:reactionPulse .8s ease-in-out infinite alternate}.reaction-target.hidden{display:none}.reaction-target.combo-tier-1{animation-duration:.72s}.reaction-target.combo-tier-2{animation-duration:.62s}.reaction-target.combo-tier-3{animation-duration:.52s;box-shadow:0 0 0 8px rgba(255,178,70,.12),0 0 38px rgba(255,112,52,.5)}.reaction-target.combo-tier-4{animation-duration:.42s;box-shadow:0 0 0 7px rgba(89,228,255,.14),0 0 42px rgba(97,118,255,.62)}.reaction-target.attack-pattern-storm,.reaction-target.attack-pattern-spiral{border-width:3px}.reaction-target.pattern-0{border-radius:50%}.reaction-target.pattern-1{border-radius:18px;transform:translate(-50%,-50%) rotate(8deg)}.reaction-target.pattern-2{border-radius:50% 18% 50% 18%;transform:translate(-50%,-50%) rotate(-10deg)}.reaction-target.pattern-3{width:72px;height:96px}.reaction-target.pattern-4{width:102px;height:68px;border-radius:22px}.reaction-target.pattern-5{border-style:dashed;box-shadow:0 0 0 13px rgba(90,160,255,.08),0 0 42px rgba(90,160,255,.66)}.reaction-target.type-double{background:radial-gradient(circle,#fff,#b49cff 52%,#5b37b5);box-shadow:0 0 0 7px rgba(160,110,255,.12),0 0 34px rgba(160,110,255,.55)}.reaction-target.type-chain{width:92px;height:92px;background:radial-gradient(circle,#fff,#62d6b0 52%,#157a5d);box-shadow:0 0 0 10px rgba(70,220,160,.14),0 0 40px rgba(70,220,160,.62)}.reaction-target.type-chain.chain-second{width:98px;height:98px;background:radial-gradient(circle,#fff,#78f0c7 44%,#0f8b66 72%);box-shadow:0 0 0 12px rgba(70,230,170,.18),0 0 50px rgba(70,230,170,.78);animation:reactionChainSecond .48s ease-in-out infinite alternate}.reaction-target.type-danger{background:radial-gradient(circle,#fff,#ff6e79 48%,#9f1728);box-shadow:0 0 0 9px rgba(255,55,75,.15),0 0 42px rgba(255,55,75,.68);animation:dangerPulse .28s ease-in-out infinite alternate}.reaction-target.type-golden{width:170px;height:52px;border:0;border-radius:14px;background:transparent;color:#fff;box-shadow:none;font-size:0;animation:reactionLinePulse .8s ease-in-out infinite alternate}.reaction-target.type-golden::before{content:'';display:block;width:148px;height:9px;border-radius:999px;background:linear-gradient(90deg,rgba(255,255,255,.25),#fff 18%,#8edcff 50%,#fff 82%,rgba(255,255,255,.25));box-shadow:0 0 0 8px rgba(120,210,255,.1),0 0 30px rgba(120,210,255,.82)}.reaction-target.type-golden .reaction-small{bottom:-9px;font-size:9px;color:#dff6ff}.reaction-target .reaction-small{position:absolute;bottom:-22px;left:50%;transform:translateX(-50%);white-space:nowrap;font-size:8px;color:#fff;text-shadow:0 2px 8px #000}.reaction-feedback{position:absolute;z-index:30;left:50%;top:24%;transform:translateX(-50%);max-width:94%;white-space:nowrap;font-size:20px;font-weight:950;pointer-events:none;animation:rpgPop .7s ease-out forwards}.reaction-feedback.perfect{color:#ffd454}.reaction-feedback.good{color:#78d7ff}.reaction-feedback.miss{color:#ff6978}.reaction-perfect-burst{position:absolute;z-index:35;left:50%;top:50%;width:70px;height:70px;border-radius:50%;pointer-events:none;transform:translate(-50%,-50%);border:3px solid #ffe36b;box-shadow:0 0 24px #ffd34f,0 0 70px rgba(255,207,58,.8);animation:perfectBurst .72s ease-out forwards}.reaction-perfect-flash{position:absolute;z-index:34;inset:0;pointer-events:none;background:radial-gradient(circle at 50% 50%,rgba(255,239,137,.42),rgba(255,190,38,.1) 42%,transparent 72%);animation:perfectFlash .55s ease-out forwards}.reaction-perfect-streak{color:#ffd454!important;text-shadow:0 0 12px rgba(255,212,84,.55)}.perfect-combat-overlay{position:fixed;z-index:9100;inset:0;display:none;place-items:center;overflow:hidden;background:radial-gradient(circle at 50% 42%,rgba(255,205,52,.26),rgba(116,27,18,.42) 38%,rgba(2,4,9,.96) 75%);padding:20px}.perfect-combat-overlay.show{display:grid;animation:perfectOverlayIn .28s ease-out}.perfect-combat-rays{position:absolute;width:160vmax;height:160vmax;background:repeating-conic-gradient(from 0deg,rgba(255,230,115,.20) 0 7deg,transparent 7deg 17deg);animation:perfectRays 9s linear infinite}.perfect-combat-card{position:relative;z-index:2;width:min(92vw,430px);padding:32px 22px 26px;text-align:center;border-radius:28px;border:2px solid rgba(255,223,102,.75);background:linear-gradient(145deg,rgba(85,25,17,.96),rgba(14,12,18,.98));box-shadow:0 0 28px rgba(255,208,57,.55),0 30px 90px rgba(0,0,0,.7);animation:perfectCardPop .7s cubic-bezier(.17,.89,.32,1.35)}.perfect-combat-crown{font-size:66px;filter:drop-shadow(0 0 18px rgba(255,218,77,.7));animation:perfectCrown 1s ease-in-out infinite alternate}.perfect-combat-title{margin-top:8px;font-size:34px;line-height:1;font-weight:1000;letter-spacing:.07em;color:#ffe66f;text-shadow:0 4px 0 #8d3f13,0 0 28px rgba(255,222,85,.72)}.perfect-combat-sub{margin-top:12px;font-size:12px;line-height:1.55;color:#f2e7c5}.perfect-combat-mult{display:inline-flex;margin-top:15px;padding:10px 18px;border-radius:999px;background:linear-gradient(135deg,#ffcf3d,#fff18a);color:#32190b;font-size:18px;font-weight:1000;box-shadow:0 8px 28px rgba(255,201,42,.32)}.perfect-combat-streak-label{margin-top:10px;font-size:11px;font-weight:900;color:#ffd95b}.perfect-combat-close{width:100%;margin-top:20px;border:0;border-radius:13px;padding:13px;background:#f2c544;color:#211407;font-weight:1000;cursor:pointer}.rpg-enemy,.trial-dummy,.raid-boss-button{pointer-events:none}.rpg-enemy-stage,.trial-stage,.raid-stage{touch-action:manipulation;user-select:none}@keyframes reactionPulse{from{transform:translate(-50%,-50%) scale(.94)}to{transform:translate(-50%,-50%) scale(1.05)}}@keyframes reactionLinePulse{from{transform:translate(-50%,-50%) scaleX(.92);opacity:.78}to{transform:translate(-50%,-50%) scaleX(1.06);opacity:1}}@keyframes dangerPulse{from{transform:translate(-50%,-50%) scale(.9) rotate(-2deg)}to{transform:translate(-50%,-50%) scale(1.08) rotate(2deg)}}@keyframes reactionChainSecond{from{transform:translate(-50%,-50%) scale(.9)}to{transform:translate(-50%,-50%) scale(1.08)}}@keyframes perfectBurst{0%{opacity:1;transform:translate(-50%,-50%) scale(.25)}100%{opacity:0;transform:translate(-50%,-50%) scale(4.3)}}@keyframes perfectFlash{0%{opacity:1}100%{opacity:0}}@keyframes perfectOverlayIn{from{opacity:0}to{opacity:1}}@keyframes perfectRays{to{transform:rotate(360deg)}}@keyframes perfectCardPop{0%{opacity:0;transform:scale(.45) rotate(-4deg)}70%{opacity:1;transform:scale(1.06) rotate(1deg)}100%{transform:scale(1) rotate(0)}}@keyframes perfectCrown{from{transform:translateY(-4px) scale(1)}to{transform:translateY(4px) scale(1.08)}}.rpg-abandon,.rpg-result-close{margin-top:13px;border:1px solid rgba(255,255,255,.08);border-radius:11px;padding:10px 15px;background:#141c2d;color:#eef2f7;font-weight:850;cursor:pointer}.rpg-result{display:none;padding:21px;border:1px solid rgba(240,196,77,.22);border-radius:18px;background:#0e1421}.rpg-result.show{display:block}.rpg-result h2{margin:0;font-size:25px;color:#f0c44d}.rpg-result p{line-height:1.55;color:#a0abc0}.rpg-result strong{color:#eef2f7}
.rpg-boss-skin{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px}.rpg-boss-face{font-size:82px;line-height:1;filter:drop-shadow(0 0 12px rgba(96,170,255,.35))}.rpg-boss-note{font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#8fb8ff}.rpg-boss-note small{display:block;color:#9ea8be;font-size:8px;letter-spacing:.03em;text-transform:none;margin-top:2px}.rpg-enemy.boss-val{background:radial-gradient(circle at 50% 35%,rgba(95,165,255,.28),rgba(180,25,41,.14) 42%,rgba(255,255,255,.02) 72%);border:1px solid rgba(95,165,255,.18)}
    .damage-trial-launch{display:block;width:100%;margin-top:9px;border:1px solid rgba(100,190,255,.22);border-radius:13px;padding:12px 14px;background:linear-gradient(135deg,rgba(32,76,145,.95),rgba(103,40,155,.95));color:#f2f7ff;font-weight:950;font-size:12px;cursor:pointer;box-shadow:0 12px 28px rgba(60,105,210,.18)}.damage-trial-launch:disabled{opacity:.45;cursor:not-allowed}.damage-trial-note{margin-top:7px;font-size:9px;color:#7e8aa4;text-align:center}.damage-trial-note b{color:#8fc9ff}
    .trial-overlay{display:none;position:fixed;inset:0;z-index:7750;padding:18px;color:#eef5ff;background:radial-gradient(circle at 50% 20%,rgba(66,119,255,.22),transparent 34%),radial-gradient(circle at 14% 75%,rgba(181,54,255,.18),transparent 30%),linear-gradient(180deg,#050715,#090d22 56%,#02040b);overflow:hidden}.trial-overlay.show{display:flex;align-items:center;justify-content:center}.trial-overlay:before,.trial-overlay:after{content:'';position:absolute;inset:-20%;pointer-events:none;background-image:radial-gradient(circle,#8ec8ff 0 1px,transparent 1.6px);background-size:34px 34px;opacity:.22;animation:trialStars 12s linear infinite}.trial-overlay:after{background-size:57px 57px;opacity:.12;animation-duration:20s;animation-direction:reverse}.trial-arena{position:relative;z-index:1;width:min(100%,410px);text-align:center}.trial-map-title{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#8fc9ff;font-weight:950}.trial-map-subtitle{margin-top:3px;font-size:22px;font-weight:950}.trial-clock{margin:8px 0 5px;font-size:37px;font-weight:950;color:#f4ce58;font-variant-numeric:tabular-nums}.trial-stage{position:relative;min-height:270px;display:grid;place-items:center;margin:5px 0}.trial-portal{position:absolute;width:250px;height:250px;border-radius:50%;background:conic-gradient(from 0deg,#4e8fff,#9d4dff,#48d7ff,#4e8fff);filter:blur(.2px) drop-shadow(0 0 34px rgba(78,143,255,.35));animation:trialPortal 4s linear infinite}.trial-portal:after{content:'';position:absolute;inset:15px;border-radius:50%;background:radial-gradient(circle,#121934 0 38%,#050817 68%);box-shadow:inset 0 0 45px rgba(100,170,255,.25)}.trial-dummy{position:relative;z-index:2;width:176px;height:176px;border:0;border-radius:50%;background:radial-gradient(circle at 50% 36%,rgba(255,225,100,.24),rgba(37,50,95,.88) 48%,rgba(4,8,20,.95) 72%);font-size:91px;cursor:pointer;touch-action:manipulation;user-select:none;filter:drop-shadow(0 24px 30px rgba(0,0,0,.55));transition:transform .055s}.trial-dummy:active,.trial-dummy.hit{transform:scale(.91) rotate(-2deg)}.trial-map-floor{position:absolute;z-index:1;bottom:8px;width:300px;height:64px;border-radius:50%;background:radial-gradient(ellipse,rgba(91,159,255,.34),rgba(30,38,83,.13) 55%,transparent 72%);transform:perspective(120px) rotateX(55deg)}.trial-info{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.trial-info div{padding:10px 7px;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.04);font-size:9px;color:#8492ae}.trial-info b{display:block;font-size:15px;color:#eef5ff;margin-bottom:2px}.trial-result{display:none;padding:22px;border-radius:20px;border:1px solid rgba(103,170,255,.28);background:rgba(10,16,36,.95);box-shadow:0 30px 90px rgba(0,0,0,.55)}.trial-result.show{display:block}.trial-result h2{margin:0;color:#8fc9ff;font-size:25px}.trial-result p{line-height:1.6;color:#a4afc4}.trial-result strong{color:#fff}.trial-close{margin-top:14px;border:0;border-radius:11px;padding:11px 16px;background:#8fc9ff;color:#07101e;font-weight:950;cursor:pointer}
    .case-overlay{display:none;position:fixed;inset:0;z-index:7900;align-items:center;justify-content:center;padding:20px;background:rgba(2,4,8,.95);backdrop-filter:blur(14px)}.case-overlay.show{display:flex}.case-result-card{width:min(100%,370px);padding:24px 18px;border-radius:22px;background:radial-gradient(circle at 50% 0,color-mix(in srgb,var(--rarity,#f0c44d) 28%,transparent),transparent 55%),#0e1421;border:1px solid color-mix(in srgb,var(--rarity,#f0c44d) 45%,transparent);text-align:center;box-shadow:0 30px 90px rgba(0,0,0,.6);animation:caseReveal .5s cubic-bezier(.2,.9,.2,1)}.case-result-icon{font-size:62px;filter:drop-shadow(0 12px 20px rgba(0,0,0,.45))}.case-result-rarity{margin-top:7px;font-size:11px;font-weight:950;text-transform:uppercase;letter-spacing:.1em}.case-result-card h2{margin:8px 0 0;font-size:20px}.case-result-card p{margin:11px 0 0;color:#a0abc0;font-size:11px;line-height:1.55}.case-result-card button{margin-top:18px;border:0;border-radius:12px;padding:11px 18px;background:var(--rarity,#f0c44d);color:#10141d;font-weight:950;cursor:pointer}
    .case-buy-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:8px}.case-buy-button{border:0;border-radius:10px;padding:8px 4px;background:rgba(240,196,77,.11);border:1px solid rgba(240,196,77,.16);color:#f0c44d;font-size:9px;font-weight:950;cursor:pointer}.case-buy-button strong{display:block;font-size:11px}.case-buy-button:disabled{opacity:.32;cursor:not-allowed}.case-card{grid-template-columns:auto 1fr}.case-card .case-buy-grid{grid-column:1/-1}
    .case-opening-shell{width:min(100%,420px);text-align:center}.case-opening-title{font-size:13px;font-weight:950;letter-spacing:.12em;color:#f0c44d;text-transform:uppercase}.case-opening-subtitle{margin-top:5px;font-size:9px;color:#8792a8}.case-roulette{position:relative;height:190px;margin-top:16px;border-radius:18px;overflow:hidden;background:linear-gradient(180deg,#0b101b,#05070d);border:1px solid rgba(255,255,255,.07);box-shadow:inset 0 0 45px rgba(0,0,0,.7)}.case-roulette::before,.case-roulette::after{content:"";position:absolute;z-index:5;top:0;bottom:0;width:62px;pointer-events:none}.case-roulette::before{left:0;background:linear-gradient(90deg,#05070d,transparent)}.case-roulette::after{right:0;background:linear-gradient(-90deg,#05070d,transparent)}.case-center-marker{position:absolute;z-index:6;top:0;bottom:0;left:50%;width:2px;background:linear-gradient(transparent,#f0c44d 18%,#f0c44d 82%,transparent);box-shadow:0 0 16px rgba(240,196,77,.65)}.case-roll-track{position:absolute;left:0;top:20px;height:150px;display:flex;align-items:center;gap:10px;will-change:transform}.case-roll-tile{flex:0 0 112px;height:138px;border-radius:16px;border:1px solid color-mix(in srgb,var(--rarity,#c4cad4) 42%,transparent);background:radial-gradient(circle at 50% 10%,color-mix(in srgb,var(--rarity,#c4cad4) 23%,transparent),transparent 56%),#101724;display:grid;place-items:center;box-shadow:0 12px 24px rgba(0,0,0,.35)}.sbd-chest{display:flex;flex-direction:column;align-items:center;gap:2px}.sbd-chest span{font-size:55px;filter:drop-shadow(0 10px 13px rgba(0,0,0,.4))}.sbd-chest b{padding:3px 10px;border-radius:999px;background:#080c13;color:var(--rarity,#f0c44d);font-size:12px;letter-spacing:.12em}.case-lock-note{margin-top:12px;font-size:9px;color:#7f8aa0}.case-opening-results{display:none;max-height:70vh;overflow:auto;margin-top:12px;padding:14px;border-radius:18px;background:#0e1421;border:1px solid rgba(255,255,255,.07)}.case-opening-results.show{display:block;animation:caseReveal .45s ease}.case-opening-results h2{margin:0;color:#f0c44d;font-size:22px}.case-opening-results p{font-size:10px;color:#98a3b8}.case-results-grid{display:grid;gap:7px;margin-top:12px;text-align:left}.case-result-row{display:grid;grid-template-columns:auto 1fr auto;gap:9px;align-items:center;padding:9px;border-radius:12px;border:1px solid color-mix(in srgb,var(--rarity,#c4cad4) 30%,transparent);background:rgba(255,255,255,.025)}.case-result-row .result-icon{font-size:24px}.case-result-row b{display:block;font-size:10px;color:var(--rarity,#eef2f7)}.case-result-row small{font-size:8px;color:#7f8aa0}.case-result-row .result-count{font-weight:950;color:#f0c44d}.case-opening-close{display:none;margin-top:14px;border:0;border-radius:12px;padding:11px 18px;background:#f0c44d;color:#10151d;font-weight:950;cursor:pointer}.case-opening-close.ready{display:inline-block}.case-progress-label{margin-top:10px;font-size:10px;color:#aab4c8;font-variant-numeric:tabular-nums}

    .collection-subtabs{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:11px}.collection-subtab{border:1px solid rgba(255,255,255,.055);border-radius:11px;padding:9px;background:rgba(255,255,255,.025);color:var(--text-muted,#5d6780);font-weight:900;font-size:10px;cursor:pointer}.collection-subtab.active{color:#f0c44d;border-color:rgba(240,196,77,.24);background:rgba(240,196,77,.07)}
    .collection-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:10px}.collection-summary div{padding:10px 6px;border-radius:12px;background:rgba(255,255,255,.03);text-align:center}.collection-summary b{display:block;font-size:15px;color:#f0c44d}.collection-summary span{font-size:8px;color:#68748c;text-transform:uppercase}
    .bestiary-tools{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:10px 0}.bestiary-tools input,.bestiary-tools select{min-width:0;width:100%;border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:9px;background:#0c111c;color:#eef2f7;font-size:9px}.bestiary-tools input{grid-column:1/-1}.bestiary-filter-count{grid-column:1/-1;font-size:8px;color:#7e8aa2}.monster-category{margin-top:4px;font-size:7px;color:#667085;line-height:1.25}.monster-discovery-date{margin-top:4px;font-size:7px;color:#8b96ad}    .bestiary-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.monster-card{position:relative;min-height:155px;padding:12px 9px;border-radius:16px;border:1px solid rgba(255,255,255,.055);background:radial-gradient(circle at 50% 0,color-mix(in srgb,var(--monster-color,#667085) 18%,transparent),transparent 55%),rgba(255,255,255,.022);text-align:center;overflow:hidden}.monster-card.undiscovered{filter:saturate(.25);opacity:.62}.monster-card.hidden-monster{filter:none;opacity:1}.monster-icon{font-size:45px;line-height:1.1;min-height:52px;display:grid;place-items:center}.monster-icon img{max-width:100%;max-height:72px;object-fit:contain;filter:drop-shadow(0 6px 10px rgba(0,0,0,.35))}.monster-icon .monster-emoji-fallback{display:grid;place-items:center}.monster-sprite-host.sprite-missing .monster-emoji-fallback{display:grid}.monster-sprite-host:not(.sprite-missing) .monster-emoji-fallback.with-image{display:none}.monster-name{margin-top:6px;font-size:10px;font-weight:950;line-height:1.25}.monster-meta{margin-top:5px;font-size:8px;color:#7e8aa2}.monster-bonus{margin-top:7px;font-size:9px;color:#f0c44d;font-weight:850}.monster-kills{position:absolute;right:7px;top:7px;padding:3px 6px;border-radius:999px;background:rgba(0,0,0,.35);font-size:8px}.rarity-secret{--rarity:#fff}.monster-card.rarity-secret,.codex-card.rarity-secret{background:linear-gradient(120deg,rgba(255,60,80,.13),rgba(255,210,60,.13),rgba(60,255,130,.13),rgba(60,160,255,.13),rgba(190,80,255,.13));animation:rainbowPulse 3s linear infinite}
    .deposited-list{display:grid;gap:8px;margin-bottom:12px}.deposited-row{--deposit-color:var(--rarity,#eef2f7);display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:start;padding:11px;border-radius:13px;border:1px solid color-mix(in srgb,var(--deposit-color) 38%,transparent);background:linear-gradient(135deg,color-mix(in srgb,var(--deposit-color) 10%,transparent),rgba(255,255,255,.018))}.deposited-icon{font-size:27px}.deposited-copy b{display:block;color:var(--deposit-color);font-size:11px;line-height:1.3}.deposited-copy span{display:block;margin-top:4px;color:#8d98ad;font-size:8px;line-height:1.45}.deposited-copy strong{color:#eef2f7}.codex-card .card-probability{margin-top:4px;font-size:7px;color:#f0c44d}.codex-card .card-date{margin-top:3px;font-size:7px;color:#8d98ad}
    .codex-groups{display:grid;gap:10px}.codex-group{border:1px solid rgba(255,255,255,.05);border-radius:15px;background:rgba(255,255,255,.015);overflow:hidden}.codex-group summary{cursor:pointer;padding:11px 12px;font-size:11px;font-weight:950;color:var(--rarity,#eef2f7);list-style:none}.codex-group summary::-webkit-details-marker{display:none}.codex-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;padding:0 9px 10px}.codex-card{position:relative;min-height:128px;padding:9px 6px;border-radius:13px;border:1px solid color-mix(in srgb,var(--rarity,#778) 35%,transparent);background:radial-gradient(circle at 50% 0,color-mix(in srgb,var(--rarity,#778) 17%,transparent),transparent 60%),rgba(255,255,255,.02);text-align:center}.codex-card.missing{filter:grayscale(.85);opacity:.47}.codex-card .card-icon{font-size:34px}.codex-card .card-name{font-size:8px;font-weight:900;line-height:1.25;margin-top:5px}.codex-card .card-status{font-size:7px;margin-top:5px;color:#77839a}.codex-tooltip{visibility:hidden;opacity:0;position:absolute;z-index:20;left:50%;bottom:calc(100% + 5px);transform:translateX(-50%);width:180px;padding:9px;border-radius:10px;background:#111827;border:1px solid rgba(255,255,255,.1);font-size:8px;line-height:1.45;color:#dbe2ef;box-shadow:0 15px 35px rgba(0,0,0,.5);transition:.15s}.codex-card:hover .codex-tooltip,.codex-card:focus .codex-tooltip{visibility:visible;opacity:1}.inventory-actions{gap:6px;flex-wrap:wrap}.inventory-actions .sell-button,.inventory-actions .deposit-button{border:0;border-radius:9px;padding:8px 9px;font-size:9px;font-weight:900;cursor:pointer}.sell-button{background:rgba(240,196,77,.12);color:#f0c44d}.deposit-button{background:rgba(95,165,255,.13);color:#8fb8ff}.sell-button:disabled,.deposit-button:disabled{opacity:.35;cursor:not-allowed}.inventory-bulk-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:9px 0 11px}.inventory-bulk-actions button{border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:11px 8px;font:900 10px Inter,system-ui,sans-serif;cursor:pointer}.inventory-bulk-actions .deposit-all-button{background:rgba(95,165,255,.13);color:#91bdff}.inventory-bulk-actions .sell-all-button{background:rgba(240,196,77,.12);color:#f0c44d}.inventory-bulk-actions button:disabled{opacity:.35;cursor:not-allowed}.inventory-bulk-note{grid-column:1/-1;margin-top:-2px;font-size:8px;line-height:1.45;color:#68758e;text-align:center}
    @keyframes trialStars{to{transform:translate3d(34px,34px,0)}}@keyframes trialPortal{to{transform:rotate(360deg)}}
    @keyframes rainbowPulse{0%{box-shadow:inset 0 0 18px rgba(255,70,70,.12)}33%{box-shadow:inset 0 0 18px rgba(70,255,150,.12)}66%{box-shadow:inset 0 0 18px rgba(100,100,255,.15)}100%{box-shadow:inset 0 0 18px rgba(255,70,70,.12)}}
    @keyframes rpgPop{0%{opacity:0;transform:translate(-50%,10px) scale(.7)}25%{opacity:1}100%{opacity:0;transform:translate(-50%,-70px) scale(1.2)}}@keyframes caseReveal{0%{opacity:0;transform:scale(.65) rotate(-4deg)}70%{transform:scale(1.04) rotate(1deg)}100%{opacity:1;transform:scale(1)}}

    .item-passive{grid-column:1/-1;padding:7px 8px;border-radius:9px;background:rgba(139,92,246,.10);border:1px solid rgba(139,92,246,.18);color:#c7b8ff!important;font-size:8px!important;line-height:1.4}.sale-preview{color:#f0c44d!important;font-weight:900}.inventory-toolbar{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:10px}.inventory-toolbar label{display:grid;gap:4px;font-size:8px;color:#8490a7;text-transform:uppercase;letter-spacing:.05em}.inventory-toolbar select{width:100%;border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:9px 8px;background:#101724;color:#eaf0f8;font:800 9px Inter,system-ui}.inventory-toolbar .wide{grid-column:1/-1}.inventory-empty-filter{padding:20px;text-align:center;color:#7f8ba2;font-size:10px}.item-level-badge{display:inline-flex;align-items:center;padding:3px 7px;border-radius:999px;background:rgba(95,165,255,.12);color:#8fb8ff;font-size:8px;font-weight:900}.damage-pct{color:#ff8f68!important;font-weight:900}.item-type-label{color:#aab4c8}.case-roll-tile.target-tile{box-shadow:0 0 0 2px var(--rarity,#f0c44d),0 0 32px color-mix(in srgb,var(--rarity,#f0c44d) 55%,transparent)}.sbd-chest-art{position:relative;width:72px;height:58px;margin-bottom:8px;filter:drop-shadow(0 12px 14px rgba(0,0,0,.42))}.sbd-chest-lid{position:absolute;left:5px;right:5px;top:2px;height:23px;border:3px solid #161a20;border-radius:13px 13px 6px 6px;background:linear-gradient(180deg,color-mix(in srgb,var(--rarity,#c4cad4) 88%,white),var(--rarity,#c4cad4))}.sbd-chest-body{position:absolute;left:2px;right:2px;bottom:0;height:39px;border:3px solid #161a20;border-radius:7px 7px 11px 11px;background:linear-gradient(135deg,color-mix(in srgb,var(--rarity,#c4cad4) 82%,white),color-mix(in srgb,var(--rarity,#c4cad4) 68%,black))}.sbd-chest-band{position:absolute;z-index:2;left:31px;top:6px;bottom:4px;width:10px;border:2px solid #141820;border-radius:3px;background:#f1c84e}.sbd-chest-lock{position:absolute;z-index:3;left:27px;top:28px;width:18px;height:16px;border:2px solid #11151c;border-radius:4px;background:#f5d563;color:#151922;font-size:7px;font-weight:950;display:grid;place-items:center}.case-target-caption{position:absolute;left:50%;bottom:5px;transform:translateX(-50%);font-size:7px;color:var(--rarity,#fff);font-weight:900;white-space:nowrap;max-width:100px;overflow:hidden;text-overflow:ellipsis}.combat-loot-line{display:block;margin-top:9px;padding:10px 10px 10px 14px;border:1px solid var(--loot-color,var(--rarity,#f0c44d));border-radius:10px;background:linear-gradient(90deg,rgba(255,255,255,.07),rgba(255,255,255,.035));box-shadow:inset 6px 0 0 var(--loot-color,var(--rarity,#f0c44d)),0 0 16px rgba(0,0,0,.28);color:#eaf0f8}.combat-loot-line .loot-rarity{color:var(--loot-color,var(--rarity,#f0c44d));font-weight:950}.combat-loot-line strong:first-child{color:var(--loot-color,var(--rarity,#f0c44d))}
    
.encounter-odds-box{margin-top:12px;padding:14px;border-radius:18px;background:linear-gradient(145deg,rgba(255,255,255,.04),rgba(255,255,255,.02));border:1px solid rgba(255,255,255,.065)}
    .encounter-odds-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px}
    .encounter-odds-head b{font-size:12px}.encounter-odds-head span{font-size:9px;color:#9babc4}
    .encounter-odds-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
    .encounter-odds-card{padding:10px 8px;border-radius:14px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.055);text-align:center}
    .encounter-odds-card strong{display:block;font-size:10px}.encounter-odds-card b{display:block;margin-top:6px;font-size:16px;color:#fff}.encounter-odds-card small{display:block;margin-top:4px;font-size:8px;color:#99abc5;line-height:1.35}
    .encounter-odds-card.rarity-normal{box-shadow:inset 0 0 0 1px rgba(196,202,212,.14)}.encounter-odds-card.rarity-common{box-shadow:inset 0 0 0 1px rgba(97,211,139,.15)}.encounter-odds-card.rarity-uncommon{box-shadow:inset 0 0 0 1px rgba(92,169,255,.15)}.encounter-odds-card.rarity-rare{box-shadow:inset 0 0 0 1px rgba(170,115,255,.17)}.encounter-odds-card.rarity-epic{box-shadow:inset 0 0 0 1px rgba(255,139,73,.18)}.encounter-odds-card.rarity-legendary{box-shadow:inset 0 0 0 1px rgba(255,208,79,.18)}.encounter-odds-card.rarity-mythic{box-shadow:inset 0 0 0 1px rgba(255,83,104,.18)}.encounter-odds-card.rarity-abyssal{box-shadow:inset 0 0 0 1px rgba(32,227,255,.18)}
    .encounter-odds-note{margin-top:9px;font-size:9px;line-height:1.5;color:#9eb0c9}
    .special-encounter-grid{display:grid;gap:7px;margin-top:10px}
    .special-encounter-card{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:9px;padding:10px 11px;border-radius:14px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.06)}
    .special-encounter-card>span{font-size:24px}.special-encounter-card strong{display:block;font-size:11px}.special-encounter-card small{display:block;margin-top:2px;font-size:8px;color:#95a6c0}.special-encounter-card>b{font-size:14px;color:#fff}
    .special-val{box-shadow:inset 0 0 0 1px rgba(255,208,79,.16)}.special-noah{box-shadow:inset 0 0 0 1px rgba(255,83,104,.16)}.special-hanzalone{box-shadow:inset 0 0 0 1px rgba(32,227,255,.18)}
    .rpg-monster-sprite{position:relative;display:grid;place-items:center;width:100%;height:100%}.rpg-monster-sprite .monster-sprite-img{position:relative;z-index:2;width:auto;height:auto;max-width:94%;max-height:94%;object-fit:contain;filter:drop-shadow(0 12px 22px rgba(0,0,0,.42))}.rpg-monster-sprite .monster-emoji-fallback{position:relative;z-index:2}.rpg-monster-sprite:not(.sprite-missing) .monster-emoji-fallback.with-image{display:none}
    .rpg-monster-sprite .monster-aura-back{position:absolute;inset:10%;border-radius:50%;background:radial-gradient(circle,var(--monster-aura,rgba(255,255,255,.12)),transparent 68%);filter:blur(6px);opacity:.95;animation:monsterAuraPulse 1.5s ease-in-out infinite alternate}
    .rpg-monster-sprite .monster-core{position:relative;z-index:2;width:100%;height:100%;display:grid;place-items:center;font-size:100px;line-height:1;filter:drop-shadow(0 10px 18px rgba(0,0,0,.48))}
    .rpg-monster-sprite .monster-ornament{position:absolute;z-index:3;top:12px;right:24px;font-size:24px;text-shadow:0 0 14px rgba(0,0,0,.55)}
    .rpg-monster-sprite .monster-eyes{position:absolute;z-index:3;top:72px;font-size:18px;letter-spacing:10px;color:var(--monster-color,#fff);text-shadow:0 0 12px var(--monster-color,#fff),0 0 22px rgba(0,0,0,.65)}
    .rpg-monster-sprite.rarity-epic .monster-core{transform:scale(1.02) rotate(-2deg)}
    .rpg-monster-sprite.rarity-legendary .monster-core{transform:scale(1.08)}
    .rpg-monster-sprite.rarity-mythic .monster-core{transform:scale(1.11);filter:drop-shadow(0 12px 24px rgba(255,83,104,.3))}
    .rpg-monster-sprite.rarity-abyssal .monster-core{transform:scale(1.16);filter:drop-shadow(0 12px 28px rgba(32,227,255,.34)) hue-rotate(12deg)}
    .inventory-card{padding:15px;border-radius:18px}
.inventory-name{font-size:14px;line-height:1.25;color:#f5d466}
.inventory-meta{font-size:10px;line-height:1.45}
.item-card-details{margin-top:10px;display:grid;gap:8px}
.item-section-label{font-size:9px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#91a2bf}
.item-pill-row{display:flex;flex-wrap:wrap;gap:6px}
.item-pill{display:inline-flex;align-items:center;gap:4px;padding:7px 10px;border-radius:999px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.06);font-size:9px;line-height:1.2;color:#cfd8ea}
.item-pill b{color:#f0c44d;font-size:9px}
.item-pill-level b,.item-pill-quality b,.item-pill-qualityPct b,.item-pill-damage b,.item-pill-sale b{color:#fff}
.item-pill-set{background:rgba(92,169,255,.12);border-color:rgba(92,169,255,.22)}
.item-pill-license{background:rgba(240,196,77,.12);border-color:rgba(240,196,77,.2)}
.item-stat-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.item-stat-chip{padding:10px 11px;border-radius:14px;background:linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.02));border:1px solid rgba(255,255,255,.065)}
.item-stat-chip small{display:block;font-size:8px;letter-spacing:.08em;text-transform:uppercase;color:#94a5bf}
.item-stat-chip strong{display:block;margin-top:4px;font-size:14px;color:#eef2f7}
.item-stat-chip.stat-damage{background:linear-gradient(145deg,rgba(255,110,88,.18),rgba(255,255,255,.02));border-color:rgba(255,110,88,.25)}
.item-stat-chip.stat-damage strong{color:#ff9c78}
.item-stat-chip.stat-power{background:linear-gradient(145deg,rgba(92,169,255,.16),rgba(255,255,255,.02));border-color:rgba(92,169,255,.23)}
.item-stat-chip.stat-power strong{color:#8fc2ff}
.item-stat-chip.stat-mastery{background:linear-gradient(145deg,rgba(240,196,77,.16),rgba(255,255,255,.02));border-color:rgba(240,196,77,.23)}
.item-stat-chip.stat-mastery strong{color:#ffd978}
.item-stat-chip.stat-fortune{background:linear-gradient(145deg,rgba(132,233,179,.16),rgba(255,255,255,.02));border-color:rgba(132,233,179,.22)}
.item-stat-chip.stat-fortune strong{color:#9af0bf}
.item-passive-banner{padding:9px 12px;border-radius:13px;background:linear-gradient(135deg,rgba(108,81,255,.16),rgba(255,255,255,.03));border:1px solid rgba(154,130,255,.22);font-size:10px;line-height:1.45;color:#efe8ff}
.monster-name-rarity{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;background:rgba(255,255,255,.07);font-size:10px;line-height:1;margin-bottom:7px}
.monster-name-main{display:block;font-size:20px;font-weight:950;letter-spacing:.01em;text-shadow:0 0 18px rgba(0,0,0,.55)}
.rpg-enemy{position:relative;overflow:visible;box-shadow:0 0 0 1px rgba(255,255,255,.05),0 0 0 14px rgba(255,255,255,.03),0 0 44px var(--monster-aura,rgba(240,196,77,.16))}
.rpg-enemy::before{content:'';position:absolute;inset:-18px;border-radius:50%;background:radial-gradient(circle,var(--monster-aura,rgba(240,196,77,.16)),transparent 68%);z-index:-1;animation:monsterAuraPulse 1.6s ease-in-out infinite alternate}
.rpg-enemy.rarity-uncommon{transform:scale(1.02)}
.rpg-enemy.rarity-rare{box-shadow:0 0 0 1px rgba(255,255,255,.05),0 0 0 15px rgba(170,115,255,.09),0 0 54px rgba(170,115,255,.48)}
.rpg-enemy.rarity-ultra_mythic{box-shadow:0 0 0 1px rgba(255,255,255,.06),0 0 0 18px rgba(221,112,255,.11),0 0 66px rgba(221,112,255,.66)}
.rpg-enemy.rarity-epic{box-shadow:0 0 0 1px rgba(255,255,255,.05),0 0 0 15px rgba(255,139,73,.08),0 0 52px rgba(255,139,73,.4)}
.rpg-enemy.rarity-legendary{box-shadow:0 0 0 1px rgba(255,255,255,.05),0 0 0 16px rgba(255,208,79,.08),0 0 56px rgba(255,208,79,.48)}
.rpg-enemy.rarity-mythic{box-shadow:0 0 0 1px rgba(255,255,255,.05),0 0 0 17px rgba(255,83,104,.09),0 0 60px rgba(255,83,104,.58)}
.rpg-enemy.rarity-abyssal{box-shadow:0 0 0 1px rgba(255,255,255,.05),0 0 0 18px rgba(32,227,255,.1),0 0 68px rgba(32,227,255,.68);filter:drop-shadow(0 24px 30px rgba(0,0,0,.55)) hue-rotate(10deg) saturate(1.14)}
.monster-intro-overlay{position:fixed;inset:0;display:none;place-items:center;pointer-events:auto;z-index:16000;background:radial-gradient(circle at 50% 42%,rgba(255,255,255,.06),rgba(2,4,8,.9) 70%)}
.monster-intro-overlay.show{display:grid;animation:monsterIntroFade 3s ease-out forwards}
.monster-intro-card{width:min(88vw,380px);padding:24px 20px;border-radius:26px;border:1px solid rgba(255,255,255,.1);background:linear-gradient(145deg,rgba(11,15,28,.97),rgba(20,10,24,.96));text-align:center;box-shadow:0 24px 70px rgba(0,0,0,.52)}
.monster-intro-kicker{font-size:10px;font-weight:1000;letter-spacing:.26em;text-transform:uppercase;color:#d7deef}
.monster-intro-rarity{margin-top:10px;font-size:24px;font-weight:1000}
.monster-intro-name{margin-top:8px;font-size:30px;font-weight:1000;line-height:1.05;text-shadow:0 0 18px rgba(0,0,0,.55)}
.monster-intro-menace{margin-top:9px;font-size:11px;color:#9db0cd}
.monster-intro-countdown{margin-top:15px;font-size:13px;font-weight:1000;letter-spacing:.08em;color:#fff;text-transform:uppercase}
.monster-intro-overlay.rarity-uncommon .monster-intro-rarity{color:#5ca9ff}
.monster-intro-overlay.rarity-rare .monster-intro-rarity{color:#aa73ff}
.monster-intro-overlay.rarity-ultra_mythic .monster-intro-rarity{color:#f3a6ff}
.monster-intro-overlay.rarity-epic .monster-intro-rarity{color:#ff8b49}
.monster-intro-overlay.rarity-legendary .monster-intro-rarity{color:#ffd04f}
.monster-intro-overlay.rarity-mythic .monster-intro-rarity{color:#ff5368}
.monster-intro-overlay.rarity-abyssal .monster-intro-rarity{color:#20e3ff}
@keyframes monsterAuraPulse{from{transform:scale(.96);opacity:.72}to{transform:scale(1.08);opacity:1}}
@keyframes monsterIntroFade{0%{opacity:0}8%{opacity:1}80%{opacity:1}100%{opacity:0}}

    .drop-combo-badge{position:absolute;right:4px;bottom:4px;z-index:8;pointer-events:none;min-width:82px;padding:7px 9px;border:1px solid rgba(255,255,255,.16);border-radius:13px;background:linear-gradient(145deg,rgba(20,24,34,.94),rgba(7,9,14,.92));box-shadow:0 8px 24px rgba(0,0,0,.42);text-align:right;transform-origin:100% 100%;animation:dropComboIdle 2.2s ease-in-out infinite}.drop-combo-badge span,.drop-combo-badge small{display:block;font-size:7px;line-height:1.05;font-weight:950;letter-spacing:.08em;text-transform:uppercase;color:#9aa3b2}.drop-combo-badge b{display:block;margin:2px 0;font-size:19px;line-height:1;font-weight:1000;color:#c1c6d0;text-shadow:0 0 10px currentColor}.drop-combo-badge.combo-enter{animation:dropComboPop .65s cubic-bezier(.18,.9,.28,1.35),dropComboIdle 2.2s .65s ease-in-out infinite}.drop-combo-badge.tier-gray{--combo-glow:rgba(170,177,190,.22)}.drop-combo-badge.tier-green{border-color:rgba(81,220,125,.48);--combo-glow:rgba(62,224,119,.38)}.drop-combo-badge.tier-green b{color:#66ec94}.drop-combo-badge.tier-blue{border-color:rgba(76,166,255,.52);--combo-glow:rgba(64,155,255,.44)}.drop-combo-badge.tier-blue b{color:#67b8ff}.drop-combo-badge.tier-purple{border-color:rgba(173,107,255,.58);--combo-glow:rgba(166,88,255,.48)}.drop-combo-badge.tier-purple b{color:#c18aff}.drop-combo-badge.tier-red{border-color:rgba(255,80,96,.62);--combo-glow:rgba(255,55,76,.52)}.drop-combo-badge.tier-red b{color:#ff6472}.drop-combo-badge.tier-gold{border-color:rgba(255,207,66,.7);--combo-glow:rgba(255,190,42,.55)}.drop-combo-badge.tier-gold b{color:#ffe36a}.drop-combo-badge.tier-ultra{border-color:rgba(212,132,255,.75);background:linear-gradient(135deg,rgba(48,18,66,.94),rgba(9,33,65,.94));--combo-glow:rgba(135,105,255,.65)}.drop-combo-badge.tier-ultra b{color:#fff;background:linear-gradient(90deg,#79e8ff,#d78cff,#ff8fc7);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}.drop-combo-badge.tier-abyssal{border-color:rgba(83,237,255,.82);background:radial-gradient(circle at 25% 20%,rgba(45,192,224,.22),transparent 50%),linear-gradient(145deg,rgba(3,20,29,.97),rgba(1,5,10,.98));--combo-glow:rgba(43,223,255,.75)}.drop-combo-badge.tier-abyssal b{color:#8ef5ff;text-shadow:0 0 10px #53eaff,0 0 22px #1aa8ff}.drop-combo-badge.tier-abyssal::before{content:'';position:absolute;inset:-2px;border-radius:14px;border:1px solid rgba(120,246,255,.42);animation:dropComboAbyss 1.1s ease-in-out infinite alternate}.reaction-target{z-index:20}.drop-combo-badge{box-shadow:0 8px 24px rgba(0,0,0,.42),0 0 22px var(--combo-glow,rgba(160,170,190,.2))}@keyframes dropComboIdle{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-2px) scale(1.025)}}@keyframes dropComboPop{0%{opacity:0;transform:translateY(12px) scale(.55) rotate(5deg)}65%{opacity:1;transform:translateY(-3px) scale(1.12) rotate(-1deg)}100%{transform:translateY(0) scale(1)}}@keyframes dropComboAbyss{from{opacity:.35;box-shadow:0 0 5px rgba(70,220,255,.25)}to{opacity:1;box-shadow:0 0 22px rgba(70,220,255,.7)}}
    @media(max-width:390px){.xp-chip{padding:5px 7px;font-size:9px}.xp-stats{grid-template-columns:1fr}.rpg-statline{grid-template-columns:1fr}.rpg-influence-grid{grid-template-columns:1fr}.rpg-statbox b{font-size:16px}.xp-panel{top:52px}.rpg-enemy{width:165px;height:165px;font-size:90px}.rpg-enemy-stage{min-height:220px}.equipment-slots{grid-template-columns:1fr}.odds-grid{grid-template-columns:1fr}.bestiary-grid{grid-template-columns:1fr}.codex-grid{grid-template-columns:repeat(2,1fr)}.item-stat-grid{grid-template-columns:1fr}.inventory-actions{flex-wrap:wrap;gap:6px}.inventory-actions button{flex:1 1 31%}.encounter-odds-grid{grid-template-columns:1fr 1fr}}
  `;
  const style = document.createElement('style');
  style.textContent = css;

  style.textContent += `
    .raid-card{margin-top:12px;padding:15px;border-radius:18px;border:1px solid rgba(137,88,255,.28);background:radial-gradient(circle at 50% 0,rgba(105,61,255,.22),transparent 58%),linear-gradient(145deg,rgba(255,255,255,.035),rgba(255,255,255,.012));box-shadow:0 18px 40px rgba(14,8,40,.3)}
    .raid-card-head{display:flex;align-items:center;gap:10px}.raid-card-icon{font-size:34px}.raid-card-copy{min-width:0;flex:1}.raid-card-copy b{display:block;font-size:13px}.raid-card-copy span{display:block;margin-top:3px;font-size:9px;color:#a8a0c8}.raid-status{padding:5px 8px;border-radius:999px;font-size:8px;font-weight:950;background:rgba(143,105,255,.15);color:#c9b8ff}.raid-countdown{margin-top:11px;text-align:center;font-size:24px;font-weight:950;color:#c9b8ff;letter-spacing:.04em}.raid-meta-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:7px;margin-top:10px}.raid-meta-grid div{padding:9px;border-radius:11px;background:rgba(255,255,255,.035);text-align:center}.raid-meta-grid b{display:block;font-size:12px}.raid-meta-grid span{display:block;margin-top:3px;font-size:7px;color:#8580a0;text-transform:uppercase}.raid-message{margin-top:10px;font-size:9px;line-height:1.5;color:#b6afca}.raid-action{width:100%;margin-top:10px;border:1px solid rgba(177,143,255,.35);border-radius:12px;padding:12px;background:linear-gradient(135deg,rgba(98,54,230,.42),rgba(207,43,61,.24));color:#fff;font-weight:950;cursor:pointer}.raid-action:disabled{opacity:.45;cursor:not-allowed}.raid-roster{display:grid;gap:5px;margin-top:10px}.raid-roster-row{display:grid;grid-template-columns:1fr auto;gap:8px;padding:7px 9px;border-radius:9px;background:rgba(255,255,255,.025);font-size:8px}.raid-roster-row strong{color:#eee}.raid-roster-row span{color:#a6a0b8}.raid-case-card{padding:13px;border-radius:15px;border:1px solid rgba(157,108,255,.25);background:radial-gradient(circle at 20% 0,rgba(113,65,255,.22),transparent 55%),rgba(255,255,255,.025)}.raid-case-head{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:9px}.raid-case-head b{display:block;font-size:11px}.raid-case-head small{display:block;margin-top:3px;color:#9c95b1;font-size:8px}.raid-case-head>strong{font-size:22px;color:#c9b8ff}.raid-case-icon{font-size:26px}.raid-case-rates{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin:10px 0;font-size:8px;color:#bdb5d1}.raid-overlay{display:none;position:fixed;z-index:650;inset:0;background:radial-gradient(circle at 50% 30%,rgba(85,48,190,.35),rgba(3,5,12,.97) 62%);padding:18px;overflow:auto}.raid-overlay.show{display:grid;place-items:center}.raid-arena{width:min(100%,430px);padding:18px;border-radius:24px;border:1px solid rgba(170,133,255,.25);background:#080b15;box-shadow:0 30px 80px rgba(0,0,0,.65)}.raid-arena-head{display:flex;justify-content:space-between;align-items:center}.raid-arena-title{font-size:12px;font-weight:950;color:#c9b8ff}.raid-clock{font-size:24px;font-weight:950;color:#fff}.raid-boss-name{text-align:center;margin-top:9px;font-size:15px;font-weight:950}.raid-infinite{text-align:center;margin-top:4px;font-size:10px;color:#9c95b1}.raid-stage{position:relative;min-height:250px;margin-top:10px;border-radius:20px;display:grid;place-items:center;overflow:hidden;background:radial-gradient(circle at 50% 50%,rgba(111,64,242,.24),transparent 45%),linear-gradient(180deg,#11162a,#070912)}.raid-stage:before{content:"";position:absolute;inset:-40%;background:repeating-conic-gradient(from 0deg,rgba(150,110,255,.1) 0 8deg,transparent 8deg 20deg);animation:raidSpin 12s linear infinite}.raid-boss-button{position:relative;z-index:2;width:170px;height:170px;border:0;border-radius:50%;background:radial-gradient(circle,rgba(148,99,255,.35),rgba(18,13,38,.9) 60%);font-size:92px;cursor:pointer;filter:drop-shadow(0 0 25px rgba(141,88,255,.42))}.raid-boss-button.hit{transform:scale(.94)}.raid-info{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:10px}.raid-info div{padding:9px;border-radius:11px;background:rgba(255,255,255,.035);text-align:center}.raid-info b{display:block;font-size:13px}.raid-info span{font-size:7px;color:#8f89a2;text-transform:uppercase}.raid-result{display:none;text-align:center}.raid-result.show{display:block}.raid-result h2{color:#c9b8ff}.raid-result p{font-size:10px;line-height:1.6;color:#c8c3d4}.raid-close{width:100%;border:0;border-radius:12px;padding:12px;background:#c9b8ff;color:#111522;font-weight:950}.raid-key-overlay{display:none;position:fixed;z-index:720;inset:0;background:rgba(2,4,10,.88);padding:20px}.raid-key-overlay.show{display:grid;place-items:center}.raid-key-card{max-width:390px;padding:24px;border-radius:24px;text-align:center;border:1px solid rgba(240,196,77,.35);background:radial-gradient(circle at 50% 0,rgba(240,196,77,.16),transparent 55%),#0a0d16;box-shadow:0 30px 80px rgba(0,0,0,.6)}.raid-key-icon{font-size:62px}.raid-key-card h2{color:#f0c44d}.raid-key-card p{font-size:13px;line-height:1.6}.raid-key-card button{border:0;border-radius:12px;padding:12px 16px;background:#f0c44d;color:#171a22;font-weight:950}.rpg-damage-pop.raid-pop{color:#d6c4ff}
    @keyframes raidSpin{to{transform:rotate(360deg)}}
  `;
  style.textContent += `
    .inventory-actions .gift-button{border:0;border-radius:9px;padding:8px 9px;font-size:9px;font-weight:900;cursor:pointer;background:rgba(171,104,255,.14);color:#c9a8ff}.inventory-actions .gift-button:disabled{opacity:.35;cursor:not-allowed}
    .item-transfer-overlay{position:fixed;z-index:1200;inset:0;display:grid;place-items:center;padding:18px;background:rgba(2,4,10,.82);backdrop-filter:blur(6px)}.item-transfer-card{width:min(100%,390px);padding:18px;border-radius:22px;border:1px solid rgba(184,126,255,.28);background:linear-gradient(145deg,#111526,#0a0d17);box-shadow:0 30px 80px rgba(0,0,0,.62)}.item-transfer-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.item-transfer-head h3{margin:0;font-size:16px;color:#d4b7ff}.item-transfer-close{width:34px;height:34px;border:1px solid rgba(255,255,255,.08);border-radius:10px;background:rgba(255,255,255,.04);color:#fff;font-size:19px;cursor:pointer}.item-transfer-object{margin-top:12px;padding:12px;border-radius:14px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.06)}.item-transfer-object strong{display:block;font-size:12px}.item-transfer-object span{display:block;margin-top:4px;font-size:9px;color:#939eb4}.item-transfer-form{display:grid;gap:11px;margin-top:13px}.item-transfer-form label{display:grid;gap:6px;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.04em;color:#8f9bb3}.item-transfer-form select,.item-transfer-form input{width:100%;border:1px solid rgba(255,255,255,.1);border-radius:11px;padding:11px 12px;background:#171c2d;color:#fff;font:800 11px Inter,system-ui,sans-serif;outline:none}.item-transfer-form select:focus,.item-transfer-form input:focus{border-color:rgba(184,126,255,.62)}.item-transfer-note{font-size:9px;line-height:1.5;color:#8f9bb3}.item-transfer-actions{display:grid;grid-template-columns:1fr 1.4fr;gap:8px;margin-top:14px}.item-transfer-actions button{border:0;border-radius:12px;padding:12px 10px;font-weight:950;cursor:pointer}.item-transfer-cancel{background:rgba(255,255,255,.06);color:#c4ccdb}.item-transfer-confirm{background:linear-gradient(135deg,#8755e8,#d568d8);color:#fff}.item-transfer-actions button:disabled{opacity:.45;cursor:not-allowed}
    @media(max-width:390px){.item-transfer-card{padding:15px}.inventory-actions .gift-button{flex:1 1 46%}}
  `;
  document.head.appendChild(style);

  function n(value, fallback = 0) {
    // Une valeur SQL NULL ne doit jamais devenir 0 automatiquement.
    // Number(null) vaut 0 en JavaScript, ce qui transformait des PV ou une durée
    // manquants en combat à 0 PV / 0 seconde.
    if (value === null || value === undefined || value === '') return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function fr(value, digits = 2) {
    const parsed = n(value);
    if (Math.abs(parsed) >= 1e15) return parsed.toExponential(Math.min(3, Math.max(0, digits))).replace('.', ',');
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits }).format(parsed);
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  function xpCostForLevel(level) {
    return Math.max(
      1,
      Math.round(50 * Math.pow(1.2, Math.max(0, n(level, 1) - 1)))
    );
  }

  function xpProgressFromTotal(xp) {
    const totalXp = Math.max(0, n(xp));
    let level = 1;
    let spent = 0;
    let cost = xpCostForLevel(level);

    while (level < 1000 && totalXp >= spent + cost) {
      spent += cost;
      level += 1;
      cost = xpCostForLevel(level);
    }

    return {
      level,
      into: totalXp - spent,
      cost
    };
  }

  function levelFromXp(xp) {
    return xpProgressFromTotal(xp).level;
  }

  function itemLevelForDifficulty(value = currentAdventureDifficulty()) {
    return Math.min(1000, Math.max(1, Math.ceil(Math.min(10000, Math.max(1, n(value, 1))) / 10)));
  }

  function caseDifficultyForLevel(level) {
    return Math.min(10000, Math.max(1, (Math.min(1000, Math.max(1, Math.floor(n(level, 1)))) - 1) * 10 + 1));
  }

  function casePriceKey(level, type = 'global') {
    const safeLevel = Math.min(1000, Math.max(1, Math.floor(n(level, 1))));
    return `${safeLevel}:${String(type || 'global').toLowerCase()}`;
  }

  function serverCaseCost(level, type = 'global') {
    const value = serverCasePrices.get(casePriceKey(level, type));
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
  }

  // Estimation uniquement utilisée si le serveur est momentanément indisponible.
  // Elle n'est plus affichée comme un prix achetable tant que le prix RPC exact
  // n'a pas été récupéré.
  function estimatedCaseCost(level, type = 'global') {
    const safeLevel = Math.min(1000, Math.max(1, Math.floor(n(level, 1))));
    const difficulty = caseDifficultyForLevel(safeLevel);
    const baseCurve = difficultyGoldMultiplier(difficulty) / Math.max(0.000001, difficultyGoldMultiplier(1));
    const fortune = Math.max(0, n(statSnapshot?.().total?.fortune, 0));
    const specific = type === 'global' ? 1 : 2;
    const fortunePriceMultiplier = 1 + Math.min(1000, fortune) * 0.001;
    return Math.max(1, Math.ceil(100 * baseCurve * fortunePriceMultiplier * specific));
  }

  function caseCost(level, type = 'global') {
    return serverCaseCost(level, type) ?? estimatedCaseCost(level, type);
  }

  async function loadServerCasePrices(level = selectedCaseLevel, { force = false } = {}) {
    if (!window.CoachingCloud?.client || !CoachingCloud.session?.user) return false;
    const safeLevel = Math.min(itemLevelForDifficulty(), Math.max(1, Math.floor(n(level, 1))));
    const types = ['global', 'weapon', 'armor', 'relic'];
    const ready = types.every(type => serverCaseCost(safeLevel, type) !== null);
    if (ready && !force) return true;
    if (casePriceLoadingLevels.has(safeLevel)) return false;

    casePriceLoadingLevels.add(safeLevel);
    if (activeTab === 'cases') render();

    const results = await Promise.all(types.map(async type => {
      const { data, error } = await CoachingCloud.client.rpc('rpg_case_price_v20', {
        p_athlete_slug: cfg.slug,
        p_item_level: safeLevel,
        p_case_type: type
      });
      if (error) return { type, error };
      let raw = Array.isArray(data) ? data[0] : data;
      if (raw && typeof raw === 'object') {
        raw = raw.rpg_case_price_v20 ?? raw.case_price ?? raw.price ?? Object.values(raw)[0];
      }
      const value = Number(raw);
      return Number.isFinite(value) && value > 0
        ? { type, value: Math.floor(value) }
        : { type, error: new Error('Prix serveur invalide') };
    }));

    let success = true;
    for (const result of results) {
      if (result.error) {
        success = false;
        console.warn(`Prix serveur de la caisse ${result.type} indisponible :`, result.error?.message || result.error);
      } else {
        serverCasePrices.set(casePriceKey(safeLevel, result.type), result.value);
      }
    }

    casePriceLoadingLevels.delete(safeLevel);
    if (activeTab === 'cases') render();
    return success;
  }

  function queueServerCasePriceLoad(level = selectedCaseLevel) {
    clearTimeout(casePriceReloadTimer);
    casePriceReloadTimer = setTimeout(() => { void loadServerCasePrices(level); }, 40);
  }

  function upgradeCost(rank) {
    const safeRank = Math.max(0, Math.floor(n(rank)));
    // Courbe exponentielle : chaque rang coûte environ 15 % de plus que le précédent.
    // L'arrondi par tranche de 5 gold reste identique à la fonction Supabase.
    return Math.ceil((75 * Math.pow(1.15, safeRank)) / 5) * 5;
  }



const MAX_ADVENTURE_DIFFICULTY = 10000;

function currentAdventureDifficulty() {
  return Math.min(MAX_ADVENTURE_DIFFICULTY, Math.max(1, Math.floor(n(progress?.adventure_difficulty, 1))));
}

function requiredPowerForDifficulty(value = currentAdventureDifficulty()) {
  const d = Math.min(MAX_ADVENTURE_DIFFICULTY, Math.max(1, Math.floor(n(value, 1))));
  if (d <= 10) return 1 + (d - 1) * (19 / 9);          // 1 -> 20
  if (d <= 25) return 20 + (d - 10) * (25 / 15);      // 20 -> 45
  if (d <= 50) return 45 + (d - 25) * (45 / 25);      // 45 -> 90
  if (d <= 75) return 90 + (d - 50) * (70 / 25);      // 90 -> 160
  if (d <= 100) return 160 + (d - 75) * (115 / 25);   // 160 -> 275
  if (d <= 250) return 400 + (d - 101) * (300 / 149); // mur après le palier 100
  if (d <= 500) return 700 + (d - 250) * (500 / 250);
  if (d <= 1000) return 1200 + (d - 500) * (1000 / 500);
  if (d <= 2500) return 2200 + (d - 1000) * (3800 / 1500);
  if (d <= 5000) return 6000 + (d - 2500) * (9000 / 2500);
  if (d <= 7500) return 15000 + (d - 5000) * (15000 / 2500);
  return 30000 + (d - 7500) * (30000 / 2500);
}

function powerDamageMultiplier(value) {
  const power = Math.max(0, n(value));
  if (power <= 300) return 1 + power / 25;
  return 13 * Math.pow(power / 300, 0.70);
}

function currentCombatPower() {
  return Math.max(0, n(statSnapshot()?.total?.power));
}

function difficultyHpMultiplier(value = currentAdventureDifficulty()) {
  return 5 * powerDamageMultiplier(requiredPowerForDifficulty(value)) / powerDamageMultiplier(1);
}

function difficultyDamageResistance() {
  return 1;
}

function difficultyXpMultiplier() {
  return 1;
}

function difficultyGoldMultiplier(value = currentAdventureDifficulty()) {
  const d = Math.min(MAX_ADVENTURE_DIFFICULTY, Math.max(1, Math.floor(n(value, 1))));
  if (d <= 100) return 0.12 * Math.pow(100, (d - 1) / 99);
  if (d <= 1000) return 12 * Math.pow(100, (d - 100) / 900);
  return 1200 * Math.pow(100, (d - 1000) / 9000);
}

function effectiveChancePoints() {
  return Math.max(0, n(statSnapshot().total.mastery));
}

function equippedPassiveTotal(type) {
  return inventory.filter(item => item.equipped && (
    item.passive_type === type ||
    (type === 'case_luck' && item.passive_type === 'relic_luck')
  )).reduce((sum, item) => sum + n(item.passive_value), 0);
}

function critChancePct() {
  return 25 * (1 - Math.exp(-effectiveChancePoints() / 250));
}

function goldJackpotChancePct() {
  return 3 * (1 - Math.exp(-effectiveChancePoints() / 500));
}

function caseLuckStrength() {
  return Math.min(0.02, Math.log1p(effectiveChancePoints()) / 500 + equippedPassiveTotal('case_luck') / 500);
}

function epicMonsterChancePct() {
  return monsterEncounterOdds().epic;
}

function uncommonPlusMonsterChancePct() {
  const odds = monsterEncounterOdds();
  return odds.uncommon + odds.rare + odds.epic + odds.legendary + odds.mythic + odds.ultra_mythic + odds.abyssal;
}

function eliteMonsterMultiplier() {
  // Croissance linéaire sans plafond : chaque tranche de 100 points de
  // Chance ajoute ×1 aux poids de toutes les raretés Peu commun et plus.
  return 1 + effectiveChancePoints() / 100;
}

function monsterEncounterOdds() {
  const advancedMultiplier = Math.max(1, eliteMonsterMultiplier());
  const hunterMultiplier = 1 + Math.max(0, equippedPassiveTotal('epic_hunter')) / 100;

  // La Chance augmente Peu commun et supérieur. Chasseur épique augmente
  // ensuite de façon identique tout le pool Rare et supérieur. Comme chaque
  // rang reçoit les mêmes multiplicateurs, la hiérarchie reste toujours :
  // Peu commun > Rare > Épique > Légendaire > Mythique > Ultra > Abyssal.
  const weights = {
    normal: 66.339,
    common: 27,
    uncommon: 5 * advancedMultiplier,
    rare: 1 * advancedMultiplier * hunterMultiplier,
    epic: 0.5 * advancedMultiplier * hunterMultiplier,
    legendary: 0.1 * advancedMultiplier * hunterMultiplier,
    mythic: 0.05 * advancedMultiplier * hunterMultiplier,
    ultra_mythic: 0.01 * advancedMultiplier * hunterMultiplier,
    abyssal: 0.001 * advancedMultiplier * hunterMultiplier
  };

  const totalWeight = Object.values(weights).reduce((sum, value) => sum + value, 0);
  if (!(totalWeight > 0)) return {
    normal: 66.339,
    common: 27,
    uncommon: 5,
    rare: 1,
    epic: 0.5,
    legendary: 0.1,
    mythic: 0.05,
    ultra_mythic: 0.01,
    abyssal: 0.001
  };

  return Object.fromEntries(
    Object.entries(weights).map(([key, value]) => [key, value / totalWeight * 100])
  );
}

function monsterEncounterChanceForSession(session) {
  const odds = monsterEncounterOdds();
  return odds[normalizedMonsterRarity(session?.monsterRarity || 'common')] || 0;
}

function monsterBaseCombatXp(rarity) {
  const rawKey = String(rarity || 'normal').toLowerCase();
  const key = rawKey === 'secret' ? 'secret' : normalizedMonsterRarity(rawKey);
  if (key === 'uncommon') return 0;
  if (key === 'rare') return 2;
  if (key === 'epic') return 5;
  if (key === 'legendary') return 10;
  if (key === 'mythic') return 20;
  if (key === 'ultra_mythic') return 50;
  if (key === 'secret' || key === 'abyssal') return 100;
  return 0;
}

function selectedCombatDifficultyForXp() {
  const unlocked = currentAdventureDifficulty();
  return Math.min(unlocked, Math.max(1, Math.floor(n(selectedDifficulty, unlocked))));
}

function monsterXpBand(difficulty = 1) {
  const normalizedDifficulty = Math.max(1, Math.floor(n(difficulty, 1)));
  // 1-10 = tranche 1, 11-20 = tranche 2, 101-110 = tranche 11.
  // Le calcul dépend uniquement du palier d'aventure débloqué et du palier
  // effectivement choisi pour le combat, jamais du niveau RPG du joueur.
  return Math.floor((normalizedDifficulty - 1) / 10) + 1;
}

function monsterXpBandRange(difficulty = 1) {
  const band = monsterXpBand(difficulty);
  return {
    band,
    min: (band - 1) * 10 + 1,
    max: band * 10
  };
}

function monsterPalierXpMultiplier(
  maxDifficulty = currentAdventureDifficulty(),
  difficulty = selectedCombatDifficultyForXp()
) {
  const maximum = Math.max(1, Math.floor(n(maxDifficulty, 1)));
  const fought = Math.max(1, Math.floor(n(difficulty, 1)));
  const difference = Math.abs(monsterXpBand(fought) - monsterXpBand(maximum));
  const pyramid = [1, 0.90, 0.75, 0.60, 0.45, 0.30, 0.15];
  return pyramid[difference] ?? 0;
}

function monsterCurrentCombatXp(
  rarity,
  maxDifficulty = currentAdventureDifficulty(),
  difficulty = selectedCombatDifficultyForXp()
) {
  const baseXp = monsterBaseCombatXp(rarity);
  const codexMultiplier = 1 + Math.max(0, n(progress?.collection_xp_bonus)) / 100;
  const palierMultiplier = monsterPalierXpMultiplier(maxDifficulty, difficulty);
  return Math.round(baseXp * codexMultiplier * palierMultiplier * 100) / 100;
}

function monsterXpMonitorLabel(
  rarity,
  maxDifficulty = currentAdventureDifficulty(),
  difficulty = selectedCombatDifficultyForXp()
) {
  const rarityKey = normalizedMonsterRarity(rarity || 'normal');
  const baseXp = monsterBaseCombatXp(rarity);
  const palierMultiplier = monsterPalierXpMultiplier(maxDifficulty, difficulty);
  const palierPct = Math.round(palierMultiplier * 100);
  const currentXp = monsterCurrentCombatXp(rarity, maxDifficulty, difficulty);

  if (rarityKey === 'uncommon') return '0 XP · Gold ×2';
  if (!(baseXp > 0)) return '0 XP';
  if (!(palierMultiplier > 0)) {
    const currentBand = monsterXpBandRange(difficulty);
    const maximumBand = monsterXpBandRange(maxDifficulty);
    return `0 XP · palier XP ${currentBand.band} (${currentBand.min}-${currentBand.max}) trop éloigné du palier XP max ${maximumBand.band}`;
  }

  const scaleNote = palierPct < 100 ? ` · palier ${palierPct} %` : '';
  if (Math.abs(currentXp - baseXp) < 0.0001) return `${fr(baseXp, 0)} XP${scaleNote}`;
  return `${fr(currentXp, 2)} XP actuel · base ${fr(baseXp, 0)}${scaleNote}`;
}

function encounterRatioLabel(ratePct) {
  const rate = Math.max(0, n(ratePct));
  if (!rate) return 'Taux indisponible';
  const ratio = Math.max(1, Math.round(100 / rate));
  return `≈ 1 / ${ratio.toLocaleString('fr-FR')}`;
}

function monsterEncounterOddsHtml() {
  const odds = monsterEncounterOdds();
  const order = ['normal','common','uncommon','rare','epic','legendary','mythic','ultra_mythic','abyssal'];

  const rarityPanel = `<div class="encounter-odds-grid">${order.map(key => {
    const p = monsterRarityPresentation(key);
    return `<div class="encounter-odds-card rarity-${key}"><strong style="color:${esc(p.color)}">${p.icon} ${esc(p.label)}</strong><b>${fr(odds[key],3)} %</b><small>${esc(monsterXpMonitorLabel(key))}</small></div>`;
  }).join('')}</div>
  <div class="encounter-odds-note">À 0 Chance : 5 % Peu commun, 1 % Rare, 0,5 % Épique, 0,1 % Légendaire, 0,05 % Mythique, 0,01 % Ultra mythique et 0,001 % Abyssal. La Chance augmente Peu commun et supérieur sans plafond. Le passif Chasseur épique augmente séparément Rare et supérieur, également sans plafond. Les mêmes multiplicateurs sont appliqués à chaque rang concerné : la hiérarchie reste donc toujours Peu commun &gt; Rare &gt; Épique &gt; Légendaire &gt; Mythique &gt; Ultra &gt; Abyssal.<br><strong>XP par grands paliers de 10 niveaux :</strong> 1-10 = palier XP 1, 11-20 = palier XP 2, etc. Tous les niveaux d’une même tranche donnent 100 % entre eux. Entre tranches : écart 0 = 100 % ; 1 = 90 % ; 2 = 75 % ; 3 = 60 % ; 4 = 45 % ; 5 = 30 % ; 6 = 15 % ; 7 ou plus = 0 %. La baisse est identique vers le bas et vers le haut. Calcul actuel : maximum ${currentAdventureDifficulty()} (${monsterXpBandRange(currentAdventureDifficulty()).min}-${monsterXpBandRange(currentAdventureDifficulty()).max}) = tranche ${monsterXpBand(currentAdventureDifficulty())}, combat ${selectedCombatDifficultyForXp()} (${monsterXpBandRange(selectedCombatDifficultyForXp()).min}-${monsterXpBandRange(selectedCombatDifficultyForXp()).max}) = tranche ${monsterXpBand(selectedCombatDifficultyForXp())}, écart ${Math.abs(monsterXpBand(currentAdventureDifficulty())-monsterXpBand(selectedCombatDifficultyForXp()))}, coefficient ${Math.round(monsterPalierXpMultiplier()*100)} %.<br><strong>Val :</strong> 0,1 % par combat éligible, uniquement à partir du palier ${Math.ceil(currentAdventureDifficulty() / 2) + 1} pour un meilleur palier débloqué de ${currentAdventureDifficulty()}.</div>`;

  const hunterBonus = Math.max(0, equippedPassiveTotal('epic_hunter'));
  return `<div class="encounter-odds-box">
    <div class="encounter-odds-head"><b>🎲 Taux d’apparition du pool</b><span>${window.GA_APP_VERSION || 'V118'} · Chance ${fr(effectiveChancePoints(),1)} · Peu commun+ ×${fr(eliteMonsterMultiplier(),2)} · Chasseur Rare+ ×${fr(1 + hunterBonus / 100,2)} · sans plafond</span></div>
    ${rarityPanel}
  </div>`;
}

function normalCaseOdds() {
  const luck = caseLuckStrength();
  const weights = {
    normal: 48.889,
    common: 25,
    uncommon: 15 * (1 + luck * 0.25),
    rare: 7 * (1 + luck * 0.60),
    epic: 3 * (1 + luck),
    legendary: 1 * (1 + luck * 1.40),
    mythic: 0.1 * (1 + luck * 1.80),
    ultra_mythic: 0.01 * (1 + luck * 2.20),
    abyssal: 0.001 * (1 + luck * 2.80)
  };
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  return Object.fromEntries(Object.entries(weights).map(([key, value]) => [key, value / total * 100]));
}

function caseLuckBoostPct() {
  return caseLuckStrength() * 100;
}

  function gearTotals() {
    const classDef = CLASS_DEFS[progress?.rpg_class] || null;
    return inventory.filter(item => item.equipped).reduce((sum, item) => {
      const affinity = classDef?.affinitySlot === item.slot ? 1.25 : 1;
      const power = n(item.scaled_power_bonus, n(item.power_bonus));
      const mastery = n(item.scaled_mastery_bonus, n(item.mastery_bonus));
      const fortune = n(item.scaled_fortune_bonus, n(item.fortune_bonus));
      return {
        power: sum.power + power * affinity,
        mastery: sum.mastery + mastery * affinity,
        fortune: sum.fortune + fortune * affinity
      };
    }, { power: 0, mastery: 0, fortune: 0 });
  }

  function collectionTotals() {
    const owned = new Set(itemCollection.map(row => row.catalog_key));
    return itemCatalog.filter(item => owned.has(item.catalog_key)).reduce((sum, item) => ({
      power: sum.power + n(item.collection_power_bonus) / 10,
      mastery: sum.mastery + n(item.collection_mastery_bonus) / 10,
      fortune: sum.fortune + n(item.collection_fortune_bonus) / 10
    }), { power: 0, mastery: 0, fortune: 0 });
  }

  function statSnapshot() {
    const gear = gearTotals();
    const collection = collectionTotals();
    const base = {
      power: n(progress?.stat_power),
      mastery: n(progress?.stat_mastery),
      fortune: n(progress?.stat_fortune)
    };
    return {
      base, gear, collection,
      total: {
        power: base.power + gear.power + collection.power,
        mastery: base.mastery + gear.mastery + collection.mastery,
        fortune: base.fortune + gear.fortune + collection.fortune
      }
    };
  }

  function classStats(classKey) {
    const def = CLASS_DEFS[classKey] || CLASS_DEFS.warrior;
    const stats = statSnapshot();
    return [
      { key: 'power', label: def.mainStat, value: stats.total.power, detail: `${fr(stats.base.power,1)} + ${fr(stats.gear.power,1)} équipement (affinité incluse) + ${fr(stats.collection.power,1)} collection` },
      { key: 'mastery', label: def.masteryStat, value: stats.total.mastery, detail: `${fr(stats.base.mastery,1)} + ${fr(stats.gear.mastery,1)} équipement (affinité incluse) + ${fr(stats.collection.mastery,1)} collection` },
      { key: 'fortune', label: 'Fortune', value: stats.total.fortune, detail: `${fr(stats.base.fortune,1)} + ${fr(stats.gear.fortune,1)} équipement (affinité incluse) + ${fr(stats.collection.fortune,1)} collection` }
    ];
  }


  const MONSTER_SPRITE_FILES = {
    "arnold schwarzeneggerie le chene en plastique": "sprites/monsters/arnold-schwarzeneggerie-le-chene-en-plastique.webp",
    "avatar du rpe 10 permanent": "sprites/monsters/avatar-du-rpe-10-permanent.webp",
    "barre proteinee gout beton": "sprites/monsters/barre-proteinee-gout-beton.webp",
    "bouteille d eau tiede consciente": "sprites/monsters/bouteille-d-eau-tiede-consciente.webp",
    "celia celeste reine du challenge abdo": "sprites/monsters/celia-celeste-reine-du-challenge-abdo.webp",
    "chaussette de gym sauvage": "sprites/monsters/chaussette-de-gym-sauvage.webp",
    "chicken broccoli rice final form": "sprites/monsters/chicken-broccoli-rice-final-form.webp",
    "clara metaknight lame de la tempo": "sprites/monsters/clara-metaknight-lame-de-la-tempo.webp",
    "controleur urssaf dimensionnel": "sprites/monsters/controleur-urssaf-dimensionnel.webp",
    "donut malicieux": "sprites/monsters/donut-malicieux.webp",
    "fantome du mock meet annule": "sprites/monsters/fantome-du-mock-meet-annule.webp",
    "greg doucette de porc le crieur hypocalorique": "sprites/monsters/greg-doucette-de-porc-le-crieur-hypocalorique.webp",
    "guillaume glorieux seigneur du gl": "sprites/monsters/guillaume-glorieux-seigneur-du-gl.webp",
    "hanzalone la version malefique": "sprites/monsters/hanzalone-la-version-malefique.webp",
    "hydre du deload refuse": "sprites/monsters/hydre-du-deload-refuse.webp",
    "janel janvier reine du cycle": "sprites/monsters/janel-janvier-reine-du-cycle.webp",
    "jo lindnergarten le jardinier veineux": "sprites/monsters/jo-lindnergarten-le-jardinier-veineux.webp",
    "jolan joliment faux": "sprites/monsters/jolan-joliment-faux.webp",
    "kali muscleton le prisonnier proteine": "sprites/monsters/kali-muscleton-le-prisonnier-proteine.webp",
    "kaoutar counter paradeuse de bench": "sprites/monsters/kaoutar-counter-paradeuse-de-bench.webp",
    "killian kill ton pr": "sprites/monsters/killian-kill-ton-pr.webp",
    "l abonne fantome de fevrier": "sprites/monsters/l-abonne-fantome-de-fevrier.webp",
    "l influenceur du miroir": "sprites/monsters/l-influenceur-du-miroir.webp",
    "l orteil de noe": "sprites/monsters/l-orteil-de-noe.webp",
    "la manager basic fit reine du bip rouge": "sprites/monsters/la-manager-basic-fit-reine-du-bip-rouge.webp",
    "le banc toujours pris": "sprites/monsters/le-banc-toujours-pris.webp",
    "le bro aux trois serviettes": "sprites/monsters/le-bro-aux-trois-serviettes.webp",
    "le cadenas sans code": "sprites/monsters/le-cadenas-sans-code.webp",
    "le dj bluetooth interdit": "sprites/monsters/le-dj-bluetooth-interdit.webp",
    "le donut malicieux": "sprites/monsters/donut-malicieux.webp",
    "le donut malicieux supreme": "sprites/monsters/le-donut-malicieux-supreme.webp",
    "le gerant du vestiaire oublie": "sprites/monsters/le-gerant-du-vestiaire-oublie.webp",
    "le grand deltoide masque": "sprites/monsters/le-pere-de-noe.webp",
    "le manager esn ultime": "sprites/monsters/le-manager-esn-ultime.webp",
    "le mec en jeans": "sprites/monsters/roi-de-la-phonk.webp",
    "le nettoyeur de banc sec": "sprites/monsters/le-nettoyeur-de-banc-sec.webp",
    "le pere de noe": "sprites/monsters/le-pere-de-noe.webp",
    "le roi de la funk": "sprites/monsters/roi-de-la-funk-synthetique.webp",
    "le roi de la phonk synthetique": "sprites/monsters/roi-de-la-phonk.webp",
    "le roi du funk synthetique": "sprites/monsters/roi-de-la-funk-synthetique.webp",
    "le squatteur de poulie": "sprites/monsters/le-squatteur-de-poulie.webp",
    "le tapis de course possede": "sprites/monsters/le-tapis-de-course-possede.webp",
    "lou dragonne souffle de magnesie": "sprites/monsters/lou-dragonne-souffle-de-magnesie.webp",
    "lucine lumiere camera critique": "sprites/monsters/lucine-lumiere-camera-critique.webp",
    "machine a adducteurs cosmique": "sprites/monsters/machine-a-adducteurs-cosmique.webp",
    "malo malosse petit boss du rack": "sprites/monsters/malo-malosse-petit-boss-du-rack.webp",
    "matthieu pecheur maitre de la canne a tirage": "sprites/monsters/matthieu-pecheur-maitre-de-la-canne-a-tirage.webp",
    "mike o hearnia l eternel naturellement mysterieux": "sprites/monsters/mike-o-hearnia-l-eternel-naturellement-mysterieux.webp",
    "noah le nain furtif": "sprites/monsters/noah-le-nain-furtif.webp",
    "noe faux noe copie conforme": "sprites/monsters/noe-faux-noe-copie-conforme.webp",
    "noel deyzel diesel le pere noel du bulk": "sprites/monsters/noel-deyzel-diesel-le-pere-noel-du-bulk.webp",
    "omelette fantome": "sprites/monsters/omelette-fantome.webp",
    "phil heath ledger le cadeau maudit": "sprites/monsters/phil-heath-ledger-le-cadeau-maudit.webp",
    "rich piano bar le musicien a huit repas": "sprites/monsters/rich-piano-bar-le-musicien-a-huit-repas.webp",
    "riz sec vengeur": "Riz sec vengeur.png",
    "roi de la funk synthetique": "sprites/monsters/roi-de-la-funk-synthetique.webp",
    "roi de la phonk": "sprites/monsters/roi-de-la-phonk.webp",
    "roi de la phonk synthetique": "sprites/monsters/roi-de-la-phonk.webp",
    "roi du funk synthetique": "sprites/monsters/roi-de-la-funk-synthetique.webp",
    "roi du rest timer infini": "sprites/monsters/roi-du-rest-timer-infini.webp",
    "saya reunion foudre creole": "sprites/monsters/saya-reunion-foudre-creole.webp",
    "seigneur du superset infini": "sprites/monsters/seigneur-du-superset-infini.webp",
    "serena serenite calme avant le top set": "sprites/monsters/serena-serenite-calme-avant-le-top-set.webp",
    "slime des tenebres": "sprites/monsters/slime-des-tenebres.webp",
    "titan du total": "sprites/monsters/titan-du-total.webp",
    "val aka kazuto aka the shadow the lonely shadow cowboy": "sprites/monsters/val-aka-kazuto-aka-the-shadow-the-lonely-shadow-cowboy.webp",
    "val kazuto the shadow the lonely shadow cowboy": "sprites/monsters/val-aka-kazuto-aka-the-shadow-the-lonely-shadow-cowboy.webp"
  };

  function normalizeSpriteKey(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[’'`´]/g, ' ')
      .replace(/&/g, ' et ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  function encodeAssetPath(path) {
    return String(path || '').split('/').map(part => encodeURIComponent(part)).join('/');
  }

  function monsterSpriteFile(name, explicitSkinPath = '') {
    const explicit = String(explicitSkinPath || '').trim();
    if (explicit) return explicit.replace(/^\.?\//, '');
    const key = normalizeSpriteKey(name);
    return MONSTER_SPRITE_FILES[key] || null;
  }

  function monsterSpriteCandidates(name, explicitSkinPath = '') {
    const file = monsterSpriteFile(name, explicitSkinPath);
    if (!file) return [];
    const version = encodeURIComponent(window.GA_APP_VERSION || 'V132');
    let absolute = file;
    try {
      absolute = rpgAssetUrl(file);
    } catch (_) {
      absolute = encodeAssetPath(file);
    }
    const separator = String(absolute).includes('?') ? '&' : '?';
    return [`${absolute}${separator}v=${version}`];
  }

  function monsterHasSprite(name, explicitSkinPath = '') {
    return !!monsterSpriteFile(name, explicitSkinPath);
  }

  function monsterSpriteImgHtml(name, alt, className = 'monster-sprite-img', explicitSkinPath = '') {
    const candidates = monsterSpriteCandidates(name, explicitSkinPath);
    if (!candidates.length) return '';
    const safeAlt = esc(alt || name || 'Monstre');
    const safeClass = esc(className);
    const safeSrc = esc(candidates[0]);
    return `<img class="${safeClass}" src="${safeSrc}" alt="${safeAlt}" loading="eager" decoding="async" onerror="this.style.display='none';this.closest('.monster-sprite-host')?.classList.add('sprite-missing')">`;
  }

  function monsterEmoji(name) {
  const value = String(name || '').toLowerCase();
  if (value.includes('noah')) return '🥸';
  if (value.includes('kazuto') || value.includes('lonely shadow cowboy') || value.includes('val,')) return '🧔‍♂️';
  if (value.includes('donut')) return '🍩';
  if (value.includes('poulet')) return '🍗';
  if (value.includes('fromage blanc')) return '🥣';
  if (value.includes('orteil de noé') || value.includes('orteil de noe')) return '🦶';
  if (value.includes('manager esn')) return '🧑‍💼';
  if (value.includes('funk')) return '🕺';
  if (value.includes('shaker')) return '🥤';
  if (value.includes('slime')) return '👾';
  if (value.includes('gobelin')) return '👺';
  if (value.includes('ogre')) return '👹';
  if (value.includes('araignée')) return '🕷️';
  if (value.includes('titan')) return '💀';
  return '☠️';
}

function monsterVisual(name, rarity = 'common', skinPath = '') {
  name = monsterDisplayName(name);
  const value = String(name || '').toLowerCase();
  const rarityKey = normalizedMonsterRarity(rarity);
  const emoji = monsterEmoji(name);
  const spriteHtml = monsterSpriteImgHtml(name, name, 'monster-sprite-img', skinPath);
  if (!spriteHtml && (value.includes('kazuto') || value.includes('lonely shadow cowboy') || value.includes('val,'))) {
    return `<div class="rpg-boss-skin rarity-${rarityKey}"><div class="rpg-boss-face">🧔‍♂️</div><div class="rpg-boss-note">yeux bleus · tatouages<small>The Shadow · Lonely Shadow Cowboy</small></div></div>`;
  }
  const ornament = rarityKey === 'epic' ? '🜂' : rarityKey === 'legendary' ? '👑' : rarityKey === 'mythic' ? '☠️' : rarityKey === 'abyssal' ? '🫧' : rarityKey === 'ultra_mythic' ? '🌟' : rarityKey === 'uncommon' ? '✦' : '·';
  const eyes = rarityKey === 'abyssal' ? '◈◈' : rarityKey === 'ultra_mythic' ? '✦✦' : rarityKey === 'mythic' ? '✧✧' : rarityKey === 'legendary' ? '◉◉' : rarityKey === 'epic' ? '◎◎' : rarityKey === 'uncommon' ? '••' : '';
  const enhanced = ['epic','legendary','mythic','ultra_mythic','abyssal'].includes(rarityKey);
  const inner = `${spriteHtml}<div class="monster-emoji-fallback ${spriteHtml ? 'with-image' : ''}">${esc(emoji)}</div>`;
  if (!enhanced) return `<div class="rpg-monster-sprite monster-sprite-host rarity-${rarityKey}"><div class="monster-core">${inner}</div><div class="monster-ornament">${ornament}</div></div>`;
  return `<div class="rpg-monster-sprite monster-sprite-host rarity-${rarityKey}"><div class="monster-aura-back"></div><div class="monster-core">${inner}</div><div class="monster-ornament">${ornament}</div><div class="monster-eyes">${eyes}</div></div>`;
}


  // Icône du monde affichée dans l'en-tête du combat.
  // Cette fonction manquait dans la version envoyée : le combat s'ouvrait,
  // puis JavaScript s'arrêtait avant l'affichage des PV et des cibles.
  function worldIcon(world) {
    const value = String(world || '').toLocaleLowerCase('fr');
    if (value.includes('bodybuilding') || value.includes('olympia')) return '🏆';
    if (value.includes('basic-fit') || value.includes('basic fit') || value.includes('donjon')) return '🏋️';
    if (value.includes('powerlifting') || value.includes('force')) return '⚔️';
    if (value.includes('coach') || value.includes('légende') || value.includes('phenom') || value.includes('phénom')) return '🎭';
    if (value.includes('nutrition') || value.includes('bulk') || value.includes('food')) return '🍗';
    if (value.includes('internet') || value.includes('réseau') || value.includes('stream')) return '🌐';
    if (value.includes('horreur') || value.includes('ombre') || value.includes('secret')) return '🌑';
    if (value.includes('bestiaire') || value.includes('aléatoire') || !value) return '🌍';
    return '🗺️';
  }

function normalizedMonsterRarity(rarity) {
  const value = String(rarity || '').toLowerCase();
  if (value === 'secret') return 'ultra_mythic';
  return value || 'common';
}

function monsterRarityPresentation(rarity) {
  const key = normalizedMonsterRarity(rarity);
  const map = {
    normal: { label:'Simple', icon:'⚪', color:'#c4cad4', aura:'rgba(196,202,212,.20)', menace:'Présence ordinaire' },
    common: { label:'Commun', icon:'🟢', color:'#61d38b', aura:'rgba(97,211,139,.25)', menace:'Présence calme' },
    uncommon: { label:'Peu commun', icon:'🔵', color:'#5ca9ff', aura:'rgba(92,169,255,.26)', menace:'Présence étrange' },
    rare: { label:'Rare', icon:'🟣', color:'#aa73ff', aura:'rgba(170,115,255,.28)', menace:'Présence instable' },
    epic: { label:'Épique', icon:'🟠', color:'#ff8b49', aura:'rgba(255,139,73,.32)', menace:'Présence menaçante' },
    legendary: { label:'Légendaire', icon:'🟡', color:'#ffd04f', aura:'rgba(255,208,79,.34)', menace:'Présence dominante' },
    mythic: { label:'Mythique', icon:'🔴', color:'#ff5368', aura:'rgba(255,83,104,.36)', menace:'Présence terrifiante' },
    ultra_mythic: { label:'Ultra mythique', icon:'🌟', color:'#f3a6ff', aura:'rgba(221,112,255,.40)', menace:'Présence transcendante' },
    abyssal: { label:'Abyssal', icon:'🫧', color:'#20e3ff', aura:'rgba(32,227,255,.4)', menace:'Présence abyssale' }
  };
  return map[key] || map.common;
}

function setMonsterNameDisplay(target, session) {
  if (!target || !session) return;
  const rarityDef = monsterRarityPresentation(session.monsterRarity || (session.isBoss ? 'legendary' : 'common'));
  const rarityKey = normalizedMonsterRarity(session.monsterRarity || (session.isBoss ? 'legendary' : 'common'));
  target.innerHTML = `<span class="monster-name-rarity rarity-${esc(rarityKey)}">${rarityDef.icon} ${esc(rarityDef.label)}</span><span class="monster-name-main" style="color:${esc(rarityDef.color)}">${esc(monsterDisplayName(session.monsterName || session.bossName || 'Monstre'))}</span>`;
}

function applyMonsterVisualState(enemyEl, session) {
  if (!enemyEl || !session) return;
  const rarityKey = normalizedMonsterRarity(session.monsterRarity || (session.isBoss ? 'legendary' : 'common'));
  enemyEl.className = `rpg-enemy rarity-${rarityKey}`;
  enemyEl.classList.toggle('boss-val', /kazuto|lonely shadow cowboy|val,|hanzalone/i.test(String(session.monsterName || session.bossName || '')));
  enemyEl.style.setProperty('--monster-aura', monsterRarityPresentation(rarityKey).aura);
  enemyEl.style.setProperty('--monster-color', monsterRarityPresentation(rarityKey).color);
}

const BONUS_STAGE_DELAY_MS = 3000;

function isBonusStageSession(session) {
  if (!session || session.mode === 'trial') return false;
  const rarityKey = normalizedMonsterRarity(session.monsterRarity || (session.isBoss ? 'legendary' : 'common'));
  const name = String(session.monsterName || session.bossName || '').toLocaleLowerCase('fr');
  return !!session.isBoss
    || !!session.isEliteSpecial
    || ['epic', 'legendary', 'mythic', 'ultra_mythic', 'abyssal'].includes(rarityKey)
    || /kazuto|lonely shadow cowboy|val,|hanzalone|noah/.test(name);
}

function ensureMonsterIntroOverlay() {
  let overlay = document.getElementById('monsterIntroOverlay');
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.id = 'monsterIntroOverlay';
  overlay.className = 'monster-intro-overlay';
  overlay.innerHTML = `<div class="monster-intro-card"><div class="monster-intro-kicker">BONUS STAGE · POOL SPÉCIAL</div><div class="monster-intro-rarity" id="monsterIntroRarity"></div><div class="monster-intro-name" id="monsterIntroName"></div><div class="monster-intro-menace" id="monsterIntroMenace"></div><div class="monster-intro-countdown" id="monsterIntroCountdown"></div></div>`;
  document.body.appendChild(overlay);
  return overlay;
}

function showMonsterIntro(session) {
  if (!isBonusStageSession(session)) return Promise.resolve(false);

  const overlay = ensureMonsterIntroOverlay();
  const rarityDef = monsterRarityPresentation(session.monsterRarity || (session.isBoss ? 'legendary' : 'common'));
  const rarityKey = normalizedMonsterRarity(session.monsterRarity || (session.isBoss ? 'legendary' : 'common'));
  overlay.className = `monster-intro-overlay show rarity-${rarityKey}`;


  if (isPereDeNoeMonsterName(session.monsterName || session.bossName)) {
    if (!session.pereDeNoeVoicePlayed) {
      session.pereDeNoeVoicePlayed = true;
      playPereDeNoeVoice();
    }
  } else if (rarityKey === 'abyssal' && !session.abyssalVoicePlayed) {
    session.abyssalVoicePlayed = true;
    playAbyssalVoice();
  }

  const rarity = document.getElementById('monsterIntroRarity');
  const name = document.getElementById('monsterIntroName');
  const menace = document.getElementById('monsterIntroMenace');
  const countdown = document.getElementById('monsterIntroCountdown');

  if (rarity) rarity.innerHTML = `${rarityDef.icon} ${esc(rarityDef.label)}`;
  if (name) {
    name.textContent = session.monsterName || session.bossName || 'Monstre';
    name.style.color = rarityDef.color;
  }
  if (menace) menace.textContent = `${rarityDef.menace} · ${session.monsterWorld || 'Bestiaire aléatoire'}`;

  clearTimeout(showMonsterIntro.timer);
  clearInterval(showMonsterIntro.countdownTimer);

  const started = Date.now();
  const refreshCountdown = () => {
    if (!countdown) return;
    const remaining = Math.max(0, Math.ceil((BONUS_STAGE_DELAY_MS - (Date.now() - started)) / 1000));
    countdown.textContent = remaining > 0 ? `Combat dans ${remaining}…` : 'COMBAT !';
  };
  refreshCountdown();
  showMonsterIntro.countdownTimer = setInterval(refreshCountdown, 200);

  return new Promise(resolve => {
    showMonsterIntro.timer = setTimeout(() => {
      clearInterval(showMonsterIntro.countdownTimer);
      if (countdown) countdown.textContent = 'COMBAT !';
      overlay.classList.remove('show');
      resolve(true);
    }, BONUS_STAGE_DELAY_MS);
  });
}

const RPG_COMBAT_MAX_DURATION_SECONDS = 24 * 60 * 60;

function normalizeCombatDurationSeconds(value, fallback = 30) {
  return Math.max(
    1,
    Math.min(
      RPG_COMBAT_MAX_DURATION_SECONDS,
      Math.floor(n(value, fallback))
    )
  );
}

async function prepareUnlimitedCombatV63(combatId, fallbackPlannedDuration = 30) {
  if (!combatId) {
    return {
      plannedDuration: normalizeCombatDurationSeconds(fallbackPlannedDuration),
      hardDuration: RPG_COMBAT_MAX_DURATION_SECONDS,
      error: { message: 'Identifiant de combat manquant.' }
    };
  }

  const { data, error } = await CoachingCloud.client.rpc('prepare_rpg_combat_unlimited_v63', {
    p_combat_id: combatId,
    p_athlete_slug: cfg.slug
  });

  if (error) {
    console.error('Impossible de préparer le temps limite du combat :', error);
    return {
      plannedDuration: normalizeCombatDurationSeconds(fallbackPlannedDuration),
      hardDuration: RPG_COMBAT_MAX_DURATION_SECONDS,
      error
    };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    plannedDuration: normalizeCombatDurationSeconds(
      row?.planned_seconds,
      fallbackPlannedDuration
    ),
    hardDuration: normalizeCombatDurationSeconds(
      row?.hard_seconds,
      RPG_COMBAT_MAX_DURATION_SECONDS
    ),
    error: null
  };
}

async function armCombatServerTimer(session) {
  if (!session?.id) return false;
  const { data, error } = await CoachingCloud.client.rpc('arm_rpg_combat_v26', {
    p_combat_id: session.id,
    p_athlete_slug: cfg.slug
  });
  if (error) {
    console.error('Impossible d’armer le chrono serveur :', error);
    CoachingCloud.toast('Chrono serveur non synchronisé : exécute le SQL BONUS STAGE V26.', true);
    session.startedAt = Date.now();
    return false;
  }
  session.serverStartedAt = Array.isArray(data) ? data[0] : data;
  session.startedAt = Date.now();
  return true;
}


  function inject() {
    preloadAbilityCutins();
    if (!chip) {
      chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'xp-chip';
      chip.textContent = 'Niv. 1 · 0 XP';
      const header = document.querySelector('.header-top') || document.querySelector('.header');
      header?.appendChild(chip);
    }
    if (!panel) {
      panel = document.createElement('section');
      panel.className = 'xp-panel';
      panel.id = 'xpPanel';
      panel.innerHTML = `
        <div class="xp-panel-head"><h2>⚡ Progression RPG</h2><div><button type="button" id="rpgAudioToggle" aria-expanded="false" aria-controls="rpgAudioSettings">🎵 Audio</button><button type="button" id="xpPanelClose">Fermer</button></div></div>
        <div class="rpg-audio-settings" id="rpgAudioSettings" hidden>
          <div class="rpg-audio-settings-head"><b>Réglages audio</b><button type="button" id="rpgAudioSettingsClose">Fermer</button></div>
          <label class="rpg-audio-row"><span><strong>Musique du jeu</strong><small>Taverne, combats, boss et ouvertures de coffres.</small></span><input class="rpg-audio-switch" type="checkbox" id="rpgMusicEnabled"></label>
          <div class="rpg-audio-slider"><input type="range" id="rpgMusicVolume" min="0" max="100" step="5"><span id="rpgMusicVolumeValue">100 %</span></div>
          <label class="rpg-audio-row"><span><strong>Effets sonores</strong><small>Sorts, annonces et sons ponctuels.</small></span><input class="rpg-audio-switch" type="checkbox" id="rpgSfxEnabled"></label>
          <div class="rpg-audio-slider"><input type="range" id="rpgSfxVolume" min="0" max="100" step="5"><span id="rpgSfxVolumeValue">100 %</span></div>
          <div class="rpg-audio-actions"><button type="button" id="rpgAudioEnableAll">Tout activer</button><button type="button" id="rpgSpotifyMode">🎧 Mode Spotify</button></div>
          <div class="rpg-audio-status" id="rpgAudioStatus"></div>
        </div>
        <div id="xpPanelBody"></div>`;
      document.body.appendChild(panel);
      chip?.addEventListener('click', () => {
        panel.classList.toggle('show');
        if (panel.classList.contains('show')) {
          unlockRpgAudio();
          // Le clic d'ouverture du RPG autorise le son, mais respecte toujours le choix mémorisé.
          if (musicAllowed()) void playMenuMusic({ userGesture:true });
        } else {
          const audioSettings = document.getElementById('rpgAudioSettings');
          const audioToggle = document.getElementById('rpgAudioToggle');
          if (audioSettings) audioSettings.hidden = true;
          audioToggle?.setAttribute('aria-expanded', 'false');
          cancelPostCombatMusicReturn();
          if (sharedMusicMode === 'battle') stopBattleMusic({ reset:false, resumeMenu:false, clearContinuity:true });
          else stopMenuMusic();
        }
        render();
      });
      document.getElementById('xpPanelClose')?.addEventListener('click', () => {
        panel.classList.remove('show');
        const audioSettings = document.getElementById('rpgAudioSettings');
        if (audioSettings) audioSettings.hidden = true;
        document.getElementById('rpgAudioToggle')?.setAttribute('aria-expanded', 'false');
        cancelPostCombatMusicReturn();
        if (sharedMusicMode === 'battle') stopBattleMusic({ reset:false, resumeMenu:false, clearContinuity:true });
        else stopMenuMusic();
      });
      bindRpgAudioSettings();
      panel.addEventListener('click', event => {
        const tabButton = event.target.closest('[data-xp-tab]');
        if (tabButton) {
          activeTab = tabButton.dataset.xpTab;
          render();
          if (activeTab === 'cases') queueServerCasePriceLoad(selectedCaseLevel);
          return;
        }
        const classButton = event.target.closest('[data-rpg-class]');
        if (classButton) chooseClass(classButton.dataset.rpgClass);
        const collectionTabButton = event.target.closest('[data-collection-tab]');
        if (collectionTabButton) { collectionSubTab = collectionTabButton.dataset.collectionTab; render(); return; }
        if (event.target.closest('#rpgLaunch')) startCombat();
        if (event.target.closest('#rpgBossLaunch')) startBossCombat();
        if (event.target.closest('#rpgDamageTrial')) startDamageTrial();
        if (event.target.closest('#rpgRaidJoin')) joinRaid();
        if (event.target.closest('#rpgRaidStart')) startRaidRun();
        const raidCaseButton = event.target.closest('[data-open-raid-case]');
        if (raidCaseButton) openRaidCases(n(raidCaseButton.dataset.openRaidCase, 1));
        const upgradeButton = event.target.closest('[data-upgrade-stat]');
        if (upgradeButton) upgradeStat(upgradeButton.dataset.upgradeStat);
        const lockButton = event.target.closest('[data-lock-item]');
        if (lockButton) {
          toggleItemLock(lockButton.dataset.lockItem, lockButton.dataset.locked !== 'true');
          return;
        }
        const sendButton = event.target.closest('[data-send-item]');
        if (sendButton) {
          openItemTransfer(sendButton.dataset.sendItem);
          return;
        }
        if (event.target.closest('[data-transfer-cancel]')) {
          closeItemTransfer();
          return;
        }
        if (event.target.closest('[data-transfer-confirm]')) {
          confirmItemTransfer();
          return;
        }
        const equipButton = event.target.closest('[data-equip-item]');
        if (equipButton) equipItem(equipButton.dataset.equipItem);
        const sellButton = event.target.closest('[data-sell-item]');
        if (sellButton) sellItem(sellButton.dataset.sellItem);
        const depositButton = event.target.closest('[data-deposit-item]');
        if (depositButton) depositItem(depositButton.dataset.depositItem);
        if (event.target.closest('[data-deposit-all]')) depositAllItems();
        if (event.target.closest('[data-sell-all]')) sellAllItems();
        const caseButton = event.target.closest('[data-open-case]');
        if (caseButton) openCases(n(caseButton.dataset.openCase), caseButton.dataset.caseType || 'global', n(caseButton.dataset.openCount, 1));
      });
      panel.addEventListener('input', event => {
        if (event.target?.id === 'caseLevelRange') {
          selectedCaseLevel = Math.min(itemLevelForDifficulty(), Math.max(1, Math.floor(n(event.target.value, 1))));
          localStorage.setItem(`rpg_case_level_${cfg.slug}`, String(selectedCaseLevel));
          render();
          queueServerCasePriceLoad(selectedCaseLevel);
          return;
        }
        if (event.target?.id === 'bestiarySearch') {
          bestiarySearch = event.target.value || '';
          const pos = event.target.selectionStart;
          render();
          requestAnimationFrame(() => { const input = document.getElementById('bestiarySearch'); if (input) { input.focus(); input.setSelectionRange(pos,pos); } });
          return;
        }
      });
      panel.addEventListener('change', event => {
        if (event.target?.id === 'inventorySort') {
          inventorySort = event.target.value;
          localStorage.setItem(`rpg_inventory_sort_${cfg.slug}`, inventorySort);
          render();
        } else if (event.target?.id === 'inventorySlotFilter') {
          inventorySlotFilter = event.target.value;
          localStorage.setItem(`rpg_inventory_slot_${cfg.slug}`, inventorySlotFilter);
          render();
        } else if (event.target?.id === 'inventoryTypeFilter') {
          inventoryTypeFilter = event.target.value;
          localStorage.setItem(`rpg_inventory_type_${cfg.slug}`, inventoryTypeFilter);
          render();
        } else if (event.target?.id === 'bestiaryRarityFilter') {
          bestiaryRarityFilter = event.target.value;
          render();
        } else if (event.target?.id === 'bestiaryCategoryFilter') {
          bestiaryCategoryFilter = event.target.value;
          render();
        } else if (event.target?.id === 'bestiaryStatusFilter') {
          bestiaryStatusFilter = event.target.value;
          render();
        } else if (event.target?.id === 'rpgDifficultyNumber' || event.target?.id === 'rpgDifficultyRange') {
          const unlocked = currentAdventureDifficulty();
          selectedDifficulty = Math.min(unlocked, Math.max(1, Math.floor(n(event.target.value, 1))));
          localStorage.setItem(`rpg_difficulty_${cfg.slug}`, String(selectedDifficulty));
          render();
        }
      });
    }
    ensureCombatOverlay();
    ensureDamageTrialOverlay();
    ensureRaidOverlay();
    ensureCaseOverlay();
  }

  function tabsHtml() {
    return `<div class="xp-tabs">
      <button type="button" class="xp-tab ${activeTab === 'progress' ? 'active' : ''}" data-xp-tab="progress">⚡ Progression</button>
      <button type="button" class="xp-tab ${activeTab === 'equipment' ? 'active' : ''}" data-xp-tab="equipment">🛡️ Équipement</button>
      <button type="button" class="xp-tab ${activeTab === 'cases' ? 'active' : ''}" data-xp-tab="cases">🎁 Cases</button>
      <button type="button" class="xp-tab ${activeTab === 'collection' ? 'active' : ''}" data-xp-tab="collection">📚 Collection</button>
    </div>`;
  }

  function classChoiceHtml() {
    return `<div class="xp-section">
      <div class="xp-section-title">Choisis ta classe</div>
      <div class="rpg-choice-intro">Ta classe est <span class="rpg-warning">permanente et définitive</span>. Elle renforce l’XP gagnée sur ton mouvement de spécialité.</div>
      <div class="rpg-class-grid">${Object.entries(CLASS_DEFS).map(([key, def]) => `
        <button type="button" class="rpg-class-card" data-rpg-class="${key}">
          <span class="rpg-class-icon">${def.icon}</span><strong>${def.title} · ${def.subtitle}</strong>
          <small>${def.perk}<br>${def.combat}</small>
        </button>`).join('')}</div>
    </div>`;
  }

  function normalizeSelectedDifficulty() {
    const unlocked = currentAdventureDifficulty();
    selectedDifficulty = Math.min(unlocked, Math.max(1, Math.floor(n(selectedDifficulty, unlocked))));
    localStorage.setItem(`rpg_difficulty_${cfg.slug}`, String(selectedDifficulty));
    return selectedDifficulty;
  }

  function difficultySelectorHtml() {
    const unlocked = currentAdventureDifficulty();
    const selected = normalizeSelectedDifficulty();
    return `<div class="world-picker">
      <div class="world-picker-head"><b>⚔️ Choisir le palier de difficulté</b><span>Maximum débloqué : ${unlocked}</span></div>
      <input id="rpgDifficultyNumber" type="number" inputmode="numeric" min="1" max="${unlocked}" step="1" value="${selected}" aria-label="Palier de difficulté">
      ${unlocked > 1 ? `<input id="rpgDifficultyRange" type="range" min="1" max="${unlocked}" step="1" value="${selected}" aria-label="Réglage rapide du palier">` : ''}
      <div class="world-picker-note">Palier choisi : <strong>${selected}</strong> · Puissance conseillée <strong>${fr(requiredPowerForDifficulty(selected),1)}</strong> · ta Puissance <strong>${fr(currentCombatPower(),1)}</strong> · PV relatifs ×${fr(difficultyHpMultiplier(selected),2)} · gold ×${fr(difficultyGoldMultiplier(selected),2)}. Les monstres sont tirés aléatoirement dans tout le bestiaire.</div>
      <div class="world-picker-note">Repères : ton score actuel doit couvrir la puissance conseillée. Un full Abyssal niveau 1 parfait est calibré autour du palier 100 ; le palier 101 crée un nouveau mur nécessitant des niveaux d’objet supplémentaires.</div>
    </div>`;
  }

  function athleteProfileImageHtml(fallbackIcon) {
    const raw = String(cfg.profileImage || cfg.avatarImage || '').trim();
    const fallback = `<span class="rpg-avatar-fallback">${esc(fallbackIcon || cfg.emoji || '⚔️')}</span>`;
    if (!raw) return fallback;
    const separator = raw.includes('?') ? '&' : '?';
    const source = `${raw}${separator}v=${encodeURIComponent(window.GA_APP_VERSION || 'V75')}`;
    return `${fallback}<img src="${esc(source)}" alt="Avatar de ${esc(cfg.name || cfg.slug || 'athlète')}" decoding="async" onerror="this.remove()">`;
  }

  function classProfileHtml() {
    const classKey = progress?.rpg_class;
    const def = CLASS_DEFS[classKey];
    if (!def) return classChoiceHtml();
    const stats = classStats(classKey);
    const canPlay = !!window.CoachingCloud?.canEditAthlete?.(cfg.slug);
    return `<div class="xp-section">
      <div class="xp-section-title">Classe de combat</div>
      <div class="rpg-profile">
        <div class="rpg-avatar">${athleteProfileImageHtml(def.icon)}</div>
        <div class="rpg-profile-copy"><b>${def.title}</b><span>${def.subtitle} · choix définitif</span></div>
      </div>
      <div class="rpg-statline">${stats.map(stat => `<div class="rpg-statbox"><b title="${esc(fr(stat.value,3))}">${fr(stat.value,1)}</b><span>${esc(stat.label)}</span><small>${esc(stat.detail)}</small></div>`).join('')}</div>
      <div class="rpg-influence-grid">
        <div class="rpg-influence-card force"><span class="k">${esc(def.mainStat)}</span><span class="v">Dégâts ×${fr(powerDamageMultiplier(stats[0].value),2)}</span><span class="d">Progression directe jusqu’à 300, puis croissance maîtrisée</span></div>
        <div class="rpg-influence-card chance"><span class="k">Chance</span><span class="v">${fr(critChancePct(),2)} % crit</span><span class="d">Peu commun+ ${fr(uncommonPlusMonsterChancePct(),3)} % · poids ×${fr(eliteMonsterMultiplier(),2)} sans plafond · Gold ×10 ${fr(goldJackpotChancePct(),2)} %</span></div>
        <div class="rpg-influence-card fortune"><span class="k">Fortune</span><span class="v">+${fr(stats[2].value*3,1)} % gold</span><span class="d">+3 % gold par rang</span></div>
      </div>
      <div class="rpg-combat-record"><span>Victoires <b>${n(progress?.combat_wins)}</b></span><span>Défaites <b>${n(progress?.combat_losses)}</b></span><span>Boss vaincus <b>${n(progress?.boss_wins)}</b></span><span>🔥 Perfect streak <b>${n(progress?.perfect_combat_streak)}</b></span><span>⚡ Combo loot <b>×${Math.max(1,n(progress?.combat_drop_combo,1))}</b></span><span>Record combo <b>×${Math.max(1,n(progress?.best_combat_drop_combo,1))}</b></span></div>
      <div class="combo-loot-note">Le combo loot reste actif entre les combats. Chaque combat parfait consécutif le double : ×1 → ×2 → ×4 → ×8, jusqu’à ×100. Une victoire non parfaite sans raté conserve le combo. Une défaite, un abandon ou un raté brise la streak et la remet à ×1. La Chance augmente sans plafond le poids de toutes les raretés Peu commun et supérieures. Le même multiplicateur est appliqué à chaque rang, donc Peu commun reste plus fréquent que Rare, Rare plus fréquent qu’Épique, puis la hiérarchie continue jusqu’à Abyssal.</div>
      <div class="boss-gate">
        <div class="boss-gate-head"><b>Palier de difficulté actuel</b><span class="boss-level">${currentAdventureDifficulty()}</span></div>
        <div class="boss-progress"><span style="width:${Math.min(100,n(progress?.kills_toward_boss)/50*100)}%"></span></div>
        <div class="boss-copy"><strong>${n(progress?.kills_toward_boss)}/50 monstres vaincus</strong> avant l’accès au boss. Chaque boss battu débloque le palier suivant, jusqu’au palier ultime 10 000.</div>
        <div class="boss-mults"><span>Puissance conseillée : ${fr(requiredPowerForDifficulty(),1)} · ta Puissance : ${fr(currentCombatPower(),1)}</span><span>PV relatifs ×${fr(difficultyHpMultiplier(),2)} · aucune résistance cachée · Gold ×${fr(difficultyGoldMultiplier(),2)}</span></div>
        <button type="button" id="rpgBossLaunch" class="boss-launch" ${!canPlay || n(progress?.kills_toward_boss)<50 ? 'disabled' : ''}>${n(progress?.kills_toward_boss)>=50 ? (currentAdventureDifficulty() >= 10000 ? '👑 Affronter le boss final du palier 10 000' : `👑 Affronter le boss du palier ${currentAdventureDifficulty()}`) : `🔒 Boss verrouillé · ${50-n(progress?.kills_toward_boss)} victoire${50-n(progress?.kills_toward_boss)===1?'':'s'} restante${50-n(progress?.kills_toward_boss)===1?'':'s'}`}</button>
        <div class="boss-lock">Boss : calibré pour environ 950 unités au seuil conseillé. Il demande un excellent combat, un sort actif bien placé ou davantage de Puissance. ${currentAdventureDifficulty() >= 10000 ? 'Victoire = palier ultime validé.' : `Victoire = difficulté ${currentAdventureDifficulty()+1} débloquée.`}</div>
      </div>
      ${difficultySelectorHtml()}
      ${monsterEncounterOddsHtml()}
      <button type="button" id="rpgLaunch" class="rpg-launch" ${canPlay ? '' : 'disabled'}>${canPlay ? `⚔️ Combattre au palier ${normalizeSelectedDifficulty()}` : 'Combat en lecture seule'}</button>
      <button type="button" id="rpgDamageTrial" class="damage-trial-launch" ${canPlay ? '' : 'disabled'}>${canPlay ? '🌀 Carte spéciale · Test de dégâts 30 s' : 'Test en lecture seule'}</button>
      <div class="damage-trial-note">Record personnel : <b>${fr(progress?.best_damage_trial,0)}</b> dégâts · ${n(progress?.damage_trial_attempts)} tentative${n(progress?.damage_trial_attempts)===1?'':'s'}</div>
    </div>`;
  }



  function raidTimeText(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
  }

  function derivedRaidStatus() {
    if (!raid?.raid_id) return 'none';
    const now = Date.now();
    if (now < new Date(raid.portal_opens_at).getTime()) return 'countdown';
    if (now < new Date(raid.portal_closes_at).getTime()) return 'open';
    return 'closed';
  }

  function raidParticipantsHtml() {
    if (!raidParticipants.length) return '<div class="raid-message">Personne n’est encore entré dans le portail.</div>';
    return `<div class="raid-roster">${raidParticipants.slice(0,10).map(row => `<div class="raid-roster-row"><strong>${esc(row.display_name || row.athlete_slug)}</strong><span>${row.finished_at ? `${fr(row.raw_damage,0)} dégâts` : 'en attente'}</span></div>`).join('')}${raidParticipants.length>10?`<div class="raid-message">+${raidParticipants.length-10} autre${raidParticipants.length-10>1?'s':''} participant${raidParticipants.length-10>1?'s':''}</div>`:''}</div>`;
  }

  function raidCardHtml() {
    const canEdit = !!window.CoachingCloud?.canEditAthlete?.(cfg.slug);
    const balance = n(progress?.raid_ultra_cases);
    if (!raid?.raid_id) {
      return `<div class="raid-card"><div class="raid-card-head"><div class="raid-card-icon">🗝️</div><div class="raid-card-copy"><b>Aucun portail de raid actif</b><span>Chaque nouvelle série validée possède 1 chance sur 100 de révéler une clé.</span></div><span class="raid-status">EN VEILLE</span></div><div class="raid-message">Quand une clé apparaît, le portail s’ouvre 15 minutes plus tard pour tous les personnages. Solde actuel : <strong>${balance} caisse${balance===1?'':'s'} Ultra</strong>.</div></div>`;
    }
    const status = derivedRaidStatus();
    const now = Date.now();
    const deadline = status === 'countdown' ? new Date(raid.portal_opens_at).getTime() : new Date(raid.portal_closes_at).getTime();
    const statusLabel = status === 'countdown' ? 'PORTAIL EN CHARGE' : status === 'open' ? 'RAID OUVERT' : 'RAID TERMINÉ';
    const button = status === 'closed'
      ? `<button type="button" class="raid-action" disabled>${raid.reward_finalized ? `🎁 ${n(raid.final_reward_cases)} caisse${n(raid.final_reward_cases)===1?'':'s'} Ultra attribuée${n(raid.final_reward_cases)===1?'':'s'}` : 'Calcul des récompenses en cours…'}</button>`
      : !raid.joined
        ? `<button type="button" id="rpgRaidJoin" class="raid-action" ${canEdit?'':'disabled'}>🌀 Entrer dans le raid</button>`
        : status === 'countdown'
          ? `<button type="button" class="raid-action" disabled>✅ Inscrit · attente de l’ouverture</button>`
          : raid.run_finished
            ? `<button type="button" class="raid-action" disabled>✅ Tentative terminée · ${n(raid.projected_reward_cases)} caisses estimées</button>`
            : `<button type="button" id="rpgRaidStart" class="raid-action" ${canEdit?'':'disabled'}>${raid.run_started ? '⚔️ Reprendre la tentative' : '⚔️ Attaquer pendant 30 secondes'}</button>`;
    return `<div class="raid-card"><div class="raid-card-head"><div class="raid-card-icon">${esc(raid.boss_icon || '🌀')}</div><div class="raid-card-copy"><b>${esc(raid.boss_name)}</b><span>Clé trouvée par ${esc(raid.discovered_by_name || raid.discovered_by_slug)} · niveau moyen ${n(raid.raid_level)}</span></div><span class="raid-status">${statusLabel}</span></div><div class="raid-countdown" id="raidCountdown">${status==='closed'?'00:00':raidTimeText(deadline-now)}</div><div class="raid-meta-grid"><div><b>${n(raid.participant_count)}</b><span>Participants</span></div><div><b>×${fr(raid.team_multiplier,0)}</b><span>Bonus équipe</span></div><div><b>${fr(raid.average_character_damage,0)}</b><span>Dégâts moyens</span></div><div><b>${fr(raid.global_raw_damage,0)}</b><span>Dégâts du raid</span></div></div><div class="raid-message">PV du boss : <strong>∞</strong>. Ta récompense dépend de tes dégâts personnels. Le multiplicateur collectif vaut <strong>×2 par personnage entré</strong>. Maximum : <strong>100 caisses Ultra</strong>.</div>${button}${raidParticipantsHtml()}<div class="raid-message">Solde disponible : <strong>${balance} caisse${balance===1?'':'s'} Ultra de raid</strong>.</div></div>`;
  }

  function updateRaidCountdownUi() {
    if (!raid?.raid_id) return;
    const status = derivedRaidStatus();
    const target = status === 'countdown' ? new Date(raid.portal_opens_at).getTime() : new Date(raid.portal_closes_at).getTime();
    const el = document.getElementById('raidCountdown');
    if (el) el.textContent = status === 'closed' ? '00:00' : raidTimeText(target-Date.now());
    if (raid.raid_status !== status && status !== 'none') loadRaid();
  }

  function progressHtml() {
    const xp = n(progress?.xp_total);
    const xpProgress = xpProgressFromTotal(xp);
    const level = n(progress?.level, xpProgress.level);
    const into = xpProgress.into;
    const nextCost = xpProgress.cost;
    const pct = Math.max(0, Math.min(100, into / Math.max(1, nextCost) * 100));
    const gl = n(progress?.gl_points, 0);
    const mult = n(progress?.gl_multiplier, 1);
    const gold = n(progress?.gold_balance, 0);
    return `
      <div class="xp-hero">
        <div class="xp-level">Niveau ${level}</div>
        <div class="xp-total">${fr(xp, 1)} <small>XP au total</small></div>
        <div class="xp-progress"><span style="width:${pct}%"></span></div>
        <div class="xp-next"><span>${fr(into, 1)} / ${fr(nextCost,0)} XP</span><span>Niveau ${level + 1}</span></div>
        <div class="xp-stats">
          <div class="xp-stat"><b>${gl > 0 ? fr(gl, 1) : '—'}</b><span>GL Points</span></div>
          <div class="xp-stat"><b>×${fr(mult, 2)}</b><span>Coefficient GL</span></div>
          <div class="xp-stat"><b>🪙 ${fr(gold, 0)}</b><span>Gold</span></div>
        </div>
      </div>
      ${classProfileHtml()}
      ${raidCardHtml()}`;
  }

  function statUpgradeHtml(statKey, label, description) {
    const snapshot = statSnapshot();
    const baseRank = snapshot.base[statKey];
    const gearRank = snapshot.gear[statKey];
    const collectionRank = snapshot.collection[statKey];
    const totalRank = baseRank + gearRank + collectionRank;
    const cost = upgradeCost(baseRank);
    const gold = n(progress?.gold_balance);
    const canEdit = !!window.CoachingCloud?.canEditAthlete?.(cfg.slug);
    return `<div class="upgrade-card">
      <div><b>${esc(label)} <span class="upgrade-rank" title="${esc(fr(totalRank, 3))}">${fr(totalRank, 1)}</span></b><small>Permanent ${fr(baseRank, 1)} · équipement +${fr(gearRank, 1)} · collection +${fr(collectionRank, 1)}<br>${esc(description)}</small></div>
      <button type="button" data-upgrade-stat="${statKey}" ${!canEdit || gold < cost || baseRank >= 50 ? 'disabled' : ''}>+1<br>${fr(cost, 0)} 🪙</button>
    </div>`;
  }

  function itemSaleEstimate(item) {
    const level = Math.min(1000, Math.max(1, Math.floor(n(item?.item_level, 1))));
    const itemCost = Math.max(1, n(item?.gold_cost, n(item?.case_cost, 100)));
    const rarityFactor = ITEM_VALUE_RARITY_MULTIPLIER[item?.rarity] || 1;
    return Math.max(1, Math.floor(level * itemCost * rarityFactor * (1 + equippedPassiveTotal('resale_bonus') / 100)));
  }

  function passiveText(item) {
    const def = PASSIVE_DEFS[item?.passive_type];
    if (!def || n(item?.passive_value) <= 0) return '';
    const value = fr(item.passive_value, ['case_luck','relic_luck'].includes(item.passive_type) ? 3 : 2);
    if (item.passive_type === 'case_luck') return `${def.icon} ${def.label} +${value} · bonus de caisse`;
    if (item.passive_type === 'relic_luck') return `${def.icon} ${def.label} +${value} · qualité de caisse`;
    if (item.passive_type === 'epic_hunter') return `${def.icon} ${def.label} +${value} % sur le pool Rare et supérieur`;
    if (item.passive_type === 'epic_gold_bonus') return `${def.icon} ${def.label} +${value} % d’or sur monstres épiques`;
    return `${def.icon} ${def.label} +${value} % de revente`;
  }

  function favoriteStatLabel(slot) {
    if (slot === 'weapon') return 'Force';
    if (slot === 'armor') return 'Chance';
    return 'Fortune';
  }

  function itemQualityInfo(rawQuality) {
    const pct = Math.min(100, Math.max(0, n(rawQuality, 0)));
    let label = 'Médiocre';
    if (pct >= 80) label = 'Excellente qualité';
    else if (pct >= 60) label = 'Très bonne qualité';
    else if (pct >= 40) label = 'Bonne qualité';
    else if (pct >= 20) label = 'Bof';
    return {
      pct,
      label,
      multiplier: 0.75 + pct / 400
    };
  }

  
function itemSetKey(item) {
  return String(item?.class_key || item?.item_type || item?.slot || 'set').toLowerCase();
}

function itemSetLabel(item) {
  if (item?.class_key && CLASS_DEFS[item.class_key]) return `Set ${CLASS_DEFS[item.class_key].title}`;
  const slot = SLOT_DEFS[item?.slot]?.label || 'Objet';
  return `Set ${slot}`;
}

function itemStatsModel(item) {
  const power = n(item.scaled_power_bonus, n(item.power_bonus));
  const mastery = n(item.scaled_mastery_bonus, n(item.mastery_bonus));
  const fortune = n(item.scaled_fortune_bonus, n(item.fortune_bonus));
  const quality = itemQualityInfo(item.stat_quality_roll);
  const passive = passiveText(item);
  const damage = n(item.damage_bonus_pct);
  const model = {
    header: [
      { key:'level', label:'Niveau', value:`${n(item.item_level, 1)}` },
      { key:'favorite', label:'Favorite', value:favoriteStatLabel(item.slot) },
      { key:'quality', label:'Qualité', value:quality.label },
      { key:'qualityPct', label:'Roll', value:`${fr(quality.pct, 2)} %` }
    ],
    stats: [
      damage ? { key:'damage', label:'Dégâts', value:`+${fr(damage, 2)} %` } : null,
      power ? { key:'power', label:'Puissance', value:`+${fr(power, 2)}` } : null,
      mastery ? { key:'mastery', label:'Chance', value:`+${fr(mastery, 2)}` } : null,
      fortune ? { key:'fortune', label:'Fortune', value:`+${fr(fortune, 2)}` } : null
    ].filter(Boolean),
    extra: [
      { key:'qualitycoef', label:'Coef. qualité', value:`×${fr(quality.multiplier, 4)}` },
      { key:'growth', label:'Croissance', value:`×${fr(ITEM_LEVEL_GROWTH, 2)}/niveau` },
      n(item.passive_growth_rate) ? { key:'passivegrowth', label:'Croiss. passif', value:`×${fr(item.passive_growth_rate, 4)}/niveau` } : null,
      { key:'sale', label:'Revente', value:`${fr(itemSaleEstimate(item),0)} gold` }
    ].filter(Boolean),
    passive,
    set: itemSetLabel(item),
    license: String(item?.item_name || '').toLowerCase() === 'licence pwl' ? 'Gold combat +10 %' : ''
  };
  return model;
}

function itemStatsText(item) {
  const model = itemStatsModel(item);
  const values = [];
  model.header.forEach(part => values.push(`${part.label} ${part.value}`));
  model.stats.forEach(part => values.push(`${part.label} ${part.value}`));
  model.extra.forEach(part => values.push(`${part.label} ${part.value}`));
  if (model.passive) values.push(model.passive);
  if (model.set) values.push(model.set);
  if (model.license) values.push(model.license);
  return values.join(' · ') || 'Aucun bonus';
}

function itemStatsCompactHtml(item) {
  const model = itemStatsModel(item);
  const head = model.header.map(part => `<span class="item-pill item-pill-${esc(part.key)}"><b>${esc(part.label)}</b> ${esc(part.value)}</span>`).join('');
  const primary = model.stats.length
    ? model.stats.map(part => `<span class="item-stat-chip stat-${esc(part.key)}"><small>${esc(part.label)}</small><strong>${esc(part.value)}</strong></span>`).join('')
    : `<span class="item-stat-chip"><small>Statut</small><strong>Objet utilitaire</strong></span>`;
  const secondary = model.extra.map(part => `<span class="item-pill item-pill-${esc(part.key)}"><b>${esc(part.label)}</b> ${esc(part.value)}</span>`).join('');
  return `<div class="item-card-details">      <div class="item-pill-row">${head}</div>      <div class="item-section-label">Statistiques</div>      <div class="item-stat-grid">${primary}</div>      <div class="item-section-label">Infos bonus</div>      <div class="item-pill-row">${secondary}${model.set ? `<span class="item-pill item-pill-set"><b>Set</b> ${esc(model.set)}</span>` : ''}${model.license ? `<span class="item-pill item-pill-license"><b>Bonus</b> ${esc(model.license)}</span>` : ''}</div>      ${model.passive ? `<div class="item-passive-banner">${esc(model.passive)}</div>` : ''}    </div>`;
}


function itemComparisonValue(item, key) {
  if (!item) return 0;
  if (key === 'damage') return n(item.damage_bonus_pct);
  if (key === 'power') return n(item.scaled_power_bonus, n(item.power_bonus));
  if (key === 'mastery') return n(item.scaled_mastery_bonus, n(item.mastery_bonus));
  if (key === 'fortune') return n(item.scaled_fortune_bonus, n(item.fortune_bonus));
  return 0;
}

function itemComparisonHtml(item) {
  if (!item || item.equipped || !SLOT_DEFS[item.slot]) return '';

  const slotDef = SLOT_DEFS[item.slot];
  const equipped = inventory.find(candidate => candidate.slot === item.slot && candidate.equipped);
  const emptyLabels = {
    weapon: 'Aucune arme équipée',
    armor: 'Aucune armure équipée',
    relic: 'Aucune relique équipée'
  };
  const actionLabels = {
    weapon: 'Équipe une arme',
    armor: 'Équipe une armure',
    relic: 'Équipe une relique'
  };

  if (!equipped) {
    return `<div class="item-comparison"><div class="item-comparison-title"><strong>${slotDef.icon} Comparaison ${esc(slotDef.label)}</strong><span>${esc(emptyLabels[item.slot] || 'Emplacement vide')}</span></div><div class="item-comparison-empty">${esc(actionLabels[item.slot] || 'Équipe un objet')} pour afficher les écarts automatiquement.</div></div>`;
  }

  const stats = [
    { key:'damage', label:'Dégâts', suffix:' %' },
    { key:'power', label:'Puissance', suffix:'' },
    { key:'mastery', label:'Chance', suffix:'' },
    { key:'fortune', label:'Fortune', suffix:'' }
  ];
  const rows = stats.map(stat => {
    const candidate = itemComparisonValue(item, stat.key);
    const current = itemComparisonValue(equipped, stat.key);
    const delta = candidate - current;
    const state = delta > 0.0001 ? 'gain' : delta < -0.0001 ? 'loss' : 'equal';
    const sign = delta > 0.0001 ? '+' : '';
    return `<div class="item-comparison-stat ${state}"><span>${esc(stat.label)}</span><b>${sign}${fr(delta,2)}${stat.suffix}</b></div>`;
  }).join('');

  return `<div class="item-comparison"><div class="item-comparison-title"><strong>${slotDef.icon} Comparé à ${item.slot === 'weapon' ? 'l’arme' : item.slot === 'armor' ? 'l’armure' : 'la relique'} équipée</strong><span>${esc(equipped.item_name)}</span></div><div class="item-comparison-grid">${rows}</div></div>`;
}

function catalogCollectionText(item) {
    const values = [];
    if (n(item.collection_power_bonus)) values.push(`Force +${fr(n(item.collection_power_bonus) / 10, 1)}`);
    if (n(item.collection_mastery_bonus)) values.push(`Chance +${fr(n(item.collection_mastery_bonus) / 10, 1)}`);
    if (n(item.collection_fortune_bonus)) values.push(`Fortune +${fr(n(item.collection_fortune_bonus) / 10, 1)}`);
    return values.join(' · ') || 'Carte de collection';
  }

  function equippedSlotsHtml() {
    return `<div class="equipment-slots">${Object.entries(SLOT_DEFS).map(([slot, def]) => {
      const item = inventory.find(candidate => candidate.slot === slot && candidate.equipped);
      return `<div class="equipment-slot">
        <div class="slot-icon">${def.icon}</div><span class="slot-label">${def.label}</span>
        ${item ? `<span class="slot-item rarity-${esc(item.rarity)}">${esc(item.item_name)}${n(item.quantity,1)>1?` ×${n(item.quantity,1)}`:''}</span><span class="slot-stats">${esc(itemStatsText(item))}</span>` : '<span class="slot-item">Emplacement vide</span>'}
      </div>`;
    }).join('')}</div>`;
  }

  function filteredSortedInventory() {
    const types = new Set(inventory.map(item => item.item_type || 'generic'));
    if (!types.has(inventoryTypeFilter)) inventoryTypeFilter = 'all';
    const filtered = inventory.filter(item => (inventorySlotFilter === 'all' || item.slot === inventorySlotFilter) && (inventoryTypeFilter === 'all' || (item.item_type || 'generic') === inventoryTypeFilter));
    return filtered.sort((a, b) => {
      if (inventorySort === 'level') return n(b.item_level) - n(a.item_level) || (RARITY_RANK[b.rarity] || 0) - (RARITY_RANK[a.rarity] || 0);
      if (inventorySort === 'damage') return n(b.damage_bonus_pct) - n(a.damage_bonus_pct) || n(b.item_level) - n(a.item_level);
      if (inventorySort === 'quantity') return n(b.quantity,1) - n(a.quantity,1) || String(a.item_name).localeCompare(String(b.item_name),'fr');
      if (inventorySort === 'name') return String(a.item_name).localeCompare(String(b.item_name),'fr');
      if (inventorySort === 'recent') return new Date(b.obtained_at) - new Date(a.obtained_at);
      return (RARITY_RANK[b.rarity] || 0) - (RARITY_RANK[a.rarity] || 0) || n(b.item_level) - n(a.item_level) || String(a.item_name).localeCompare(String(b.item_name),'fr');
    });
  }

  function inventoryToolbarHtml() {
    const types = [...new Set(inventory.map(item => item.item_type || 'generic'))].sort((a,b)=>a.localeCompare(b,'fr'));
    return `<div class="inventory-toolbar"><label>Trier<select id="inventorySort"><option value="rarity" ${inventorySort==='rarity'?'selected':''}>Rareté</option><option value="level" ${inventorySort==='level'?'selected':''}>Niveau</option><option value="damage" ${inventorySort==='damage'?'selected':''}>% dégâts</option><option value="quantity" ${inventorySort==='quantity'?'selected':''}>Quantité</option><option value="name" ${inventorySort==='name'?'selected':''}>Nom</option><option value="recent" ${inventorySort==='recent'?'selected':''}>Plus récent</option></select></label><label>Emplacement<select id="inventorySlotFilter"><option value="all">Tous</option>${Object.entries(SLOT_DEFS).map(([key,def])=>`<option value="${key}" ${inventorySlotFilter===key?'selected':''}>${def.label}</option>`).join('')}</select></label><label class="wide">Type<select id="inventoryTypeFilter"><option value="all">Tous les types</option>${types.map(type=>`<option value="${esc(type)}" ${inventoryTypeFilter===type?'selected':''}>${esc(type)}</option>`).join('')}</select></label></div>`;
  }

  function depositAllEligibleCount() {
    const deposited = new Set(itemCollection.map(row => row.catalog_key));
    const eligible = new Set();
    for (const item of inventory) {
      if (item.is_locked) continue;
      if (!item.catalog_key || deposited.has(item.catalog_key)) continue;
      if (item.equipped && n(item.quantity, 1) <= 1) continue;
      eligible.add(item.catalog_key);
    }
    return eligible.size;
  }

  function sellAllEligibleQuantity() {
    return inventory
      .filter(item => !item.equipped && !item.is_locked)
      .reduce((sum, item) => sum + n(item.quantity, 1), 0);
  }

  function lockedInventoryQuantity() {
    return inventory
      .filter(item => !!item.is_locked)
      .reduce((sum, item) => sum + n(item.quantity, 1), 0);
  }

  function transferRecipientOptionsHtml() {
    if (!transferRecipients.length) {
      return '<option value="">Aucun autre athlète disponible</option>';
    }
    return `<option value="">Choisir un destinataire</option>${transferRecipients.map(person => `<option value="${esc(person.athlete_slug)}">${esc(person.display_name || person.athlete_slug)}</option>`).join('')}`;
  }

  function itemTransferModalHtml() {
    if (!transferModalItemId) return '';
    const item = inventory.find(candidate => String(candidate.id) === String(transferModalItemId));
    if (!item) return '';
    const rarity = RARITY_DEFS[item.rarity] || RARITY_DEFS.normal;
    const maxQuantity = Math.max(1, n(item.quantity, 1));
    return `<div class="item-transfer-overlay" role="dialog" aria-modal="true" aria-label="Envoyer un objet">
      <div class="item-transfer-card">
        <div class="item-transfer-head"><div><h3>🎁 Envoyer un objet</h3></div><button type="button" class="item-transfer-close" data-transfer-cancel aria-label="Fermer">×</button></div>
        <div class="item-transfer-object"><strong>${rarity.icon} ${esc(item.item_name)}</strong><span>${rarity.label} · Niveau ${n(item.item_level,1)} · ${maxQuantity} exemplaire${maxQuantity>1?'s':''} disponible${maxQuantity>1?'s':''}${item.is_locked?' · 🔒 objet verrouillé':''}</span></div>
        <div class="item-transfer-form">
          <label>Destinataire<select id="itemTransferRecipient" ${transferBusy ? 'disabled' : ''}>${transferRecipientOptionsHtml()}</select></label>
          <label>Quantité<input id="itemTransferQuantity" type="number" min="1" max="${maxQuantity}" step="1" value="1" inputmode="numeric" ${transferBusy ? 'disabled' : ''}></label>
          <div class="item-transfer-note">L’objet est retiré de ton inventaire et arrive immédiatement dans celui du destinataire. Un objet équipé ne peut pas être envoyé. Le loquet protège seulement des actions globales : un envoi manuel reste possible.</div>
        </div>
        <div class="item-transfer-actions"><button type="button" class="item-transfer-cancel" data-transfer-cancel ${transferBusy ? 'disabled' : ''}>Annuler</button><button type="button" class="item-transfer-confirm" data-transfer-confirm ${transferBusy || !transferRecipients.length ? 'disabled' : ''}>${transferBusy ? 'Envoi…' : 'Envoyer'}</button></div>
      </div>
    </div>`;
  }

  function inventoryHtml() {
    if (!inventory.length) return '<div class="empty-state">Ton inventaire est vide.<br>Ouvre une case ou bats un monstre pour obtenir ton premier objet.</div>';
    const level = currentAdventureDifficulty();
    const canEdit = !!window.CoachingCloud?.canEditAthlete?.(cfg.slug);
    const visible = filteredSortedInventory();
    const depositCount = depositAllEligibleCount();
    const sellCount = sellAllEligibleQuantity();
    const protectedCount = lockedInventoryQuantity();
    const bulkActions = `<div class="inventory-bulk-actions">
      <button type="button" class="deposit-all-button" data-deposit-all ${!canEdit || collectionBusy || depositCount <= 0 ? 'disabled' : ''}>📚 Tout déposer<br><small>${depositCount} objet${depositCount>1?'s':''} unique${depositCount>1?'s':''}</small></button>
      <button type="button" class="sell-all-button" data-sell-all ${!canEdit || collectionBusy || sellCount <= 0 ? 'disabled' : ''}>🪙 Tout vendre<br><small>${sellCount} exemplaire${sellCount>1?'s':''}</small></button>
      <div class="inventory-bulk-note">🔒 Les objets verrouillés sont toujours ignorés par « Tout déposer » et « Tout vendre ». ${protectedCount ? `${protectedCount} exemplaire${protectedCount>1?'s':''} actuellement protégé${protectedCount>1?'s':''}.` : 'Aucun objet verrouillé.'}</div>
    </div>`;
    return `${bulkActions}${inventoryToolbarHtml()}${visible.length ? `<div class="inventory-list">${visible.map(item => {
      const rarity = RARITY_DEFS[item.rarity] || RARITY_DEFS.normal;
      const slot = SLOT_DEFS[item.slot] || { label: item.slot, icon: '🎒' };
      const locked = level < n(item.required_level, 1);
      return `<article class="inventory-card rarity-${esc(item.rarity)} ${item.equipped ? 'equipped' : ''} ${item.is_locked ? 'item-locked' : ''}">
        <div class="inventory-top"><div><div class="inventory-name">${rarity.icon} ${esc(item.item_name)}</div><div class="inventory-meta">${slot.icon} ${esc(slot.label)} · <span class="item-type-label">${esc(item.item_type || 'generic')}</span> · ${rarity.label} · <span class="item-level-badge">Niv. ${n(item.item_level,1)}</span> · <span class="inventory-copy-count">${n(item.quantity,1)} exemplaire${n(item.quantity,1)>1?'s':''}</span></div>${item.is_locked ? '<span class="inventory-lock-label">🔒 Protégé des actions globales</span>' : ''}</div><div class="inventory-card-status"><button type="button" class="item-lock-button ${item.is_locked ? 'active' : ''}" data-lock-item="${esc(item.id)}" data-locked="${item.is_locked ? 'true' : 'false'}" aria-pressed="${item.is_locked ? 'true' : 'false'}" title="${item.is_locked ? 'Déverrouiller cet objet' : 'Verrouiller cet objet'}" ${!canEdit || collectionBusy ? 'disabled' : ''}>${item.is_locked ? '🔒' : '🔓'}</button>${item.equipped ? '<span title="Équipé">✅</span>' : ''}${n(item.quantity,1)>1?`<span class="stack-badge">×${n(item.quantity,1)}</span>`:''}</div></div>
        ${itemStatsCompactHtml(item)}
        ${itemComparisonHtml(item)}
        <div class="inventory-actions"><button type="button" class="equip-button" data-equip-item="${esc(item.id)}" ${!canEdit || item.equipped || locked || collectionBusy || transferBusy ? 'disabled' : ''}>${item.equipped ? 'Équipé' : locked ? `Palier ${n(item.required_level)}` : 'Équiper'}</button><button type="button" class="deposit-button" data-deposit-item="${esc(item.id)}" ${!canEdit || collectionBusy || transferBusy || itemCollection.some(row => row.catalog_key === item.catalog_key) ? 'disabled' : ''}>${itemCollection.some(row => row.catalog_key === item.catalog_key) ? 'Déjà au codex' : 'Déposer 1'}</button><button type="button" class="gift-button" data-send-item="${esc(item.id)}" ${!canEdit || collectionBusy || transferBusy || item.equipped || !transferRecipients.length ? 'disabled' : ''}>🎁 Envoyer</button><button type="button" class="sell-button" data-sell-item="${esc(item.id)}" ${!canEdit || collectionBusy || transferBusy || item.equipped ? 'disabled' : ''}>Vendre 1<br><small>${fr(itemSaleEstimate(item),0)} 🪙</small></button></div>
      </article>`;
    }).join('')}</div>` : '<div class="inventory-empty-filter">Aucun objet ne correspond à ces filtres.</div>'}${itemTransferModalHtml()}`;
  }

  function equipmentHtml() {
    const def = CLASS_DEFS[progress?.rpg_class] || CLASS_DEFS.warrior;
    return `
      <div class="gold-wallet"><div><span>TON PORTE-MONNAIE</span><strong>🪙 ${fr(progress?.gold_balance, 0)} gold</strong></div><span>Total gagné : ${fr(progress?.gold_total_earned, 0)}</span></div>
      <div class="xp-section"><div class="xp-section-title">Améliorer les statistiques · coût exponentiel (+15 % par rang)</div><div class="upgrade-grid">
        ${statUpgradeHtml('power', def.mainStat, '+4 % de dégâts de base par rang.')}
        ${statUpgradeHtml('mastery', 'Chance', 'Critiques à rendement dégressif · jackpot gold ×10 · apparition des monstres élites sans plafond · amélioration minuscule des caisses.')}
        ${statUpgradeHtml('fortune', 'Fortune', '+3 % de gold gagné par victoire et par rang.')}
      </div></div>
      <div class="xp-section"><div class="xp-section-title">Équipement porté</div>${equippedSlotsHtml()}</div>
      <div class="xp-section"><div class="xp-section-title">Inventaire (${inventory.reduce((sum,item)=>sum+n(item.quantity,1),0)} objets · ${inventory.length} piles)</div>${inventoryHtml()}</div>`;
  }

  function casesHtml() {
    const gold = n(progress?.gold_balance, 0);
    const maxLevel = itemLevelForDifficulty();
    selectedCaseLevel = Math.min(maxLevel, Math.max(1, Math.floor(n(selectedCaseLevel, maxLevel))));
    const canEdit = !!window.CoachingCloud?.canEditAthlete?.(cfg.slug);
    const difficulty = caseDifficultyForLevel(selectedCaseLevel);
    const types = [
      { key:'global', icon:'🎁', title:'Caisse globale', note:'Arme, armure ou relique. Prix standard.' },
      { key:'weapon', icon:'🗡️', title:'Caisse Arme', note:'Contient uniquement une arme. Prix ×2.' },
      { key:'armor', icon:'🛡️', title:'Caisse Armure', note:'Contient uniquement une armure. Prix ×2.' },
      { key:'relic', icon:'💎', title:'Caisse Relique', note:'Contient uniquement une relique. Prix ×2.' }
    ];
    const pricesReady = types.every(type => serverCaseCost(selectedCaseLevel, type.key) !== null);
    if (!pricesReady && !casePriceLoadingLevels.has(selectedCaseLevel)) queueServerCasePriceLoad(selectedCaseLevel);
    const cards = types.map(type => {
      const serverCost = serverCaseCost(selectedCaseLevel, type.key);
      const loadingPrice = serverCost === null;
      const cost = serverCost ?? estimatedCaseCost(selectedCaseLevel, type.key);
      return `<article class="case-type-card">
        <div class="case-icon">${type.icon}</div>
        <b>${type.title}</b>
        <small>${type.note}</small>
        <div class="case-price">${loadingPrice ? '⏳ Prix serveur…' : `${fr(cost,0)} gold / caisse`}</div>
        <div class="case-buy-grid">${CASE_COUNTS.map(count => `<button type="button" class="case-buy-button" data-open-case="${selectedCaseLevel}" data-case-type="${type.key}" data-open-count="${count}" ${loadingPrice || gold < cost * count || !canEdit || openingCase ? 'disabled' : ''}><strong>×${count}</strong><br>${loadingPrice ? '—' : `${fr(cost * count,0)} 🪙`}</button>`).join('')}</div>
      </article>`;
    }).join('');
    const raidBalance = n(progress?.raid_ultra_cases);
    const raidCase = `<div class="raid-case-card"><div class="raid-case-head"><span class="raid-case-icon">🌀🎁</span><div><b>Caisse Ultra de raid</b><small>Récompense des portails mondiaux · niveau d’objet égal au niveau du raid</small></div><strong>${raidBalance}</strong></div><div class="raid-case-rates"><span>🫧 Abyssal 0,01 %</span><span>🌟 Ultra méga mythique 0,10 %</span><span>🔴 Mythique 1 %</span><span>🟡 Légendaire 10 %</span><span>🟠 Épique 30 %</span><span>🟣 Rare 35 %</span></div><div class="case-buy-grid">${CASE_COUNTS.map(count => `<button type="button" class="case-buy-button" data-open-raid-case="${count}" ${raidBalance<count || !canEdit || openingCase ? 'disabled' : ''}><strong>×${count}</strong> GRATUIT</button>`).join('')}</div></div>`;
    return `
      <div class="gold-wallet"><div><span>GOLD DISPONIBLE</span><strong>🪙 ${fr(gold, 0)}</strong></div><span>Palier ${currentAdventureDifficulty()} · objet max niveau ${maxLevel}</span></div>
      <div class="xp-section"><div class="xp-section-title">Choisir le niveau de la caisse</div>
        <div class="case-level-picker">
          <div class="case-level-head"><b>Niveau d’objet</b><strong id="caseLevelValue">${selectedCaseLevel}</strong></div>
          <input type="range" id="caseLevelRange" min="1" max="${maxLevel}" value="${selectedCaseLevel}" step="1">
          <div class="case-level-note">Niveau ${selectedCaseLevel} = tranche de paliers ${difficulty}-${Math.min(10000,difficulty+9)}. Ton palier actuel autorise jusqu’au niveau ${maxLevel}.</div>
        </div>
        <div class="case-type-grid">${cards}</div>
      </div>
      <div class="xp-section"><div class="xp-section-title">Récompenses de raid</div>${raidCase}</div>
      <div class="xp-section"><div class="xp-section-title">Probabilités transparentes</div><div class="odds-grid">${Object.entries(RARITY_DEFS).map(([key, rarity]) => { const odds=normalCaseOdds()[key] ?? rarity.rate; return `<div class="odds-row rarity-${key}"><b>${rarity.icon} ${rarity.label}</b><span>${fr(odds, odds < 0.01 ? 5 : odds < 1 ? 3 : 2)} %</span></div>`; }).join('')}</div><div class="case-note">Le type de caisse ne change pas les probabilités de rareté. Il filtre seulement l’emplacement. Les caisses Arme, Armure et Relique coûtent deux fois le prix de la caisse globale. Les prix affichés sont maintenant lus directement depuis Supabase : le bouton et le serveur utilisent exactement le même montant.</div></div>`;
  }


function formatCollectionDate(value) {
  if (!value) return 'Date inconnue';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date inconnue';
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function itemDropProbability(item) {
  const rarity = RARITY_DEFS[item?.rarity] || RARITY_DEFS.normal;
  const classKey = progress?.rpg_class;
  if (item?.class_key && classKey && item.class_key !== classKey) return { value: 0, label: `Réservé à la classe ${CLASS_DEFS[item.class_key]?.title || item.class_key}` };
  const eligible = itemCatalog.filter(candidate => candidate.rarity === item.rarity && (!candidate.class_key || !classKey || candidate.class_key === classKey));
  const probability = n(rarity.rate) / Math.max(1, eligible.length);
  return { value: probability, label: `≈ ${fr(probability, probability < 1 ? 3 : 2)} % par caisse (${rarity.chance} pour la rareté)` };
}

function catalogFallbackFromRow(row) {
  const inv = inventory.find(item => item.catalog_key && row?.catalog_key && item.catalog_key === row.catalog_key) || {};
  const slot = inv.slot || row?.slot || 'weapon';
  const rarity = inv.rarity || row?.rarity || 'normal';
  const item_type = inv.item_type || row?.item_type || 'generic';
  const sourceName = row?.source_item_name || inv.item_name || row?.item_name || (row?.catalog_key ? row.catalog_key.replaceAll('_',' ') : 'Objet inconnu');
  return {
    catalog_key: row?.catalog_key || inv.catalog_key || `fallback_${sourceName.replace(/\s+/g,'_').toLowerCase()}`,
    item_name: sourceName,
    rarity,
    slot,
    item_type,
    icon: inv.icon || SLOT_DEFS[slot]?.icon || '🎴',
    power_collect_bonus: n(row?.deposited_power_bonus),
    mastery_collect_bonus: n(row?.deposited_mastery_bonus),
    fortune_collect_bonus: n(row?.deposited_fortune_bonus)
  };
}


function bestiaryExpectedTotal() {
  return Math.max(monsterCatalog.length, 300);
}

function rarityItemCounts() {
  const order = ['common','uncommon','rare','epic','legendary','mythic','ultra_mythic','abyssal'];
  return order.map(key => {
    const total = itemCatalog.filter(item => (item.rarity || 'normal') === key).length;
    const owned = itemCollection.filter(item => {
      const catalogItem = itemCatalog.find(ci => ci.catalog_key === item.catalog_key);
      return (catalogItem?.rarity || catalogFallbackFromRow(item).rarity) === key;
    }).length;
    return { key, total, owned, def: RARITY_DEFS[key] };
  }).filter(row => row.total > 0 || row.owned > 0);
}

function depositedItemsHtml() {
  if (!itemCollection.length) return '<div class="empty-state">Aucun objet déposé dans le codex.</div>';
  const catalogByKey = new Map(itemCatalog.map(item => [item.catalog_key, item]));
  return `<div class="deposited-list">${[...itemCollection].sort((a,b)=>new Date(b.deposited_at)-new Date(a.deposited_at)).map(row => {
    const item = catalogByKey.get(row.catalog_key) || catalogFallbackFromRow(row);
    const rarity = RARITY_DEFS[item.rarity] || RARITY_DEFS.normal;
    const probability = itemDropProbability(item);
    return `<article class="deposited-row rarity-${esc(item.rarity)}"><div class="deposited-icon">${esc(item.icon || SLOT_DEFS[item.slot]?.icon || '🎴')}</div><div class="deposited-copy"><b>${rarity.icon} ${esc(item.item_name)}</b><span>${esc(rarity.label)} · ${esc(probability.label)}</span><span>Déposé le <strong>${esc(formatCollectionDate(row.deposited_at))}</strong></span><span>Objet sacrifié : <strong>niveau ${n(row.deposited_item_level,1)} · dégâts +${fr(row.deposited_damage_bonus_pct,2)} %</strong></span><span>Statistiques de l’objet : <strong>Puissance +${fr(n(row.deposited_power_bonus) / 10,1)} · Chance +${fr(n(row.deposited_mastery_bonus) / 10,1)} · Fortune +${fr(n(row.deposited_fortune_bonus) / 10,1)}</strong></span><span>Bonus permanent du codex : <strong>${esc(catalogCollectionText(item))}</strong></span></div></article>`;
  }).join('')}</div>`;
}


function bestiaryCollectionHtml() {
  const discovered = new Map(monsterCollection.map(row => [row.monster_key, row]));
  const total = Math.max(bestiaryExpectedTotal(), discovered.size);
  const found = discovered.size;
  const bonus = n(progress?.collection_xp_bonus);
  const categories = [...new Set(monsterCatalog.map(monster => monster.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'));
  const query = bestiarySearch.trim().toLocaleLowerCase('fr');
  if (!monsterCatalog.length) {
    return `<div class="collection-summary"><div><b>${found}/—</b><span>Monstres</span></div><div><b>+${fr(bonus,1)} %</b><span>XP permanent</span></div><div><b>${monsterCollection.reduce((s,r)=>s+n(r.kills),0)}</b><span>Kills connus</span></div></div>
      <div class="empty-state"><strong>Le catalogue n’a pas été chargé.</strong><br>Exécute le correctif SQL du bestiaire puis recharge la page avec Ctrl + F5.</div>`;
  }
  const filtered = monsterCatalog.filter(monster => {
    const entry = discovered.get(monster.monster_key);
    if (bestiaryRarityFilter !== 'all' && monster.rarity !== bestiaryRarityFilter) return false;
    if (bestiaryCategoryFilter !== 'all' && monster.category !== bestiaryCategoryFilter) return false;
    if (bestiaryStatusFilter === 'found' && !entry) return false;
    if (bestiaryStatusFilter === 'missing' && entry) return false;
    if (query && !`${monster.monster_name} ${monster.category || ''}`.toLocaleLowerCase('fr').includes(query)) return false;
    return true;
  });
  return `<div class="collection-summary"><div><b>${found}/${total}</b><span>Monstres</span></div><div><b>+${fr(bonus,1)} %</b><span>XP permanent</span></div><div><b>${monsterCollection.reduce((s,r)=>s+n(r.kills),0)}</b><span>Kills connus</span></div></div>
    <div class="bestiary-tools"><input id="bestiarySearch" type="search" value="${esc(bestiarySearch)}" placeholder="Rechercher parmi les ${total} monstres…"><select id="bestiaryRarityFilter"><option value="all">Toutes raretés</option>${Object.entries(MONSTER_RARITY_DEFS).map(([key,def])=>`<option value="${key}" ${bestiaryRarityFilter===key?'selected':''}>${def.icon} ${def.label}</option>`).join('')}</select><select id="bestiaryStatusFilter"><option value="all" ${bestiaryStatusFilter==='all'?'selected':''}>Tous</option><option value="found" ${bestiaryStatusFilter==='found'?'selected':''}>Découverts</option><option value="missing" ${bestiaryStatusFilter==='missing'?'selected':''}>Non découverts</option></select><select id="bestiaryCategoryFilter"><option value="all">Toutes catégories</option>${categories.map(category=>`<option value="${esc(category)}" ${bestiaryCategoryFilter===category?'selected':''}>${esc(category)}</option>`).join('')}</select><div class="bestiary-filter-count">${filtered.length} monstre${filtered.length>1?'s':''} affiché${filtered.length>1?'s':''} · Chaque carte affiche l’XP réelle au niveau et au palier choisis, bonus du bestiaire inclus.</div></div>
    <div class="bestiary-grid">${filtered.map(monster => {
      const entry = discovered.get(monster.monster_key);
      const hidden = !monster.visible_before_discovery && !entry;
      const def = MONSTER_RARITY_DEFS[monster.rarity] || MONSTER_RARITY_DEFS.common;
      const name = hidden ? '???' : monsterDisplayName(monster.monster_name);
      const icon = hidden ? (monster.rarity === 'secret' ? '🌈❓' : '❓') : monster.icon;
      const spriteHtml = !hidden ? monsterSpriteImgHtml(monster.monster_name, monsterDisplayName(monster.monster_name), 'monster-card-sprite', monster.skin_path || '') : '';
      const visualHtml = spriteHtml
        ? `<div class="monster-sprite-host"><span class="monster-emoji-fallback with-image">${esc(icon)}</span>${spriteHtml}</div>`
        : `<span class="monster-emoji-fallback">${esc(icon)}</span>`;
      return `<article class="monster-card rarity-${esc(monster.rarity)} ${entry ? 'discovered' : 'undiscovered'} ${hidden ? 'hidden-monster' : ''}">
        ${entry ? `<span class="monster-kills">×${n(entry.kills)}</span>` : ''}<div class="monster-icon">${visualHtml}</div><div class="monster-name">${esc(name)}</div>
        <div class="monster-meta">${def.icon} ${hidden ? 'Rareté inconnue' : def.label}${entry ? ' · découvert' : ' · non découvert'}</div>
        <div class="monster-category">${hidden ? 'Archive inconnue' : esc(monster.category || 'Autres')}</div>
        ${entry ? `<div class="monster-discovery-date">Première victoire : ${esc(formatCollectionDate(entry.first_discovered_at))}</div>` : ''}
        <div class="monster-bonus">${hidden ? 'XP de combat inconnue' : `Combat : +${esc(monsterXpMonitorLabel(monster.rarity))}`}</div>
        <div class="monster-bonus">${hidden ? 'Bonus inconnu' : `Découverte : +${fr(monster.xp_bonus,0)} % XP`}</div></article>`;
    }).join('')}</div>`;
}



function itemCodexHtml() {
  const collectionByKey = new Map(itemCollection.map(row => [row.catalog_key, row]));
  const owned = new Set(collectionByKey.keys());
  const catalogByKey = new Map(itemCatalog.map(item => [item.catalog_key, item]));
  for (const row of itemCollection) {
    if (!catalogByKey.has(row.catalog_key)) {
      const fallback = catalogFallbackFromRow(row);
      itemCatalog.push(fallback);
      catalogByKey.set(fallback.catalog_key, fallback);
    }
  }
  const rarityOrder = ['normal','common','uncommon','rare','epic','legendary','mythic','ultra_mythic','abyssal'];
  const groups = [...new Set(itemCatalog.map(item => item.rarity || 'normal'))].sort((a,b)=>{
    const ai = rarityOrder.indexOf(a); const bi = rarityOrder.indexOf(b);
    return (ai===-1?999:ai) - (bi===-1?999:bi);
  });
  const totals = collectionTotals();
  const collected = owned.size;
  const totalItems = Math.max(itemCatalog.length, collected);
  const rarityBreakdown = rarityItemCounts();
  return `<div class="collection-summary"><div><b>${collected}/${totalItems}</b><span>Objets uniques</span></div><div><b>+${fr(totals.power,1)}</b><span>Force</span></div><div><b>+${fr(totals.mastery + totals.fortune,1)}</b><span>Chance + Fortune</span></div></div>
    <div class="bestiary-grid" style="margin-bottom:10px">${rarityBreakdown.map(row => `<article class="monster-card rarity-${row.key}" style="min-height:auto;padding:10px"><div class="monster-name">${row.def?.icon || '🎴'} ${row.def?.label || row.key}</div><div class="monster-bonus">${row.owned}/${row.total}</div><div class="monster-meta">objets collectés</div></article>`).join('')}</div>
    <div class="xp-section-title">Objets déposés</div>${depositedItemsHtml()}
    <div class="xp-section-title">Album complet</div><div class="codex-groups">${groups.map(rarity => {
      const def = RARITY_DEFS[rarity] || { icon:'🎴', label: rarity };
      const items = itemCatalog.filter(item => (item.rarity || 'normal') === rarity);
      if (!items.length) return '';
      return `<details class="codex-group rarity-${rarity}" ${['normal','common'].includes(rarity) ? 'open' : ''}><summary>${def.icon} ${def.label} · ${items.filter(i=>owned.has(i.catalog_key)).length}/${items.length}</summary><div class="codex-grid">${items.map(item => {
        const deposit = collectionByKey.get(item.catalog_key);
        const has = !!deposit;
        const slot = SLOT_DEFS[item.slot] || {label:item.slot,icon:'🎴'};
        const probability = itemDropProbability(item);
        return `<article tabindex="0" class="codex-card rarity-${rarity} ${has ? 'owned' : 'missing'}"><div class="card-icon">${esc(item.icon || slot.icon)}</div><div class="card-name">${esc(item.item_name)}</div><div class="card-status">${has ? '✅ Déposé' : '⬜ Manquant'}</div><div class="card-probability">${esc(probability.label)}</div>${has ? `<div class="card-date">${esc(formatCollectionDate(deposit.deposited_at))}</div>` : ''}<div class="codex-tooltip"><strong>${esc(item.item_name)}</strong><br>${esc(slot.label)} · ${esc(item.item_type || 'generic')}${item.class_key ? ` · ${esc(CLASS_DEFS[item.class_key]?.title || item.class_key)}` : ' · Objet signature'}<br>Probabilité : ${esc(probability.label)}<br>${has ? `Déposé le ${esc(formatCollectionDate(deposit.deposited_at))}<br>Objet déposé : niveau ${n(deposit.deposited_item_level,1)} · dégâts +${fr(deposit.deposited_damage_bonus_pct,2)} %<br>` : ''}Bonus permanent : ${esc(catalogCollectionText(item))}</div></article>`;
      }).join('')}</div></details>`;
    }).join('')}</div>`;
}

function collectionHtml() {
    return `<div class="collection-subtabs"><button type="button" class="collection-subtab ${collectionSubTab==='bestiary'?'active':''}" data-collection-tab="bestiary">👾 Bestiaire</button><button type="button" class="collection-subtab ${collectionSubTab==='items'?'active':''}" data-collection-tab="items">🎴 Codex objets</button></div>
      <div class="xp-section"><div class="xp-section-title">${collectionSubTab==='bestiary'?'Collection de monstres':'Album des équipements'}</div>${collectionSubTab==='bestiary'?bestiaryCollectionHtml():itemCodexHtml()}</div>`;
  }

  function render() {
    inject();
    const xp = n(progress?.xp_total);
    const level = n(progress?.level, levelFromXp(xp));
    const gold = n(progress?.gold_balance);
    if (chip) chip.textContent = `Niv. ${level} · ${fr(xp, 1)} XP · 🪙 ${fr(gold, 0)}`;
    const body = document.getElementById('xpPanelBody');
    if (!body) return;
    const content = activeTab === 'equipment' ? equipmentHtml() : activeTab === 'cases' ? casesHtml() : activeTab === 'collection' ? collectionHtml() : progressHtml();
    body.innerHTML = `${tabsHtml()}${content}`;
  }

  async function loadProgress() {
    if (!window.CoachingCloud?.client || !CoachingCloud.session?.user) return;
    let result = await CoachingCloud.client
      .from('athlete_progress')
      .select('athlete_slug,xp_total,level,unopened_packs,gl_points,gl_multiplier,rpg_class,class_chosen_at,combat_wins,combat_losses,best_combat_damage,gold_balance,gold_total_earned,stat_power,stat_mastery,stat_fortune,collection_xp_bonus,best_damage_trial,damage_trial_attempts,last_damage_trial_at,adventure_difficulty,kills_toward_boss,boss_wins,last_boss_at,raid_ultra_cases,perfect_combat_streak,best_perfect_combat_streak,combat_drop_combo,best_combat_drop_combo')
      .eq('athlete_slug', cfg.slug)
      .maybeSingle();
    if (result.error && /column|does not exist|schema cache/i.test(result.error.message || '')) {
      result = await CoachingCloud.client
        .from('athlete_progress')
        .select('athlete_slug,xp_total,level,unopened_packs,gl_points,gl_multiplier,rpg_class,class_chosen_at,combat_wins,combat_losses,best_combat_damage,gold_balance,gold_total_earned,stat_power,stat_mastery,stat_fortune,collection_xp_bonus')
        .eq('athlete_slug', cfg.slug)
        .maybeSingle();
    }
    if (result.error) {
      console.warn('Progression XP/RPG indisponible :', result.error.message);
      CoachingCloud.toast(`Progression RPG indisponible : ${result.error.message}`, true);
      return;
    }
    const data = result.data;
    progress = data || {
      athlete_slug: cfg.slug, xp_total: 0, level: 1, unopened_packs: 0,
      gl_points: null, gl_multiplier: 1, rpg_class: null,
      combat_wins: 0, combat_losses: 0, best_combat_damage: 0,
      gold_balance: 0, gold_total_earned: 0,
      stat_power: 0, stat_mastery: 0, stat_fortune: 0, collection_xp_bonus: 0,
      best_damage_trial: 0, damage_trial_attempts: 0, last_damage_trial_at: null, raid_ultra_cases: 0, adventure_difficulty: 1, kills_toward_boss: 0, boss_wins: 0, last_boss_at: null, perfect_combat_streak: 0, best_perfect_combat_streak: 0, combat_drop_combo: 1, best_combat_drop_combo: 1
    };
    progress = {
      best_damage_trial: 0, damage_trial_attempts: 0, last_damage_trial_at: null,
      raid_ultra_cases: 0, adventure_difficulty: 1, kills_toward_boss: 0,
      boss_wins: 0, last_boss_at: null, perfect_combat_streak: 0, best_perfect_combat_streak: 0,
      combat_drop_combo: 1, best_combat_drop_combo: 1,
      ...progress
    };
    serverCasePrices.clear();
    render();
    if (activeTab === 'cases') queueServerCasePriceLoad(selectedCaseLevel);
  }

  async function loadInventory() {
    if (!window.CoachingCloud?.client || !CoachingCloud.session?.user) return;
    let result = await CoachingCloud.client
      .from('rpg_inventory')
      .select('id,athlete_slug,item_name,rarity,slot,case_tier,required_level,power_bonus,mastery_bonus,fortune_bonus,scaled_power_bonus,scaled_mastery_bonus,scaled_fortune_bonus,stat_quality_roll,stat_growth_rate,passive_growth_rate,equipped,is_locked,source,catalog_key,quantity,item_level,damage_bonus_pct,item_type,passive_type,passive_value,obtained_at')
      .eq('athlete_slug', cfg.slug)
      .order('obtained_at', { ascending: false });
    if (result.error && /(passive_|quality_roll|growth_rate|scaled_|is_locked)/i.test(result.error.message || '')) {
      result = await CoachingCloud.client.from('rpg_inventory')
        .select('id,athlete_slug,item_name,rarity,slot,case_tier,required_level,power_bonus,mastery_bonus,fortune_bonus,equipped,source,catalog_key,quantity,item_level,damage_bonus_pct,item_type,obtained_at')
        .eq('athlete_slug', cfg.slug).order('obtained_at', { ascending: false });
    }
    if (result.error) {
      console.warn('Inventaire RPG indisponible :', result.error.message);
      return;
    }
    inventory = Array.isArray(result.data) ? result.data : [];
    render();
  }

  async function loadTransferRecipients() {
    if (!window.CoachingCloud?.client || !CoachingCloud.session?.user) return;
    const { data, error } = await CoachingCloud.client.rpc('get_rpg_transfer_recipients_v31', {
      p_sender_slug: cfg.slug
    });
    if (error) {
      console.warn('Destinataires de transfert indisponibles :', error.message);
      transferRecipients = [];
      render();
      return;
    }
    transferRecipients = (Array.isArray(data) ? data : data ? [data] : [])
      .filter(person => person?.athlete_slug && person.athlete_slug !== cfg.slug)
      .sort((a, b) => String(a.display_name || a.athlete_slug).localeCompare(String(b.display_name || b.athlete_slug), 'fr'));
    render();
  }

  async function loadCollections() {
    if (!window.CoachingCloud?.client || !CoachingCloud.session?.user) return;

    // On récupère les quatre blocs séparément. Une colonne optionnelle manquante
    // ou une erreur du codex ne doit plus empêcher l'affichage du bestiaire.
    const [monsters, monsterOwned, items, itemOwned] = await Promise.all([
      CoachingCloud.client.from('rpg_monster_catalog').select('*').order('sort_order', { ascending: true }),
      CoachingCloud.client.from('rpg_monster_collection').select('*').eq('athlete_slug', cfg.slug),
      CoachingCloud.client.from('rpg_item_catalog').select('*').order('sort_order', { ascending: true }),
      CoachingCloud.client.from('rpg_item_collection').select('*').eq('athlete_slug', cfg.slug)
    ]);

    if (monsters.error) console.warn('Catalogue des monstres indisponible :', monsters.error.message);
    else monsterCatalog = Array.isArray(monsters.data) ? monsters.data.map(monster => {
      const displayName = monsterDisplayName(monster.monster_name);
      return {
        ...monster,
        monster_name: displayName,
        rarity: canonicalMonsterRarity(displayName, monster.rarity, monster.monster_key)
      };
    }) : [];

    if (monsterOwned.error) console.warn('Bestiaire de l’athlète indisponible :', monsterOwned.error.message);
    else monsterCollection = Array.isArray(monsterOwned.data) ? monsterOwned.data.map(monster => ({ ...monster, monster_name: monsterDisplayName(monster.monster_name) })) : [];

    if (items.error) console.warn('Catalogue des objets indisponible :', items.error.message);
    else itemCatalog = Array.isArray(items.data) ? items.data : [];

    if (itemOwned.error) console.warn('Codex de l’athlète indisponible :', itemOwned.error.message);
    else itemCollection = Array.isArray(itemOwned.data) ? itemOwned.data : [];

    // Sécurité : un ancien kill doit toujours rester visible même si une fiche
    // de catalogue a été renommée ou n'a pas encore été resynchronisée.
    const catalogKeys = new Set(monsterCatalog.map(monster => monster.monster_key));
    for (const owned of monsterCollection) {
      if (!catalogKeys.has(owned.monster_key)) {
        monsterCatalog.push({
          monster_key: owned.monster_key,
          monster_name: monsterDisplayName(owned.monster_name || owned.monster_key.replaceAll('_', ' ')),
          rarity: owned.rarity || 'common',
          icon: '👾',
          xp_bonus: 0,
          combat_xp_base: monsterBaseCombatXp(owned.rarity || 'common'),
          visible_before_discovery: true,
          sort_order: 999999,
          category: 'Archives retrouvées'
        });
      }
    }

    const itemKeys = new Set(itemCatalog.map(item => item.catalog_key));
    for (const owned of itemCollection) {
      if (!itemKeys.has(owned.catalog_key)) {
        const fallback = catalogFallbackFromRow(owned);
        itemCatalog.push({ ...fallback, sort_order: 999999, visible_before_discovery: true });
        itemKeys.add(fallback.catalog_key);
      }
    }
    monsterCatalog.sort((a, b) => n(a.sort_order, 999999) - n(b.sort_order, 999999));
    itemCatalog.sort((a, b) => n(a.sort_order, 999999) - n(b.sort_order, 999999));
    render();
  }


  async function loadRaid(showFinderMessage = false) {
    if (!window.CoachingCloud?.client || !CoachingCloud.session?.user) return;
    const { data, error } = await CoachingCloud.client.rpc('get_rpg_raid_status', { p_athlete_slug: cfg.slug });
    if (error) {
      console.warn('Raid indisponible :', error.message);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    raid = row || null;
    raidParticipants = [];
    if (raid?.raid_id) {
      const { data: participants, error: participantError } = await CoachingCloud.client.rpc('get_rpg_raid_participants', { p_raid_id: raid.raid_id });
      if (!participantError) raidParticipants = Array.isArray(participants) ? participants : [];
      if (showFinderMessage && raid.discovered_by_slug === cfg.slug) {
        const foundAt = new Date(raid.found_at).getTime();
        if (Date.now() - foundAt < 90000) showRaidKeyFound(raid);
      }
    }
    if (progress && row) progress = { ...progress, raid_ultra_cases: n(row.ultra_cases_balance, progress?.raid_ultra_cases) };
    render();
  }

  function ensureRaidKeyOverlay() {
    let overlay = document.getElementById('raidKeyOverlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'raidKeyOverlay';
    overlay.className = 'raid-key-overlay';
    overlay.innerHTML = `<div class="raid-key-card"><div class="raid-key-icon">🗝️🌀</div><h2>CLÉ DE RAID TROUVÉE</h2><p id="raidKeyMessage"></p><button type="button" id="raidKeyClose">Prévenir les autres</button></div>`;
    document.body.appendChild(overlay);
    document.getElementById('raidKeyClose').addEventListener('click', () => overlay.classList.remove('show'));
    return overlay;
  }

  function showRaidKeyFound(currentRaid) {
    const storageKey = `raid_key_seen_${currentRaid.raid_id}_${cfg.slug}`;
    if (sessionStorage.getItem(storageKey)) return;
    sessionStorage.setItem(storageKey, '1');
    const overlay = ensureRaidKeyOverlay();
    const message = document.getElementById('raidKeyMessage');
    if (message) message.innerHTML = `Préviens tes amis : tu as trouvé la clef d’un raid.<br><strong>Le portail s’ouvrira dans 15 minutes.</strong><br><br>${esc(currentRaid.boss_name)} · niveau moyen ${n(currentRaid.raid_level)}.`;
    overlay.classList.add('show');
    if (navigator.vibrate) navigator.vibrate([120,70,220,70,320]);
  }

  async function joinRaid() {
    if (!raid?.raid_id) return;
    const button = document.getElementById('rpgRaidJoin');
    if (button) button.disabled = true;
    const { error } = await CoachingCloud.client.rpc('join_rpg_raid', {
      p_athlete_slug: cfg.slug,
      p_raid_id: raid.raid_id
    });
    if (error) {
      CoachingCloud.toast(`Entrée impossible : ${error.message}`, true);
      if (button) button.disabled = false;
      return;
    }
    CoachingCloud.toast('🌀 Tu es entré dans le raid. Le bonus collectif vient d’augmenter.');
    await loadRaid();
  }

  function splitCaseOpeningBatches(count) {
    const safeCount = Math.max(1, Math.floor(Number(count) || 1));
    const batches = [];
    let remaining = safeCount;

    while (remaining > 0) {
      const batch = Math.min(CASE_RPC_BATCH_SIZE, remaining);
      batches.push(batch);
      remaining -= batch;
    }

    return batches;
  }

  async function openRaidCases(count = 1) {
    primeAbyssalVoice();
    count = CASE_COUNTS.includes(Number(count)) ? Number(count) : 1;
    if (openingCase || n(progress?.raid_ultra_cases) < count) return;

    openingCase = true;
    render();

    const items = [];
    let openedCount = 0;

    for (const batchCount of splitCaseOpeningBatches(count)) {
      const { data, error } = await CoachingCloud.client.rpc('open_rpg_raid_cases', {
        p_athlete_slug: cfg.slug,
        p_quantity: batchCount
      });

      if (error) {
        openingCase = false;

        if (openedCount > 0) {
          await Promise.all([loadProgress(), loadInventory()]);
          CoachingCloud.toast(
            `${openedCount} caisse${openedCount > 1 ? 's' : ''} Ultra ouverte${openedCount > 1 ? 's' : ''}, puis arrêt : ${error.message}`,
            true
          );
        } else {
          CoachingCloud.toast(`Ouverture Ultra impossible : ${error.message}`, true);
        }

        render();
        return;
      }

      const batchItems = (Array.isArray(data) ? data : data ? [data] : []).map(row => ({
        ...row,
        item_level: row.item_level ?? row.awarded_item_level,
        damage_bonus_pct: row.damage_bonus_pct ?? row.awarded_damage_bonus_pct,
        power_bonus: row.power_bonus ?? row.awarded_power_bonus,
        mastery_bonus: row.mastery_bonus ?? row.awarded_mastery_bonus,
        fortune_bonus: row.fortune_bonus ?? row.awarded_fortune_bonus,
        item_slot: row.item_slot ?? row.slot
      }));

      items.push(...batchItems);
      openedCount += batchCount;

      const lastRow = batchItems.at(-1);
      if (lastRow) {
        progress = {
          ...progress,
          raid_ultra_cases: n(
            lastRow.raid_cases_balance_after,
            progress?.raid_ultra_cases
          )
        };
      }
    }

    if (!items.length) {
      openingCase = false;
      render();
      return;
    }

    await loadInventory();

    const hydratedItems = items.map(item => {
      const actual = inventory.find(
        candidate => String(candidate.id) === String(item.item_id || item.id)
      );

      return actual
        ? {
            ...item,
            ...actual,
            item_id: actual.id,
            item_rarity: actual.rarity,
            item_slot: actual.slot
          }
        : item;
    });

    await playCaseOpeningAnimation(
      hydratedItems,
      Math.floor(n(hydratedItems[0]?.item_level, 1) / 5),
      count,
      'Ouverture des caisses Ultra de raid'
    );

    for (const item of hydratedItems.filter(item =>
      ['legendary', 'mythic', 'ultra_mythic', 'abyssal']
        .includes(item.item_rarity || item.rarity)
    )) {
      await publishLootActivity(item);
    }

    openingCase = false;
    render();
  }

  async function loadAll() {
    await Promise.all([loadProgress(), loadInventory(), loadCollections(), loadRaid(), loadTransferRecipients()]);
    render();
  }

  async function chooseClass(classKey) {
    const def = CLASS_DEFS[classKey];
    if (!def || progress?.rpg_class) return;
    if (!window.CoachingCloud?.canEditAthlete?.(cfg.slug)) {
      CoachingCloud.toast('Ce compte ne peut pas choisir la classe de cet athlète.', true);
      return;
    }
    const confirmed = window.confirm(`Choisir ${def.title} (${def.subtitle}) ? Ce choix est permanent et définitif.`);
    if (!confirmed) return;
    const { error } = await CoachingCloud.client.rpc('choose_athlete_class', {
      p_athlete_slug: cfg.slug,
      p_class: classKey
    });
    if (error) {
      CoachingCloud.toast(`Choix impossible : ${error.message}`, true);
      return;
    }
    CoachingCloud.toast(`${def.icon} Classe choisie : ${def.title}.`);
    await loadAll();
  }

  async function upgradeStat(statKey) {
    if (!['power', 'mastery', 'fortune'].includes(statKey)) return;
    const { data, error } = await CoachingCloud.client.rpc('upgrade_rpg_stat', {
      p_athlete_slug: cfg.slug,
      p_stat: statKey
    });
    if (error) {
      CoachingCloud.toast(`Amélioration impossible : ${error.message}`, true);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    progress = {
      ...progress,
      gold_balance: n(row?.gold_balance_after, progress?.gold_balance),
      stat_power: n(row?.stat_power_after, progress?.stat_power),
      stat_mastery: n(row?.stat_mastery_after, progress?.stat_mastery),
      stat_fortune: n(row?.stat_fortune_after, progress?.stat_fortune)
    };
    CoachingCloud.toast(`Statistique améliorée · -${fr(row?.upgrade_cost, 0)} gold.`);
    render();
  }

  async function openItemTransfer(itemId) {
    const item = inventory.find(candidate => String(candidate.id) === String(itemId));
    if (!item || item.equipped || transferBusy) return;
    if (!transferRecipients.length) await loadTransferRecipients();
    if (!transferRecipients.length) {
      CoachingCloud.toast('Aucun autre athlète disponible pour recevoir cet objet.', true);
      return;
    }
    transferModalItemId = item.id;
    render();
  }

  function closeItemTransfer() {
    if (transferBusy) return;
    transferModalItemId = null;
    render();
  }

  async function confirmItemTransfer() {
    if (transferBusy || !transferModalItemId) return;
    const item = inventory.find(candidate => String(candidate.id) === String(transferModalItemId));
    const recipientSelect = document.getElementById('itemTransferRecipient');
    const quantityInput = document.getElementById('itemTransferQuantity');
    const recipientSlug = String(recipientSelect?.value || '').trim();
    const quantity = Math.max(1, Math.min(n(item?.quantity, 1), Math.floor(n(quantityInput?.value, 1))));
    const recipient = transferRecipients.find(person => person.athlete_slug === recipientSlug);
    if (!item) {
      transferModalItemId = null;
      render();
      return;
    }
    if (!recipientSlug || !recipient) {
      CoachingCloud.toast('Choisis la personne qui doit recevoir l’objet.', true);
      return;
    }
    if (!confirm(`Envoyer ${quantity} exemplaire${quantity>1?'s':''} de « ${item.item_name} » à ${recipient.display_name || recipient.athlete_slug} ?`)) return;
    transferBusy = true;
    render();
    const { data, error } = await CoachingCloud.client.rpc('transfer_rpg_item_v31', {
      p_from_slug: cfg.slug,
      p_to_slug: recipientSlug,
      p_item_id: item.id,
      p_quantity: quantity
    });
    transferBusy = false;
    if (error) {
      CoachingCloud.toast(`Envoi impossible : ${error.message}`, true);
      render();
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    transferModalItemId = null;
    CoachingCloud.toast(`🎁 ${n(row?.quantity_sent, quantity)} ${row?.item_name || item.item_name} envoyé${n(row?.quantity_sent, quantity)>1?'s':''} à ${row?.recipient_name || recipient.display_name || recipientSlug}.`);
    await loadInventory();
  }

  async function toggleItemLock(itemId, shouldLock) {
    if (!itemId || collectionBusy) return;
    collectionBusy = true;
    render();
    const { data, error } = await CoachingCloud.client.rpc('set_rpg_item_lock_v30', {
      p_athlete_slug: cfg.slug,
      p_item_id: itemId,
      p_locked: !!shouldLock
    });
    collectionBusy = false;
    if (error) {
      CoachingCloud.toast(`Loquet impossible : ${error.message}`, true);
      render();
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    CoachingCloud.toast(row?.is_locked ? '🔒 Objet verrouillé : les actions globales l’ignoreront.' : '🔓 Objet déverrouillé.');
    await loadInventory();
  }

  async function equipItem(itemId) {
    if (!itemId) return;
    const { error } = await CoachingCloud.client.rpc('equip_rpg_item', {
      p_athlete_slug: cfg.slug,
      p_item_id: itemId
    });
    if (error) {
      CoachingCloud.toast(`Équipement impossible : ${error.message}`, true);
      return;
    }
    CoachingCloud.toast('Objet équipé. Tes prochaines frappes utiliseront ses statistiques.');
    await loadInventory();
  }

  async function sellItem(itemId) {
    if (collectionBusy || !confirm('Vendre un exemplaire de cette pile contre du gold ?')) return;
    collectionBusy = true; render();
    const { data, error } = await CoachingCloud.client.rpc('sell_rpg_item',{p_athlete_slug:cfg.slug,p_item_id:itemId});
    collectionBusy = false;
    if (error) { CoachingCloud.toast(`Vente impossible : ${error.message}`,true); render(); return; }
    const row = Array.isArray(data)?data[0]:data;
    CoachingCloud.toast(`${row?.item_name || 'Objet'} vendu · +${fr(row?.gold_gained,0)} gold`);
    await Promise.all([loadProgress(),loadInventory()]);
  }

  async function depositItem(itemId) {
    if (collectionBusy || !confirm('Déposer un exemplaire dans le codex ? Un seul objet de la pile sera consommé et le bonus restera permanent.')) return;
    collectionBusy = true; render();
    const { data, error } = await CoachingCloud.client.rpc('deposit_rpg_collection_item',{p_athlete_slug:cfg.slug,p_item_id:itemId});
    collectionBusy = false;
    if (error) { CoachingCloud.toast(`Dépôt impossible : ${error.message}`,true); render(); return; }
    const row = Array.isArray(data)?data[0]:data;
    CoachingCloud.toast(`${row?.item_name || 'Objet'} ajouté au codex · bonus permanent activé`);
    activeTab='collection'; collectionSubTab='items';
    await Promise.all([loadInventory(),loadCollections()]);
  }

  async function depositAllItems() {
    const count = depositAllEligibleCount();
    if (collectionBusy || count <= 0) return;
    if (!confirm(`Déposer automatiquement ${count} objet${count>1?'s':''} unique${count>1?'s':''} dans le codex ? Un exemplaire de chaque objet sera consommé. Les objets équipés sans doublon et tous les objets verrouillés seront conservés.`)) return;
    collectionBusy = true;
    render();
    const { data, error } = await CoachingCloud.client.rpc('deposit_all_rpg_collection_items_v30', {
      p_athlete_slug: cfg.slug
    });
    collectionBusy = false;
    if (error) {
      CoachingCloud.toast(`Dépôt global impossible : ${error.message}`, true);
      render();
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    CoachingCloud.toast(`${n(row?.deposited_count)} objet${n(row?.deposited_count)>1?'s':''} ajouté${n(row?.deposited_count)>1?'s':''} au codex${n(row?.locked_skipped)>0?` · 🔒 ${n(row.locked_skipped)} protégé${n(row.locked_skipped)>1?'s':''}`:''}${n(row?.skipped_count)>0?` · ${n(row.skipped_count)} autre${n(row.skipped_count)>1?'s':''} ignoré${n(row.skipped_count)>1?'s':''}`:''}.`);
    activeTab = 'collection';
    collectionSubTab = 'items';
    await Promise.all([loadInventory(), loadCollections(), loadProgress()]);
  }

  async function sellAllItems() {
    const count = sellAllEligibleQuantity();
    if (collectionBusy || count <= 0) return;
    if (!confirm(`Vendre définitivement les ${count} exemplaire${count>1?'s':''} non équipé${count>1?'s':''} de ton inventaire ? Les objets portés et verrouillés ne seront pas vendus.`)) return;
    collectionBusy = true;
    render();
    const { data, error } = await CoachingCloud.client.rpc('sell_all_rpg_items_v30', {
      p_athlete_slug: cfg.slug
    });
    collectionBusy = false;
    if (error) {
      CoachingCloud.toast(`Vente globale impossible : ${error.message}`, true);
      render();
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    CoachingCloud.toast(`${n(row?.items_sold)} objet${n(row?.items_sold)>1?'s':''} vendu${n(row?.items_sold)>1?'s':''} · +${fr(row?.gold_gained,0)} gold${n(row?.locked_skipped)>0?` · 🔒 ${n(row.locked_skipped)} exemplaire${n(row.locked_skipped)>1?'s':''} protégé${n(row.locked_skipped)>1?'s':''}`:''}.`);
    await Promise.all([loadProgress(), loadInventory()]);
  }

  async function openCases(itemLevel, caseType = 'global', count = 1) {
    primeAbyssalVoice();
    count = CASE_COUNTS.includes(Number(count)) ? Number(count) : 1;
    if (openingCase) return;

    // Lance le thème Casino immédiatement dans le geste utilisateur.
    primeEventMusic('case_opening');
    await loadServerCasePrices(itemLevel, { force:true });
    const exactUnitCost = serverCaseCost(itemLevel, caseType);
    if (exactUnitCost === null) {
      stopEventMusic({ resumeMenu:true });
      CoachingCloud.toast('Prix serveur indisponible. Recharge la page avant d’ouvrir la caisse.', true);
      render();
      return;
    }
    const exactTotalCost = exactUnitCost * count;
    if (n(progress?.gold_balance, 0) < exactTotalCost) {
      stopEventMusic({ resumeMenu:true });
      CoachingCloud.toast(`Pas assez de gold : ${fr(exactTotalCost,0)} requis`, true);
      render();
      return;
    }

    primeEventMusic('case_opening');
    openingCase = true;
    render();

    const items = [];
    let openedCount = 0;

    // Le serveur accepte des lots de 100 de façon fiable.
    // ×500 est donc exécuté en cinq lots successifs de 100.
    for (const batchCount of splitCaseOpeningBatches(count)) {
      const { data, error } = await CoachingCloud.client.rpc('open_rpg_cases_v20', {
        p_athlete_slug: cfg.slug,
        p_item_level: itemLevel,
        p_case_type: caseType,
        p_quantity: batchCount
      });

      if (error) {
        openingCase = false;

        if (openedCount > 0) {
          await Promise.all([loadProgress(), loadInventory()]);
          CoachingCloud.toast(
            `${openedCount} caisse${openedCount > 1 ? 's' : ''} ouverte${openedCount > 1 ? 's' : ''}, puis arrêt : ${error.message}`,
            true
          );
        } else {
          CoachingCloud.toast(`Ouverture impossible : ${error.message}`, true);
        }

        render();
        return;
      }

      const batchItems = (Array.isArray(data) ? data : data ? [data] : []).map(row => ({
        ...row,
        power_bonus: row.power_bonus ?? row.awarded_power_bonus,
        mastery_bonus: row.mastery_bonus ?? row.awarded_mastery_bonus,
        fortune_bonus: row.fortune_bonus ?? row.awarded_fortune_bonus,
        item_level: row.item_level ?? row.awarded_item_level,
        damage_bonus_pct: row.damage_bonus_pct ?? row.awarded_damage_bonus_pct,
        item_slot: row.item_slot ?? row.slot,
        opened_case_tier: row.opened_case_tier ?? row.case_tier
      }));

      items.push(...batchItems);
      openedCount += batchCount;

      const lastRow = batchItems.at(-1);
      if (lastRow) {
        progress = {
          ...progress,
          gold_balance: n(lastRow.gold_balance_after, progress?.gold_balance)
        };
      }
    }

    if (!items.length) {
      openingCase = false;
      render();
      return;
    }

    await loadInventory();

    const hydratedItems = items.map(item => {
      const actual = inventory.find(
        candidate => String(candidate.id) === String(item.item_id || item.id)
      );

      return actual
        ? {
            ...item,
            ...actual,
            item_id: actual.id,
            item_rarity: actual.rarity,
            item_slot: actual.slot
          }
        : item;
    });

    await playCaseOpeningAnimation(hydratedItems, itemLevel, count);

    for (const item of hydratedItems.filter(item =>
      ['legendary', 'mythic', 'ultra_mythic', 'abyssal']
        .includes(item.item_rarity || item.rarity)
    )) {
      await publishLootActivity(item);
    }

    openingCase = false;
    render();
  }

  function ensureLevelOverlay() {
    let overlay = document.getElementById('xpLevelUp');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'xpLevelUp';
    overlay.className = 'xp-levelup';
    overlay.innerHTML = `<div class="xp-levelup-card"><h2 id="xpLevelTitle">LEVEL UP BG !</h2><p id="xpLevelText"></p><button type="button" id="xpLevelClose">Continuer</button></div>`;
    document.body.appendChild(overlay);
    document.getElementById('xpLevelClose').addEventListener('click', () => overlay.classList.remove('show'));
    return overlay;
  }

  function ensureCaseOverlay() {
    let overlay = document.getElementById('rpgCaseOverlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'rpgCaseOverlay';
    overlay.className = 'case-overlay';
    overlay.innerHTML = `<div class="case-opening-shell">
      <div id="caseAnimationView">
        <div class="case-opening-title">Ouverture de coffres SBD</div>
        <div class="case-opening-subtitle">L’animation ne peut pas être passée.</div>
        <div class="case-roulette"><div class="case-center-marker"></div><div class="case-roll-track" id="caseRollTrack"></div></div>
        <div class="case-progress-label" id="caseProgressLabel">Préparation des coffres…</div>
        <div class="case-lock-note">🔒 Ouverture sécurisée · aucun bouton Skip</div>
      </div>
      <div class="case-opening-results" id="caseOpeningResults"><h2>Butin obtenu</h2><p id="caseOpeningSummary"></p><div class="case-results-grid" id="caseResultsGrid"></div><button type="button" class="case-opening-close" id="caseOpeningClose">Ranger dans l’inventaire</button></div>
    </div>`;
    document.body.appendChild(overlay);
    document.getElementById('caseOpeningClose').addEventListener('click', () => {
      if (!document.getElementById('caseOpeningClose')?.classList.contains('ready')) return;
      stopEventMusic({ resumeMenu:false });
      overlay.classList.remove('show');
      panel?.classList.add('show');
      activeTab = 'equipment';
      render();
      playMenuMusic();
    });
    return overlay;
  }

  function aggregateCaseResults(items) {
    const groups = new Map();
    for (const item of items) {
      const key = [item.item_name,item.item_rarity,item.item_slot,item.item_level,item.damage_bonus_pct,item.power_bonus,item.mastery_bonus,item.fortune_bonus].join('|');
      const group = groups.get(key) || { ...item, count: 0 };
      group.count += 1;
      groups.set(key, group);
    }
    return [...groups.values()].sort((a,b) => {
      const order = ['mythic','legendary','epic','rare','uncommon','common','normal'];
      return order.indexOf(a.item_rarity) - order.indexOf(b.item_rarity) || b.count - a.count;
    });
  }

  function caseShowcaseItem(items) {
    return [...items].sort((a,b)=>(RARITY_RANK[b.item_rarity]||0)-(RARITY_RANK[a.item_rarity]||0)||n(b.item_level)-n(a.item_level))[0] || items[0];
  }

  function chestTileHtml(item, target = false) {
    const rarityKey = item?.item_rarity || 'normal';
    return `<div class="case-roll-tile rarity-${rarityKey} ${target?'target-tile':''}"><div class="sbd-chest"><div class="sbd-chest-art"><div class="sbd-chest-lid"></div><div class="sbd-chest-body"></div><div class="sbd-chest-band"></div><div class="sbd-chest-lock">SBD</div></div><b>SBD</b></div>${target?`<div class="case-target-caption">${esc(item.item_name)}</div>`:''}</div>`;
  }

  async function playCaseOpeningAnimation(items, tier, count, openingTitle = 'Ouverture de coffres SBD') {
    playEventMusic('case_opening', { restart:true, loop:true, volume:0.58 });
    const overlay = ensureCaseOverlay();
    const isRaidOpening = openingTitle.toLowerCase().includes('ultra');
    const animationView = document.getElementById('caseAnimationView');
    const title = overlay.querySelector('.case-opening-title');
    if (title) title.textContent = openingTitle;
    const results = document.getElementById('caseOpeningResults');
    const close = document.getElementById('caseOpeningClose');
    const track = document.getElementById('caseRollTrack');
    const roulette = track?.parentElement;
    const progressLabel = document.getElementById('caseProgressLabel');
    animationView.style.display = '';
    results.classList.remove('show');
    close.classList.remove('ready');
    panel?.classList.remove('show');
    overlay.classList.add('show');

    const showcase = caseShowcaseItem(items);
    const targetIndex = 38;
    const totalTiles = 46;
    const fillerRarities = ['normal','common','normal','uncommon','normal','common','rare','normal','epic','common'];
    const tiles = Array.from({length:totalTiles},(_,index)=> index===targetIndex ? showcase : { item_rarity:fillerRarities[(index*7+count)%fillerRarities.length], item_name:`Coffre SBD ${index+1}` });
    track.innerHTML = tiles.map((item,index)=>chestTileHtml(item,index===targetIndex)).join('');
    track.style.transition='none';
    track.style.transform='translate3d(0,0,0)';
    void track.offsetWidth;

    const targetTile = track.children[targetIndex];
    const targetCenter = targetTile.offsetLeft + targetTile.offsetWidth/2;
    const viewportCenter = (roulette?.clientWidth || 380)/2;
    const finalX = viewportCenter - targetCenter;
    const duration = 4300 + Math.min(4200,count*35);
    progressLabel.textContent = `${count} coffre${count>1?'s':''} ${isRaidOpening?'Ultra de raid':'SBD'} en cours d’ouverture… le coffre arrêté correspond exactement à l’objet vedette.`;
    track.style.transition=`transform ${duration}ms cubic-bezier(.06,.74,.12,1)`;
    track.style.transform=`translate3d(${finalX}px,0,0)`;
    await new Promise(resolve=>setTimeout(resolve,duration+250));
    if (String(showcase?.item_rarity || showcase?.rarity || '').toLowerCase() === 'abyssal') {
      playAbyssalVoice();
    }
    progressLabel.textContent = `${RARITY_DEFS[showcase.item_rarity]?.label || 'Objet'} · ${showcase.item_name}`;
    await new Promise(resolve=>setTimeout(resolve,700));

    animationView.style.display='none';
    const totalCost=isRaidOpening?0:n(items[0]?.gold_cost,caseCost(tier))*count;
    const aggregated=aggregateCaseResults(items);
    document.getElementById('caseOpeningSummary').textContent=isRaidOpening?`${count} caisse${count>1?'s':''} Ultra ouverte${count>1?'s':''} · récompense de raid · ${aggregated.length} objet${aggregated.length>1?'s':''} différent${aggregated.length>1?'s':''}. Le coffre final représentait ${showcase.item_name}.`:`${count} caisse${count>1?'s':''} ouverte${count>1?'s':''} · ${fr(totalCost,0)} gold dépensé · ${aggregated.length} objet${aggregated.length>1?'s':''} différent${aggregated.length>1?'s':''}. Le coffre final représentait ${showcase.item_name}.`;
    document.getElementById('caseResultsGrid').innerHTML=aggregated.map(item=>{
      const rarityKey=item.item_rarity||'normal';const rarity=RARITY_DEFS[rarityKey]||RARITY_DEFS.normal;const slot=SLOT_DEFS[item.item_slot]||{icon:'🎒',label:'Objet'};
      return `<div class="case-result-row rarity-${rarityKey}"><div class="result-icon">${slot.icon}</div><div><b>${rarity.icon} ${esc(item.item_name)}</b><small>${slot.label} · niveau ${n(item.item_level,1)} · ${esc(itemStatsText(item))}</small></div><div class="result-count">×${item.count}</div></div>`;
    }).join('');
    results.classList.add('show');close.classList.add('ready');
    if(navigator.vibrate&&items.some(item=>['legendary','mythic','ultra_mythic','abyssal'].includes(item.item_rarity)))navigator.vibrate([120,60,180,60,260]);
  }

  function ensurePerfectCombatOverlay() {
    let overlay = document.getElementById('perfectCombatOverlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'perfectCombatOverlay';
    overlay.className = 'perfect-combat-overlay';
    overlay.innerHTML = `<div class="perfect-combat-rays"></div><div class="perfect-combat-card"><div class="perfect-combat-crown">👑</div><div class="perfect-combat-title">COMBAT PARFAIT</div><div class="perfect-combat-sub" id="perfectCombatSub">24 signaux maîtrisés sans aucune erreur.</div><div class="perfect-combat-mult" id="perfectCombatMult">GOLD ×2</div><div class="perfect-combat-streak-label" id="perfectCombatStreakLabel">Perfect streak : 1</div><div class="perfect-combat-streak-label" id="perfectCombatLootCombo">Combo loot : ×2</div><button type="button" class="perfect-combat-close" id="perfectCombatClose">Récupérer la récompense</button></div>`;
    document.body.appendChild(overlay);
    document.getElementById('perfectCombatClose').addEventListener('click', () => overlay.classList.remove('show'));
    return overlay;
  }

  function showPerfectCombatAnimation(result) {
    const overlay = ensurePerfectCombatOverlay();
    const streak = Math.max(1, n(result?.perfect_combat_streak, 1));
    const mult = Math.max(2, n(result?.perfect_gold_multiplier, 2));
    const sub = document.getElementById('perfectCombatSub');
    const multEl = document.getElementById('perfectCombatMult');
    const streakEl = document.getElementById('perfectCombatStreakLabel');
    const lootComboEl = document.getElementById('perfectCombatLootCombo');
    const lootCombo = Math.max(1, n(result?.combat_drop_combo, progress?.combat_drop_combo, 1));
    if (sub) sub.textContent = `${n(result?.successful_actions, REACTION_TARGET_COUNT)}/${REACTION_TARGET_COUNT} signaux maîtrisés · aucune erreur · aucun BON.`;
    if (multEl) multEl.textContent = `GOLD ×${fr(mult, 3)}`;
    if (streakEl) streakEl.textContent = `Perfect combat streak : ${streak} · prochain perfect ×${fr(Math.min(4, 2*Math.pow(1.05,streak)),3)} gold`;
    if (lootComboEl) lootComboEl.textContent = `Combo loot conservé : ×${lootCombo} · poids Rare+ ×${lootCombo}`;
    overlay.classList.remove('show');
    requestAnimationFrame(() => overlay.classList.add('show'));
    if (navigator.vibrate) navigator.vibrate([120,60,180,60,260,80,380]);
  }

  function dropComboTier(value) {
    const combo = Math.max(1, Math.min(100, Math.floor(n(value, 1))));
    if (combo >= 100) return { key:'abyssal', label:'ABYSSAL STREAK' };
    if (combo >= 64) return { key:'ultra', label:'ULTRA STREAK' };
    if (combo >= 32) return { key:'gold', label:'MYTHIC STREAK' };
    if (combo >= 16) return { key:'red', label:'LEGEND STREAK' };
    if (combo >= 8) return { key:'purple', label:'EPIC STREAK' };
    if (combo >= 4) return { key:'blue', label:'RARE STREAK' };
    if (combo >= 2) return { key:'green', label:'COMBO ACTIF' };
    return { key:'gray', label:'COMBO' };
  }

  function updateDropComboBadge(value, animate = false) {
    const badge = document.getElementById('rpgDropComboBadge');
    if (!badge) return;
    const combo = Math.max(1, Math.min(100, Math.floor(n(value, 1))));
    const tier = dropComboTier(combo);
    badge.className = `drop-combo-badge tier-${tier.key}`;
    badge.innerHTML = `<span>${tier.label}</span><b>×${combo}</b><small>Drop Rare+ ×${combo}</small>`;
    badge.setAttribute('aria-label', `Combo loot ${combo}`);
    if (animate) {
      void badge.offsetWidth;
      badge.classList.add('combo-enter');
    }
  }

  function ensureCombatOverlay() {
    let overlay = document.getElementById('rpgOverlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'rpgOverlay';
    overlay.className = 'rpg-overlay';
    overlay.innerHTML = `<div class="rpg-arena">
      <div id="rpgFightView">
        <div class="rpg-arena-head"><span id="rpgClassLabel">Combat</span><span class="rpg-clock" id="rpgClock">30,0</span></div>
        <div class="rpg-monster-name" id="rpgMonsterName">Monstre</div>
        <div class="rpg-hp"><span id="rpgHpBar"></span></div><div class="rpg-hp-label" id="rpgHpLabel">0 / 0 PV</div>
        <div class="reaction-hint" id="rpgReactionHint">Observe l’écran…</div>
        <div class="rpg-enemy-stage" id="rpgEnemyStage"><button type="button" class="rpg-enemy" id="rpgEnemy">👹</button><div class="drop-combo-badge tier-gray" id="rpgDropComboBadge" aria-hidden="true"><span>COMBO</span><b>×1</b><small>Drop Rare+ ×1</small></div></div>
        <div class="reaction-live"><div><b id="rpgReactionCombo">×0</b>Combo</div><div><b id="rpgReactionPerfectStreak">×0</b>Perfect streak</div><div><b id="rpgReactionAccuracy">0 %</b>Précision</div><div><b id="rpgClicks">0</b>Unités</div></div>
        <div class="rpg-combat-info"><div><b id="rpgDamage">0</b>Dégâts</div><div><b id="rpgPerHit">0</b>Base / unité</div><div><b id="rpgTargetCount">∞</b>Cibles</div></div>
        <button type="button" class="rpg-ability" id="rpgRushAbility">⚡ Ruée du destin<small id="rpgRushHint">Cibles bleues ×4 pendant 3 s</small></button>
        <button type="button" class="rpg-ability" id="rpgAbility"><span id="rpgAbilityLabel">✨ Assumptio</span><small id="rpgAbilityHint">14 cibles bleues pendant 5 s · une utilisation</small></button>
        <button type="button" class="rpg-abandon" id="rpgAbandon">Abandonner</button>
      </div>
      <div class="rpg-result" id="rpgResult"><h2 id="rpgResultTitle"></h2><p id="rpgResultText"></p><button type="button" class="rpg-result-close" id="rpgResultClose">Revenir à la progression</button></div>
    </div>`;
    document.body.appendChild(overlay);
    if (sfxAllowed()) ensureAssumptioSound();
    document.getElementById('rpgEnemyStage').addEventListener('pointerdown', event => reactionStageMiss(combat, event));
    document.getElementById('rpgAbility').addEventListener('click', activateCombatAbility);
    document.getElementById('rpgRushAbility').addEventListener('click', activateRushAbility);
    document.getElementById('rpgAbandon').addEventListener('click', abandonCurrentCombat);
    document.getElementById('rpgResultClose').addEventListener('click', () => {
      if (sharedMusicMode === 'event') stopEventMusic({ resumeMenu:false, resumeBattle:true });
      overlay.classList.remove('show');
      panel?.classList.add('show');
      combat = null;
      // V50 : la musique de combat continue jusqu'à l'expiration des 25 secondes.
      // Ensuite la taverne reprend, tout en gardant la seconde mémorisée.
      if (sharedMusicMode === 'battle' && menuMusic) {
        menuMusic.volume = BATTLE_MUSIC_VOLUME;
        battleContinuityKey = sharedMusicKey;
        battleContinuityWasPlaying = !menuMusic.paused;
      }
    });
    return overlay;
  }

  function buildAbilityCutinParticles(theme) {
    const sets = {
      warrior: ['✦','✦','✦','✦','✦','✦','✦','✦'],
      archer: ['➶','➵','➳','✦','➶','➵','➳','✦'],
      mage: ['❤','💖','✨','❤','💖','✨','❤','✨']
    };
    const list = sets[theme] || sets.warrior;
    return list.map((symbol, index) => {
      const left = 8 + (index * 11) % 84;
      const top = 12 + (index * 9) % 64;
      const driftX = theme === 'archer' ? 80 + (index % 3) * 22 : 30 + (index % 4) * 18;
      const driftY = theme === 'mage' ? -20 - (index % 3) * 10 : theme === 'warrior' ? -8 + (index % 5) * 5 : -12 + (index % 4) * 8;
      const delay = (index * 0.06).toFixed(2);
      const size = theme === 'warrior' ? 16 + (index % 3) * 5 : 18 + (index % 4) * 4;
      const classes = ['ability-cutin-particle', `theme-${theme}`];
      if (theme === 'warrior') classes.push('shard');
      return `<span class="${classes.join(' ')}" style="left:${left}%;top:${top}%;--cutin-dx:${driftX}px;--cutin-dy:${driftY}px;animation-delay:${delay}s;font-size:${size}px">${theme === 'warrior' ? '' : symbol}</span>`;
    }).join('');
  }

  function ensureAbilityCutinOverlay() {
    let overlay = document.getElementById('abilityCutinOverlay');
    if (overlay) return overlay;
    const style = document.createElement('style');
    style.id = 'abilityCutinStyle';
    style.textContent = `
      .ability-cutin-overlay{position:fixed;inset:0;pointer-events:none;z-index:15000;overflow:hidden}
      .ability-cutin-band{position:absolute;left:50%;bottom:148px;width:min(390px,92vw);height:96px;opacity:0;transform:translateX(-50%) skewX(-8deg) scale(.98);border-radius:16px;overflow:hidden;clip-path:polygon(4% 0,100% 0,96% 100%,0 100%);background:rgba(8,12,24,.94);border:1px solid rgba(255,255,255,.14);box-shadow:0 14px 35px rgba(0,0,0,.48)}
      .ability-cutin-overlay.show .ability-cutin-band{animation:abilityCutinSlide 1.18s cubic-bezier(.22,.8,.18,1) forwards}
      @keyframes abilityCutinSlide{0%{opacity:0;transform:translateX(-145%) skewX(-8deg) scale(.94)}12%{opacity:1;transform:translateX(-50%) skewX(-8deg) scale(1)}70%{opacity:1;transform:translateX(-50%) skewX(-8deg) scale(1)}100%{opacity:0;transform:translateX(55%) skewX(-8deg) scale(1.02)}}
      .ability-cutin-band::before{content:'';position:absolute;inset:0;background:linear-gradient(115deg,rgba(255,255,255,.18),transparent 24%,transparent 76%,rgba(255,255,255,.12));mix-blend-mode:screen}
      .ability-cutin-band::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.12),transparent 25%,transparent 75%,rgba(0,0,0,.18))}
      .ability-cutin-image{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;opacity:.94;filter:saturate(1.05) contrast(1.02)}
      .ability-cutin-copy{position:absolute;left:15px;bottom:12px;max-width:52%;color:#fff;text-shadow:0 3px 18px rgba(0,0,0,.68)}
      .ability-cutin-mini{font-size:7px;letter-spacing:.24em;font-weight:900;text-transform:uppercase;opacity:.84}
      .ability-cutin-title{margin-top:3px;font-size:clamp(17px,5vw,25px);font-weight:1000;line-height:.94;letter-spacing:.03em;text-transform:uppercase}
      .ability-cutin-subtitle{margin-top:4px;font-size:8px;font-weight:700;opacity:.96}
      .ability-cutin-overlay.theme-warrior .ability-cutin-band{box-shadow:0 24px 70px rgba(70,110,255,.3),0 16px 45px rgba(0,0,0,.52)}
      .ability-cutin-overlay.theme-archer .ability-cutin-band{box-shadow:0 24px 70px rgba(255,110,45,.34),0 16px 45px rgba(0,0,0,.52)}
      .ability-cutin-overlay.theme-mage .ability-cutin-band{box-shadow:0 24px 70px rgba(255,92,188,.34),0 16px 45px rgba(0,0,0,.52)}
      .ability-cutin-accent{position:absolute;top:0;bottom:0;width:18px;opacity:.95}
      .ability-cutin-accent.left{left:0;background:linear-gradient(180deg,rgba(255,255,255,.55),transparent 18%,transparent 80%,rgba(255,255,255,.25))}
      .ability-cutin-accent.right{right:0;background:linear-gradient(180deg,rgba(255,255,255,.38),transparent 15%,transparent 84%,rgba(255,255,255,.2))}
      .ability-cutin-particles{position:absolute;inset:0;pointer-events:none}
      .ability-cutin-particle{position:absolute;color:#fff;font-weight:1000;opacity:0;transform:translate3d(0,0,0) scale(.7);text-shadow:0 2px 12px rgba(0,0,0,.55);animation:abilityCutinParticle .85s ease-out forwards}
      @keyframes abilityCutinParticle{0%{opacity:0;transform:translate3d(0,0,0) scale(.55)}18%{opacity:1}100%{opacity:0;transform:translate3d(var(--cutin-dx),var(--cutin-dy),0) scale(1.18)}}
      .ability-cutin-particle.theme-mage{color:#ffd5f3}
      .ability-cutin-particle.theme-archer{color:#ffd07a}
      .ability-cutin-particle.theme-warrior{color:#a8c6ff}
      .ability-cutin-particle.shard{width:16px;height:52px;border-radius:999px;background:linear-gradient(180deg,rgba(255,255,255,.96),rgba(130,180,255,.72) 55%,rgba(130,180,255,0));box-shadow:0 0 18px rgba(130,180,255,.4);transform:rotate(22deg);animation-name:abilityCutinShard}
      @keyframes abilityCutinShard{0%{opacity:0;transform:translate3d(0,0,0) rotate(22deg) scale(.5)}18%{opacity:1}100%{opacity:0;transform:translate3d(var(--cutin-dx),var(--cutin-dy),0) rotate(22deg) scale(1.08)}}
    `;
    if (!document.getElementById('abilityCutinStyle')) document.head.appendChild(style);
    overlay = document.createElement('div');
    overlay.id = 'abilityCutinOverlay';
    overlay.className = 'ability-cutin-overlay';
    overlay.innerHTML = `
      <div class="ability-cutin-band" id="abilityCutinBand">
        <img class="ability-cutin-image" id="abilityCutinImage" alt="Sort actif">
        <div class="ability-cutin-accent left"></div>
        <div class="ability-cutin-accent right"></div>
        <div class="ability-cutin-copy">
          <div class="ability-cutin-mini">Sort actif</div>
          <div class="ability-cutin-title" id="abilityCutinTitle"></div>
          <div class="ability-cutin-subtitle" id="abilityCutinSubtitle"></div>
        </div>
        <div class="ability-cutin-particles" id="abilityCutinParticles"></div>
      </div>`;
    document.body.appendChild(overlay);
    return overlay;
  }

  function showAbilityCutin(classKey) {
    const asset = ABILITY_CUTIN_ASSETS[classKey];
    if (!asset) return;
    const overlay = ensureAbilityCutinOverlay();
    const image = document.getElementById('abilityCutinImage');
    const title = document.getElementById('abilityCutinTitle');
    const subtitle = document.getElementById('abilityCutinSubtitle');
    const particles = document.getElementById('abilityCutinParticles');
    if (image) image.src = asset.image;
    if (title) title.textContent = asset.title;
    if (subtitle) subtitle.textContent = asset.subtitle;
    if (particles) particles.innerHTML = buildAbilityCutinParticles(asset.theme);
    overlay.className = `ability-cutin-overlay theme-${asset.theme}`;
    overlay.classList.remove('show');
    void overlay.offsetWidth;
    overlay.classList.add('show');
    clearTimeout(overlay._hideTimer);
    overlay._hideTimer = setTimeout(() => overlay.classList.remove('show'), 1230);
  }

  function ensureRaidOverlay() {
    let overlay = document.getElementById('raidBattleOverlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'raidBattleOverlay';
    overlay.className = 'raid-overlay';
    overlay.innerHTML = `<div class="raid-arena">
      <div id="raidFightView">
        <div class="raid-arena-head"><span class="raid-arena-title">RAID MONDIAL · PV INFINIS</span><span class="raid-clock" id="raidClock">30,0</span></div>
        <div class="raid-boss-name" id="raidBossName">Boss de raid</div>
        <div class="raid-infinite">PV : ∞ · niveau <span id="raidBossLevel">1</span> · bonus collectif <strong id="raidTeamMultiplier">×2</strong></div>
        <div class="reaction-hint" id="raidReactionHint">Observe l’écran…</div>
        <div class="raid-stage" id="raidStage"><button type="button" class="raid-boss-button" id="raidBossButton">🌀</button><button type="button" class="reaction-target hidden" id="raidReactionTarget"></button></div>
        <div class="reaction-live"><div><b id="raidReactionCombo">×0</b>Combo</div><div><b id="raidReactionPerfectStreak">×0</b>Perfect streak</div><div><b id="raidReactionAccuracy">0 %</b>Précision</div><div><b id="raidClicks">0</b>Puissance</div></div>
        <div class="raid-info"><div><b id="raidRawDamage">0</b><span>Dégâts personnels</span></div><div><b id="raidEffectiveDamage">0</b><span>Dégâts avec équipe</span></div><div><b>24</b><span>Cibles</span></div></div>
      </div>
      <div class="raid-result" id="raidBattleResult"><h2>CONTRIBUTION ENREGISTRÉE</h2><p id="raidBattleResultText"></p><button type="button" class="raid-close" id="raidBattleClose">Revenir au raid</button></div>
    </div>`;
    document.body.appendChild(overlay);
    document.getElementById('raidStage').addEventListener('pointerdown', event => reactionStageMiss(raidBattle, event));
    document.getElementById('raidBattleClose').addEventListener('click', async () => {
      overlay.classList.remove('show');
      panel?.classList.add('show');
      raidBattle = null;
      await Promise.all([loadProgress(), loadRaid()]);
    });
    return overlay;
  }
  async function startRaidRun() {
    primeAbyssalVoice();
    if (!raid?.raid_id || raidBattle || combat || damageTrial) return;
    playBattleMusic({ mode:'raid', bossName:raid?.boss_name, raidLevel:raid?.raid_level, isBoss:true, isEliteSpecial:true }, false);
    const button = document.getElementById('rpgRaidStart');
    if (button) button.disabled = true;
    const { data, error } = await CoachingCloud.client.rpc('start_rpg_raid_run', {
      p_athlete_slug: cfg.slug,
      p_raid_id: raid.raid_id
    });
    if (button) button.disabled = false;
    if (error) {
      stopBattleMusic();
      CoachingCloud.toast(`Raid impossible : ${error.message}`, true);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) { stopBattleMusic(); return; }
    raidBattle = {
      id: row.run_id,
      raidId: row.raid_id,
      classKey: row.rpg_class,
      bossName: row.boss_name,
      bossIcon: row.boss_icon || '🌀',
      raidLevel: n(row.raid_level, 1),
      baseDamage: n(row.base_damage, 1),
      critSeed: n(row.crit_seed, 1),
      critChance: n(row.crit_chance_pct, critChancePct()),
      duration: n(row.duration_seconds, 30),
      startedAt: Date.now(),
      serverStartedAt: row.started_at || null,
      clicks: 0,
      rawDamage: 0,
      teamMultiplier: n(row.team_multiplier, 2),
      finishing: false
    };
    initReactionSession(raidBattle, 'raid');
    const overlay = ensureRaidOverlay();
    panel?.classList.remove('show');
    overlay.classList.add('show');
    document.getElementById('raidFightView').style.display = '';
    document.getElementById('raidBattleResult').classList.remove('show');
    document.getElementById('raidBossName').textContent = raidBattle.bossName;
    document.getElementById('raidBossButton').textContent = raidBattle.bossIcon;
    document.getElementById('raidBossLevel').textContent = raidBattle.raidLevel;
    document.getElementById('raidTeamMultiplier').textContent = `×${fr(raidBattle.teamMultiplier,0)}`;
    updateRaidBattleUi();
    clearInterval(raidBattleTimer);
    raidBattleTimer = setInterval(updateRaidBattleClock, 50);
    updateRaidBattleClock();
  }

  function updateRaidBattleClock() {
    if (!raidBattle || raidBattle.finishing) return;
    updateReactionSession(raidBattle);
    const elapsed = reactionElapsed(raidBattle);
    const remaining = Math.max(0, raidBattle.duration * 1000 - elapsed);
    const clock = document.getElementById('raidClock');
    if (clock) clock.textContent = (remaining / 1000).toFixed(1).replace('.', ',');
    if (remaining <= 0) finishRaidRun();
  }

  function hitRaidBoss() {
    if (!raidBattle || raidBattle.finishing) return;
    if (Date.now() - raidBattle.startedAt >= raidBattle.duration * 1000) return finishRaidRun();
    raidBattle.clicks += 1;
    const hit = damageForClick(raidBattle.classKey, raidBattle.baseDamage, raidBattle.clicks, raidBattle.critSeed, raidBattle.critChance);
    raidBattle.rawDamage += hit.damage;
    const boss = document.getElementById('raidBossButton');
    boss?.classList.add('hit');
    setTimeout(() => boss?.classList.remove('hit'), 60);
    const pop = document.createElement('span');
    pop.className = `rpg-damage-pop raid-pop${hit.crit ? ' crit' : ''}`;
    pop.textContent = `-${fr(hit.damage,0)}${hit.crit ? ' !' : ''}`;
    pop.style.marginLeft = `${Math.round(Math.random()*90-45)}px`;
    document.getElementById('raidStage')?.appendChild(pop);
    setTimeout(() => pop.remove(), 600);
    updateRaidBattleUi();
  }

  function updateRaidBattleUi() {
    if (!raidBattle) return;
    const clicks = document.getElementById('raidClicks');
    const raw = document.getElementById('raidRawDamage');
    const effective = document.getElementById('raidEffectiveDamage');
    if (clicks) clicks.textContent = raidBattle.clicks;
    if (raw) raw.textContent = fr(raidBattle.rawDamage,0);
    if (effective) effective.textContent = fr(raidBattle.rawDamage*raidBattle.teamMultiplier,0);
  }

  async function finishRaidRun() {
    if (!raidBattle || raidBattle.finishing) return;
    raidBattle.finishing = true;
    clearInterval(raidBattleTimer);
    const { data, error } = await CoachingCloud.client.rpc('finish_rpg_raid_run', {
      p_run_id: raidBattle.id,
      p_actions: raidBattle.reactionActions
    });
    if (error) {
      raidBattle.finishing = false;
      CoachingCloud.toast(`Contribution non enregistrée : ${error.message}`, true);
      return;
    }
    const result = Array.isArray(data) ? data[0] : data;
    rememberBattleMusicPosition();
    document.getElementById('raidFightView').style.display = 'none';
    document.getElementById('raidBattleResult').classList.add('show');
    document.getElementById('raidBattleResultText').innerHTML = `Tu as infligé <strong>${fr(result?.raw_damage,0)} dégâts personnels</strong> avec <strong>${n(result?.successful_actions)} actions réussies</strong>.<br>Précision <strong>${fr(result?.accuracy_pct,0)} %</strong> · parfaits <strong>${n(result?.perfect_actions)}</strong> · combo max <strong>×${n(result?.max_combo)}</strong> · perfect streak max <strong>${n(result?.max_perfect_streak)}</strong>.<br>Avec ${n(result?.participant_count)} participant${n(result?.participant_count)===1?'':'s'}, le bonus collectif est <strong>×${fr(result?.team_multiplier,0)}</strong>, soit <strong>${fr(result?.effective_damage,0)} dégâts effectifs</strong>.<br><br>Récompense estimée : <strong>${n(result?.projected_reward_cases)} caisse${n(result?.projected_reward_cases)===1?'':'s'} Ultra</strong> sur 100 maximum.<br>Le total final est recalculé à la fermeture du portail selon le nombre définitif de participants.<br>Critiques de Chance : <strong>${n(result?.crit_count)}</strong>.`;
    await loadRaid();
    await publishRaidActivity(result);
    if (navigator.vibrate) navigator.vibrate([100,60,160,60,220]);
  }

  async function publishRaidActivity(result) {
    if (!window.CoachingCloud?.client || !CoachingCloud.session?.user || !raid?.raid_id) return;
    const payload = {
      set_key: `raid|${cfg.slug}|${raid.raid_id}`,
      athlete_slug: cfg.slug,
      athlete_name: cfg.name,
      athlete_emoji: cfg.emoji || '🏋️',
      program_key: cfg.programKey,
      week_index: 0,
      week_label: 'RPG',
      day_index: 0,
      day_name: 'Raid mondial',
      set_index: 0,
      exercise_code: 'raid',
      exercise_name: 'Raid mondial',
      reps: Math.max(1,n(result?.clicks,1)),
      load_kg: 0,
      rpe: 1,
      activity_type: 'raid',
      details_text: `${cfg.name} a infligé ${fr(result?.raw_damage,0)} dégâts au raid ${raid.boss_name} avec un bonus collectif ×${fr(result?.team_multiplier,0)}.`,
      created_by: CoachingCloud.session.user.id,
      updated_at: new Date().toISOString()
    };
    const { error } = await CoachingCloud.client.from('workout_activities').upsert(payload,{onConflict:'set_key'});
    if (error) console.warn('Activité de raid non publiée :',error.message);
  }

  function ensureDamageTrialOverlay() {
    let overlay = document.getElementById('damageTrialOverlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'damageTrialOverlay';
    overlay.className = 'trial-overlay';
    overlay.innerHTML = `<div class="trial-arena">
      <div id="trialFightView">
        <div class="trial-map-title">Carte spéciale · Dimension du Total</div>
        <div class="trial-map-subtitle">Le Monolithe SBD</div>
        <div class="trial-clock" id="trialClock">30,0</div>
        <div class="reaction-hint" id="trialReactionHint">Observe l’écran…</div>
        <div class="trial-stage" id="trialStage"><div class="trial-portal"></div><div class="trial-map-floor"></div><button type="button" class="trial-dummy" id="trialDummy">🗿</button><button type="button" class="reaction-target hidden" id="trialReactionTarget"></button></div>
        <div class="reaction-live"><div><b id="trialReactionCombo">×0</b>Combo</div><div><b id="trialReactionPerfectStreak">×0</b>Perfect streak</div><div><b id="trialReactionAccuracy">0 %</b>Précision</div><div><b id="trialClicks">0</b>Unités</div></div>
        <div class="trial-info"><div><b id="trialDamage">0</b>Dégâts</div><div><b id="trialPerHit">0</b>Base / unité</div><div><b>24</b>Cibles</div></div>
      </div>
      <div class="trial-result" id="trialResult"><h2>TEST TERMINÉ</h2><p id="trialResultText"></p><button type="button" class="trial-close" id="trialClose">Revenir à la progression</button></div>
    </div>`;
    document.body.appendChild(overlay);
    document.getElementById('trialStage').addEventListener('pointerdown', event => reactionStageMiss(damageTrial, event));
    document.getElementById('trialClose').addEventListener('click', () => {
      overlay.classList.remove('show');
      panel?.classList.add('show');
      damageTrial = null;
    });
    return overlay;
  }

  async function startDamageTrial() {
    if (!progress?.rpg_class || damageTrial || combat) return;
    playBattleMusic({ mode:'trial' }, false);
    const button = document.getElementById('rpgDamageTrial');
    if (button) button.disabled = true;
    const { data, error } = await CoachingCloud.client.rpc('start_rpg_damage_trial', { p_athlete_slug: cfg.slug });
    if (button) button.disabled = false;
    if (error) {
      CoachingCloud.toast(`Test impossible : ${error.message}`, true);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return;
    damageTrial = {
      id: row.trial_id,
      classKey: row.rpg_class,
      baseDamage: n(row.base_damage, 1),
      critSeed: n(row.crit_seed, 1),
      critChance: n(row.crit_chance_pct, critChancePct()),
      duration: n(row.duration_seconds, 30),
      startedAt: Date.now(),
      serverStartedAt: row.started_at || null,
      clicks: 0,
      damage: 0,
      finishing: false
    };
    initReactionSession(damageTrial, 'trial');
    const overlay = ensureDamageTrialOverlay();
    panel?.classList.remove('show');
    overlay.classList.add('show');
    document.getElementById('trialFightView').style.display = '';
    document.getElementById('trialResult').classList.remove('show');
    document.getElementById('trialPerHit').textContent = fr(damageTrial.baseDamage, 0);
    updateDamageTrialUi();
    clearInterval(damageTrialTimer);
    clearTimeout(damageTrialHardStopTimer);
    damageTrialTimer = setInterval(updateDamageTrialClock, 50);
    damageTrialHardStopTimer = setTimeout(() => {
      if (damageTrial && !damageTrial.finishing) void finishDamageTrial();
    }, Math.max(250, damageTrial.duration * 1000 + 250));
    updateDamageTrialClock();
  }

  function updateDamageTrialClock() {
    if (!damageTrial || damageTrial.finishing) return;
    updateReactionSession(damageTrial);
    const elapsed = reactionElapsed(damageTrial);
    const remaining = Math.max(0, damageTrial.duration * 1000 - elapsed);
    const clock = document.getElementById('trialClock');
    if (clock) clock.textContent = (remaining / 1000).toFixed(1).replace('.', ',');
    if (remaining <= 0) finishDamageTrial();
  }

  function hitDamageTrial() {
    if (!damageTrial || damageTrial.finishing) return;
    if (Date.now() - damageTrial.startedAt >= damageTrial.duration * 1000) return finishDamageTrial();
    damageTrial.clicks += 1;
    const hit = damageForClick(damageTrial.classKey, damageTrial.baseDamage, damageTrial.clicks, damageTrial.critSeed, damageTrial.critChance);
    damageTrial.damage += hit.damage;
    const dummy = document.getElementById('trialDummy');
    dummy?.classList.add('hit');
    setTimeout(() => dummy?.classList.remove('hit'), 60);
    const pop = document.createElement('span');
    pop.className = `rpg-damage-pop${hit.crit ? ' crit' : ''}`;
    pop.textContent = `-${hit.damage}${hit.crit ? ' !' : ''}`;
    pop.style.marginLeft = `${Math.round(Math.random() * 90 - 45)}px`;
    document.getElementById('trialStage')?.appendChild(pop);
    setTimeout(() => pop.remove(), 600);
    updateDamageTrialUi();
  }

  function updateDamageTrialUi() {
    if (!damageTrial) return;
    const clicks = document.getElementById('trialClicks');
    const damage = document.getElementById('trialDamage');
    if (clicks) clicks.textContent = damageTrial.clicks;
    if (damage) damage.textContent = fr(damageTrial.damage, 0);
  }

  function damageTrialRpcTimeout(promise, timeoutMs = 12000) {
    return Promise.race([
      promise,
      new Promise(resolve => setTimeout(() => resolve({
        data: null,
        error: { message: `Délai serveur dépassé après ${Math.round(timeoutMs / 1000)} s` },
        timedOut: true
      }), timeoutMs))
    ]);
  }

  async function finishDamageTrial() {
    if (!damageTrial || damageTrial.finishing) return;

    const trial = damageTrial;
    trial.finishing = true;
    clearInterval(damageTrialTimer);
    clearTimeout(damageTrialHardStopTimer);

    const clock = document.getElementById('trialClock');
    if (clock) clock.textContent = '0,0';

    // Le combat disparaît immédiatement à 0,0 : l'écran n'attend plus Supabase.
    const fightView = document.getElementById('trialFightView');
    const resultView = document.getElementById('trialResult');
    const resultText = document.getElementById('trialResultText');
    if (fightView) fightView.style.display = 'none';
    resultView?.classList.add('show');
    if (resultText) resultText.innerHTML = 'Calcul du score et sauvegarde du record…';

    let response = await damageTrialRpcTimeout(
      CoachingCloud.client.rpc('finish_rpg_damage_trial', {
        p_trial_id: trial.id,
        p_actions: trial.reactionActions || []
      })
    );

    // Compatibilité avec l'ancienne fonction Supabase qui attendait p_clicks.
    const firstError = String(response?.error?.message || '');
    const legacySignature = /p_actions|function|schema cache|could not find|does not exist/i.test(firstError);
    if (response?.error && legacySignature && !response?.timedOut) {
      response = await damageTrialRpcTimeout(
        CoachingCloud.client.rpc('finish_rpg_damage_trial', {
          p_trial_id: trial.id,
          p_clicks: Math.max(0, n(trial.clicks))
        })
      );
    }

    const { data, error } = response || {};
    if (error) {
      const localScore = Math.max(0, n(trial.damage));
      if (resultText) {
        resultText.innerHTML = `Le test est bien terminé.<br>Score local : <strong>${fr(localScore,0)} dégâts</strong>.<br><br><strong>⚠️ Record non sauvegardé :</strong> ${esc(error.message || 'erreur serveur inconnue')}.<br>Tu peux revenir à la progression sans rester bloqué sur le timer.`;
      }
      rememberBattleMusicPosition();
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;
    rememberBattleMusicPosition();
    const score = n(result?.damage_dealt, trial.damage);
    const isRecord = !!result?.is_personal_record;
    if (resultText) {
      resultText.innerHTML = `Tu as infligé <strong>${fr(score,0)} dégâts</strong> avec <strong>${n(result?.successful_actions)}</strong> actions réussies.<br>Précision <strong>${fr(result?.accuracy_pct,0)} %</strong> · parfaits <strong>${n(result?.perfect_actions)}</strong> · combo max <strong>×${n(result?.max_combo)}</strong> · perfect streak max <strong>${n(result?.max_perfect_streak)}</strong>.<br>${isRecord ? '<strong>🏆 Nouveau record personnel !</strong><br>' : ''}Meilleur score : <strong>${fr(result?.best_damage_trial,0)}</strong>.<br>Critiques de Chance : <strong>${n(result?.crit_count)}</strong>.<br><br>Aucun XP, gold ou objet n’est distribué sur cette carte.`;
    }
    progress = {
      ...progress,
      best_damage_trial: n(result?.best_damage_trial, progress?.best_damage_trial),
      damage_trial_attempts: n(result?.damage_trial_attempts, progress?.damage_trial_attempts)
    };
    render();
    if (isRecord && navigator.vibrate) navigator.vibrate([100,60,160,60,220]);
  }

  function deterministicLuckRoll(seed, clickNo) {
    const modulus = 2147483647;
    return ((Math.max(1, Math.floor(n(seed, 1))) + Math.max(1, clickNo) * 48271) % modulus) / modulus;
  }

  function damageForClick(classKey, baseDamage, clickNo, critSeed = 1, chancePct = 0) {
    let damage = baseDamage;
    const luckCrit = deterministicLuckRoll(critSeed, clickNo) < Math.max(0, chancePct) / 100;
    if (luckCrit) damage *= 2;
    return { damage, crit: luckCrit, luckCrit };
  }

  function classAbility(session) {
    return CLASS_ABILITIES[session?.classKey] || null;
  }

  function abilityActiveAt(session, elapsedMs = reactionElapsed(session)) {
    if (!session?.abilityUsed || !Number.isFinite(n(session.abilityElapsedMs, NaN))) return false;
    const ability = classAbility(session);
    if (!ability) return false;
    return elapsedMs >= session.abilityElapsedMs && elapsedMs <= session.abilityElapsedMs + ability.durationMs;
  }

  function beginReactionPause(session, durationMs) {
    if (!session || session.reactionPauseStartedAt) return;
    const now = performance.now();
    session.reactionPauseStartedAt = now;
    session.reactionPauseUntil = now + durationMs;
    setTimeout(() => {
      if (!session?.reactionPauseStartedAt) return;
      const endedAt = Math.min(performance.now(), session.reactionPauseUntil);
      session.reactionPausedMs = n(session.reactionPausedMs) + Math.max(0, endedAt - session.reactionPauseStartedAt);
      session.reactionPauseStartedAt = 0;
      session.reactionPauseUntil = 0;
      document.getElementById('rpgOverlay')?.classList.remove('time-stopped');
      updateCombatAbilityButton();
    }, durationMs + 30);
  }


  function reactionRand(seed, roundNo, salt) {
    const modulus = 2147483647;
    const base = Math.max(1, Math.floor(n(seed, 1))) + Math.max(1, roundNo) * 48271 + Math.max(1, salt) * 69621;
    return ((base * 48271) % modulus) / modulus;
  }

  function reactionTypeForComboTier(seed, roundNo, tier = 0) {
    const roll = reactionRand(seed, roundNo, 1);
    const tables = [
      [0.52, 0.68, 0.82, 0.94],
      [0.45, 0.65, 0.80, 0.92],
      [0.38, 0.61, 0.79, 0.91],
      [0.32, 0.57, 0.77, 0.90],
      [0.27, 0.53, 0.75, 0.89]
    ];
    const thresholds = tables[Math.max(0, Math.min(4, Math.floor(n(tier))))] || tables[0];
    return roll < thresholds[0] ? 'normal'
      : roll < thresholds[1] ? 'double'
      : roll < thresholds[2] ? 'chain'
      : roll < thresholds[3] ? 'danger'
      : 'golden';
  }

  function reactionComboDifficulty(session) {
    const combo = Math.max(0, Math.floor(n(session?.reactionCombo)));
    if (combo >= 35) return { tier:4, key:'abyssal', label:'ABYSSAL', intervalMultiplier:0.62, maxActive:5, durationMultiplier:0.80 };
    if (combo >= 20) return { tier:3, key:'expert', label:'EXPERT', intervalMultiplier:0.72, maxActive:4, durationMultiplier:0.86 };
    if (combo >= 10) return { tier:2, key:'avance', label:'AVANCÉ', intervalMultiplier:0.82, maxActive:3, durationMultiplier:0.93 };
    if (combo >= 5) return { tier:1, key:'enchaînement', label:'ENCHAÎNEMENT', intervalMultiplier:0.92, maxActive:2, durationMultiplier:1 };
    return { tier:0, key:'initiation', label:'', intervalMultiplier:1.05, maxActive:1, durationMultiplier:1.08 };
  }

  function reactionSpec(seed, roundNo, startMs = 0, forceBlue = false, options = {}) {
    const tier = Math.max(0, Math.min(4, Math.floor(n(options.tier))));
    const type = forceBlue ? 'normal' : (options.type || reactionTypeForComboTier(seed, roundNo, tier));
    const baseDuration = type === 'chain' ? 1200 : type === 'double' ? 1250 : type === 'golden' ? 1200 : type === 'danger' ? 980 : 1050;
    const durationMultiplier = Math.max(0.55, n(options.durationMultiplier, 1));
    const duration = Math.max(650, Math.round(n(options.duration, baseDuration * durationMultiplier)));
    const x = Number.isFinite(Number(options.x)) ? Number(options.x) : 15 + reactionRand(seed, roundNo, 2) * 70;
    const y = Number.isFinite(Number(options.y)) ? Number(options.y) : 18 + reactionRand(seed, roundNo, 3) * 58;
    let x2 = Number.isFinite(Number(options.x2)) ? Number(options.x2) : 15 + reactionRand(seed, roundNo, 4) * 70;
    let y2 = Number.isFinite(Number(options.y2)) ? Number(options.y2) : 18 + reactionRand(seed, roundNo, 5) * 58;
    if ((x2 - x) ** 2 + (y2 - y) ** 2 < 30 ** 2) {
      x2 = x < 50 ? Math.min(85, x + 35) : Math.max(15, x - 35);
      y2 = y < 47 ? Math.min(76, y + 22) : Math.max(18, y - 22);
    }
    return {
      round:roundNo,
      type,
      start:startMs,
      duration,
      x,
      y,
      x2,
      y2,
      rushBlue:forceBlue,
      comboTier:tier,
      patternKey:options.patternKey || 'single',
      patternLabel:options.patternLabel || ''
    };
  }

  function reactionPatternPool(tier) {
    if (tier >= 4) return ['spiral','storm','cross','zigzag','bait_hard','sweep_vertical'];
    if (tier >= 3) return ['zigzag','cross','triangle','sweep_horizontal','bait','alternating'];
    if (tier >= 2) return ['sweep_horizontal','sweep_vertical','triangle','pair','bait','single'];
    if (tier >= 1) return ['pair','alternating','single','double','chain','bait'];
    return ['single','single','single','double','chain','danger','golden'];
  }

  function reactionBuildPattern(session, elapsedMs, budget = 1) {
    const state = reactionComboDifficulty(session);
    const seed = session.reactionSeed;
    session.reactionPatternCounter = Math.max(0, Math.floor(n(session.reactionPatternCounter))) + 1;
    const patternNo = session.reactionPatternCounter;
    const pool = reactionPatternPool(state.tier);
    const patternKey = pool[Math.min(pool.length - 1, Math.floor(reactionRand(seed, patternNo, 71) * pool.length))] || 'single';
    const labels = {
      single:'CIBLE LIBRE', double:'DOUBLE IMPACT', chain:'CHAÎNE', danger:'PIÈGE ROUGE', golden:'TRAIT LUMINEUX',
      pair:'DUO CROISÉ', alternating:'ALTERNANCE', sweep_horizontal:'BALAYAGE HORIZONTAL', sweep_vertical:'BALAYAGE VERTICAL',
      triangle:'TRIANGLE', zigzag:'ZIGZAG', cross:'CROIX', spiral:'SPIRALE', storm:'TEMPÊTE', bait:'FEINTE', bait_hard:'DOUBLE FEINTE'
    };
    const patternLabel = labels[patternKey] || 'PATTERN';
    const specs = [];
    const limit = Math.max(1, Math.floor(n(budget, 1)));
    const add = (offset, x, y, type = 'normal', durationScale = 1, extra = {}) => {
      if (specs.length >= limit) return;
      session.reactionRoundCounter += 1;
      specs.push(reactionSpec(seed, session.reactionRoundCounter, elapsedMs + Math.max(0, offset), false, {
        tier:state.tier,
        type,
        x,
        y,
        x2:extra.x2,
        y2:extra.y2,
        durationMultiplier:state.durationMultiplier * durationScale,
        duration:extra.duration,
        patternKey,
        patternLabel
      }));
    };
    const randomX = salt => 18 + reactionRand(seed, patternNo, salt) * 64;
    const randomY = salt => 20 + reactionRand(seed, patternNo, salt) * 54;
    const normalOrGolden = salt => reactionRand(seed, patternNo, salt) > (state.tier >= 3 ? 0.82 : 0.92) ? 'golden' : 'normal';

    if (patternKey === 'single') {
      session.reactionRoundCounter += 1;
      specs.push(reactionSpec(seed, session.reactionRoundCounter, elapsedMs, false, {
        tier:state.tier,
        durationMultiplier:state.durationMultiplier,
        patternKey,
        patternLabel
      }));
    } else if (['double','chain','danger','golden'].includes(patternKey)) {
      add(0, randomX(81), randomY(82), patternKey, patternKey === 'danger' ? 0.90 : 1);
    } else if (patternKey === 'pair') {
      const flip = reactionRand(seed, patternNo, 83) > 0.5;
      add(0, flip ? 24 : 76, 28, 'normal');
      add(state.tier >= 2 ? 150 : 260, flip ? 76 : 24, 68, normalOrGolden(84));
    } else if (patternKey === 'alternating') {
      const count = Math.min(limit, state.tier >= 3 ? 4 : 3);
      for (let i = 0; i < count; i += 1) add(i * (state.tier >= 3 ? 135 : 220), i % 2 ? 78 : 22, 25 + (i % 3) * 22, normalOrGolden(90 + i));
    } else if (patternKey === 'sweep_horizontal') {
      const positions = [18, 39, 61, 82];
      const count = Math.min(limit, state.tier >= 3 ? 4 : 3);
      const reverse = reactionRand(seed, patternNo, 100) > 0.5;
      const y = randomY(101);
      for (let i = 0; i < count; i += 1) add(i * (state.tier >= 3 ? 115 : 180), positions[reverse ? positions.length - 1 - i : i], y, normalOrGolden(102 + i), 0.96);
    } else if (patternKey === 'sweep_vertical') {
      const positions = [20, 38, 57, 75];
      const count = Math.min(limit, state.tier >= 3 ? 4 : 3);
      const reverse = reactionRand(seed, patternNo, 110) > 0.5;
      const x = randomX(111);
      for (let i = 0; i < count; i += 1) add(i * (state.tier >= 3 ? 115 : 180), x, positions[reverse ? positions.length - 1 - i : i], normalOrGolden(112 + i), 0.96);
    } else if (patternKey === 'triangle') {
      const points = [[50,20],[22,70],[78,70]];
      points.slice(0, limit).forEach((point, i) => add(i * (state.tier >= 3 ? 110 : 180), point[0], point[1], normalOrGolden(120 + i), 0.94));
    } else if (patternKey === 'zigzag') {
      const points = [[20,22],[78,38],[22,57],[80,74]];
      points.slice(0, limit).forEach((point, i) => add(i * 125, point[0], point[1], normalOrGolden(130 + i), 0.90));
    } else if (patternKey === 'cross') {
      const points = [[50,18],[18,48],[82,48],[50,77],[50,48]];
      points.slice(0, limit).forEach((point, i) => add(i * 105, point[0], point[1], i === 4 ? 'golden' : normalOrGolden(140 + i), 0.88));
    } else if (patternKey === 'spiral') {
      const points = [[20,25],[72,18],[82,62],[42,77],[18,55]];
      points.slice(0, limit).forEach((point, i) => add(i * 95, point[0], point[1], i === 4 ? 'golden' : 'normal', 0.86));
    } else if (patternKey === 'storm') {
      const count = Math.min(limit, 5);
      for (let i = 0; i < count; i += 1) {
        const type = i === 1 && state.tier >= 4 ? 'danger' : normalOrGolden(150 + i);
        add(i * 80, randomX(160 + i * 2), randomY(161 + i * 2), type, type === 'danger' ? 0.78 : 0.84);
      }
    } else if (patternKey === 'bait' || patternKey === 'bait_hard') {
      add(0, 50, 48, 'danger', 0.76);
      add(patternKey === 'bait_hard' ? 280 : 390, 22, 67, 'normal', 0.88);
      add(patternKey === 'bait_hard' ? 430 : 650, 78, 30, patternKey === 'bait_hard' ? 'golden' : 'normal', 0.86);
      if (patternKey === 'bait_hard') add(560, 50, 72, 'normal', 0.82);
    }

    return specs;
  }

  function reactionOutstandingCount(session, elapsed = reactionElapsed(session)) {
    return (session?.reactionSequence || []).filter(spec => {
      if (session.reactionResolved.has(spec.round)) return false;
      const chainExtra = spec.type === 'chain' && session.reactionChainFirst?.round === spec.round ? 1200 : 0;
      return elapsed <= spec.start + spec.duration + chainExtra;
    }).length;
  }

  function reactionIcon(type) {
    return type === 'double' ? '✌️' : type === 'chain' ? '🔗' : type === 'danger' ? '☠️' : type === 'golden' ? '' : '🎯';
  }

  function reactionInstruction(type) {
    return type === 'double' ? 'DOUBLE TAP' : type === 'chain' ? '1 / 2' : type === 'danger' ? 'NE CLIQUE PAS' : type === 'golden' ? 'FRAPPE LE TRAIT' : 'FRAPPE';
  }

  function initReactionSession(session, mode) {
    session.reactionMode = mode;
    session.reactionSeed = n(session.critSeed, 1);
    session.reactionTargetCount = 0;
    session.reactionSequence = [];
    session.reactionRoundCounter = 0;
    session.reactionPatternCounter = 0;
    session.reactionLastPattern = '';
    session.reactionNextSpawnAt = performance.now() + 800;
    session.reactionStartedAt = performance.now();
    session.reactionActions = [];
    session.reactionResolved = new Set();
    session.reactionCurrentRound = 0;
    session.reactionCombo = 0;
    session.reactionMaxCombo = 0;
    session.reactionPerfect = 0;
    session.reactionPerfectStreak = 0;
    session.reactionMaxPerfectStreak = 0;
    session.reactionGood = 0;
    session.reactionMisses = 0;
    session.reactionSuccessful = 0;
    session.reactionProcessed = 0;
    session.reactionEffectiveClicks = 0;
    session.reactionDoubleFirstAt = 0;
    session.reactionChainFirst = null;
    // V58 : chaque tête de mort parfaitement esquivée double le prochain hit.
    // Les esquives consécutives se multiplient : ×2, ×4, ×8, etc.
    session.reactionDodgeMultiplier = 1;
    session.reactionDodgeStacks = 0;
    session.reactionMaxDodgeMultiplier = 1;
    session.clicks = 0;
    session.abilityUsed = false;
    session.rushAbilityUsed = false;
    session.rushStartedAt = 0;
    session.rushElapsedMs = null;
    session.rushDurationMs = 0;
    session.rushExtraElapsedMs = 0;
    session.abilityElapsedMs = null;
    session.blueBurstActive = false;
    session.reactionPausedMs = 0;
    session.reactionPauseStartedAt = 0;
    session.reactionPauseUntil = 0;
    if ('damage' in session) session.damage = 0;
    if ('rawDamage' in session) session.rawDamage = 0;
  }

  function reactionIds(mode) {
    if (mode === 'trial') return { stage:'trialStage', target:'trialReactionTarget', hint:'trialReactionHint', combo:'trialReactionCombo', perfectStreak:'trialReactionPerfectStreak', accuracy:'trialReactionAccuracy' };
    if (mode === 'raid') return { stage:'raidStage', target:'raidReactionTarget', hint:'raidReactionHint', combo:'raidReactionCombo', perfectStreak:'raidReactionPerfectStreak', accuracy:'raidReactionAccuracy' };
    return { stage:'rpgEnemyStage', target:'rpgReactionTarget', hint:'rpgReactionHint', combo:'rpgReactionCombo', perfectStreak:'rpgReactionPerfectStreak', accuracy:'rpgReactionAccuracy' };
  }

  function reactionElapsed(session) {
    return Math.max(0, performance.now() - n(session?.reactionStartedAt));
  }

  function rushAbilityActive(session) {
    return !!(session?.rushStartedAt && performance.now() < session.rushStartedAt + session.rushDurationMs);
  }

  function combatClockElapsed(session) {
    if (!session) return 0;
    const now = performance.now();
    let paused = n(session.reactionPausedMs);
    if (session.reactionPauseStartedAt) {
      paused += Math.max(0, Math.min(now, n(session.reactionPauseUntil, now)) - session.reactionPauseStartedAt);
    }
    return Math.max(0, now - n(session.reactionStartedAt) - paused);
  }

  function reactionActiveSpecs(session) {
    const elapsed = reactionElapsed(session);
    return (session?.reactionSequence || []).filter(spec =>
      !session.reactionResolved.has(spec.round) &&
      elapsed >= spec.start &&
      elapsed <= spec.start + spec.duration + (spec.type === 'chain' && session.reactionChainFirst?.round === spec.round ? 1200 : 0)
    );
  }

  function reactionActiveSpec(session, round = null) {
    const specs = reactionActiveSpecs(session);
    return round == null ? (specs[0] || null) : (specs.find(spec => spec.round === round) || null);
  }

  function reactionStagePoint(event, stage) {
    const rect = stage.getBoundingClientRect();
    return {
      x: rect.width ? (event.clientX - rect.left) / rect.width * 100 : 50,
      y: rect.height ? (event.clientY - rect.top) / rect.height * 100 : 50
    };
  }

  function reactionFeedback(mode, text, quality) {
    const ids = reactionIds(mode);
    const stage = document.getElementById(ids.stage);
    if (!stage) return;
    const el = document.createElement('span');
    el.className = `reaction-feedback ${quality}`;
    el.textContent = text;
    stage.appendChild(el);
    setTimeout(() => el.remove(), 720);
  }

  function reactionPerfectAnimation(session) {
    const ids = reactionIds(session?.reactionMode);
    const stage = document.getElementById(ids.stage);
    if (!stage) return;
    const flash = document.createElement('span');
    flash.className = 'reaction-perfect-flash';
    const burst = document.createElement('span');
    burst.className = 'reaction-perfect-burst';
    stage.append(flash, burst);
    setTimeout(() => { flash.remove(); burst.remove(); }, 760);
    if (navigator.vibrate) navigator.vibrate([18,22,35]);
  }

  function showRagnarokStyleDamage(session, amount, critCount = 0) {
    const ids = reactionIds(session?.reactionMode);
    const stage = document.getElementById(ids.stage);
    if (!stage || amount <= 0) return;
    const burst = document.createElement('span');
    burst.className = `ro-hit-burst${critCount > 0 ? ' ro-hit-critical' : ''}`;
    burst.style.marginLeft = `${Math.round(Math.random() * 70 - 35)}px`;
    burst.style.marginTop = `${Math.round(Math.random() * 24 - 12)}px`;
    burst.innerHTML = `${critCount > 0 ? '<span class="ro-hit-star"></span><span class="ro-hit-label">CRITICAL!</span>' : ''}<span class="ro-hit-slash s1"></span><span class="ro-hit-slash s2"></span><span class="ro-hit-slash s3"></span><span class="ro-hit-number">${fr(amount,0)}</span>`;
    stage.appendChild(burst);
    setTimeout(() => burst.remove(), 850);
  }

  function reactionAddEffectiveClicks(session, units) {
    const amount = Math.max(0, Math.floor(units));
    let damageAdded = 0;
    let critCount = 0;
    for (let i = 0; i < amount; i += 1) {
      session.reactionEffectiveClicks += 1;
      const hit = damageForClick(session.classKey, session.baseDamage, session.reactionEffectiveClicks, session.critSeed, session.critChance);
      damageAdded += hit.damage;
      if (hit.crit) critCount += 1;
      if ('damage' in session) session.damage += hit.damage;
      if ('rawDamage' in session) session.rawDamage += hit.damage;
    }
    session.clicks = session.reactionEffectiveClicks;
    if ('maxHp' in session) session.hp = Math.max(0, session.maxHp - session.damage);
    return { units: amount, damageAdded, critCount };
  }

  function reactionDodgeDamageMultiplier(session) {
    if (session?.reactionMode !== 'combat') return 1;
    return Math.max(1, Math.floor(n(session?.reactionDodgeMultiplier, 1)));
  }

  function reactionDodgeHintPrefix(session) {
    const multiplier = reactionDodgeDamageMultiplier(session);
    return multiplier > 1 ? `☠️ PROCHAIN HIT ×${multiplier} · ` : '';
  }

  function resetReactionDodgeBonus(session) {
    if (!session) return;
    session.reactionDodgeMultiplier = 1;
    session.reactionDodgeStacks = 0;
  }

  function reactionResolve(session, spec, action, quality) {
    if (!session || !spec || session.reactionResolved.has(spec.round)) return;
    if (
      session.reactionMode === 'combat'
      && combatClockElapsed(session) >= normalizeCombatDurationSeconds(session.duration, 30) * 1000
    ) {
      finishCombat('timer');
      return;
    }
    session.reactionResolved.add(spec.round);
    if (session.reactionChainFirst?.round === spec.round) session.reactionChainFirst = null;
    session.reactionCurrentRound = 0;
    session.reactionProcessed += 1;
    if (action) session.reactionActions.push(action);

    if (quality === 'miss') {
      session.reactionMisses += 1;
      session.reactionCombo = 0;
      session.reactionPerfectStreak = 0;
      // Cliquer sur la tête de mort fait perdre la charge d’esquive.
      // Rater une cible normale ne la consomme pas : elle attend le prochain hit réussi.
      if (spec.type === 'danger' && session.reactionMode === 'combat') {
        resetReactionDodgeBonus(session);
      }
      reactionFeedback(session.reactionMode, 'RATÉ', 'miss');
    } else {
      session.reactionSuccessful += 1;
      session.reactionCombo += 1;
      session.reactionMaxCombo = Math.max(session.reactionMaxCombo, session.reactionCombo);
      const isPerfectResolution = quality === 'perfect';
      if (isPerfectResolution) {
        session.reactionPerfectStreak += 1;
        session.reactionMaxPerfectStreak = Math.max(session.reactionMaxPerfectStreak, session.reactionPerfectStreak);
      } else {
        session.reactionPerfectStreak = 0;
      }
      if (spec.type !== 'danger') {
        if (quality === 'perfect') session.reactionPerfect += 1;
        else session.reactionGood += 1;
        // V14 : une cible ne génère plus une quantité exponentielle de frappes.
        // BON = 4 unités, PARFAIT = 6, trait lumineux = 8. Le combo est plafonné à +15 %.
        const comboMultiplier = Math.min(1.15, 1 + Math.floor((session.reactionCombo - 1) / 5) * 0.05);
        const baseUnits = (quality === 'perfect' ? 6 : 4) + (spec.type === 'golden' ? 2 : 0);
        const actionTime = n(action?.t_ms, reactionElapsed(session));
        const firstSpellActive = Number.isFinite(n(session.rushElapsedMs, NaN)) && actionTime >= session.rushElapsedMs && actionTime <= session.rushElapsedMs + 5000;
        const classMultiplier = firstSpellActive ? 1.35 : 1;
        const dodgeMultiplier = reactionDodgeDamageMultiplier(session);
        const hitUnits = Math.round(baseUnits * comboMultiplier * classMultiplier * dodgeMultiplier);
        const hitSummary = reactionAddEffectiveClicks(session, hitUnits);
        showRagnarokStyleDamage(session, hitSummary.damageAdded, hitSummary.critCount);

        // Le bonus est consommé uniquement par le prochain hit réussi.
        if (dodgeMultiplier > 1) resetReactionDodgeBonus(session);

        const multiplierLabel = dodgeMultiplier > 1 ? ` ×${dodgeMultiplier}` : '';
        if (quality === 'perfect') {
          reactionPerfectAnimation(session);
          reactionFeedback(session.reactionMode, `PARFAIT${multiplierLabel}`, quality);
        } else {
          reactionFeedback(session.reactionMode, `BON${multiplierLabel}`, quality);
        }
      } else {
        reactionPerfectAnimation(session);
        if (session.reactionMode === 'combat') {
          const currentMultiplier = reactionDodgeDamageMultiplier(session);
          session.reactionDodgeMultiplier = currentMultiplier * 2;
          session.reactionDodgeStacks = Math.max(0, Math.floor(n(session.reactionDodgeStacks))) + 1;
          session.reactionMaxDodgeMultiplier = Math.max(
            Math.floor(n(session.reactionMaxDodgeMultiplier, 1)),
            session.reactionDodgeMultiplier
          );
          reactionFeedback(
            session.reactionMode,
            `ESQUIVE · PROCHAIN HIT ×${session.reactionDodgeMultiplier}`,
            'perfect'
          );
        } else {
          reactionFeedback(session.reactionMode, 'ESQUIVE PARFAITE', 'perfect');
        }
      }
    }
    updateReactionUi(session);
    if (session.reactionMode === 'combat' && session.hp <= 0 && !session.finishing) {
      setTimeout(() => finishCombat('monster-defeated'), 0);
      return;
    }
    // Ne jamais terminer un combat simplement parce que les 24 signaux ont été joués.
    // Le joueur conserve tout le temps affiché : seule la mort du monstre ou la fin
    // réelle du chronomètre peut clôturer le combat.
  }

  function reactionActionQuality(session, spec, action) {
    const t = n(action?.t_ms, -9999);
    const dx = n(action?.x, -999) - spec.x;
    const dy = n(action?.y, -999) - spec.y;
    const archerFocus = session?.classKey === 'archer' && abilityActiveAt(session, t);

    const radius = archerFocus ? 28 : 18;
    const timeMargin = archerFocus ? 360 : 220;
    const inside = spec.type === 'golden'
      ? Math.abs(dx) <= (archerFocus ? 34 : 24) && Math.abs(dy) <= (archerFocus ? 18 : 10)
      : dx * dx + dy * dy <= radius * radius;
    if (!inside || t < spec.start - timeMargin || t > spec.start + spec.duration + timeMargin) return 'miss';

    if (spec.type === 'golden') {
      if (action.kind !== 'tap') return 'miss';
      return 'perfect';
    }
    if (spec.type === 'normal') {
      if (action.kind !== 'tap') return 'miss';
      if (archerFocus) return 'perfect';
      return Math.abs(t - (spec.start + spec.duration / 2)) <= 260 ? 'perfect' : 'good';
    }
    if (spec.type === 'double') {
      if (action.kind !== 'double') return 'miss';
      if (archerFocus) return 'perfect';
      return Math.abs(t - (spec.start + spec.duration / 2)) <= 420 ? 'perfect' : 'good';
    }
    if (spec.type === 'chain') {
      if (action.kind !== 'chain') return 'miss';
      const t2 = n(action.t2_ms, -9999);
      const dx2 = n(action.x2, -999) - spec.x2;
      const dy2 = n(action.y2, -999) - spec.y2;
      const radius2 = archerFocus ? 30 : 20;
      const inside2 = dx2 * dx2 + dy2 * dy2 <= radius2 * radius2;
      const chainMs = t2 - t;
      if (!inside2 || chainMs < 30 || chainMs > (archerFocus ? 1300 : 1100)) return 'miss';
      if (archerFocus) return 'perfect';
      return Math.abs(t - (spec.start + spec.duration / 2)) <= 360 && chainMs <= 800 ? 'perfect' : 'good';
    }
    return 'miss';
  }

  function reactionTargetPointerDown(session, event, forcedSpec = null) {
    if (!session || session.finishing) return;
    event.preventDefault();
    event.stopPropagation();
    const requestedRound = forcedSpec?.round ?? (Number(event.currentTarget?.dataset?.reactionRound || 0) || null);
    const spec = forcedSpec || reactionActiveSpec(session, requestedRound);
    if (!spec) return;
    const ids = reactionIds(session.reactionMode);
    const stage = document.getElementById(ids.stage);
    if (!stage) return;
    const point = reactionStagePoint(event, stage);
    const t = Math.round(reactionElapsed(session));
    if (spec.type === 'danger') {
      reactionResolve(session, spec, { round:spec.round, kind:'miss', t_ms:t, x:point.x, y:point.y }, 'miss');
      return;
    }
    if (spec.type === 'chain') {
      const target = event.currentTarget;
      if (!session.reactionChainFirst || session.reactionChainFirst.round !== spec.round) {
        session.reactionChainFirst = { round:spec.round, t, point, started:performance.now() };
        if (target) {
          target.className = `reaction-target type-chain chain-second${session.classKey === 'archer' && abilityActiveAt(session) ? ' ability-focus' : ''}`;
          target.style.left = `${spec.x2}%`;
          target.style.top = `${spec.y2}%`;
          target.innerHTML = `🔗<span class="reaction-small">2 / 2</span>`;
        }
        const hint = document.getElementById(ids.hint);
        if (hint) hint.textContent = 'Clique la seconde cible : tu as jusqu’à environ 1 seconde.';
        return;
      }
      const first = session.reactionChainFirst;
      session.reactionChainFirst = null;
      const action = {
        round:spec.round,
        kind:'chain',
        t_ms:first.t,
        x:first.point.x,
        y:first.point.y,
        t2_ms:t,
        x2:point.x,
        y2:point.y,
        chain_ms:Math.round(performance.now() - first.started)
      };
      reactionResolve(session, spec, action, reactionActionQuality(session, spec, action));
      return;
    }
    if (spec.type === 'double') {
      if (session.reactionDoubleFirstAt && performance.now() - session.reactionDoubleFirstAt <= 700) {
        const action = { round:spec.round, kind:'double', t_ms:t, x:point.x, y:point.y };
        session.reactionDoubleFirstAt = 0;
        reactionResolve(session, spec, action, reactionActionQuality(session, spec, action));
      } else {
        session.reactionDoubleFirstAt = performance.now();
        const target = event.currentTarget;
        if (target) target.querySelector('.reaction-small').textContent = 'ENCORE 1 FOIS';
      }
      return;
    }
    const action = { round:spec.round, kind:'tap', t_ms:t, x:point.x, y:point.y };
    reactionResolve(session, spec, action, reactionActionQuality(session, spec, action));
  }

  function reactionStageMiss(session, event) {
    if (!session || session.finishing || event.target.closest?.('.reaction-target')) return;
    const spec = reactionActiveSpec(session);
    if (!spec) return;
    const ids = reactionIds(session.reactionMode);
    const stage = document.getElementById(ids.stage);
    const point = reactionStagePoint(event, stage);
    reactionResolve(session, spec, { round:spec.round, kind:'miss', t_ms:Math.round(reactionElapsed(session)), x:point.x, y:point.y }, 'miss');
  }

  function combatPhaseState(session) {
    if (!session || session.reactionMode !== 'combat' || !(session.maxHp > 0)) {
      return { phase:1, label:'', intervalMultiplier:1 };
    }

    const hpRatio = Math.max(0, Math.min(1, n(session.hp, 0) / Math.max(1, n(session.maxHp, 1))));
    const name = String(session.monsterName || '').toLowerCase();
    const isHanzalone = name.includes('hanzalone');
    const isVal = name.includes('kazuto') || name.includes('lonely shadow') || (name.includes('val') && name.includes('shadow'));
    const isNoah = name.includes('noah');

    if (isHanzalone) {
      if (hpRatio <= 0.33) return { phase:3, label:'PHASE 3 · CHAOS', intervalMultiplier:0.68 };
      if (hpRatio <= 0.66) return { phase:2, label:'PHASE 2 · ACCÉLÉRATION', intervalMultiplier:0.82 };
      return { phase:1, label:'PHASE 1', intervalMultiplier:1 };
    }
    if (isVal) {
      if (hpRatio <= 0.50) return { phase:2, label:'PHASE 2 · OMBRE RAPIDE', intervalMultiplier:0.80 };
      return { phase:1, label:'PHASE 1', intervalMultiplier:1 };
    }
    if (isNoah) {
      if (hpRatio <= 0.40) return { phase:2, label:'PHASE 2 · FURTIF', intervalMultiplier:0.86 };
      return { phase:1, label:'PHASE 1', intervalMultiplier:1 };
    }
    if (session.isBoss) {
      if (hpRatio <= 0.33) return { phase:3, label:'PHASE 3 · ENRAGÉ', intervalMultiplier:0.78 };
      if (hpRatio <= 0.66) return { phase:2, label:'PHASE 2', intervalMultiplier:0.90 };
    }
    return { phase:1, label:'', intervalMultiplier:1 };
  }

  function renderReactionTargets(session) {
    const ids = reactionIds(session.reactionMode);
    const stage = document.getElementById(ids.stage);
    const hint = document.getElementById(ids.hint);
    if (!stage) return;

    // Supprime aussi l'ancienne cible statique laissée par les versions précédentes.
    const legacyTemplate = document.getElementById(ids.target);
    if (legacyTemplate) legacyTemplate.remove();
    stage.querySelectorAll('.reaction-target:not(.dynamic-target)').forEach(node => node.remove());
    const activeSpecs = reactionActiveSpecs(session);
    const activeRounds = new Set(activeSpecs.map(spec => String(spec.round)));
    stage.querySelectorAll('.reaction-target.dynamic-target').forEach(node => {
      if (!activeRounds.has(node.dataset.reactionRound)) node.remove();
    });

    for (const spec of activeSpecs) {
      let target = stage.querySelector(`.reaction-target.dynamic-target[data-reaction-round="${spec.round}"]`);
      if (!target) {
        target = document.createElement('button');
        target.type = 'button';
        target.dataset.reactionRound = String(spec.round);
        target.className = 'reaction-target dynamic-target';
        stage.appendChild(target);
      }
      const isChainSecond = spec.type === 'chain' && session.reactionChainFirst?.round === spec.round;
      const patternVariant = spec.rushBlue || isChainSecond ? '' : ` pattern-${spec.round % 6}`;
      const attackPatternClass = spec.patternKey ? ` attack-pattern-${String(spec.patternKey).replace(/_/g,'-')}` : '';
      const comboTierClass = ` combo-tier-${Math.max(0, Math.floor(n(spec.comboTier)))}`;
      target.className = `reaction-target dynamic-target type-${spec.type}${isChainSecond ? ' chain-second' : ''}${patternVariant}${attackPatternClass}${comboTierClass}${session.classKey === 'archer' && abilityActiveAt(session) ? ' ability-focus' : ''}`;
      target.style.left = `${isChainSecond ? spec.x2 : spec.x}%`;
      target.style.top = `${isChainSecond ? spec.y2 : spec.y}%`;
      target.innerHTML = isChainSecond ? `🔗<span class="reaction-small">2 / 2</span>` : `${reactionIcon(spec.type)}<span class="reaction-small">${reactionInstruction(spec.type)}</span>`;
      target.onpointerdown = event => reactionTargetPointerDown(session, event, spec);
    }

    if (hint) {
      const dodgePrefix = reactionDodgeHintPrefix(session);
      let hintText = '';
      if (!activeSpecs.length) hintText = 'Observe l’écran…';
      else if (session.blueBurstActive) hintText = 'ASSUMPTIO : toutes les cibles bleues restent affichées pendant 5 secondes.';
      else if (rushAbilityActive(session)) hintText = 'RUÉE : uniquement des cibles bleues, plusieurs peuvent apparaître en même temps.';
      else if (activeSpecs.length > 1) hintText = `${activeSpecs.length} cibles actives : frappe-les avant leur disparition.`;
      else {
        const spec = activeSpecs[0];
        hintText = spec.type === 'danger' ? 'Ne touche à rien pendant le signal rouge.' : spec.type === 'chain' ? 'Clique la première cible puis la seconde.' : spec.type === 'double' ? 'Deux pressions rapides sur la cible.' : spec.type === 'golden' ? 'Frappe le grand trait lumineux.' : 'Frappe la cible au meilleur moment.';
      }
      const phaseState = combatPhaseState(session);
      const phasePrefix = phaseState.label ? `${phaseState.label} · ` : '';
      const comboState = reactionComboDifficulty(session);
      const escalationPrefix = comboState.label ? `COMBO ${comboState.label} · ` : '';
      const patternLabel = activeSpecs.find(spec => spec.patternLabel)?.patternLabel || '';
      const patternPrefix = patternLabel && activeSpecs.length > 1 ? `${patternLabel} · ` : '';
      hint.textContent = `${phasePrefix}${escalationPrefix}${patternPrefix}${dodgePrefix}${hintText}`;
    }
  }

  function updateReactionUi(session) {
    if (!session) return;
    const ids = reactionIds(session.reactionMode);
    const accuracy = session.reactionProcessed ? session.reactionSuccessful / session.reactionProcessed * 100 : 0;
    const combo = document.getElementById(ids.combo);
    const perfectStreak = document.getElementById(ids.perfectStreak);
    const accuracyEl = document.getElementById(ids.accuracy);
    if (combo) combo.textContent = `×${session.reactionCombo}`;
    if (perfectStreak) {
      perfectStreak.textContent = session.reactionPerfectStreak ? `×${session.reactionPerfectStreak}` : '×0';
      perfectStreak.classList.toggle('reaction-perfect-streak', session.reactionPerfectStreak > 0);
    }
    if (accuracyEl) accuracyEl.textContent = `${fr(accuracy,0)} %`;
    if (session.reactionMode === 'trial') updateDamageTrialUi();
    else if (session.reactionMode === 'raid') updateRaidBattleUi();
    else updateCombatUi();
  }

  function updateReactionSession(session) {
    if (!session || session.finishing) return;
    const now = performance.now();
    const elapsed = reactionElapsed(session);
    const combatDurationMs = normalizeCombatDurationSeconds(
      session.reactionMode === 'combat' ? session.duration : (session.hardDuration ?? session.duration),
      session.reactionMode === 'combat' ? 30 : RPG_COMBAT_MAX_DURATION_SECONDS
    ) * 1000;
    const phaseState = combatPhaseState(session);
    let spawnSafety = 0;

    // Le combo change réellement le rythme et la géométrie des attaques :
    // simples au départ, puis duos, balayages, triangles, zigzags et tempêtes.
    while (elapsed < combatDurationMs && now >= session.reactionNextSpawnAt && spawnSafety < 8) {
      const comboState = reactionComboDifficulty(session);
      const interval = Math.max(560, Math.round(
        REACTION_BASE_INTERVAL_MS * phaseState.intervalMultiplier * comboState.intervalMultiplier
      ));
      const outstanding = reactionOutstandingCount(session, elapsed);
      const budget = Math.max(0, comboState.maxActive - outstanding);
      if (budget > 0) {
        const specs = reactionBuildPattern(session, elapsed, budget);
        if (specs.length) {
          session.reactionSequence.push(...specs);
          session.reactionTargetCount += specs.length;
          session.reactionLastPattern = specs[0].patternKey || 'single';
        }
      }
      session.reactionNextSpawnAt += interval;
      spawnSafety += 1;
    }
    if (spawnSafety >= 8) {
      const comboState = reactionComboDifficulty(session);
      session.reactionNextSpawnAt = now + Math.max(560, Math.round(
        REACTION_BASE_INTERVAL_MS * phaseState.intervalMultiplier * comboState.intervalMultiplier
      ));
    }

    for (const spec of session.reactionSequence) {
      const chainExtra = spec.type === 'chain' && session.reactionChainFirst?.round === spec.round ? 1200 : 0;
      if (!session.reactionResolved.has(spec.round) && elapsed > spec.start + spec.duration + chainExtra) {
        session.reactionChainFirst = null;
        reactionResolve(session, spec, null, spec.type === 'danger' ? 'perfect' : 'miss');
      }
    }
    renderReactionTargets(session);
  }



  function rpgAssetUrl(relativePath) {
    try {
      const cleanPath = String(relativePath || '').replace(/^\.\//, '');
      const scripts = Array.from(document.scripts || []);
      const appScript = scripts.reverse().find(script => /(?:^|\/)app(?:\([^)]*\))?\.js(?:[?#].*)?$/i.test(script.src || ''));
      const base = appScript?.src ? new URL('.', appScript.src) : new URL('.', document.baseURI || location.href);
      // Les noms issus de Zippy contiennent de vrais caractères « #U2022 ».
      // Sans encodage segment par segment, le navigateur prend « # » pour un fragment
      // et demande un faux fichier tronqué.
      const encodedPath = cleanPath
        .split('/')
        .map(segment => encodeURIComponent(segment))
        .join('/');
      return new URL(encodedPath, base).href;
    } catch (_) {
      return relativePath;
    }
  }

  const FIRST_SPELLS = {
    warrior: { icon:'⚔️', name:'UNBOUND — Brise-Limites', quote:'Rien ne peut me retenir.', audioPaths:['sort1-guerrier.mp3','sort1-guerrier.mp3'] },
    archer: { icon:'🏹', name:'PIERCING FATE — Flèche du Destin', quote:'Ma flèche dans ton pied.', audioPaths:['sort1-archer.mp3','sort1-archer.mp3'] },
    mage: { icon:'✨', name:'SPARKLING CAT — Éveil Astral', quote:'Sparkling Cat.', audioPaths:['sort1-magicienne.mp3','sort1-magicienne.mp3'] }
  };
  const FIRST_SPELL_DURATION_MS = 5000;
  const FIRST_SPELL_DAMAGE_MULTIPLIER = 1.35;
  const firstSpellAudioCache = new Map();

  function firstSpellDef(session) {
    return FIRST_SPELLS[session?.classKey] || FIRST_SPELLS.warrior;
  }

  function ensureFirstSpellAudio(classKey) {
    const key = FIRST_SPELLS[classKey] ? classKey : 'warrior';
    if (firstSpellAudioCache.has(key)) return firstSpellAudioCache.get(key);

    const def = FIRST_SPELLS[key];
    const sources = def.audioPaths.map(audioVersionedUrl);
    const audio = document.createElement('audio');
    audio.preload = 'none';
    audio.playsInline = true;
    audio.setAttribute('playsinline', '');
    audio.setAttribute('webkit-playsinline', '');
    audio.setAttribute('aria-hidden', 'true');
    audio.volume = effectiveSfxVolume(1);
    audio.dataset.sourceIndex = '0';
    audio.src = sources[0];
    audio.style.display = 'none';
    audio.addEventListener('error', () => {
      const nextIndex = n(audio.dataset.sourceIndex) + 1;
      if (nextIndex < sources.length) {
        audio.dataset.sourceIndex = String(nextIndex);
        audio.src = sources[nextIndex];
        audio.load();
        return;
      }
      console.warn(`Voix du Sort 1 introuvable pour ${key} :`, audio.src, audio.error);
    });
    document.body.appendChild(audio);
    firstSpellAudioCache.set(key, audio);
    return audio;
  }

  function preloadFirstSpellSounds() {
    // V60 : chargement à la demande. Les trois voix ne sont plus téléchargées
    // à l'ouverture de chaque page, ce qui réduit la mémoire et les données.
    return sfxAllowed();
  }

  function playFirstSpellSound(session) {
    if (!sfxAllowed()) return false;
    const key = FIRST_SPELLS[session?.classKey] ? session.classKey : 'warrior';
    const audio = ensureFirstSpellAudio(key);
    const previousBattleVolume = battleMusic && !battleMusic.paused ? battleMusic.volume : null;

    try {
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
      audio.defaultMuted = false;
      audio.volume = effectiveSfxVolume(1);

      if (previousBattleVolume !== null) battleMusic.volume = Math.min(previousBattleVolume, 0.16);

      // Appel immédiat depuis le clic sur le sort : compatible Brave/Safari iPhone.
      const playback = audio.play();
      if (playback?.catch) {
        playback.catch(error => {
          console.warn('Lecture voix Sort 1 impossible :', error?.name, error?.message, audio.src);
        });
      }

      const restoreBattleVolume = () => {
        if (previousBattleVolume !== null && battleMusic) battleMusic.volume = previousBattleVolume;
      };
      audio.addEventListener('ended', restoreBattleVolume, { once:true });
      setTimeout(restoreBattleVolume, 4500);
      return true;
    } catch (error) {
      if (previousBattleVolume !== null && battleMusic) battleMusic.volume = previousBattleVolume;
      console.warn('Initialisation voix Sort 1 impossible :', error?.name, error?.message, audio.src);
      return false;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', preloadFirstSpellSounds, { once:true });
  } else {
    preloadFirstSpellSounds();
  }
  function updateRushAbilityButton() {
    const button = document.getElementById('rpgRushAbility');
    const hint = document.getElementById('rpgRushHint');
    if (!button || !combat) return;
    const def = firstSpellDef(combat);
    const active = rushAbilityActive(combat);
    button.innerHTML = `${def.icon} ${def.name}<small id="rpgRushHint"></small>`;
    const newHint = document.getElementById('rpgRushHint');
    button.disabled = combat.rushAbilityUsed || combat.finishing;
    button.classList.toggle('active', active);
    button.classList.toggle('used', combat.rushAbilityUsed && !active);
    if (newHint) newHint.textContent = active ? 'ACTIF · dégâts +35 % pendant 5 s' : combat.rushAbilityUsed ? 'Sort déjà utilisé pour ce combat' : 'Dégâts +35 % pendant 5 s · une utilisation';
  }
  function activateRushAbility() {
    if (!combat || combat.finishing || combat.rushAbilityUsed) return;
    combat.rushAbilityUsed = true;
    combat.rushStartedAt = performance.now();
    combat.rushElapsedMs = Math.round(reactionElapsed(combat));
    combat.rushDurationMs = FIRST_SPELL_DURATION_MS;
    const def = firstSpellDef(combat);
    unlockRpgAudio();
    playFirstSpellSound(combat);
    showAbilityCutin(combat.classKey);
    reactionFeedback('combat', `${def.icon} ${def.name.toUpperCase()} · +35 % DÉGÂTS !`, 'perfect');
    updateRushAbilityButton();
    setTimeout(() => { if (!combat) return; combat.rushStartedAt = 0; updateRushAbilityButton(); }, FIRST_SPELL_DURATION_MS + 20);
    if (navigator.vibrate) navigator.vibrate([45,35,80]);
  }

  function addBlueBurstTargets(session) {
    if (!session || session.finishing) return 0;
    const elapsed = reactionElapsed(session);
    let added = 0;
    for (let index = 0; index < BLUE_BURST_TARGET_COUNT; index += 1) {
      session.reactionRoundCounter += 1;
      const spec = reactionSpec(session.reactionSeed + 7919, session.reactionRoundCounter, elapsed, true);
      spec.duration = BLUE_BURST_DURATION_MS;
      spec.abilityBurst = true;
      // Répartition en grille légèrement irrégulière pour éviter les superpositions.
      const column = index % 4;
      const row = Math.floor(index / 4);
      spec.x = 14 + column * 24 + reactionRand(session.reactionSeed, session.reactionRoundCounter, 8) * 5;
      spec.y = 17 + row * 20 + reactionRand(session.reactionSeed, session.reactionRoundCounter, 9) * 5;
      session.reactionSequence.push(spec);
      session.reactionTargetCount += 1;
      added += 1;
    }
    renderReactionTargets(session);
    return added;
  }

  function updateCombatAbilityButton() {
    const button = document.getElementById('rpgAbility');
    const label = document.getElementById('rpgAbilityLabel');
    const hint = document.getElementById('rpgAbilityHint');
    if (!button || !label || !hint || !combat) return;
    label.textContent = '✨ Assumptio';
    button.style.display = '';
    const cooldown = assumptioCooldownRemaining();
    button.classList.toggle('active', !!combat.blueBurstActive);
    button.classList.toggle('used', (combat.abilityUsed || cooldown > 0) && !combat.blueBurstActive);
    button.disabled = combat.abilityUsed || cooldown > 0 || combat.finishing;
    hint.textContent = combat.blueBurstActive
      ? 'ACTIF · les cibles restent 5 secondes'
      : combat.abilityUsed
        ? `Sort utilisé · recharge après ${ASSUMPTIO_COOLDOWN_COMBATS} combats`
        : cooldown > 0
          ? `Recharge : encore ${cooldown} combat${cooldown > 1 ? 's' : ''}`
          : `${BLUE_BURST_TARGET_COUNT} cibles bleues pendant 5 s · disponible`;
  }

  function activateCombatAbility() {
    if (!combat || combat.finishing || combat.abilityUsed || assumptioCooldownRemaining() > 0) return;
    const currentCombat = combat;
    const elapsedMs = Math.round(reactionElapsed(currentCombat));

    // Assumptio est utilisable une fois puis se recharge après 5 combats validés.
    currentCombat.abilityUsed = true;
    currentCombat.assumptioActivatedThisCombat = true;
    startAssumptioCooldown();
    currentCombat.abilityElapsedMs = elapsedMs;
    currentCombat.blueBurstActive = true;

    // Lecture immédiate dans le geste utilisateur pour Safari/iPhone.
    unlockRpgAudio();
    playAssumptioSound();
    showAbilityCutin(currentCombat.classKey);
    const added = addBlueBurstTargets(currentCombat);
    reactionFeedback('combat', `✨ ASSUMPTIO · ${added} CIBLES BLEUES !`, 'perfect');
    updateCombatAbilityButton();

    setTimeout(() => {
      // Ne modifie pas le combat suivant si le précédent s'est déjà terminé.
      if (combat !== currentCombat) return;
      currentCombat.blueBurstActive = false;
      updateCombatAbilityButton();
    }, BLUE_BURST_DURATION_MS + 30);

    if (navigator.vibrate) navigator.vibrate([50,40,90]);
  }

  async function startCombat() {
    primeAbyssalVoice();
    if (!progress?.rpg_class || combat) return;
    const chosenDifficulty = normalizeSelectedDifficulty();
    primeBattleMusic({ mode:'combat', difficulty:chosenDifficulty });
    const button = document.getElementById('rpgLaunch');
    if (button) button.disabled = true;
    const { data, error } = await CoachingCloud.client.rpc('start_rpg_combat_special_v25', {
      p_athlete_slug: cfg.slug,
      p_difficulty: chosenDifficulty
    });
    if (button) button.disabled = false;
    if (error) {
      stopBattleMusic();
      CoachingCloud.toast(`Combat impossible : ${error.message}`, true);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      stopBattleMusic();
      CoachingCloud.toast('Combat impossible : Supabase n’a renvoyé aucune donnée.', true);
      return;
    }
    if (n(row.difficulty, chosenDifficulty) !== chosenDifficulty) {
      stopBattleMusic();
      CoachingCloud.toast(`Le serveur a renvoyé le mauvais palier. Exécute le patch V10.2.`, true);
      return;
    }

    const returnedHp = n(row.monster_hp, NaN);
    const returnedDamage = n(row.base_damage, NaN);
    const returnedCombatId = String(row.combat_id || '').trim();
    const returnedMonsterName = monsterDisplayName(row.monster_name);
    if (!returnedCombatId || !returnedMonsterName || !Number.isFinite(returnedHp) || returnedHp <= 0 || !Number.isFinite(returnedDamage) || returnedDamage <= 0) {
      stopBattleMusic();
      console.error('Réponse de combat invalide :', row);
      CoachingCloud.toast('Combat impossible : PV ou dégâts invalides.', true);
      return;
    }

    const durationSetup = await prepareUnlimitedCombatV63(
      returnedCombatId,
      row.duration_seconds
    );
    if (durationSetup.error) {
      console.warn('Durée avancée indisponible, utilisation de la durée du combat :', durationSetup.error);
    }
    const returnedDuration = durationSetup.plannedDuration;

    const catalogMonster = monsterCatalogMatch(row);
    const resolvedMonsterRarity = canonicalMonsterRarity(
      returnedMonsterName,
      row.monster_rarity || row.rarity || catalogMonster?.rarity || 'common',
      row.monster_key || catalogMonster?.monster_key || ''
    );
    const eliteSpecial = isEliteSpecialMonster({ ...row, monster_rarity: resolvedMonsterRarity });
    combat = {
      id: returnedCombatId,
      classKey: row.rpg_class,
      level: n(row.level, 1),
      xp: n(row.xp_total),
      monsterName: returnedMonsterName,
      maxHp: returnedHp,
      hp: returnedHp,
      baseDamage: returnedDamage,
      critSeed: n(row.crit_seed, 1),
      critChance: n(row.crit_chance_pct, critChancePct()),
      duration: returnedDuration,
      hardDuration: durationSetup.hardDuration,
      difficulty: n(row.difficulty, currentAdventureDifficulty()),
      hpMultiplier: n(row.hp_multiplier, difficultyHpMultiplier()),
      xpMultiplier: n(row.xp_multiplier, difficultyXpMultiplier()),
      startedAt: 0,
      serverStartedAt: row.started_at || null,
      clicks: 0,
      damage: 0,
      finishing: false,
      monsterRarity: resolvedMonsterRarity,
      monsterWorld: row.monster_world || catalogMonster?.category || 'Bestiaire aléatoire',
      monsterSkinPath: row.skin_path || catalogMonster?.skin_path || monsterSpriteFile(returnedMonsterName) || '',
      isEliteSpecial: eliteSpecial,
      noVisibleTimeLimit: false
    };
    pauseMenuMusic();
    const combatMusicContext = { mode:'combat', ...combat };
    if (resolveBattleMusicKey(combatMusicContext)) playBattleMusic(combatMusicContext, false);
    else if (battleMusic) { try { battleMusic.pause(); battleMusic.currentTime = 0; } catch (_) {} }
    const overlay = ensureCombatOverlay();
    panel?.classList.remove('show');
    overlay.classList.add('show');
    // L’arène est préparée, mais le chrono reste arrêté pendant un éventuel BONUS STAGE.
    document.getElementById('rpgFightView').style.display = '';
    document.getElementById('rpgResult').classList.remove('show');
    const targetCount = document.getElementById('rpgTargetCount');
    if (targetCount) targetCount.textContent = '∞';
    setMonsterNameDisplay(document.getElementById('rpgMonsterName'), combat);
    const enemyEl = document.getElementById('rpgEnemy');
    if (enemyEl) {
      enemyEl.innerHTML = monsterVisual(combat.monsterName, combat.monsterRarity || (combat.isBoss ? 'legendary' : 'common'), combat.monsterSkinPath || '');
      applyMonsterVisualState(enemyEl, combat);
    }
    updateDropComboBadge(progress?.combat_drop_combo, true);
    const def = CLASS_DEFS[combat.classKey];
    document.getElementById('rpgClassLabel').textContent = `${def?.icon || ''} ${def?.title || 'Combattant'} · ${worldIcon(combat.monsterWorld)} ${combat.monsterWorld} · difficulté ${combat.difficulty} · temps limite ${formatCombatDurationLabel(combat.duration)} · critique ${fr(combat.critChance,1)} % · combo loot ×${Math.max(1,n(progress?.combat_drop_combo,1))}`;
    document.getElementById('rpgPerHit').textContent = fr(combat.baseDamage, 0);
    updateCombatAbilityButton();
    updateCombatUi();

    // Commun / normal : démarrage immédiat. Épique et supérieur : animation de 3 secondes.
    await showMonsterIntro(combat);
    await armCombatServerTimer(combat);

    // Le chrono, les cibles et les actions commencent uniquement après l’animation.
    initReactionSession(combat, 'combat');
    clearInterval(combatTimer);
    combatTimer = setInterval(updateCombatClock, 50);
    updateCombatClock();
  }

  async function startBossCombat() {
    primeAbyssalVoice();
    if (!progress?.rpg_class || combat) return;

    const button = document.getElementById('rpgBossLaunch');
    if (button) button.disabled = true;
    primeBattleMusic({ mode:'combat', isBoss:true, difficulty:currentAdventureDifficulty() });

    try {
      const { data, error } = await CoachingCloud.client.rpc('start_rpg_boss', {
        p_athlete_slug: cfg.slug
      });
      if (error) throw new Error(error.message || 'Le serveur a refusé le boss.');

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error('Supabase n’a renvoyé aucune donnée pour le boss.');

      const returnedBossCombatId = String(row.combat_id || row.id || '').trim();
      const returnedBossName = monsterDisplayName(row.monster_name || row.boss_name || 'Boss');
      const returnedHp = n(row.monster_hp, NaN);
      const returnedDamage = n(row.base_damage, NaN);
      if (!returnedBossCombatId || !returnedBossName || !Number.isFinite(returnedHp) || returnedHp <= 0 || !Number.isFinite(returnedDamage) || returnedDamage <= 0) {
        console.error('Réponse boss invalide :', row);
        throw new Error('La réponse du boss contient des PV, dégâts ou identifiant invalides.');
      }

      const durationSetup = await prepareUnlimitedCombatV63(
        returnedBossCombatId,
        row.duration_seconds
      );
      if (durationSetup.error) {
        // V132 : ce RPC est une amélioration de chrono, pas une condition pour combattre.
        console.warn('Durée avancée du boss indisponible, durée SQL utilisée :', durationSetup.error);
      }

      const catalogBoss = monsterCatalogMatch({
        monster_key: row.monster_key,
        monster_name: returnedBossName
      });
      const bossRarity = canonicalMonsterRarity(
        returnedBossName,
        row.monster_rarity || catalogBoss?.rarity || 'legendary',
        row.monster_key || catalogBoss?.monster_key || ''
      );

      combat = {
        id: returnedBossCombatId,
        classKey: row.rpg_class,
        level: n(row.level, 1),
        xp: n(row.xp_total),
        monsterName: returnedBossName,
        maxHp: returnedHp,
        hp: returnedHp,
        baseDamage: returnedDamage,
        critSeed: n(row.crit_seed, 1),
        critChance: n(row.crit_chance_pct, critChancePct()),
        duration: durationSetup.plannedDuration,
        hardDuration: durationSetup.hardDuration,
        difficulty: n(row.difficulty, currentAdventureDifficulty()),
        hpMultiplier: n(row.hp_multiplier, difficultyHpMultiplier()),
        xpMultiplier: 1,
        startedAt: 0,
        serverStartedAt: row.started_at || null,
        clicks: 0,
        damage: 0,
        finishing: false,
        isBoss: true,
        isEliteSpecial: true,
        noVisibleTimeLimit: false,
        monsterRarity: bossRarity,
        monsterWorld: row.monster_world || catalogBoss?.category || 'Boss de palier',
        monsterSkinPath: row.skin_path || catalogBoss?.skin_path || monsterSpriteFile(returnedBossName) || ''
      };

      playBattleMusic({ mode:'combat', ...combat, isBoss:true }, false);
      const overlay = ensureCombatOverlay();
      panel?.classList.remove('show');
      overlay.classList.add('show');
      document.getElementById('rpgFightView').style.display = '';
      document.getElementById('rpgResult').classList.remove('show');
      const targetCount = document.getElementById('rpgTargetCount');
      if (targetCount) targetCount.textContent = '∞';
      setMonsterNameDisplay(document.getElementById('rpgMonsterName'), combat);
      const enemyEl = document.getElementById('rpgEnemy');
      if (enemyEl) {
        enemyEl.innerHTML = monsterVisual(combat.monsterName || 'Boss', combat.monsterRarity || 'legendary', combat.monsterSkinPath || '');
        applyMonsterVisualState(enemyEl, combat);
        enemyEl.classList.add('boss-val');
      }
      updateDropComboBadge(progress?.combat_drop_combo, true);
      const def = CLASS_DEFS[combat.classKey];
      document.getElementById('rpgClassLabel').textContent = `${def?.icon || ''} ${def?.title || 'Combattant'} · BOSS DU PALIER ${combat.difficulty} · temps limite ${formatCombatDurationLabel(combat.duration)} · critique ${fr(combat.critChance,1)} % · combo loot ×${Math.max(1,n(progress?.combat_drop_combo,1))}`;
      document.getElementById('rpgPerHit').textContent = fr(combat.baseDamage, 0);
      updateCombatAbilityButton();
      updateCombatUi();

      await showMonsterIntro(combat);
      try {
        await armCombatServerTimer(combat);
      } catch (timerError) {
        console.warn('Chrono serveur du boss non synchronisé :', timerError);
        combat.startedAt = Date.now();
      }

      initReactionSession(combat, 'combat');
      clearInterval(combatTimer);
      combatTimer = setInterval(updateCombatClock, 50);
      updateCombatClock();
    } catch (bossError) {
      stopBattleMusic();
      combat = null;
      console.error('Boss impossible :', bossError);
      CoachingCloud.toast(`Boss inaccessible : ${bossError?.message || bossError}`, true);
    } finally {
      if (button && !combat) button.disabled = false;
    }
  }

  function formatCombatElapsedTime(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  function formatCombatDurationLabel(seconds) {
    const value = normalizeCombatDurationSeconds(seconds, 30);
    if (value >= 3600 && value % 3600 === 0) {
      const hours = value / 3600;
      return `${hours} h`;
    }
    if (value >= 60 && value % 60 === 0) {
      const minutes = value / 60;
      return `${minutes} min`;
    }
    return `${value} s`;
  }

  function updateCombatClock() {
    if (!combat || combat.finishing) return;
    const elapsed = combatClockElapsed(combat);
    const durationMs = normalizeCombatDurationSeconds(combat.duration, 30) * 1000;
    const remainingMs = Math.max(0, durationMs - elapsed);
    const clock = document.getElementById('rpgClock');
    if (clock) {
      clock.textContent = formatCombatElapsedTime(remainingMs);
      clock.title = `Temps limite : ${formatCombatDurationLabel(combat.duration)}. À 0:00, le combat se termine immédiatement.`;
    }

    if (elapsed >= durationMs) {
      finishCombat('timer');
      return;
    }

    updateReactionSession(combat);
    updateCombatAbilityButton();
    updateRushAbilityButton();
  }

  function hitMonster() {
    if (!combat || combat.finishing) return;
    const durationMs = normalizeCombatDurationSeconds(combat.duration, 30) * 1000;
    if (combatClockElapsed(combat) >= durationMs) return finishCombat('timer');
    combat.clicks += 1;
    const hit = damageForClick(combat.classKey, combat.baseDamage, combat.clicks, combat.critSeed, combat.critChance);
    combat.damage += hit.damage;
    combat.hp = Math.max(0, combat.maxHp - combat.damage);
    const enemy = document.getElementById('rpgEnemy');
    enemy?.classList.add('hit');
    setTimeout(() => enemy?.classList.remove('hit'), 65);
    const pop = document.createElement('span');
    pop.className = `rpg-damage-pop${hit.crit ? ' crit' : ''}`;
    pop.textContent = `-${hit.damage}${hit.crit ? ' !' : ''}`;
    pop.style.marginLeft = `${Math.round(Math.random() * 80 - 40)}px`;
    document.getElementById('rpgEnemyStage')?.appendChild(pop);
    setTimeout(() => pop.remove(), 600);
    updateCombatUi();
    if (combat.hp <= 0) finishCombat('monster-defeated');
  }

  function updateCombatUi() {
    if (!combat) return;
    const pct = Math.max(0, Math.min(100, combat.hp / combat.maxHp * 100));
    document.getElementById('rpgHpBar').style.width = `${pct}%`;
    const phaseState = combatPhaseState(combat);
    const phaseSuffix = phaseState.label ? ` · ${phaseState.label}` : '';
    document.getElementById('rpgHpLabel').textContent = `${fr(combat.hp, 0)} / ${fr(combat.maxHp, 0)} PV${phaseSuffix}`;
    document.getElementById('rpgClicks').textContent = combat.clicks;
    document.getElementById('rpgDamage').textContent = fr(combat.damage, 0);
  }

  async function abandonCurrentCombat() {
    if (!combat || combat.finishing) return;

    // Si la validation serveur a échoué alors que le monstre est déjà à 0 PV,
    // ce bouton sert à relancer proprement l'enregistrement de la victoire.
    if (combat.finishValidationFailed && combat.hp <= 0) {
      combat.finishValidationFailed = false;
      await finishCombat('monster-defeated');
      return;
    }

    // Les combats normaux gardent leur système actuel.
    if (!combat.isBoss) {
      await finishCombat('abandon');
      return;
    }

    const abandonedCombat = combat;
    const abandonButton = document.getElementById('rpgAbandon');
    abandonedCombat.finishing = true;
    clearInterval(combatTimer);
    if (abandonButton) abandonButton.disabled = true;

    const { data, error } = await CoachingCloud.client.rpc('abandon_rpg_boss_v20', {
      p_combat_id: abandonedCombat.id
    });

    if (error) {
      abandonedCombat.finishing = false;
      if (abandonButton) abandonButton.disabled = false;
      clearInterval(combatTimer);
      combatTimer = setInterval(updateCombatClock, 50);
      updateCombatClock();
      stopBattleMusic();
      document.getElementById('rpgFightView').style.display = 'none';
      document.getElementById('rpgResult').classList.add('show');
      document.getElementById('rpgResultTitle').textContent = 'COMBAT ABANDONNÉ';
      document.getElementById('rpgResultText').innerHTML = `Combat fermé. La synchronisation serveur de l’abandon a échoué : <strong>${esc(error.message)}</strong>.`;
      abandonedCombat.finishing = false;
      combat = null;
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;
    rememberBattleMusicPosition();

    document.getElementById('rpgFightView').style.display = 'none';
    document.getElementById('rpgResult').classList.add('show');
    document.getElementById('rpgResultTitle').textContent = 'COMBAT ABANDONNÉ';
    document.getElementById('rpgResultText').innerHTML =
      `Tu as abandonné le combat contre <strong>${esc(abandonedCombat.monsterName)}</strong>.<br>` +
      `Dégâts réalisés avant l’abandon : <strong>${fr(abandonedCombat.damage, 0)}</strong>.<br><br>` +
      `Le boss reste accessible : ton compteur demeure à <strong>${n(result?.kills_toward_boss, progress?.kills_toward_boss)}/50</strong>.`;

    progress = {
      ...progress,
      combat_wins: n(result?.combat_wins, progress?.combat_wins),
      combat_losses: n(result?.combat_losses, progress?.combat_losses),
      boss_wins: n(result?.boss_wins, progress?.boss_wins),
      kills_toward_boss: n(result?.kills_toward_boss, progress?.kills_toward_boss),
      adventure_difficulty: n(result?.difficulty_unlocked, progress?.adventure_difficulty),
      gold_balance: n(result?.gold_balance, progress?.gold_balance),
      combat_drop_combo: Math.max(1, n(result?.combat_drop_combo, 1))
    };
    registerCompletedCombatForAssumptio(abandonedCombat);
    normalizeAssumptioCooldown();
    updateCombatAbilityButton();
    render();
    await loadProgress();
  }

  function combatActionsPayloadV64(session) {
    const actions = Array.isArray(session?.reactionActions)
      ? session.reactionActions.map(action => ({ ...action }))
      : [];

    // Résumé fiable du combat dynamique pour le SQL du combo persistant.
    // Le kind reste combat_summary_v62 afin de rester compatible avec le RPC installé.
    actions.push({
      kind: 'combat_summary_v62',
      successful_actions: Math.max(0, Math.floor(n(session?.reactionSuccessful))),
      perfect_actions: Math.max(0, Math.floor(n(session?.reactionPerfect))),
      good_actions: Math.max(0, Math.floor(n(session?.reactionGood))),
      missed_actions: Math.max(0, Math.floor(n(session?.reactionMisses))),
      processed_actions: Math.max(0, Math.floor(n(session?.reactionProcessed))),
      generated_targets: Math.max(0, Math.floor(n(session?.reactionTargetCount))),
      client_combo_max: Math.max(0, Math.floor(n(session?.reactionMaxCombo))),
      client_perfect_streak_max: Math.max(0, Math.floor(n(session?.reactionMaxPerfectStreak))),
      definition: 'perfect_zero_ok_zero_miss'
    });

    return actions;
  }

  async function finishCombat(reason = 'automatic') {
    if (!combat || combat.finishing) return;
    const elapsed = combatClockElapsed(combat);
    const durationMs = normalizeCombatDurationSeconds(combat.duration, 30) * 1000;
    const timerExpired = elapsed >= durationMs - 40;
    const monsterDefeated = combat.hp <= 0;
    if (reason !== 'abandon' && !timerExpired && !monsterDefeated) return;
    combat.finishing = true;
    combat.finishValidationFailed = false;
    clearInterval(combatTimer);
    const reactionStage = document.getElementById(reactionIds('combat').stage);
    reactionStage?.querySelectorAll('.reaction-target').forEach(target => target.remove());
    const reactionHint = document.getElementById(reactionIds('combat').hint);
    if (reactionHint) reactionHint.textContent = reason === 'timer' ? 'TEMPS ÉCOULÉ · validation du résultat…' : 'Validation du résultat…';
    const validationButton = document.getElementById('rpgAbandon');
    if (validationButton) {
      validationButton.disabled = true;
      validationButton.textContent = 'Validation…';
    }

    const rpcPromise = CoachingCloud.client.rpc(
      combat.isBoss ? 'finish_rpg_boss_codex_xp_v35' : 'finish_rpg_combat_codex_xp_v35',
      {
        p_combat_id: combat.id,
        p_actions: combatActionsPayloadV64(combat),
        p_client_clicks: Math.max(0, Math.floor(n(combat.reactionEffectiveClicks, combat.clicks)))
      }
    );
    const timeoutPromise = new Promise(resolve => setTimeout(() => resolve({
      data: null,
      error: { message: 'Le serveur met trop de temps à valider la victoire. Réessaie sans relancer le combat.' }
    }), 15000));
    const { data, error } = await Promise.race([rpcPromise, timeoutPromise]);

    if (error) {
      combat.finishing = false;
      combat.finishValidationFailed = true;
      if (validationButton) {
        validationButton.disabled = false;
        validationButton.textContent = 'Réessayer la validation';
      }
      CoachingCloud.toast(`Résultat non enregistré : ${error.message}`, true);
      return;
    }
    const result = Array.isArray(data) ? data[0] : data;
    rememberBattleMusicPosition();
    schedulePostCombatMusicReturn();
    const won = !!result?.won;
    const hasAbyssalDrop = [
      result?.combat_item_rarity,
      result?.elite_raid_drop_rarity,
      result?.item_rarity,
      result?.special_drop_rarity
    ].some(rarity => String(rarity || '').toLowerCase() === 'abyssal');
    if (won && hasAbyssalDrop) playAbyssalVoice();
    const goldEarned = n(result?.gold_earned);
    const xpEarned = n(result?.xp_earned);
    const baseCombatXp = n(result?.base_combat_xp);
    const codexXpBonusPct = n(result?.codex_xp_bonus_pct);
    const codexXpMultiplier = n(result?.codex_xp_multiplier, 1);
    const palierXpMultiplier = Math.max(0, n(
      result?.palier_xp_multiplier,
      monsterPalierXpMultiplier(
        n(result?.max_adventure_difficulty, progress?.adventure_difficulty, currentAdventureDifficulty()),
        n(result?.combat_difficulty, combat?.difficulty, selectedCombatDifficultyForXp())
      )
    ));
    const palierXpPct = Math.round(palierXpMultiplier * 100);
    const bossExcludedFromXp = result?.boss_xp_excluded === true
      || result?.xp_reward_mode === 'boss_zero';
    const palierXpText = palierXpPct < 100
      ? ` · coefficient palier XP ${palierXpPct} %`
      : '';
    const xpRewardHtml = bossExcludedFromXp
      ? `<strong>👑 Boss : 0 XP</strong> <span style="opacity:.82;font-size:.92em">(hors pool de rareté des monstres)</span>`
      : codexXpBonusPct > 0
        ? `<strong>✨ +${fr(xpEarned,2)} XP</strong> <span style="opacity:.82;font-size:.92em">(base ${fr(baseCombatXp,0)} ×${fr(codexXpMultiplier,3)} grâce au bestiaire +${fr(codexXpBonusPct,1)} %${palierXpText})</span>`
        : `<strong>✨ +${fr(xpEarned,2)} XP</strong> <span style="opacity:.82;font-size:.92em">(base ${fr(baseCombatXp,0)}${palierXpText})</span>`;
    const perfectActionGold = n(result?.perfect_action_gold_bonus);
    const lootComboAfter = Math.max(1, Math.min(100, n(result?.combat_drop_combo, progress?.combat_drop_combo, 1)));
    const lootComboUsed = Math.max(1, Math.min(100, n(result?.drop_combo_used, lootComboAfter)));
    const dropComboPerfect = result?.drop_combo_perfect === true;
    const lootComboHtml = `<strong>🔥 Combo loot ×${lootComboAfter}</strong>${dropComboPerfect ? ` <span style="opacity:.9;font-size:.92em">(PERFECT : zéro OK, zéro raté · streak doublée)</span>` : lootComboUsed !== lootComboAfter ? ` <span style="opacity:.82;font-size:.92em">(×${lootComboUsed} appliqué à ce drop)</span>` : ''}`;
    // gold_earned contient déjà le bonus des actions Perfect.
    // On affiche donc un total crédité et son détail, sans laisser croire
    // que le bonus Perfect doit être ajouté une seconde fois.
    const combatGoldWithoutPerfectActions = Math.max(0, goldEarned - perfectActionGold);
    const goldRewardHtml = perfectActionGold > 0
      ? `<strong>🪙 Total crédité : +${fr(goldEarned,0)} gold</strong> <span style="opacity:.82;font-size:.92em">(combat +${fr(combatGoldWithoutPerfectActions,0)} · Perfects +${fr(perfectActionGold,0)}, déjà inclus)</span>`
      : `<strong>🪙 Total crédité : +${fr(goldEarned,0)} gold</strong>`;
    const eliteRaidDropHtml = result?.elite_raid_drop_name
      ? `<span class="combat-loot-line rarity-${esc(result.elite_raid_drop_rarity || 'rare')}" style="--loot-color:${esc(RARITY_COLORS[result.elite_raid_drop_rarity] || RARITY_COLORS.rare)}"><strong>🌀 Drop de monstre élite :</strong> ${esc(result.elite_raid_drop_name)} · <span class="loot-rarity">${RARITY_DEFS[result.elite_raid_drop_rarity]?.label || esc(result.elite_raid_drop_rarity)}</span> · niveau ${n(result.elite_raid_drop_level,1)}</span>`
      : '';
    updateDropComboBadge(lootComboAfter, true);
    document.getElementById('rpgFightView').style.display = 'none';
    document.getElementById('rpgResult').classList.add('show');
    document.getElementById('rpgResultTitle').textContent = won ? (combat.isBoss ? 'BOSS TERRASSÉ !' : 'VICTOIRE BG !') : 'DÉFAITE';
    document.getElementById('rpgResultText').innerHTML = won
      ? (combat.isBoss
        ? `Tu as vaincu <strong>${esc(combat.monsterName)}</strong> avec <strong>${n(result?.successful_actions)} actions réussies</strong> et <strong>${fr(result.damage_dealt,0)} dégâts</strong>.<br>Précision <strong>${fr(result?.accuracy_pct,0)} %</strong> · parfaits <strong>${n(result?.perfect_actions)}</strong> · combo max <strong>×${n(result?.max_combo)}</strong> · perfect streak max <strong>${n(result?.max_perfect_streak)}</strong>.<br><br>Récompense : ${goldRewardHtml}${result?.gold_jackpot ? ' · <strong>🍀 JACKPOT ×10 !</strong>' : ''}${result?.perfect_combat ? ` · <strong>👑 COMBAT PARFAIT ×${fr(result?.perfect_gold_multiplier,3)} GOLD</strong>` : ''} · ${xpRewardHtml} · ${lootComboHtml}.<br>${n(result?.difficulty_unlocked, combat.difficulty) >= 10000 ? '<strong>Palier ultime 10 000 validé !</strong>' : `<strong>Palier ${n(result?.difficulty_unlocked, combat.difficulty + 1)} débloqué !</strong>`} Le compteur repart à 0/50.<br>Critiques de Chance : <strong>${n(result?.crit_count)}</strong>.`
        : `Tu as terrassé <strong>${esc(combat.monsterName)}</strong> avec <strong>${n(result?.successful_actions)} actions réussies</strong> et <strong>${fr(result.damage_dealt, 0)} dégâts</strong>.<br>Précision <strong>${fr(result?.accuracy_pct,0)} %</strong> · parfaits <strong>${n(result?.perfect_actions)}</strong> · combo max <strong>×${n(result?.max_combo)}</strong> · perfect streak max <strong>${n(result?.max_perfect_streak)}</strong>.<br><br>Récompenses : ${goldRewardHtml}${result?.gold_jackpot ? ' · <strong>🍀 JACKPOT ×10 !</strong>' : ''}${result?.perfect_combat ? ` · <strong>👑 COMBAT PARFAIT ×${fr(result?.perfect_gold_multiplier,3)} GOLD</strong>` : ''} · ${xpRewardHtml} · ${lootComboHtml} · difficulté <strong>${n(combat.difficulty,1)}</strong> · critiques de Chance <strong>${n(result?.crit_count)}</strong>.${result?.combat_item_name ? `<span class="combat-loot-line rarity-${esc(result.combat_item_rarity || 'normal')}" style="--loot-color:${esc(RARITY_COLORS[result.combat_item_rarity] || RARITY_COLORS.normal)}"><strong>🎁 Objet de combat garanti :</strong> ${esc(result.combat_item_name)} · <span class="loot-rarity">${RARITY_DEFS[result.combat_item_rarity]?.label || esc(result.combat_item_rarity)}</span> · niveau ${n(result.combat_item_level,1)} · dégâts +${fr(result.combat_item_damage_bonus_pct,2)} %${n(result.combat_item_quantity_after,1)>1?` · pile ×${n(result.combat_item_quantity_after)}`:''}</span>` : ''}${eliteRaidDropHtml}${result?.discovered_new ? `<br><br><strong>📖 NOUVELLE DÉCOUVERTE :</strong> ${esc(monsterDisplayName(result.discovered_monster_name))}<br>Bonus permanent : <strong>+${fr(result.discovery_xp_bonus,0)} % XP</strong> · total bestiaire : +${fr(result.collection_xp_bonus,1)} %.` : ''}${result?.special_drop_name ? `<br><br><strong>Drop spécial :</strong> ${esc(result.special_drop_name)}${result?.special_drop_note ? ` · ${esc(result.special_drop_note)}` : ''}` : ''}`)
      : `<strong>${esc(combat.monsterName)}</strong> avait encore ${fr(Math.max(0, n(result.monster_hp) - n(result.damage_dealt)), 0)} PV. Tu as infligé <strong>${fr(result.damage_dealt, 0)} dégâts</strong> avec ${n(result?.successful_actions)} actions réussies · précision ${fr(result?.accuracy_pct,0)} %.${perfectActionGold>0 ? `<br><strong>🎯 Bonus des perfects : +${fr(perfectActionGold,0)} gold</strong>` : ''}`;
    progress = {
      ...progress,
      combat_wins: n(result.combat_wins, progress?.combat_wins),
      combat_losses: n(result.combat_losses, progress?.combat_losses),
      best_combat_damage: n(result.best_combat_damage, progress?.best_combat_damage),
      gold_balance: n(result.gold_balance, progress?.gold_balance),
      gold_total_earned: n(progress?.gold_total_earned) + goldEarned,
      xp_total: n(result?.xp_total, progress?.xp_total),
      level: n(result?.level_after, progress?.level),
      collection_xp_bonus: n(result?.collection_xp_bonus, progress?.collection_xp_bonus),
      adventure_difficulty: n(result?.difficulty_unlocked, progress?.adventure_difficulty),
      kills_toward_boss: n(result?.kills_toward_boss, progress?.kills_toward_boss),
      boss_wins: n(result?.boss_wins, progress?.boss_wins),
      perfect_combat_streak: n(result?.perfect_combat_streak, result?.perfect_combat ? n(progress?.perfect_combat_streak)+1 : 0),
      best_perfect_combat_streak: Math.max(n(progress?.best_perfect_combat_streak), n(result?.perfect_combat_streak)),
      combat_drop_combo: lootComboAfter,
      best_combat_drop_combo: Math.max(n(progress?.best_combat_drop_combo, 1), n(result?.best_combat_drop_combo, lootComboAfter))
    };
    registerCompletedCombatForAssumptio(combat);
    normalizeAssumptioCooldown();
    updateCombatAbilityButton();
    render();
    if (won && result?.gold_jackpot) playEventMusic('jackpot', { restart:true, loop:false, volume:0.72 });
    if (won && result?.perfect_combat) showPerfectCombatAnimation(result);
    if (won) {
      await Promise.all([loadProgress(), loadInventory(), loadCollections()]);
      await publishCombatActivity(result, combat);
      if (navigator.vibrate) navigator.vibrate([100, 60, 140, 60, 220]);
    } else {
      await loadProgress();
    }
  }

  async function publishCombatActivity(result, battle) {
    if (!window.CoachingCloud?.client || !CoachingCloud.session?.user) return;
    const payload = {
      set_key: `combat|${cfg.slug}|${battle.id}`,
      athlete_slug: cfg.slug,
      athlete_name: cfg.name,
      athlete_emoji: cfg.emoji || '🏋️',
      program_key: cfg.programKey,
      week_index: 0,
      week_label: 'RPG',
      day_index: 0,
      day_name: 'Arène',
      set_index: 0,
      exercise_code: 'rpg',
      exercise_name: 'Combat RPG',
      reps: Math.max(1, n(result.clicks, 1)),
      load_kg: 0,
      rpe: 1,
      activity_type: 'combat',
      details_text: `${cfg.name} a terrassé ${battle.monsterName} en ${n(result.clicks)} coups, ${fr(result.damage_dealt, 0)} dégâts, gagne ${fr(result.gold_earned, 0)} gold et ${result?.boss_xp_excluded === true ? '0 XP car les boss sont hors pool de rareté' : `${fr(result.xp_earned, 2)} XP${n(result?.codex_xp_bonus_pct)>0 ? ` grâce au multiplicateur bestiaire +${fr(result.codex_xp_bonus_pct,1)} %` : ''}`}.${result?.discovered_new ? ` Nouvelle découverte ajoutée au bestiaire.` : ''}`, 
      created_by: CoachingCloud.session.user.id,
      updated_at: new Date().toISOString()
    };
    const { error } = await CoachingCloud.client.from('workout_activities').upsert(payload, { onConflict: 'set_key' });
    if (error) console.warn('Activité de combat non publiée :', error.message);
  }

  async function publishLootActivity(item) {
    if (!window.CoachingCloud?.client || !CoachingCloud.session?.user) return;
    const rarity = RARITY_DEFS[item.item_rarity] || RARITY_DEFS.normal;
    const payload = {
      set_key: `loot|${cfg.slug}|${item.item_id}`,
      athlete_slug: cfg.slug,
      athlete_name: cfg.name,
      athlete_emoji: cfg.emoji || '🏋️',
      program_key: cfg.programKey,
      week_index: 0,
      week_label: 'RPG',
      day_index: 0,
      day_name: 'Case opening',
      set_index: 0,
      exercise_code: 'loot',
      exercise_name: 'Équipement RPG',
      reps: 1,
      load_kg: 0,
      rpe: 1,
      activity_type: 'loot',
      details_text: `${cfg.name} a obtenu un objet ${rarity.label.toLowerCase()} : ${item.item_name}.`,
      created_by: CoachingCloud.session.user.id,
      updated_at: new Date().toISOString()
    };
    const { error } = await CoachingCloud.client.from('workout_activities').upsert(payload, { onConflict: 'set_key' });
    if (error) console.warn('Activité de loot non publiée :', error.message);
  }

  function celebrate(result) {
    if (!result || result.duplicate) return;
    const totalGain = n(result.setPoints) + n(result.speedBonus);
    const baseWithPr = n(result.basePoints) + n(result.prBonus);
    let text = `+${fr(totalGain, 2)} XP · base ${fr(baseWithPr, 2)} × GL ${fr(result.glMultiplier, 2)}`;
    if (Math.abs(n(result.classMultiplier, 1) - 1) > 0.0001) text += ` × classe ${fr(result.classMultiplier, 2)}`;
    if (Math.abs(n(result.collectionMultiplier, 1) - 1) > 0.0001) text += ` × bestiaire ${fr(result.collectionMultiplier, 2)}`;
    if (result.speedBonus > 0) text += ` · vitesse +${fr(result.speedBonus, 2)}`;
    CoachingCloud.toast(text);
    if (result.levelUp) {
      const overlay = ensureLevelOverlay();
      document.getElementById('xpLevelTitle').textContent = `LEVEL UP BG ! NIVEAU ${result.level}`;
      document.getElementById('xpLevelText').textContent = `Ton total est maintenant de ${fr(result.totalXp, 1)} XP. Une nouvelle tranche de cases est débloquée tous les 5 niveaux.`;
      overlay.classList.add('show');
      if (navigator.vibrate) navigator.vibrate([120, 70, 180, 70, 260]);
    }
  }

  async function publishMilestones(result, meta) {
    if (!result || !window.CoachingCloud?.client || !CoachingCloud.session?.user) return;
    const common = {
      athlete_slug: cfg.slug,
      athlete_name: cfg.name,
      athlete_emoji: cfg.emoji || '🏋️',
      program_key: cfg.programKey,
      week_index: meta.w,
      week_label: meta.weekLabel,
      day_index: meta.d,
      day_name: meta.dayName,
      set_index: meta.idx,
      exercise_code: 'xp',
      exercise_name: 'Progression',
      reps: 1,
      load_kg: 0,
      rpe: 1,
      created_by: CoachingCloud.session.user.id,
      xp_points: 0,
      level_after: result.level,
      updated_at: new Date().toISOString()
    };
    if (result.levelUp) {
      await CoachingCloud.client.from('workout_activities').upsert({
        ...common,
        set_key: `level|${cfg.slug}|${result.level}`,
        activity_type: 'level',
        details_text: `${cfg.name} passe niveau ${result.level}.`
      }, { onConflict: 'set_key' });
    }
    if (result.speedBonus > 0) {
      await CoachingCloud.client.from('workout_activities').upsert({
        ...common,
        set_key: `speed|${cfg.slug}|${cfg.programKey}|${meta.w}|${meta.d}`,
        activity_type: 'session',
        xp_points: result.speedBonus,
        speed_multiplier: result.speedMultiplier,
        details_text: `${cfg.name} termine sa séance avec un coefficient vitesse ×${fr(result.speedMultiplier, 2)} et gagne ${fr(result.speedBonus, 2)} XP bonus.`
      }, { onConflict: 'set_key' });
    }
  }

  async function awardForSet(meta, prResult, structure) {
    if (!window.CoachingCloud?.client || !CoachingCloud.session?.user) return null;
    const { data, error } = await CoachingCloud.client.rpc('award_set_xp_v71', {
      p_athlete_slug: cfg.slug,
      p_program_key: cfg.programKey,
      p_week_index: meta.w,
      p_day_index: meta.d,
      p_set_index: meta.idx,
      p_exercise_code: meta.code,
      p_is_pr: !!prResult?.isPr,
      p_previous_pr_kg: prResult?.previousLoad || null,
      p_total_sets: structure?.totalSets || 0,
      p_sbd_sets: structure?.sbdSets || 0,
      p_accessory_sets: structure?.accessorySets || 0
    });
    if (error) {
      console.warn('Attribution XP impossible :', error.message);
      CoachingCloud.toast(`Série validée, XP non attribuée : ${error.message}`, true);
      return null;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    const result = {
      duplicate: !!row.was_duplicate,
      basePoints: n(row.base_points),
      prBonus: n(row.pr_bonus_points),
      glPoints: n(row.gl_points),
      glMultiplier: n(row.gl_multiplier, 1),
      classMultiplier: n(row.class_multiplier, 1),
      collectionMultiplier: n(row.collection_multiplier, 1),
      sbdSetNumber: n(row.sbd_set_number, 0),
      setPoints: n(row.set_points_awarded),
      speedMultiplier: n(row.speed_multiplier, 1),
      speedBonus: n(row.speed_bonus_awarded),
      totalXp: n(row.total_xp),
      level: n(row.level_after, 1),
      levelUp: !!row.level_up,
      packEarned: n(row.packs_earned)
    };
    progress = {
      ...(progress || {}),
      athlete_slug: cfg.slug,
      xp_total: result.totalXp,
      level: result.level,
      unopened_packs: n(progress?.unopened_packs) + result.packEarned,
      gl_points: result.glPoints || progress?.gl_points,
      gl_multiplier: result.glMultiplier
    };
    render();
    celebrate(result);
    await publishMilestones(result, meta);
    if (!result.duplicate) await loadRaid(true);
    return result;
  }

  inject();
  render();
  window.addEventListener('pagehide', () => { cancelPostCombatMusicReturn(); stopEventMusic({ resumeMenu:false, resumeBattle:false }); stopBattleMusic({ reset:false, resumeMenu:false, clearContinuity:true }); stopMenuMusic(); });

  window.CoachingXP = { awardForSet, refresh: loadAll, render };

  if (window.CoachingCloud?.onReady) {
    CoachingCloud.onReady(async () => {
      await loadAll();
      if (!channel) {
        channel = CoachingCloud.client
          .channel(`ga-rpg-${cfg.slug}`)
          .on('postgres_changes', {
            event: '*', schema: 'public', table: 'athlete_progress', filter: `athlete_slug=eq.${cfg.slug}`
          }, loadProgress)
          .on('postgres_changes', {
            event: '*', schema: 'public', table: 'rpg_inventory', filter: `athlete_slug=eq.${cfg.slug}`
          }, loadInventory)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'rpg_monster_collection', filter: `athlete_slug=eq.${cfg.slug}` }, loadCollections)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'rpg_item_collection', filter: `athlete_slug=eq.${cfg.slug}` }, loadCollections)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'rpg_raids' }, () => loadRaid())
          .on('postgres_changes', { event: '*', schema: 'public', table: 'rpg_raid_participants' }, () => loadRaid())
          .on('postgres_changes', { event: '*', schema: 'public', table: 'rpg_raid_runs' }, () => loadRaid())
          .subscribe();
      }
      clearInterval(raidPollTimer);
      raidPollTimer = setInterval(() => loadRaid(), 15000);
      clearInterval(raidClockTimer);
      raidClockTimer = setInterval(updateRaidCountdownUi, 1000);
    });
  }
})();


(function () {
  'use strict';

  const cfg = window.COACHING_ATHLETE || {};
  if (!cfg.slug) return;
  if (!cfg.name || !cfg.programKey || !cfg.adapter) {
    console.error('Configuration athlète incomplète.', cfg);
    return;
  }
  if (cfg.adapter === 'custom') return;

  // Coupe le vieux chrono natif des pages historiques : sinon il réécrit
  // l'affichage toutes les secondes avec une ancienne session globale.
  try {
    if (typeof chronoInt !== 'undefined' && chronoInt) {
      clearInterval(chronoInt);
      chronoInt = null;
    }
  } catch (_) {}

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
    .load-select.ga-load-choice-v125{appearance:menulist!important;-webkit-appearance:menulist!important;width:96px!important;min-width:96px!important;padding:5px 4px!important;border-color:rgba(255,255,255,.16)!important;background-color:rgba(255,255,255,.08)!important;color:inherit!important;cursor:pointer!important}.load-select.ga-load-choice-v125:focus{border-color:var(--accent,#55b9e6)!important}.load-select.ga-load-choice-v125.ga-load-missing-v125{border-color:rgba(240,196,77,.48)!important;color:var(--gold,#efc45a)!important}
    .set-row.ga-accessory-no-rpe-v114 .cloud-athlete-rpe,.set-row.ga-accessory-no-rpe-v114 .rpe-select,.set-row.ga-accessory-no-rpe-v114 .rpe-input,.set-row.ga-accessory-no-rpe-v114 .set-rpe,.set-row.ga-accessory-no-rpe-v114 [data-rpe],.set-row.ga-accessory-no-rpe-v114 [data-rpe-value],.set-row.ga-accessory-no-rpe-v114 [aria-label*="rpe" i],.set-row.ga-accessory-no-rpe-v114 [title*="rpe" i]{display:none!important}
    .set-row{flex-wrap:wrap}.cloud-load-interval{display:none!important}.set-row.ga-sbd-clean-v28>.cloud-athlete-load,.set-row.ga-sbd-clean-v28>.cloud-athlete-rpe,.set-row.ga-sbd-clean-v28>.load-preset-v22{display:none!important}
    .cloud-feed-switch{display:grid;grid-template-columns:1fr 1fr;gap:5px;padding:4px;margin-bottom:10px;border:1px solid rgba(255,255,255,.05);border-radius:12px;background:rgba(255,255,255,.025)}.cloud-feed-switch button{border:0;border-radius:9px;padding:9px;background:transparent;color:var(--text-muted,#667696);font-weight:900;font-size:10px;cursor:pointer}.cloud-feed-switch button.active{background:var(--surface-2,#1c2438);color:var(--accent,#f0c44d)}.cloud-athlete-feed-view.hidden{display:none}
    .day-tab.cloud-day-complete{background:rgba(45,198,83,.16)!important;border-color:rgba(45,198,83,.38)!important;color:#65e781!important}.cloud-day-duration{display:block;margin-top:3px;font-size:7px;line-height:1;color:var(--text-muted,#667696);font-weight:800;white-space:nowrap}.day-tab.cloud-day-complete .cloud-day-duration{color:#65e781}.cloud-fallback-rest{display:none;position:fixed;inset:0;z-index:8000;background:rgba(4,7,13,.96);align-items:center;justify-content:center;padding:20px}.cloud-fallback-rest.visible{display:flex}.cloud-fallback-rest-card{width:min(100%,360px);padding:25px;border-radius:22px;text-align:center;background:#101725;border:1px solid rgba(255,255,255,.09);box-shadow:0 30px 70px rgba(0,0,0,.55)}.cloud-fallback-rest-card h2{margin:0 0 8px;font-size:14px}.cloud-fallback-time{font-size:48px;font-weight:950;color:var(--accent,#f0c44d);font-variant-numeric:tabular-nums}.cloud-fallback-actions{display:flex;justify-content:center;gap:8px;margin-top:14px}.cloud-fallback-actions button{border:0;border-radius:10px;padding:10px 13px;background:var(--surface-2,#1c2438);color:inherit;font-weight:850}.cloud-fallback-actions .primary{background:var(--accent,#f0c44d);color:#111722}
    @media (max-width:370px){.cloud-athlete-rpe,.cloud-athlete-load{width:50px;flex-basis:50px!important;font-size:10px}.set-row{gap:5px!important}}
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

  function normalizeLoadValue(value) {
    const parsed = parseNumber(value);
    return parsed !== null && parsed >= 0 ? parsed : null;
  }

  function normalizeRpeValue(value) {
    const parsed = parseNumber(value);
    if (parsed === null || parsed < 1 || parsed > 10) return null;
    const doubled = parsed * 2;
    if (Math.abs(doubled - Math.round(doubled)) > 0.000001) return null;
    return Math.round(doubled) / 2;
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
      ? `Journée terminée en ${formatSessionDuration(timing.seconds)}`
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
    const input = row?.querySelector('.load-select,.load-input,.set-load');
    const onchange = input?.getAttribute('onchange') || '';
    const match = onchange.match(/(?:sL|setLd)\(\s*['"]([^'"]+)['"]/i);
    if (match) return match[1];
    const setKey = extractBooleanSetKey(row);
    return setKey ? `${setKey}_ld` : null;
  }

  function extractBooleanRpeKey(row) {
    const input = row?.querySelector('.rpe-select,.rpe-input,.set-rpe');
    const onchange = input?.getAttribute('onchange') || '';
    const match = onchange.match(/(?:sRPE|setRPE|setRpe)\(\s*['"]([^'"]+)['"]/i);
    if (match) return match[1];
    const setKey = extractBooleanSetKey(row);
    return setKey ? `${setKey}_rpe` : null;
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
    if (value === null || value === undefined) return;
    const stringValue = String(value);
    try {
      if (cfg.adapter === 'state' && typeof state !== 'undefined') {
        if (!state.loads) state.loads = {};
        if (stringValue === '') delete state.loads[valueKey(w, d, idx)];
        else state.loads[valueKey(w, d, idx)] = stringValue;
      } else if (cfg.adapter === 'boolean' && typeof loads !== 'undefined') {
        const key = extractBooleanLoadKey(row);
        if (key) {
          if (stringValue === '') delete loads[key];
          else loads[key] = stringValue;
        }
      } else if (cfg.adapter === 'legacy' && typeof S !== 'undefined') {
        if (!S.loads) S.loads = {};
        if (stringValue === '') delete S.loads[valueKey(w, d, idx)];
        else S.loads[valueKey(w, d, idx)] = stringValue;
      }
    } catch (error) {
      console.error(error);
    }
  }

  function setOriginalRpe(w, d, idx, value, row) {
    if (value === null || value === undefined) return;
    const stringValue = String(value);
    try {
      if (cfg.adapter === 'state' && typeof state !== 'undefined') {
        if (!state.rpes) state.rpes = {};
        if (stringValue === '') delete state.rpes[valueKey(w, d, idx)];
        else state.rpes[valueKey(w, d, idx)] = stringValue;
      } else if (cfg.adapter === 'boolean' && typeof rpes !== 'undefined') {
        const key = extractBooleanRpeKey(row);
        if (key) {
          if (stringValue === '') delete rpes[key];
          else rpes[key] = stringValue;
        }
      } else if (cfg.adapter === 'legacy' && typeof S !== 'undefined') {
        if (!S.rpes) S.rpes = {};
        if (stringValue === '') delete S.rpes[valueKey(w, d, idx)];
        else S.rpes[valueKey(w, d, idx)] = stringValue;
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
    const text = String(clone.textContent || '').trim();

    // Ne transforme jamais une intensité (71 %) ou une plage de répétitions
    // (10-12) en charge réalisée. Une valeur n'est reprise que si "kg" est écrit.
    const kgMatch = text.match(/\b(\d+(?:[.,]\d+)?)\s*kg\b/i);
    return kgMatch ? kgMatch[1] : '';
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

  function detectRowCode(row) {
    const block = row?.closest('.exercise-block');
    const badge = block?.querySelector('.exercise-badge');
    const badgeClass = badge?.className || '';
    const text = `${badge?.textContent || ''} ${block?.querySelector('.exercise-name')?.textContent || ''}`.toLowerCase();
    if (/badge-sq/.test(badgeClass) || /\bsquat\b|\bsq\b/.test(text)) return 'sq';
    if (/badge-bn/.test(badgeClass) || /\bbench\b|\bbn\b/.test(text)) return 'bn';
    if (/badge-dl/.test(badgeClass) || /\bdeadlift\b|\bsoulev[ée]\b|\bdl\b/.test(text)) return 'dl';
    return 'ac';
  }

  function firstMatchingControl(row, selectors) {
    for (const selector of selectors) {
      const control = row?.querySelector(selector);
      if (control) return control;
    }
    return null;
  }

  function nativeLoadInput(row) {
    return firstMatchingControl(row, [
      '.accessory-track-v22 [data-cloud-load]',
      '.accessory-track-v22 .cloud-athlete-load',
      '.accessory-track-v22 .load-input',
      '.accessory-track-v22 .set-load',
      '.cloud-athlete-load',
      '.load-select',
      '.load-input',
      '.set-load',
      'input[data-load]',
      'input[data-load-kg]',
      'input[data-real-load]',
      'input[name*="load" i]',
      'input[name*="charge" i]',
      'input[aria-label*="charge" i]'
    ]);
  }

  function nativeRpeInput(row) {
    return firstMatchingControl(row, [
      '.accessory-track-v22 .cloud-athlete-rpe',
      '.cloud-athlete-rpe',
      '.rpe-select',
      '.rpe-input',
      '.set-rpe',
      'input[data-rpe]',
      'select[data-rpe]',
      'input[name*="rpe" i]',
      'select[name*="rpe" i]',
      'input[aria-label*="rpe" i]',
      'select[aria-label*="rpe" i]'
    ]);
  }

  function nativeLoadControl(row) {
    return nativeLoadInput(row) || firstMatchingControl(row, [
      '.load-value',
      '.load-display',
      '.set-load-value',
      '.set-load-display',
      '.charge-value',
      '.charge-display',
      '[data-load-value]',
      '[data-load-kg]',
      '[aria-label*="charge" i]',
      '[title*="charge" i]'
    ]);
  }

  function nativeRpeControl(row) {
    return nativeRpeInput(row) || firstMatchingControl(row, [
      '.rpe-value',
      '.rpe-display',
      '.set-rpe-value',
      '.set-rpe-display',
      '[data-rpe-value]',
      '[data-rpe]',
      '[aria-label*="rpe" i]',
      '[title*="rpe" i]'
    ]);
  }

  const ACCESSORY_RPE_SELECTORS_V114 = [
    '.cloud-athlete-rpe',
    '.rpe-select',
    '.rpe-input',
    '.set-rpe',
    '[data-rpe]',
    '[data-rpe-value]',
    'input[name*="rpe" i]',
    'select[name*="rpe" i]',
    '[aria-label*="rpe" i]',
    '[title*="rpe" i]'
  ].join(',');

  function stripAccessoryRpeV114(row, idx, w, d) {
    if (!row) return;
    row.classList.add('ga-accessory-no-rpe-v114');
    row.querySelectorAll(ACCESSORY_RPE_SELECTORS_V114).forEach(control => {
      try {
        if (/^(?:INPUT|SELECT|TEXTAREA)$/i.test(String(control.tagName || ''))) {
          control.value = '';
          control.disabled = true;
        }
        control.removeAttribute?.('data-rpe');
        control.removeAttribute?.('data-rpe-value');
        control.setAttribute?.('aria-hidden', 'true');
        control.tabIndex = -1;
        if (control.dataset?.gaInjectedControl === '1' || control.classList?.contains('cloud-athlete-rpe')) {
          control.remove();
        } else {
          control.hidden = true;
          control.style.display = 'none';
        }
      } catch (_) {}
    });
    const key = valueKey(w, d, idx);
    const previous = inputCache[key] || {};
    inputCache[key] = { ...previous, rpe: '' };
    setOriginalRpe(w, d, idx, '', row);
  }

  function controlNumber(control, kind = '') {
    if (!control) return null;
    const isFormControl = /^(?:INPUT|SELECT|TEXTAREA)$/i.test(String(control.tagName || ''));
    const candidates = [
      control.value,
      control.dataset?.value,
      kind === 'load' ? control.dataset?.loadKg : null,
      kind === 'load' ? control.dataset?.load : null,
      kind === 'rpe' ? control.dataset?.rpe : null,
      control.getAttribute?.('data-value')
    ];

    // Un <select> vide contient quand même tous ses libellés dans textContent
    // ("RPE 6 6.5 7..."). Il ne faut jamais lire ce texte comme une valeur.
    if (!isFormControl) candidates.push(control.textContent);

    for (const candidate of candidates) {
      const text = String(candidate ?? '').trim();
      if (!text || /^(?:—|-|RPE|KG)$/i.test(text)) continue;
      const exact = text.match(/^-?\d+(?:[.,]\d+)?$/);
      const embedded = isFormControl ? null : text.match(/-?\d+(?:[.,]\d+)?/);
      const parsed = parseNumber(exact?.[0] || embedded?.[0]);
      if (parsed === null) continue;
      if (kind === 'rpe') return normalizeRpeValue(parsed);
      if (kind === 'load') return normalizeLoadValue(parsed);
      return parsed;
    }
    return null;
  }

  function writeControlValue(control, value, kind = '') {
    if (!control || value === null || value === undefined || value === '') return;
    const normalized = kind === 'rpe' ? normalizeRpeValue(value) : normalizeLoadValue(value);
    if (normalized === null) return;
    const text = String(normalized);
    const isFormControl = /^(?:INPUT|SELECT|TEXTAREA)$/i.test(String(control.tagName || ''));

    if (isFormControl) {
      if (String(control.value ?? '').trim() !== text) control.value = text;
      control.classList?.toggle('filled', true);
    } else {
      control.dataset.value = text;
      if (kind === 'load') {
        control.dataset.load = text;
        control.dataset.loadKg = text;
      }
      if (kind === 'rpe') control.dataset.rpe = text;

      const target = control.querySelector?.('[data-value],.value,.load-value,.charge-value,.rpe-value') || control;
      if (!target.children?.length) {
        const current = String(target.textContent || '').trim();
        if (!current || /^(?:—|-|kg|rpe|0)$/i.test(current) || /^-?\d+(?:[.,]\d+)?(?:\s*kg)?$/i.test(current)) {
          target.textContent = text.replace('.', ',');
        }
      }
    }
  }

  function removeLegacyDuplicateControls(row, code) {
    row.querySelectorAll('.cloud-load-interval').forEach(node => node.remove());
    const isSbd = ['sq', 'bn', 'dl'].includes(code);
    row.classList.toggle('ga-sbd-clean-v28', isSbd);
    if (!isSbd) return;

    // Ces contrôles ont été ajoutés par d'anciennes versions d'app.js.
    // Les commandes natives de la programmation restent intactes.
    [...row.children].forEach(node => {
      if (
        node.classList?.contains('cloud-athlete-load') ||
        node.classList?.contains('cloud-athlete-rpe') ||
        node.classList?.contains('load-preset-v22')
      ) node.remove();
    });
  }

  function improveLoadChoiceV125(row, idx, w, d) {
    const select = row?.querySelector('.load-select');
    if (!select) return;

    select.classList.add('ga-load-choice-v125');
    select.setAttribute('aria-label', 'Choisir la charge réalisée');
    select.title = 'Clique ici pour choisir la charge. Le crayon sert uniquement à saisir une charge libre.';

    const rangeText = String(row.querySelector('.load-range')?.textContent || '').replace(/\s+/g, ' ').trim();
    const range = rangeText.match(/(\d+(?:[.,]\d+)?)\s*(?:-|–|—|à)\s*(\d+(?:[.,]\d+)?)/i);
    const fixed = !range ? rangeText.match(/(\d+(?:[.,]\d+)?)\s*kg/i) : null;
    const min = range ? normalizeLoadValue(range[1]) : normalizeLoadValue(fixed?.[1]);
    const max = range ? normalizeLoadValue(range[2]) : min;

    const emptyOption = [...select.options].find(option => option.value === '');
    if (emptyOption) {
      if (min !== null && max !== null) {
        emptyOption.textContent = min === max
          ? `${String(min).replace('.', ',')} kg ▾`
          : `${String(min).replace('.', ',')}–${String(max).replace('.', ',')} kg ▾`;
      } else {
        emptyOption.textContent = 'Charge kg ▾';
      }
    }

    // Une charge fixe peut être présélectionnée sans inventer une performance.
    // Pour une plage, l'athlète choisit lui-même la charge réellement utilisée.
    if (!String(select.value || '').trim() && min !== null && max !== null && min === max) {
      const exactOption = [...select.options].find(option => normalizeLoadValue(option.value) === min);
      if (exactOption) {
        select.value = exactOption.value;
        setOriginalLoad(w, d, idx, min, row);
        const key = valueKey(w, d, idx);
        inputCache[key] = { ...(inputCache[key] || {}), load: min, dirty: true, updatedAt: Date.now() };
        writeCache();
        persistOriginal();
      }
    }

    select.classList.toggle('ga-load-missing-v125', !String(select.value || '').trim());
  }

  function ensureInputs(row, idx, w, d) {
    row.dataset.cloudSetIndex = String(idx);
    const box = checkboxFor(row);
    if (!box) return;
    box.dataset.cloudCheckbox = '1';

    const code = detectRowCode(row);
    const isAccessoryRow = code === 'ac';
    removeLegacyDuplicateControls(row, code);

    let loadInput = nativeLoadInput(row);
    let rpeInput = nativeRpeInput(row);
    improveLoadChoiceV125(row, idx, w, d);

    // Les accessoires gardent uniquement la charge : aucun champ RPE,
    // aucune exigence RPE et aucune ancienne valeur RPE réinjectée.
    if (isAccessoryRow) {
      stripAccessoryRpeV114(row, idx, w, d);
      rpeInput = null;
    } else {
      row.classList.remove('ga-accessory-no-rpe-v114');
    }

    // Les champs supplémentaires ne sont créés que pour la charge des accessoires.
    // Sur squat / bench / deadlift, on garde exclusivement les contrôles natifs.
    if (isAccessoryRow && !loadInput) {
      loadInput = document.createElement('input');
      loadInput.type = 'number';
      loadInput.inputMode = 'decimal';
      loadInput.step = '0.5';
      loadInput.min = '0';
      loadInput.className = 'cloud-athlete-load';
      loadInput.dataset.gaInjectedControl = '1';
      loadInput.placeholder = inferPrescribedLoad(row) || 'kg';
      loadInput.setAttribute('aria-label', 'Charge réalisée en kilogrammes');
      box.before(loadInput);
    }
    if (loadInput) loadInput.dataset.cloudLoad = '1';

    const key = valueKey(w, d, idx);
    const cached = inputCache[key] || {};
    const cachedLoad = normalizeLoadValue(cached.load);
    const cachedRpe = isAccessoryRow ? null : normalizeRpeValue(cached.rpe);
    const loadControl = nativeLoadControl(row);
    const rpeControl = isAccessoryRow ? null : nativeRpeControl(row);

    if (cachedLoad !== null) {
      setOriginalLoad(w, d, idx, cachedLoad, row);
      writeControlValue(loadInput || loadControl, cachedLoad, 'load');
    }
    if (cachedRpe !== null) {
      setOriginalRpe(w, d, idx, cachedRpe, row);
      writeControlValue(rpeInput || rpeControl, cachedRpe, 'rpe');
    }
    improveLoadChoiceV125(row, idx, w, d);
  }

  function rowMeta(row, idx, w, d) {
    const block = row.closest('.exercise-block');
    const badge = block?.querySelector('.exercise-badge');
    const code = detectRowCode(row);

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

    const loadInput = nativeLoadInput(row);
    const isAccessoryRow = code === 'ac';
    const rpeInput = isAccessoryRow ? null : nativeRpeInput(row);
    const loadControl = nativeLoadControl(row);
    const rpeControl = isAccessoryRow ? null : nativeRpeControl(row);

    return {
      w, d, idx, code, exerciseName, variantName, reps, weekLabel, dayName,
      load: controlNumber(loadControl, 'load'),
      rpe: isAccessoryRow ? null : controlNumber(rpeControl, 'rpe'),
      intervalMin: null,
      intervalMax: null,
      loadInput,
      rpeInput,
      loadControl,
      rpeControl,
      intervalMinInput: null,
      intervalMaxInput: null
    };
  }

  function cacheInputs(meta, options = {}) {
    const key = valueKey(meta.w, meta.d, meta.idx);
    const previous = inputCache[key] || {};
    const isAccessoryRow = meta.code === 'ac';
    const readLoad = normalizeLoadValue(meta.loadInput?.value ?? meta.load);
    const readRpe = isAccessoryRow ? null : normalizeRpeValue(meta.rpeInput?.value ?? meta.rpe);
    const previousLoad = normalizeLoadValue(previous.load);
    const previousRpe = isAccessoryRow ? null : normalizeRpeValue(previous.rpe);

    // V111 : un champ momentanément vide après render() n'est jamais interprété
    // comme une demande d'effacement. La dernière charge connue reste la source
    // de vérité locale jusqu'à ce qu'une nouvelle valeur numérique la remplace.
    const cachedLoad = readLoad !== null
      ? readLoad
      : (options.allowLoadClear ? '' : (previousLoad ?? previous.load ?? ''));
    const cachedRpe = isAccessoryRow
      ? ''
      : (readRpe !== null
          ? readRpe
          : (options.allowRpeClear ? '' : (previousRpe ?? previous.rpe ?? '')));

    inputCache[key] = {
      load: cachedLoad,
      rpe: cachedRpe,
      // V123 : les bornes numériques restent nulles quand elles sont vides.
      intervalMin: normalizeLoadValue(meta.intervalMin) ?? normalizeLoadValue(previous.intervalMin),
      intervalMax: normalizeLoadValue(meta.intervalMax) ?? normalizeLoadValue(previous.intervalMax),
      completed: Object.prototype.hasOwnProperty.call(previous, 'completed') ? !!previous.completed : undefined,
      completionDirty: !!previous.completionDirty,
      updatedAt: Date.now(),
      dirty: options.dirty !== false || !!previous.dirty
    };
    if (previous.updatedAt && options.keepTimestamp) inputCache[key].updatedAt = previous.updatedAt;
    writeCache();
  }

  function rememberLocalCompletion(meta, completed) {
    const key = valueKey(meta.w, meta.d, meta.idx);
    const previous = inputCache[key] || {};
    inputCache[key] = {
      ...previous,
      completed: !!completed,
      completionDirty: true,
      dirty: true,
      updatedAt: Date.now()
    };
    writeCache();
  }

  function markCacheSynced(meta, completed) {
    const key = valueKey(meta.w, meta.d, meta.idx);
    if (!inputCache[key]) return;
    inputCache[key].dirty = false;
    inputCache[key].completed = !!completed;
    inputCache[key].completionDirty = false;
    inputCache[key].updatedAt = Date.now();
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
        const cached = inputCache[key] || {};
        const remoteUpdatedAt = Date.parse(remote.updated_at || '') || 0;
        const localUpdatedAt = Number(cached.updatedAt) || 0;
        const pendingCompletion = !!cached.completionDirty;
        const preferLocal = pendingCompletion || (!!cached.dirty && localUpdatedAt >= remoteUpdatedAt);
        const localLoad = normalizeLoadValue(cached.load);
        const localRpe = normalizeRpeValue(cached.rpe);
        const remoteLoad = normalizeLoadValue(remote.load_kg);
        const remoteRpe = normalizeRpeValue(remote.rpe);
        const code = detectRowCode(row);
        const usableRemoteLoad = remoteLoad !== null && (!['sq', 'bn', 'dl'].includes(code) || remoteLoad > 0);

        // V111 : une valeur cloud nulle/0 issue d'un ancien render ne peut plus
        // écraser une charge locale valide. Une vraie nouvelle charge non nulle
        // venant du serveur reste toutefois prioritaire quand elle est plus récente.
        const mergedLoad = preferLocal
          ? (localLoad ?? remoteLoad)
          : (usableRemoteLoad ? remoteLoad : localLoad);
        const mergedRpe = code === 'ac'
          ? null
          : (preferLocal
              ? (localRpe ?? remoteRpe)
              : (remoteRpe ?? localRpe));
        const mergedCompleted = pendingCompletion ? !!cached.completed : !!remote.completed;
        inputCache[key] = {
          load: mergedLoad,
          rpe: mergedRpe,
          intervalMin: normalizeLoadValue(remote.prescribed_load_min_kg) ?? normalizeLoadValue(cached.intervalMin),
          intervalMax: normalizeLoadValue(remote.prescribed_load_max_kg) ?? normalizeLoadValue(cached.intervalMax),
          completed: mergedCompleted,
          completionDirty: pendingCompletion,
          updatedAt: preferLocal ? localUpdatedAt : (remoteUpdatedAt || localUpdatedAt),
          dirty: preferLocal
        };
        setOriginalLoad(w, d, idx, mergedLoad, row);
        if (code === 'ac') {
          setOriginalRpe(w, d, idx, '', row);
          stripAccessoryRpeV114(row, idx, w, d);
        } else {
          setOriginalRpe(w, d, idx, mergedRpe, row);
        }
        if (originalCompleted(w, d, idx, row) !== mergedCompleted) {
          if (setOriginalCompleted(w, d, idx, mergedCompleted, row)) needsRender = true;
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

      currentRows.forEach((row, idx) => {
        const cached = inputCache[valueKey(w, d, idx)];
        if (!cached?.dirty) return;
        const meta = rowMeta(row, idx, w, d);
        scheduleSetValueSync(meta, originalCompleted(w, d, idx, row), 0);
      });
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

  function strictSmallInt(value, fallback = 0, minimum = 0) {
    const parsed = Number.parseInt(String(value ?? '').trim(), 10);
    return Number.isFinite(parsed) ? Math.max(minimum, parsed) : Math.max(minimum, fallback);
  }

  function safeRequiredText(value, fallback) {
    const text = String(value ?? '').trim();
    return text || String(fallback ?? '').trim() || '—';
  }

  function buildWorkoutSetPayload(meta, completed, now) {
    const payload = {
      athlete_slug: safeRequiredText(cfg.slug, 'athlete'),
      athlete_name: safeRequiredText(cfg.name, cfg.slug),
      program_key: safeRequiredText(cfg.programKey, 'programme'),
      week_index: strictSmallInt(meta.w, 0, 0),
      day_index: strictSmallInt(meta.d, 0, 0),
      set_index: strictSmallInt(meta.idx, 0, 0),
      exercise_code: safeRequiredText(meta.code, 'ac'),
      exercise_name: safeRequiredText(meta.exerciseName, 'Exercice'),
      reps: strictSmallInt(meta.reps, 1, 1),
      load_kg: normalizeLoadValue(meta.load),
      completed: !!completed,
      completed_by: CoachingCloud.session.user.id,
      completed_at: completed ? now : null
    };
    const safeRpe = meta.code === 'ac' ? null : normalizeRpeValue(meta.rpe);
    if (safeRpe !== null) payload.rpe = safeRpe;
    const min = normalizeLoadValue(meta.intervalMin);
    const max = normalizeLoadValue(meta.intervalMax);
    if (min !== null) payload.prescribed_load_min_kg = min;
    if (max !== null) payload.prescribed_load_max_kg = max;
    return payload;
  }

  async function persistWorkoutSetPayload(payload) {
    const client = CoachingCloud.client;
    const updatePayload = {
      completed: !!payload.completed,
      completed_by: payload.completed_by,
      completed_at: payload.completed_at
    };
    if (payload.load_kg !== null) updatePayload.load_kg = payload.load_kg;
    if (Object.prototype.hasOwnProperty.call(payload, 'rpe')) updatePayload.rpe = payload.rpe;

    // V123 : une ligne existe généralement déjà. La mise à jour minimale évite
    // que n'importe quelle ancienne chaîne vide d'un champ secondaire rebloque
    // la validation de la coche.
    let result = await client.from('workout_sets')
      .update(updatePayload)
      .eq('athlete_slug', payload.athlete_slug)
      .eq('program_key', payload.program_key)
      .eq('week_index', payload.week_index)
      .eq('day_index', payload.day_index)
      .eq('set_index', payload.set_index)
      .select('set_index');

    if (!result.error && Array.isArray(result.data) && result.data.length > 0) return result;

    // Ligne absente : insertion/upsert avec uniquement des nombres réels ou null.
    const cleanPayload = Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== '' && value !== undefined)
    );
    result = await client.from('workout_sets').upsert(cleanPayload, {
      onConflict: 'athlete_slug,program_key,week_index,day_index,set_index'
    });

    if (result.error && /invalid input syntax for type numeric/i.test(result.error.message || '')) {
      // Dernier filet : aucune borne prescrite et aucun RPE facultatif.
      const minimalPayload = {
        athlete_slug: cleanPayload.athlete_slug,
        athlete_name: cleanPayload.athlete_name,
        program_key: cleanPayload.program_key,
        week_index: strictSmallInt(cleanPayload.week_index, 0, 0),
        day_index: strictSmallInt(cleanPayload.day_index, 0, 0),
        set_index: strictSmallInt(cleanPayload.set_index, 0, 0),
        exercise_code: cleanPayload.exercise_code,
        exercise_name: cleanPayload.exercise_name,
        reps: strictSmallInt(cleanPayload.reps, 1, 1),
        load_kg: normalizeLoadValue(cleanPayload.load_kg),
        completed: !!cleanPayload.completed,
        completed_by: cleanPayload.completed_by,
        completed_at: cleanPayload.completed_at
      };
      result = await client.from('workout_sets').upsert(minimalPayload, {
        onConflict: 'athlete_slug,program_key,week_index,day_index,set_index'
      });
    }
    return result;
  }

  async function syncSetNow(meta, completed, options = {}) {
    if (!cloudReady) return;
    const durable = inputCache[valueKey(meta.w, meta.d, meta.idx)] || {};
    meta = {
      ...meta,
      load: normalizeLoadValue(meta.load) ?? normalizeLoadValue(durable.load),
      rpe: meta.code === 'ac' ? null : (normalizeRpeValue(meta.rpe) ?? normalizeRpeValue(durable.rpe))
    };
    if (!CoachingCloud.canEditAthlete(cfg.slug)) {
      CoachingCloud.toast(`Ce compte ne peut pas modifier la programmation de ${cfg.name}.`, true);
      await loadCloudState();
      return;
    }

    cacheInputs(meta);
    const now = new Date().toISOString();
    const payload = buildWorkoutSetPayload(meta, completed, now);
    let result = await persistWorkoutSetPayload(payload);

    // Sécurité supplémentaire : une ancienne valeur locale hors barème ne doit
    // jamais bloquer la charge, la validation ou les autres données de la série.
    if (result.error && /workout_sets_rpe_check/i.test(result.error.message || '')) {
      console.warn('RPE rejeté par Supabase, nouvelle tentative avec RPE nul.', payload.rpe);
      payload.rpe = null;
      meta.rpe = null;
      result = await CoachingCloud.client.from('workout_sets').upsert(payload, {
        onConflict: 'athlete_slug,program_key,week_index,day_index,set_index'
      });
    }

    if (result.error) {
      console.error(result.error);

      // Une ancienne contrainte Supabase peut encore refuser les RPE vides.
      // Dans ce cas, on garde impérativement la saisie locale et on évite de
      // recharger le cloud, car ce rechargement effacerait la charge/RPE saisis.
      if (/workout_sets_rpe_check/i.test(result.error.message || '')) {
        cacheInputs(meta, { dirty: true, keepTimestamp: true });
        rememberLocalCompletion(meta, completed);
        const toastNow = Date.now();
        if (!window.__gaRpeSchemaToastAt || toastNow - window.__gaRpeSchemaToastAt > 5000) {
          window.__gaRpeSchemaToastAt = toastNow;
          CoachingCloud.toast('Supabase bloque encore une ancienne valeur RPE. La série reste conservée localement.', true);
        }
        return;
      }

      cacheInputs(meta, { dirty: true, keepTimestamp: true });
      rememberLocalCompletion(meta, completed);
      const localRow = rows()[meta.idx];
      if (localRow) {
        setOriginalLoad(meta.w, meta.d, meta.idx, meta.load, localRow);
        if (meta.code === 'ac') setOriginalRpe(meta.w, meta.d, meta.idx, '', localRow);
        else setOriginalRpe(meta.w, meta.d, meta.idx, meta.rpe, localRow);
        setOriginalCompleted(meta.w, meta.d, meta.idx, !!completed, localRow);
        persistOriginal();
      }
      CoachingCloud.toast(`Série validée localement. Synchronisation cloud à réessayer : ${result.error.message}`, true);
      return;
    }

    markCacheSynced(meta, completed);

    const setKey = activitySetKey(meta.w, meta.d, meta.idx);
    const publishActivity = completed
      && meta.load !== null
      && (meta.code === 'ac' || meta.rpe !== null);
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
        rpe: meta.code === 'ac' ? null : meta.rpe,
        prescribed_load_min_kg: normalizeLoadValue(meta.intervalMin),
        prescribed_load_max_kg: normalizeLoadValue(meta.intervalMax),
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
    remoteRows.set(remoteKey(meta.w, meta.d, meta.idx), {
      ...payload,
      updated_at: now
    });
    scheduleReconcile();
    setTimeout(loadCloudState, 450);
  }

  // V111 : toutes les écritures d'une même série sont sérialisées. Une ancienne
  // requête ne peut plus arriver après la nouvelle et remettre une charge obsolète.
  const setSyncChains = new Map();
  function syncSet(meta, completed, options = {}) {
    const key = remoteKey(meta.w, meta.d, meta.idx);
    const previous = setSyncChains.get(key) || Promise.resolve();
    const next = previous
      .catch(() => {})
      .then(() => syncSetNow({ ...meta }, completed, { ...options }));
    const tracked = next.finally(() => {
      if (setSyncChains.get(key) === tracked) setSyncChains.delete(key);
    });
    setSyncChains.set(key, tracked);
    return tracked;
  }

  const valueSyncTimers = new Map();

  function persistSetValues(meta, row, options = {}) {
    cacheInputs(meta, options);
    const stored = inputCache[valueKey(meta.w, meta.d, meta.idx)] || {};
    const durableLoad = normalizeLoadValue(meta.load) ?? normalizeLoadValue(stored.load);
    const durableRpe = meta.code === 'ac' ? null : (normalizeRpeValue(meta.rpe) ?? normalizeRpeValue(stored.rpe));
    setOriginalLoad(meta.w, meta.d, meta.idx, durableLoad, row);
    if (meta.code === 'ac') {
      setOriginalRpe(meta.w, meta.d, meta.idx, '', row);
      stripAccessoryRpeV114(row, meta.idx, meta.w, meta.d);
    } else {
      setOriginalRpe(meta.w, meta.d, meta.idx, durableRpe, row);
      writeControlValue(nativeRpeControl(row), durableRpe, 'rpe');
    }
    writeControlValue(nativeLoadControl(row), durableLoad, 'load');
    persistOriginal();
  }

  function scheduleSetValueSync(meta, completed, delay = 0) {
    const key = remoteKey(meta.w, meta.d, meta.idx);
    clearTimeout(valueSyncTimers.get(key));
    valueSyncTimers.set(key, setTimeout(() => {
      valueSyncTimers.delete(key);
      if (!cloudReady) return;
      syncSet(meta, completed, { checkPr: false, awardXp: false });
    }, Math.max(0, delay)));
  }

  // V119 : construit un instantané durable de la série. La valeur visible,
  // puis le cache local, sont prioritaires sur une valeur momentanément vide
  // provoquée par le render() natif de la page.
  function durableSetMeta(meta, row = null) {
    const stored = inputCache[valueKey(meta.w, meta.d, meta.idx)] || {};
    const visible = row ? rowMeta(row, meta.idx, meta.w, meta.d) : meta;
    const load = normalizeLoadValue(visible.load)
      ?? normalizeLoadValue(meta.load)
      ?? normalizeLoadValue(stored.load);
    const rpe = meta.code === 'ac'
      ? null
      : (normalizeRpeValue(visible.rpe)
        ?? normalizeRpeValue(meta.rpe)
        ?? normalizeRpeValue(stored.rpe));
    return {
      ...meta,
      ...visible,
      load,
      rpe,
      intervalMin: normalizeLoadValue(visible.intervalMin)
        ?? normalizeLoadValue(meta.intervalMin)
        ?? normalizeLoadValue(stored.intervalMin),
      intervalMax: normalizeLoadValue(visible.intervalMax)
        ?? normalizeLoadValue(meta.intervalMax)
        ?? normalizeLoadValue(stored.intervalMax)
    };
  }

  function bindInteractions() {
    // Sauvegarde dès l'appui sur la coche. Le click natif peut provoquer un
    // render() immédiat ; pointerdown garantit que la charge saisie est déjà
    // copiée dans loads/state/S avant la destruction du champ courant.
    document.addEventListener('pointerdown', event => {
      const checkbox = event.target.closest('[data-cloud-checkbox],.set-check,.check-btn');
      const row = checkbox?.closest('.set-row');
      if (!checkbox || !row || !exerciseContainer()?.contains(row)) return;
      const idx = Number(row.dataset.cloudSetIndex);
      if (!Number.isInteger(idx)) return;
      const { w, d } = currentIndices();
      const meta = rowMeta(row, idx, w, d);
      persistSetValues(meta, row);
    }, true);

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

      // V125 : un seul moteur de validation pour squat, bench, deadlift et
      // accessoires. On bloque le onclick automatique puis on l'exécute nous-mêmes
      // une seule fois. Cela évite qu'un second gestionnaire annule la coche selon
      // la catégorie de l'exercice et garantit le lancement immédiat du repos.
      event.preventDefault();
      event.stopImmediatePropagation();

      persistSetValues(meta, row, { dirty: true });
      const preClickMeta = durableSetMeta(meta, row);
      const nextCompleted = !wasCompleted;

      if (nextCompleted && ['sq', 'bn', 'dl'].includes(preClickMeta.code) && preClickMeta.load === null) {
        const loadSelect = row.querySelector('.load-select');
        if (loadSelect) {
          loadSelect.classList.add('ga-load-missing-v125');
          loadSelect.focus();
          CoachingCloud.toast('Choisis directement la charge dans le champ gris. Le crayon sert seulement à saisir une charge libre.', true);
          return;
        }
      }
      const booleanKey = extractBooleanSetKey(row);
      const visibleSetNumber = Math.max(1, Number(row.querySelector('.set-num')?.textContent) || (idx + 1));
      const loadForTimer = preClickMeta.load === null ? '' : String(preClickMeta.load);
      let nativeToggleRan = false;

      if (cfg.adapter === 'boolean' && booleanKey && typeof window.tog === 'function') {
        try {
          window.tog(
            booleanKey,
            preClickMeta.exerciseName,
            visibleSetNumber,
            preClickMeta.reps,
            loadForTimer
          );
          nativeToggleRan = true;
        } catch (error) {
          console.warn('Validation native indisponible, repli local V125 :', error);
        }
      }

      if (!nativeToggleRan) {
        setOriginalLoad(w, d, idx, preClickMeta.load, row);
        if (preClickMeta.code === 'ac') setOriginalRpe(w, d, idx, '', row);
        else setOriginalRpe(w, d, idx, preClickMeta.rpe, row);
        setOriginalCompleted(w, d, idx, nextCompleted, row);
        persistOriginal();
        renderOriginal();
      }

      cacheInputs(preClickMeta, { dirty: true });
      rememberLocalCompletion(preClickMeta, nextCompleted);
      persistOriginal();

      if (nextCompleted) {
        rememberDayStart(w, d);
        // Le moteur natif lance normalement le repos. Ce filet démarre le timer
        // de secours seulement si aucun overlay n'est apparu après le rendu.
        ensureRestTimerStarted(idx);
        if (['sq', 'bn', 'dl'].includes(preClickMeta.code) && (preClickMeta.load === null || preClickMeta.rpe === null)) {
          const now = Date.now();
          if (!window.__gaOptionalSetFieldsToastAt || now - window.__gaOptionalSetFieldsToastAt > 5000) {
            window.__gaOptionalSetFieldsToastAt = now;
            CoachingCloud.toast('Série validée. La charge affichée est sauvegardée ; tu peux compléter les champs manquants ensuite.');
          }
        }
      }

      // Confirmation visuelle immédiate après le render() natif, puis synchro cloud.
      setTimeout(() => {
        const currentRow = rows()[idx] || row;
        const finalMeta = durableSetMeta(preClickMeta, currentRow);
        setOriginalLoad(w, d, idx, finalMeta.load, currentRow);
        if (finalMeta.code === 'ac') setOriginalRpe(w, d, idx, '', currentRow);
        else setOriginalRpe(w, d, idx, finalMeta.rpe, currentRow);
        setOriginalCompleted(w, d, idx, nextCompleted, currentRow);
        cacheInputs(finalMeta, { dirty: true });
        rememberLocalCompletion(finalMeta, nextCompleted);
        persistOriginal();

        // Si une autre extension a reconstruit la ligne sans appliquer les classes,
        // on impose également l'état visuel sans attendre une nouvelle synchro.
        const confirmedRow = rows()[idx] || currentRow;
        const confirmedBox = checkboxFor(confirmedRow);
        confirmedRow?.classList.toggle('completed', nextCompleted);
        confirmedRow?.classList.toggle('done', nextCompleted);
        confirmedBox?.classList.toggle('checked', nextCompleted);
        confirmedBox?.setAttribute('aria-checked', nextCompleted ? 'true' : 'false');

        renderDayDurations();
        syncSet(finalMeta, nextCompleted, {
          checkPr: !wasCompleted && nextCompleted,
          awardXp: !wasCompleted && nextCompleted
        });
      }, 90);
    }, true);

    // Les nouvelles pages utilisent parfois un bouton crayon qui ouvre un prompt
    // puis réécrit un simple bloc visuel au lieu d'un <input>. On relit donc la
    // ligne juste après toute action d'édition afin de sauvegarder la valeur réelle.
    document.addEventListener('click', event => {
      const row = event.target.closest('.set-row');
      if (!row || !exerciseContainer()?.contains(row)) return;
      if (event.target.closest('[data-cloud-checkbox],.set-check,.check-btn')) return;
      const action = event.target.closest('button,[role="button"],input,select');
      if (!action) return;
      const idx = Number(row.dataset.cloudSetIndex);
      if (!Number.isInteger(idx)) return;

      [0, 60, 220].forEach(delay => setTimeout(() => {
        const currentRow = rows()[idx];
        if (!currentRow) return;
        const { w, d } = currentIndices();
        const meta = rowMeta(currentRow, idx, w, d);
        persistSetValues(meta, currentRow);
        scheduleSetValueSync(meta, originalCompleted(w, d, idx, currentRow), delay === 220 ? 0 : 80);
      }, delay));
    }, false);

    document.addEventListener('input', event => {
      const input = event.target.closest('[data-cloud-load],.cloud-athlete-rpe,.cloud-athlete-load,.load-select,.load-input,.set-load,.rpe-select,.rpe-input,.set-rpe,.accessory-time-v22');
      const row = input?.closest('.set-row');
      if (!input || !row || !exerciseContainer()?.contains(row)) return;
      const idx = Number(row.dataset.cloudSetIndex);
      if (!Number.isInteger(idx)) return;
      const { w, d } = currentIndices();
      const meta = rowMeta(row, idx, w, d);
      persistSetValues(meta, row);
      scheduleSetValueSync(meta, originalCompleted(w, d, idx, row), 120);
    }, true);

    document.addEventListener('change', event => {
      const input = event.target.closest('[data-cloud-load],.cloud-athlete-rpe,.cloud-athlete-load,.load-select,.load-input,.set-load,.rpe-select,.rpe-input,.set-rpe,.accessory-time-v22');
      const row = input?.closest('.set-row');
      if (!input || !row || !exerciseContainer()?.contains(row)) return;
      const idx = Number(row.dataset.cloudSetIndex);
      if (!Number.isInteger(idx)) return;
      const { w, d } = currentIndices();
      const meta = rowMeta(row, idx, w, d);
      input.classList?.toggle('ga-load-missing-v125', input.classList?.contains('load-select') && !String(input.value || '').trim());
      persistSetValues(meta, row);
      scheduleSetValueSync(meta, originalCompleted(w, d, idx, row), 0);
    }, true);

    document.addEventListener('click', event => {
      if (!event.target.closest('.week-btn,.day-tab')) return;
      setTimeout(renderDayDurations, 20);
      setTimeout(renderCurrentSessionChrono, 120);
    }, true);

    const persistVisibleValues = () => {
      const { w, d } = currentIndices();
      rows().forEach((row, idx) => {
        const meta = rowMeta(row, idx, w, d);
        persistSetValues(meta, row);
      });
      writeCache();
    };
    window.addEventListener('pagehide', persistVisibleValues, { capture: true });
    window.addEventListener('beforeunload', persistVisibleValues, { capture: true });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') persistVisibleValues();
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


/* ============================================================
   V115 — TRACKING DES ACCESSOIRES SANS RPE
   Charge + répétitions prescrites + temps facultatif + records.
   ============================================================ */
(function () {
  'use strict';

  const cfg = window.COACHING_ATHLETE || {};
  if (!cfg.slug || !cfg.programKey || cfg.adapter === 'custom') return;

  document.documentElement.dataset.gaAccessoryBuild = 'v115';

  const cloud = window.CoachingCloud;
  const localKey = `ga-accessory-v22:${cfg.slug}:${cfg.programKey}`;
  let cloudReady = false;
  let remoteSets = new Map();
  let records = new Map();
  let mutationTimer = null;
  let saveTimers = new WeakMap();
  let panel = null;
  let selectedExerciseKey = '';

  const styles = document.createElement('style');
  styles.id = 'gaAccessoryTrackingV22Style';
  styles.textContent = `
    .accessory-block-v22 .exercise-name{cursor:pointer;text-decoration:underline;text-decoration-color:rgba(240,196,77,.38);text-underline-offset:4px}
    .accessory-pr-link-v22{display:inline-flex;align-items:center;margin-left:7px;padding:3px 7px;border-radius:999px;border:1px solid rgba(240,196,77,.24);background:rgba(240,196,77,.08);color:var(--accent-light,var(--accent,#f0c44d));font:850 8px Inter,system-ui,sans-serif;white-space:nowrap;cursor:pointer}
    .accessory-block-v22 .cloud-load-interval{display:none!important}
    .accessory-clean-v28>.cloud-athlete-load,.accessory-clean-v28>.cloud-athlete-rpe,.accessory-clean-v28>.load-input,.accessory-clean-v28>.set-load,.accessory-clean-v28>.load-preset-v22,.accessory-clean-v28>.rpe-input,.accessory-clean-v28>.set-rpe{display:none!important}
    .accessory-track-v22{order:12;flex:1 0 100%;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:7px;padding:8px;border:1px solid rgba(255,255,255,.06);border-radius:11px;background:rgba(255,255,255,.025)}
    .accessory-field-v22{min-width:0}.accessory-field-v22>span{display:block;margin:0 0 4px;color:var(--text-muted,#667696);font:800 8px Inter,system-ui,sans-serif;text-transform:uppercase;letter-spacing:.04em}
    .accessory-combo-v22{display:grid;grid-template-columns:minmax(0,1fr) 31px;gap:3px;min-width:0}
    .accessory-combo-v22 input,.accessory-combo-v22 select,.load-preset-v22{min-width:0;width:100%;height:32px;border:1px solid rgba(255,255,255,.09);border-radius:8px;background:rgba(255,255,255,.055);color:inherit;font:800 10px Inter,system-ui,sans-serif;text-align:center;outline:none}
    .accessory-combo-v22 input:focus,.accessory-combo-v22 select:focus,.cloud-athlete-load:focus{border-color:var(--accent,#f0c44d)}
    .accessory-combo-v22 select,.load-preset-v22{padding:0 2px;color:var(--accent-light,var(--accent,#f0c44d))}
    .load-preset-v22{flex:0 0 31px;width:31px;height:30px;margin-right:2px}
    .accessory-track-note-v22{grid-column:1/-1;color:var(--text-muted,#667696);font:700 8px/1.35 Inter,system-ui,sans-serif}
    .accessory-pr-panel-v22{display:none;position:fixed;z-index:7200;inset:0;background:rgba(3,6,12,.92);backdrop-filter:blur(12px);padding:max(58px,env(safe-area-inset-top)) 12px calc(18px + env(safe-area-inset-bottom));overflow:auto;color:var(--text,#eef2f7)}
    .accessory-pr-panel-v22.show{display:block}.accessory-pr-shell-v22{width:min(100%,430px);margin:0 auto;border:1px solid rgba(255,255,255,.08);border-radius:20px;background:var(--bg,#080c15);overflow:hidden;box-shadow:0 30px 90px rgba(0,0,0,.58)}
    .accessory-pr-head-v22{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px;background:rgba(10,15,25,.96);border-bottom:1px solid rgba(255,255,255,.06)}.accessory-pr-head-v22 h2{margin:0;font-size:16px}.accessory-pr-head-v22 button{border:0;border-radius:9px;padding:8px 10px;background:var(--surface-2,#1b2438);color:inherit;font-weight:850}
    .accessory-pr-tools-v22{padding:10px 12px}.accessory-pr-search-v22{width:100%;padding:10px 12px;border:1px solid rgba(255,255,255,.08);border-radius:10px;background:rgba(255,255,255,.045);color:inherit;outline:none;font:750 11px Inter,system-ui,sans-serif}
    .accessory-pr-list-v22{padding:0 12px 14px}.accessory-pr-empty-v22{padding:24px 12px;text-align:center;color:var(--text-muted,#667696);font-size:11px;line-height:1.55}
    .accessory-pr-card-v22{scroll-margin-top:78px;margin-bottom:9px;padding:12px;border:1px solid rgba(255,255,255,.07);border-radius:14px;background:linear-gradient(145deg,rgba(255,255,255,.035),rgba(255,255,255,.012))}.accessory-pr-card-v22.highlight{border-color:rgba(240,196,77,.55);box-shadow:0 0 0 2px rgba(240,196,77,.09)}
    .accessory-pr-title-v22{display:flex;justify-content:space-between;gap:8px;align-items:flex-start;font-size:12px;font-weight:900}.accessory-pr-title-v22 small{color:var(--text-muted,#667696);font-size:8px;white-space:nowrap}
    .accessory-pr-grid-v22{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:9px}.accessory-pr-stat-v22{padding:8px;border-radius:9px;background:rgba(255,255,255,.035)}.accessory-pr-stat-v22 span{display:block;color:var(--text-muted,#667696);font-size:8px;font-weight:800;text-transform:uppercase}.accessory-pr-stat-v22 strong{display:block;margin-top:3px;color:var(--accent-light,var(--accent,#f0c44d));font-size:12px}
    .accessory-profile-button-v22{border:1px solid rgba(240,196,77,.22)!important;background:rgba(240,196,77,.08)!important;color:var(--accent-light,var(--accent,#f0c44d))!important}
    .accessory-pr-flash-v22{display:none;position:fixed;z-index:9000;inset:0;align-items:center;justify-content:center;padding:20px;background:rgba(2,4,8,.84);backdrop-filter:blur(10px)}.accessory-pr-flash-v22.show{display:flex}.accessory-pr-flash-card-v22{width:min(100%,360px);padding:22px;border:1px solid rgba(240,196,77,.38);border-radius:20px;text-align:center;background:#101725;box-shadow:0 28px 80px rgba(0,0,0,.58)}.accessory-pr-flash-card-v22 h2{margin:0;color:var(--accent,#f0c44d);font-size:20px}.accessory-pr-flash-card-v22 p{margin:10px 0 0;font-size:12px;line-height:1.55}.accessory-pr-flash-card-v22 button{margin-top:15px;border:0;border-radius:10px;padding:9px 14px;background:var(--accent,#f0c44d);color:#111722;font-weight:900}
    @media(max-width:370px){.accessory-track-v22{grid-template-columns:1fr}.accessory-pr-grid-v22{grid-template-columns:1fr}}
  `;
  document.head.appendChild(styles);

  function safeNumber(value) {
    const raw = String(value ?? '').trim().replace(',', '.');
    if (!raw) return null;
    const number = Number(raw);
    return Number.isFinite(number) ? number : null;
  }

  function normalizeKey(value) {
    return String(value || 'exercice')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      .slice(0, 120) || 'exercice';
  }

  function fr(value, digits = 2) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '—';
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits }).format(number);
  }

  function durationLabel(value) {
    const seconds = Math.max(0, Math.round(Number(value) || 0));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const rest = seconds % 60;
    if (hours) return `${hours}h${String(minutes).padStart(2, '0')}m`;
    if (minutes) return `${minutes}:${String(rest).padStart(2, '0')}`;
    return `${rest}s`;
  }

  function parseDuration(value) {
    const text = String(value ?? '').trim().toLowerCase().replace(',', '.');
    if (!text) return null;
    if (/^\d+(?:\.\d+)?$/.test(text)) return Math.max(1, Math.round(Number(text)));
    const clock = text.match(/^(?:(\d+)\s*:)?(\d{1,2})$/);
    if (clock) return Math.max(1, (Number(clock[1]) || 0) * 60 + Number(clock[2]));
    const h = Number(text.match(/(\d+(?:\.\d+)?)\s*h/)?.[1] || 0);
    const m = Number(text.match(/(\d+(?:\.\d+)?)\s*m(?:in)?/)?.[1] || 0);
    const s = Number(text.match(/(\d+(?:\.\d+)?)\s*s/)?.[1] || 0);
    const total = Math.round(h * 3600 + m * 60 + s);
    return total > 0 ? total : null;
  }

  function readLocal() {
    try {
      const parsed = JSON.parse(localStorage.getItem(localKey) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) { return {}; }
  }

  let localValues = readLocal();
  function writeLocal() {
    try { localStorage.setItem(localKey, JSON.stringify(localValues)); } catch (_) {}
  }

  function currentIndices() {
    const weeks = [...document.querySelectorAll('.week-btn')];
    const days = [...document.querySelectorAll('.day-tab')];
    return {
      w: Math.max(0, weeks.findIndex(node => node.classList.contains('active'))),
      d: Math.max(0, days.findIndex(node => node.classList.contains('active')))
    };
  }

  function allRows() {
    const container = document.getElementById('exerciseList') || document.getElementById('exercises');
    return container ? [...container.querySelectorAll('.set-row')] : [];
  }

  function checkbox(row) { return row?.querySelector('.set-check,.check-btn'); }
  function rowIsCompleted(row) {
    const box = checkbox(row);
    return !!(box?.classList.contains('checked') || row?.classList.contains('completed') || row?.classList.contains('done'));
  }

  function exerciseBlock(row) { return row?.closest('.exercise-block'); }
  function exerciseName(row) {
    const block = exerciseBlock(row);
    return block?.querySelector('.exercise-name')?.textContent?.trim()
      || block?.querySelector('.exercise-badge')?.textContent?.trim()
      || 'Exercice accessoire';
  }

  function rowCode(row) {
    const block = exerciseBlock(row);
    const badge = block?.querySelector('.exercise-badge');
    const classes = badge?.className || '';
    const text = `${badge?.textContent || ''} ${block?.querySelector('.exercise-name')?.textContent || ''}`.toLowerCase();
    if (/badge-sq/.test(classes) || /\bsquat\b|\bsq\b/.test(text)) return 'sq';
    if (/badge-bn/.test(classes) || /\bbench\b|\bbn\b/.test(text)) return 'bn';
    if (/badge-dl/.test(classes) || /\bdeadlift\b|\bsoulev[ée]\b|\bdl\b/.test(text)) return 'dl';
    return 'ac';
  }

  function isAccessory(row) { return rowCode(row) === 'ac'; }

  function prescriptionText(row) {
    const block = exerciseBlock(row);
    return [
      row?.querySelector('.set-info')?.textContent,
      ...(block ? [...block.querySelectorAll('.exercise-meta .meta-chip,.exercise-badge,.exercise-intention,.variant')].map(node => node.textContent) : [])
    ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  }

  function inferMode(row) {
    const text = prescriptionText(row).toLowerCase();
    if (/\b\d+(?:[.,]\d+)?\s*(?:s|sec|seconde|secondes|min|minute|minutes)\b/.test(text)) return 'time';
    if (/\b(?:chrono|dur[ée]e|isom[ée]tr|hold|maintien)\b/.test(text)) return 'time';
    return 'reps';
  }

  function inferReps(row) {
    const strong = row?.querySelector('.set-info strong')?.textContent || '';
    const direct = String(strong).match(/\d+/);
    if (direct) return Math.max(1, Number(direct[0]) || 1);
    const text = prescriptionText(row);
    const match = text.match(/\b(\d{1,3})\s*(?:rep|reps|r[ée]p)/i);
    return match ? Math.max(1, Number(match[1])) : null;
  }

  function inferDuration(row) {
    const text = prescriptionText(row).toLowerCase();
    const match = text.match(/(\d+(?:[.,]\d+)?)\s*(s|sec|seconde|secondes|min|minute|minutes)\b/i);
    if (!match) return null;
    const amount = Number(String(match[1]).replace(',', '.'));
    return /min/.test(match[2]) ? Math.round(amount * 60) : Math.round(amount);
  }

  function setIdentity(row, idx) {
    const { w, d } = currentIndices();
    row.dataset.accessorySetV22 = `${w}|${d}|${idx}`;
    return { w, d, idx, key: `${w}|${d}|${idx}` };
  }

  function loadPresetValues() {
    const values = [0,1,2,2.5,5,7.5,10,12.5,15,17.5,20,22.5,25,27.5,30,32.5,35,37.5,40,45,50,55,60,65,70,75,80,85,90,95,100,110,120,130,140,150,160,180,200,220,250,300,350,400,450,500];
    return values.map(value => `<option value="${value}">${String(value).replace('.', ',')}</option>`).join('');
  }
  const loadOptions = loadPresetValues();
  const repOptions = Array.from({ length: 30 }, (_, index) => index + 1).concat([35,40,45,50,60,75,100]).map(value => `<option value="${value}">${value}</option>`).join('');
  const timeOptions = [10,15,20,30,40,45,60,75,90,120,150,180,240,300,600].map(value => `<option value="${value}">${durationLabel(value)}</option>`).join('');

  function ensureLoadPreset(row, loadInput) {
    if (!loadInput || row.querySelector('.load-preset-v22')) return;
    const preset = document.createElement('select');
    preset.className = 'load-preset-v22';
    preset.setAttribute('aria-label', 'Choisir une charge prédéfinie');
    preset.innerHTML = `<option value="">⌄</option>${loadOptions}`;
    loadInput.after(preset);
  }

  function addProfileLink(block, name) {
    if (!block || block.querySelector('.accessory-pr-link-v22')) return;
    block.classList.add('accessory-block-v22');
    const title = block.querySelector('.exercise-name');
    if (!title) return;
    title.dataset.accessoryNameV22 = name;
    title.setAttribute('role', 'button');
    title.setAttribute('tabindex', '0');
    const badge = document.createElement('button');
    badge.type = 'button';
    badge.className = 'accessory-pr-link-v22';
    badge.dataset.accessoryNameV22 = name;
    badge.textContent = '🏆 Voir les PR';
    title.after(badge);
  }

  function controlsValue(row) {
    const inferredMode = row.dataset.accessoryModeV22 || inferMode(row);
    const load = safeNumber(row.querySelector('[data-cloud-load],.cloud-athlete-load,.load-input,.set-load')?.value) ?? 0;
    const prescribedReps = inferReps(row);
    const durationInput = row.querySelector('.accessory-time-v22');
    const durationRaw = String(durationInput?.value ?? '').trim();
    const duration = parseDuration(durationRaw);
    const mode = inferredMode === 'time' && !(prescribedReps > 0) ? 'time' : 'reps';
    return {
      mode,
      load,
      rpe: null,
      reps: prescribedReps > 0 ? Math.round(prescribedReps) : null,
      duration,
      durationRaw
    };
  }

  function cacheRow(row) {
    const identity = row.dataset.accessorySetV22;
    if (!identity) return;
    const value = controlsValue(row);
    localValues[identity] = {
      mode: value.mode,
      load: row.querySelector('[data-cloud-load],.cloud-athlete-load,.load-input,.set-load')?.value ?? '',
      reps: value.reps ?? '',
      duration: row.querySelector('.accessory-time-v22')?.value ?? ''
    };
    writeLocal();
  }

  function applyStored(row, identity) {
    const stored = remoteSets.get(identity.key) || localValues[identity.key] || {};
    const loadInput = row.querySelector('[data-cloud-load],.cloud-athlete-load,.load-input,.set-load');
    const timeInput = row.querySelector('.accessory-time-v22');
    if (loadInput) {
      if (stored.load_kg !== undefined && stored.load_kg !== null) loadInput.value = stored.load_kg;
      else if (stored.load !== undefined && stored.load !== '') loadInput.value = stored.load;
      else if (!loadInput.value) loadInput.value = '0';
    }
    if (stored.duration_seconds !== undefined && stored.duration_seconds !== null && timeInput) timeInput.value = durationLabel(stored.duration_seconds);
    else if (stored.duration !== undefined && stored.duration !== '' && timeInput) timeInput.value = stored.duration;
  }

  function cleanupNonAccessoryArtifacts(row) {
    row.classList.remove('accessory-clean-v28');
    row.querySelectorAll('.load-preset-v22,.accessory-track-v22').forEach(node => node.remove());
    delete row.dataset.accessoryModeV22;
    delete row.dataset.accessorySetV22;
  }

  function cleanupAccessoryInlineDuplicates(row, tracker, loadInput) {
    row.classList.add('accessory-clean-v28');
    row.querySelectorAll('.cloud-load-interval').forEach(node => node.remove());

    // Les accessoires n'utilisent jamais de RPE.
    row.querySelectorAll('.cloud-athlete-rpe,.rpe-input,.set-rpe,.rpe-select,[data-cloud-rpe]').forEach(node => node.remove());

    // Une fois le champ de charge déplacé dans le panneau accessoire,
    // tout autre contrôle de charge/RPE directement dans la ligne est un doublon.
    [...row.children].forEach(node => {
      if (node === tracker || node === loadInput) return;
      if (
        node.matches?.('.set-num,.set-info,.set-check,.check-btn') ||
        node.contains?.(tracker)
      ) return;

      const classText = String(node.className || '').toLowerCase();
      const ariaText = `${node.getAttribute?.('aria-label') || ''} ${node.getAttribute?.('title') || ''}`.toLowerCase();
      const label = String(node.textContent || '').trim().toUpperCase();
      const looksLikeDuplicate =
        node.matches?.('input,select') ||
        /(?:load|charge|rpe|preset)/.test(classText) ||
        /(?:charge|rpe)/.test(ariaText) ||
        /^(?:RPE|—|-|✏|✏️)$/.test(label);

      if (looksLikeDuplicate) node.remove();
    });

    const keepers = new Set([loadInput, tracker?.querySelector('.load-preset-v22')]);
    row.querySelectorAll('.cloud-athlete-load,.load-preset-v22').forEach(node => {
      if (!keepers.has(node) && !tracker?.contains(node)) node.remove();
    });
  }

  function ensureAccessoryTracking(row, idx) {
    if (!isAccessory(row)) {
      cleanupNonAccessoryArtifacts(row);
      return;
    }

    row.querySelectorAll('.cloud-load-interval').forEach(node => node.remove());
    row.querySelectorAll('.cloud-athlete-rpe,.rpe-input,.set-rpe,.rpe-select,[data-cloud-rpe]').forEach(node => node.remove());

    const loadInput = row.querySelector('[data-cloud-load],.cloud-athlete-load,.load-input,.set-load');
    if (!loadInput) return;

    ensureLoadPreset(row, loadInput);

    const identity = setIdentity(row, idx);
    const mode = inferMode(row);
    row.dataset.accessoryModeV22 = mode;
    const name = exerciseName(row);
    addProfileLink(exerciseBlock(row), name);

    let tracker = row.querySelector('.accessory-track-v22');
    if (!tracker) {
      tracker = document.createElement('div');
      tracker.className = 'accessory-track-v22';
      row.appendChild(tracker);
    }
    if (tracker.dataset.version !== 'v115') {
      tracker.dataset.version = 'v115';
      tracker.dataset.mode = mode;
      tracker.innerHTML = `
        <label class="accessory-field-v22"><span>Charge réalisée</span><div class="accessory-combo-v22 accessory-load-slot-v22"></div></label>
        <label class="accessory-field-v22"><span>Temps de la série · facultatif</span><div class="accessory-combo-v22"><input class="accessory-time-v22" inputmode="numeric" placeholder="mm:ss" aria-label="Temps facultatif de la série"><select class="accessory-time-preset-v22" aria-label="Temps prédéfini facultatif"><option value="">⌄</option>${timeOptions}</select></div></label>
        <div class="accessory-track-note-v22">Aucun RPE n'est demandé sur les accessoires. Le temps est facultatif ; laisse la case vide si tu ne souhaites pas le suivre.</div>`;
    }

    const loadSlot = tracker.querySelector('.accessory-load-slot-v22');
    const preset = row.querySelector('.load-preset-v22');

    if (loadSlot && loadInput.parentElement !== loadSlot) {
      loadSlot.append(loadInput);
      if (preset) loadSlot.append(preset);
    }

    cleanupAccessoryInlineDuplicates(row, tracker, loadInput);

    const timeInput = tracker.querySelector('.accessory-time-v22');
    if (mode === 'time' && timeInput && !timeInput.value) {
      const seconds = inferDuration(row);
      if (seconds) timeInput.value = durationLabel(seconds);
    }
    applyStored(row, identity);
  }

  function enrich() {
    clearTimeout(mutationTimer);
    mutationTimer = setTimeout(() => {
      allRows().forEach((row, idx) => ensureAccessoryTracking(row, idx));
      injectProfileButton();
    }, 30);
  }

  function weekLabel(w) {
    return document.querySelector('.week-btn.active')?.textContent?.trim() || `S${w + 1}`;
  }
  function dayLabel(d) {
    return (document.querySelector('.day-tab.active')?.textContent || `Jour ${d + 1}`).replace(/\s+/g, ' ').trim();
  }

  function validate(row) {
    const values = controlsValue(row);
    if (values.durationRaw && !(values.duration > 0)) {
      return { ok: false, message: 'Le temps facultatif doit être écrit en secondes ou au format mm:ss.', focus: row.querySelector('.accessory-time-v22') };
    }
    if (values.duration !== null && (values.duration < 1 || values.duration > 86400)) {
      return { ok: false, message: 'Le temps doit être compris entre 1 seconde et 24 heures.', focus: row.querySelector('.accessory-time-v22') };
    }
    return { ok: true, values };
  }

  async function saveRow(row, completed, quiet = false) {
    if (!isAccessory(row)) return;
    cacheRow(row);
    if (!cloudReady || !cloud?.client || !cloud?.session?.user) return;
    if (!cloud.canEditAthlete(cfg.slug)) {
      if (!quiet) cloud.toast(`Ce compte ne peut pas modifier la programmation de ${cfg.name}.`, true);
      return;
    }
    const idx = Number(row.dataset.accessorySetV22?.split('|')[2]);
    const { w, d } = currentIndices();
    if (!Number.isInteger(idx)) return;
    const validation = completed ? validate(row) : { ok: true, values: controlsValue(row) };
    if (!validation.ok) return;
    const values = validation.values;
    const name = exerciseName(row);
    const key = normalizeKey(name);
    const { data, error } = await cloud.client.rpc('save_accessory_set_v22', {
      p_athlete_slug: cfg.slug,
      p_athlete_name: cfg.name || cfg.slug,
      p_program_key: cfg.programKey,
      p_week_index: w,
      p_week_label: weekLabel(w),
      p_day_index: d,
      p_day_name: dayLabel(d),
      p_set_index: idx,
      p_exercise_key: key,
      p_exercise_name: name,
      p_tracking_mode: values.mode,
      p_load_kg: values.load,
      p_actual_reps: values.reps,
      p_duration_seconds: values.duration,
      p_rpe: null,
      p_completed: !!completed
    });
    if (error) {
      console.error('Tracking accessoire V22 :', error);
      if (!quiet) cloud.toast(`Accessoire non synchronisé : ${error.message}`, true);
      return;
    }
    const result = Array.isArray(data) ? data[0] : data;
    if (result) {
      records.set(key, {
        athlete_slug: cfg.slug,
        exercise_key: key,
        exercise_name: name,
        best_load_kg: result.best_load_kg,
        best_load_reps: result.best_load_reps,
        best_reps: result.best_reps,
        best_reps_load_kg: result.best_reps_load_kg,
        best_duration_seconds: result.best_duration_seconds,
        best_duration_load_kg: result.best_duration_load_kg,
        best_volume_kg: result.best_volume_kg,
        total_sets: result.total_sets,
        last_performed_at: new Date().toISOString()
      });
      if (result.is_pr && completed && !quiet) showPrFlash(name, result);
      renderPanel();
    }
  }

  function queueSave(row, completed, delay = 450, quiet = true) {
    clearTimeout(saveTimers.get(row));
    const timer = setTimeout(() => saveRow(row, completed, quiet), delay);
    saveTimers.set(row, timer);
  }

  async function loadRemote() {
    if (!cloudReady || !cloud?.client) return;
    const [setsResult, prsResult] = await Promise.all([
      cloud.client.from('workout_sets')
        .select('week_index,day_index,set_index,load_kg,tracking_mode,actual_reps,duration_seconds,completed')
        .eq('athlete_slug', cfg.slug).eq('program_key', cfg.programKey),
      cloud.client.from('accessory_prs')
        .select('athlete_slug,exercise_key,exercise_name,best_load_kg,best_load_reps,best_reps,best_reps_load_kg,best_duration_seconds,best_duration_load_kg,best_volume_kg,total_sets,last_performed_at')
        .eq('athlete_slug', cfg.slug)
    ]);
    if (!setsResult.error) {
      remoteSets = new Map((setsResult.data || []).map(item => [`${item.week_index}|${item.day_index}|${item.set_index}`, item]));
    } else if (!/tracking_mode|actual_reps|duration_seconds/i.test(setsResult.error.message || '')) {
      console.warn('Tracking accessoire :', setsResult.error.message);
    }
    if (!prsResult.error) records = new Map((prsResult.data || []).map(item => [item.exercise_key, item]));
    else if (!/accessory_prs/i.test(prsResult.error.message || '')) console.warn('Records accessoires :', prsResult.error.message);
    enrich();
    renderPanel();
  }

  function ensurePanel() {
    if (panel) return panel;
    panel = document.createElement('section');
    panel.id = 'accessoryPrPanelV22';
    panel.className = 'accessory-pr-panel-v22';
    panel.innerHTML = `
      <div class="accessory-pr-shell-v22">
        <div class="accessory-pr-head-v22"><h2>🏆 PR des accessoires</h2><button type="button" id="accessoryPrCloseV22">Fermer</button></div>
        <div class="accessory-pr-tools-v22"><input type="search" class="accessory-pr-search-v22" id="accessoryPrSearchV22" placeholder="Rechercher un accessoire…"></div>
        <div class="accessory-pr-list-v22" id="accessoryPrListV22"></div>
      </div>`;
    document.body.appendChild(panel);
    panel.querySelector('#accessoryPrCloseV22').addEventListener('click', () => panel.classList.remove('show'));
    panel.addEventListener('click', event => { if (event.target === panel) panel.classList.remove('show'); });
    panel.querySelector('#accessoryPrSearchV22').addEventListener('input', renderPanel);
    return panel;
  }

  function renderPanel() {
    if (!panel) return;
    const list = panel.querySelector('#accessoryPrListV22');
    const query = String(panel.querySelector('#accessoryPrSearchV22')?.value || '').trim().toLowerCase();
    const entries = [...records.values()]
      .filter(item => !query || String(item.exercise_name || '').toLowerCase().includes(query))
      .sort((a, b) => String(a.exercise_name).localeCompare(String(b.exercise_name), 'fr'));
    if (!entries.length) {
      list.innerHTML = `<div class="accessory-pr-empty-v22">Aucun PR accessoire enregistré pour le moment.<br>Complète une série avec sa charge ; tu peux aussi renseigner un temps facultatif.</div>`;
      return;
    }
    list.innerHTML = entries.map(item => {
      const key = item.exercise_key;
      const loadText = Number(item.best_load_kg) > 0 ? `${fr(item.best_load_kg)} kg${item.best_load_reps ? ` × ${item.best_load_reps}` : ''}` : '—';
      const repsText = Number(item.best_reps) > 0 ? `${item.best_reps} reps${Number(item.best_reps_load_kg) > 0 ? ` à ${fr(item.best_reps_load_kg)} kg` : ' au PDC'}` : '—';
      const timeText = Number(item.best_duration_seconds) > 0 ? `${durationLabel(item.best_duration_seconds)}${Number(item.best_duration_load_kg) > 0 ? ` à ${fr(item.best_duration_load_kg)} kg` : ''}` : '—';
      const volumeText = Number(item.best_volume_kg) > 0 ? `${fr(item.best_volume_kg)} kg·reps` : '—';
      return `<article class="accessory-pr-card-v22 ${selectedExerciseKey === key ? 'highlight' : ''}" data-accessory-card-v22="${key}">
        <div class="accessory-pr-title-v22"><span>${escapeHtmlV22(item.exercise_name)}</span><small>${Number(item.total_sets) || 0} séries suivies</small></div>
        <div class="accessory-pr-grid-v22">
          <div class="accessory-pr-stat-v22"><span>Meilleure charge</span><strong>${loadText}</strong></div>
          <div class="accessory-pr-stat-v22"><span>Record répétitions</span><strong>${repsText}</strong></div>
          <div class="accessory-pr-stat-v22"><span>Record temps</span><strong>${timeText}</strong></div>
          <div class="accessory-pr-stat-v22"><span>Meilleur volume</span><strong>${volumeText}</strong></div>
        </div>
      </article>`;
    }).join('');
  }

  function escapeHtmlV22(value) {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[character]));
  }

  function openPanel(name = '') {
    ensurePanel();
    selectedExerciseKey = name ? normalizeKey(name) : '';
    const search = panel.querySelector('#accessoryPrSearchV22');
    if (name && search) search.value = '';
    renderPanel();
    panel.classList.add('show');
    requestAnimationFrame(() => {
      const target = selectedExerciseKey ? panel.querySelector(`[data-accessory-card-v22="${selectedExerciseKey}"]`) : null;
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  function injectProfileButton() {
    const head = document.querySelector('#prPanel .pr-panel-head');
    if (!head || head.querySelector('.accessory-profile-button-v22')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'accessory-profile-button-v22';
    button.textContent = 'Accessoires';
    button.addEventListener('click', () => openPanel());
    const close = head.querySelector('button');
    if (close) head.insertBefore(button, close);
    else head.appendChild(button);
  }

  function ensureFlash() {
    let overlay = document.getElementById('accessoryPrFlashV22');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'accessoryPrFlashV22';
    overlay.className = 'accessory-pr-flash-v22';
    overlay.innerHTML = `<div class="accessory-pr-flash-card-v22"><h2>NOUVEAU PR ACCESSOIRE !</h2><p id="accessoryPrFlashTextV22"></p><button type="button">Voir mes PR</button></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('button').addEventListener('click', () => { overlay.classList.remove('show'); openPanel(selectedExerciseKey); });
    overlay.addEventListener('click', event => { if (event.target === overlay) overlay.classList.remove('show'); });
    return overlay;
  }

  function showPrFlash(name, result) {
    selectedExerciseKey = normalizeKey(name);
    const labels = [];
    if (result.load_pr) labels.push('charge');
    if (result.reps_pr) labels.push('répétitions');
    if (result.time_pr) labels.push('temps');
    if (result.volume_pr) labels.push('volume');
    const overlay = ensureFlash();
    overlay.querySelector('#accessoryPrFlashTextV22').textContent = `${name} : nouveau record de ${labels.join(', ') || 'performance'}.`;
    overlay.classList.add('show');
    if (navigator.vibrate) navigator.vibrate([120,60,180]);
    clearTimeout(showPrFlash.timer);
    showPrFlash.timer = setTimeout(() => overlay.classList.remove('show'), 7000);
  }

  window.addEventListener('click', event => {
    const nameTarget = event.target.closest('[data-accessory-name-v22]');
    if (nameTarget) {
      event.preventDefault();
      event.stopPropagation();
      openPanel(nameTarget.dataset.accessoryNameV22 || nameTarget.textContent);
      return;
    }

    const box = event.target.closest('[data-cloud-checkbox],.set-check,.check-btn');
    const row = box?.closest('.set-row');
    if (!box || !row || !isAccessory(row)) return;
    const willComplete = !rowIsCompleted(row);
    if (willComplete) {
      const result = validate(row);
      if (!result.ok) {
        event.preventDefault();
        event.stopImmediatePropagation();
        cloud?.toast?.(result.message, true);
        result.focus?.focus();
        return;
      }
    }
    setTimeout(() => saveRow(row, willComplete, false), 180);
    if (willComplete) setTimeout(() => saveRow(row, true, true), 900);
  }, true);

  window.addEventListener('change', event => {
    const row = event.target.closest('.set-row');
    if (!row) return;
    if (event.target.matches('.load-preset-v22')) {
      const loadInput = row.querySelector('[data-cloud-load],.cloud-athlete-load,.load-input,.set-load');
      if (event.target.value !== '' && loadInput) {
        loadInput.value = event.target.value;
        loadInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      event.target.value = '';
      return;
    }
    if (event.target.matches('.accessory-time-preset-v22')) {
      const input = row.querySelector('.accessory-time-v22');
      if (event.target.value && input) input.value = durationLabel(event.target.value);
      event.target.value = '';
    }
    if (!isAccessory(row)) return;
    if (!event.target.matches('.accessory-time-v22,.accessory-time-preset-v22,.cloud-athlete-load,[data-cloud-load],.load-input,.set-load')) return;
    cacheRow(row);
    queueSave(row, rowIsCompleted(row), rowIsCompleted(row) ? 350 : 650, true);
  }, true);

  window.addEventListener('input', event => {
    const row = event.target.closest('.set-row');
    if (!row || !isAccessory(row)) return;
    if (!event.target.matches('.accessory-time-v22,.cloud-athlete-load,[data-cloud-load],.load-input,.set-load')) return;
    cacheRow(row);
  }, true);

  document.addEventListener('click', event => {
    if (!event.target.closest('.week-btn,.day-tab')) return;
    setTimeout(enrich, 40);
  }, true);

  const container = document.getElementById('exerciseList') || document.getElementById('exercises');
  if (container) new MutationObserver(enrich).observe(container, { childList: true, subtree: true });

  ensurePanel();
  enrich();
  window.CoachingAccessoryTracking = { open: openPanel, refresh: loadRemote };

  if (cloud?.onReady) {
    cloud.onReady(async () => {
      cloudReady = true;
      await loadRemote();
      cloud.client.channel(`ga-accessory-prs-${cfg.slug}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'accessory_prs', filter: `athlete_slug=eq.${cfg.slug}` }, loadRemote)
        .subscribe();
    });
  }
})();


/* --------------------------------------------------------------------------
   V28.3 — CORRECTION RESPONSIVE DU BILAN DE SÉANCE

   Corrige les champs qui dépassent de la carte :
   - colonnes Grid autorisées à rétrécir avec minmax(0, 1fr)
   - box-sizing uniforme
   - champs, zones de notes et unités contenus dans la largeur disponible
   - passage sur une colonne sur les petits écrans
--------------------------------------------------------------------------- */
(function fixSessionCheckinLayoutV283() {
  'use strict';

  const STYLE_ID = 'gaSessionCheckinLayoutV283';

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #gaSessionCheckin,
      #gaSessionCheckin *,
      .ga-session-finish-fixed-v283,
      .ga-session-finish-fixed-v283 * {
        box-sizing: border-box !important;
      }

      #gaSessionCheckin {
        width: auto !important;
        max-width: calc(100% - 32px) !important;
        min-width: 0 !important;
        overflow: hidden !important;
      }

      #gaSessionCheckin .ga-session-checkin-head,
      #gaSessionCheckin .ga-checkin-grid,
      #gaSessionCheckin .ga-checkin-field,
      #gaSessionCheckin .ga-checkin-input-wrap {
        min-width: 0 !important;
        max-width: 100% !important;
      }

      #gaSessionCheckin .ga-checkin-grid {
        width: 100% !important;
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      }

      #gaSessionCheckin .ga-checkin-field {
        width: 100% !important;
      }

      #gaSessionCheckin .ga-checkin-input-wrap {
        width: 100% !important;
        overflow: hidden !important;
      }

      #gaSessionCheckin input,
      #gaSessionCheckin select,
      #gaSessionCheckin textarea {
        display: block !important;
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
      }

      #gaSessionCheckin .ga-checkin-input-wrap > input,
      #gaSessionCheckin .ga-checkin-input-wrap > select {
        flex: 1 1 0 !important;
        width: 0 !important;
      }

      #gaSessionCheckin textarea {
        resize: vertical !important;
      }

      #gaSessionCheckin .ga-checkin-unit {
        flex: 0 0 auto !important;
        white-space: nowrap !important;
      }

      .ga-session-finish-fixed-v283 {
        display: block !important;
        width: calc(100% - 32px) !important;
        max-width: calc(100% - 32px) !important;
        margin-left: 16px !important;
        margin-right: 16px !important;
        box-sizing: border-box !important;
      }

      @media (max-width: 520px) {
        #gaSessionCheckin {
          max-width: calc(100% - 24px) !important;
          margin-left: 12px !important;
          margin-right: 12px !important;
          padding-left: 12px !important;
          padding-right: 12px !important;
        }

        #gaSessionCheckin .ga-checkin-grid {
          grid-template-columns: minmax(0, 1fr) !important;
        }

        #gaSessionCheckin .ga-checkin-field {
          grid-column: auto !important;
        }

        .ga-session-finish-fixed-v283 {
          width: calc(100% - 24px) !important;
          max-width: calc(100% - 24px) !important;
          margin-left: 12px !important;
          margin-right: 12px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function markFinishButton() {
    const buttons = Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"]'));
    const button = buttons.find(element => {
      const label = element.tagName === 'INPUT' ? element.value : element.textContent;
      return normalizeText(label).includes('terminer la seance');
    });

    if (button) button.classList.add('ga-session-finish-fixed-v283');
  }

  function repair() {
    installStyle();

    const card = document.getElementById('gaSessionCheckin');
    if (card) {
      card.style.setProperty('box-sizing', 'border-box', 'important');
      card.querySelectorAll('input, select, textarea').forEach(control => {
        control.style.setProperty('box-sizing', 'border-box', 'important');
        control.style.setProperty('max-width', '100%', 'important');
        control.style.setProperty('min-width', '0', 'important');
      });
    }

    markFinishButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', repair, { once: true });
  } else {
    repair();
  }

  const observer = new MutationObserver(() => repair());
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  window.addEventListener('resize', repair, { passive: true });
})();

/* --------------------------------------------------------------------------
   FIN DE BLOC, SÉANCES SKIPPÉES ET EXPORT PDF
   Build : 2026-08-02-v29-block-report
---------------------------------------------------------------------------- */
(function () {
  'use strict';

  const cfg = window.COACHING_ATHLETE || {};
  if (!cfg.slug || !cfg.programKey) return;

  const BUILD = '2026-08-02-v29-block-report';
  const moduleState = {
    cloudReady: false,
    loading: false,
    migrationMissing: false,
    setRows: [],
    statusRows: [],
    sessionRows: [],
    refreshTimer: null,
    lastCurrentKey: '',
    reportBusy: false
  };

  const style = document.createElement('style');
  style.textContent = `
    .ga-block-panel{margin:12px 16px 24px;padding:15px;border-radius:17px;border:1px solid rgba(255,255,255,.075);background:linear-gradient(145deg,rgba(255,255,255,.04),rgba(255,255,255,.018));box-shadow:0 16px 38px rgba(0,0,0,.18);color:var(--text,#e8ecf5);box-sizing:border-box}
    .ga-block-panel *{box-sizing:border-box;min-width:0}.ga-block-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.ga-block-head h2{margin:0;font-size:14px;font-weight:950}.ga-block-head p{margin:4px 0 0;color:var(--text-muted,#71809d);font-size:9px;line-height:1.45}.ga-block-count{flex:none;padding:5px 8px;border-radius:999px;background:rgba(255,255,255,.05);color:var(--accent,#f0c44d);font-size:9px;font-weight:950}
    .ga-block-progress{height:8px;margin-top:12px;border-radius:999px;background:rgba(255,255,255,.06);overflow:hidden}.ga-block-progress>span{display:block;height:100%;width:0;border-radius:inherit;background:linear-gradient(90deg,#cf2b3d,var(--accent,#f0c44d));transition:width .25s ease}.ga-block-current{margin-top:10px;padding:10px 11px;border-radius:12px;background:rgba(255,255,255,.035);font-size:9px;line-height:1.5;color:var(--text-dim,#a0abc0)}.ga-block-current strong{color:var(--text,#e8ecf5)}
    .ga-block-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:11px}.ga-block-actions button{width:100%;min-height:43px;border-radius:12px;border:1px solid rgba(255,255,255,.08);padding:10px 9px;font:900 10px Inter,system-ui,sans-serif;cursor:pointer}.ga-skip-session{background:rgba(240,72,72,.10);color:#ff9b9b;border-color:rgba(240,72,72,.22)!important}.ga-block-report{background:linear-gradient(135deg,rgba(240,196,77,.92),rgba(255,139,73,.88));color:#171a22!important;border:0!important}.ga-block-actions button:disabled{opacity:.38;cursor:not-allowed;filter:grayscale(.35)}
    .ga-block-note{margin-top:8px;font-size:8px;line-height:1.45;color:var(--text-muted,#71809d);text-align:center}.ga-block-error{color:#ff9292!important}.ga-block-ok{color:#61d38b!important}.ga-day-state{display:block;margin-top:2px;font-size:7px;font-weight:950;line-height:1}.ga-day-state.done{color:#61d38b}.ga-day-state.skipped{color:#ff8f8f}.ga-day-state.pending{color:#7f8da8}.ga-day-skipped-banner{display:none;margin:0 0 10px;padding:10px;border-radius:12px;background:rgba(240,72,72,.10);border:1px solid rgba(240,72,72,.22);color:#ffaaaa;font-size:10px;font-weight:900;text-align:center}.ga-day-skipped .ga-day-skipped-banner{display:block}.ga-day-skipped .set-row{opacity:.48;pointer-events:none;filter:grayscale(.25)}
    @media(max-width:370px){.ga-block-panel{margin-left:12px;margin-right:12px}.ga-block-actions{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  function toast(message, error = false) {
    if (window.CoachingCloud?.toast) CoachingCloud.toast(message, error);
    else if (error) alert(message);
  }

  function programObject() {
    try { return typeof P !== 'undefined' && P?.weeks ? P : null; }
    catch (_) { return null; }
  }

  function currentIndices() {
    try {
      if ((cfg.adapter === 'state' || cfg.adapter === 'custom') && typeof state !== 'undefined') return { w: Number(state.w) || 0, d: Number(state.d) || 0 };
      if (cfg.adapter === 'boolean' && typeof W !== 'undefined' && typeof D !== 'undefined') return { w: Number(W) || 0, d: Number(D) || 0 };
      if ((cfg.adapter === 'legacy' || cfg.adapter === 'custom') && typeof S !== 'undefined') return { w: Number(S.w) || 0, d: Number(S.d) || 0 };
    } catch (_) {}
    const weeks = [...document.querySelectorAll('.week-btn')];
    const days = [...document.querySelectorAll('.day-tab')];
    return {
      w: Math.max(0, weeks.findIndex(el => el.classList.contains('active'))),
      d: Math.max(0, days.findIndex(el => el.classList.contains('active')))
    };
  }

  function dayKey(w, d) { return `${Number(w)}|${Number(d)}`; }

  function flattenPlannedSets(day) {
    const result = [];
    let index = 0;
    for (const exercise of day?.exercises || []) {
      for (const block of exercise?.blocks || []) {
        const amount = Math.max(0, Number(block?.s) || 0);
        for (let i = 0; i < amount; i += 1) {
          result.push({
            setIndex: index++,
            code: String(exercise?.l || 'ac'),
            exerciseName: String(exercise?.n || 'Exercice'),
            variant: String(exercise?.v || ''),
            reps: block?.r ?? '',
            percent: block?.pct ?? null,
            prescribedLoad: String(block?.ld ?? '')
          });
        }
      }
    }
    return result;
  }

  function plannedDays() {
    const program = programObject();
    if (!program) return [];
    const result = [];
    (program.weeks || []).forEach((week, w) => {
      (week?.days || []).forEach((day, d) => {
        const sets = flattenPlannedSets(day);
        if (!sets.length) return;
        result.push({
          w,
          d,
          key: dayKey(w, d),
          weekLabel: String(week?.label || `S${w + 1}`),
          dayName: String(day?.name || `Jour ${d + 1}`),
          emoji: String(day?.emoji || ''),
          sets,
          totalSets: sets.length
        });
      });
    });
    return result;
  }

  function exerciseContainer() {
    return document.getElementById('exerciseList') || document.getElementById('exercises');
  }

  function currentDomCompletedCount() {
    const container = exerciseContainer();
    if (!container) return 0;
    return [...container.querySelectorAll('.set-row')].filter(row => {
      const box = row.querySelector('.set-check,.check-btn,[data-cloud-checkbox]');
      return row.classList.contains('completed') || row.classList.contains('done') || box?.classList.contains('checked') || box?.getAttribute('aria-checked') === 'true';
    }).length;
  }

  function statusMap() {
    return new Map(moduleState.statusRows.map(row => [dayKey(row.week_index, row.day_index), row]));
  }

  function setsForDay(w, d) {
    return moduleState.setRows.filter(row => Number(row.week_index) === Number(w) && Number(row.day_index) === Number(d));
  }

  function sessionForDay(w, d) {
    return moduleState.sessionRows.find(row => Number(row.week_index) === Number(w) && Number(row.day_index) === Number(d)) || null;
  }

  function resolvedDay(day) {
    const status = statusMap().get(day.key);
    const remoteCompleted = new Set(setsForDay(day.w, day.d).filter(row => row.completed).map(row => Number(row.set_index))).size;
    const current = currentIndices();
    const completedSets = current.w === day.w && current.d === day.d
      ? Math.max(remoteCompleted, currentDomCompletedCount())
      : remoteCompleted;
    if (status?.status === 'skipped') return { state: 'skipped', completedSets, status };
    if (status?.status === 'completed' || completedSets >= day.totalSets) return { state: 'completed', completedSets: Math.min(day.totalSets, completedSets), status };
    return { state: 'pending', completedSets, status };
  }

  function localDurationSeconds(w, d) {
    const start = Number(localStorage.getItem(`ga-day-start:${cfg.slug}:${cfg.programKey}:${w}:${d}`)) || 0;
    const end = Number(localStorage.getItem(`ga-day-end:${cfg.slug}:${cfg.programKey}:${w}:${d}`)) || 0;
    if (start > 0 && end >= start) return Math.max(0, Math.floor((end - start) / 1000));
    return null;
  }

  function formatDuration(seconds) {
    const value = Math.max(0, Math.floor(Number(seconds) || 0));
    if (!value) return 'Non renseignée';
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    const secs = value % 60;
    if (hours) return `${hours} h ${String(minutes).padStart(2, '0')} min`;
    return `${minutes} min ${String(secs).padStart(2, '0')} s`;
  }

  function ensurePanel() {
    let panel = document.getElementById('gaBlockCompletionPanel');
    if (panel) return panel;
    panel = document.createElement('section');
    panel.id = 'gaBlockCompletionPanel';
    panel.className = 'ga-block-panel';
    panel.innerHTML = `
      <div class="ga-block-head">
        <div><h2>📄 Fin du bloc</h2><p>Chaque journée doit être terminée ou marquée comme skippée.</p></div>
        <span class="ga-block-count" id="gaBlockCount">0 / 0</span>
      </div>
      <div class="ga-block-progress"><span id="gaBlockProgress"></span></div>
      <div class="ga-block-current" id="gaBlockCurrent">Chargement de la progression…</div>
      <div class="ga-block-actions">
        <button type="button" class="ga-skip-session" id="gaSkipSession">⏭️ Skipper la séance (-25 XP)</button>
        <button type="button" class="ga-block-report" id="gaBlockReport" disabled>🔒 Compte rendu PDF du bloc</button>
      </div>
      <div class="ga-block-note" id="gaBlockNote">Le PDF se débloque quand toutes les journées sont clôturées.</div>`;
    const checkin = document.getElementById('gaSessionCheckin');
    const container = exerciseContainer();
    if (checkin) checkin.insertAdjacentElement('afterend', panel);
    else if (container) container.insertAdjacentElement('afterend', panel);
    else document.body.appendChild(panel);
    panel.querySelector('#gaSkipSession')?.addEventListener('click', skipCurrentSession);
    panel.querySelector('#gaBlockReport')?.addEventListener('click', generateBlockReport);
    ensureSkippedBanner();
    return panel;
  }

  function ensureSkippedBanner() {
    const container = exerciseContainer();
    if (!container || container.querySelector('.ga-day-skipped-banner')) return;
    const banner = document.createElement('div');
    banner.className = 'ga-day-skipped-banner';
    banner.textContent = '⏭️ Cette séance a été skippée. Malus appliqué : -25 XP.';
    container.prepend(banner);
  }

  function tabForDay(day) {
    const current = currentIndices();
    if (current.w !== day.w) return null;
    return [...document.querySelectorAll('.day-tab')][day.d] || null;
  }

  function renderDayTabs(days) {
    days.forEach(day => {
      const tab = tabForDay(day);
      if (!tab) return;
      const resolved = resolvedDay(day);
      let badge = tab.querySelector('.ga-day-state');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'ga-day-state';
        tab.appendChild(badge);
      }
      badge.className = `ga-day-state ${resolved.state === 'completed' ? 'done' : resolved.state}`;
      badge.textContent = resolved.state === 'completed' ? 'TERMINÉE' : resolved.state === 'skipped' ? 'SKIPPÉE' : `${resolved.completedSets}/${day.totalSets}`;
    });
  }

  function render() {
    const panel = ensurePanel();
    ensureSkippedBanner();
    const days = plannedDays();
    const resolved = days.map(day => ({ day, ...resolvedDay(day) }));
    const closed = resolved.filter(item => item.state !== 'pending').length;
    const skipped = resolved.filter(item => item.state === 'skipped').length;
    const current = currentIndices();
    const currentDay = days.find(day => day.w === current.w && day.d === current.d);
    const currentResolved = currentDay ? resolvedDay(currentDay) : null;
    const pct = days.length ? Math.round(closed / days.length * 100) : 0;

    const count = panel.querySelector('#gaBlockCount');
    const bar = panel.querySelector('#gaBlockProgress');
    const currentBox = panel.querySelector('#gaBlockCurrent');
    const skipButton = panel.querySelector('#gaSkipSession');
    const reportButton = panel.querySelector('#gaBlockReport');
    const note = panel.querySelector('#gaBlockNote');
    if (count) count.textContent = `${closed} / ${days.length}`;
    if (bar) bar.style.width = `${pct}%`;

    if (currentBox && currentDay && currentResolved) {
      const label = `<strong>${escapeHtml(currentDay.weekLabel)} - ${escapeHtml(currentDay.dayName)}</strong>`;
      if (currentResolved.state === 'skipped') currentBox.innerHTML = `${label}<br><span class="ga-block-error">Séance skippée · ${currentResolved.completedSets}/${currentDay.totalSets} séries enregistrées · -25 XP</span>`;
      else if (currentResolved.state === 'completed') currentBox.innerHTML = `${label}<br><span class="ga-block-ok">Séance terminée · ${currentDay.totalSets}/${currentDay.totalSets} séries</span>`;
      else currentBox.innerHTML = `${label}<br>${currentResolved.completedSets}/${currentDay.totalSets} séries terminées.`;
    }

    const canEdit = !!window.CoachingCloud?.canEditAthlete?.(cfg.slug);
    const lockedByMigration = moduleState.migrationMissing || !moduleState.cloudReady;
    if (skipButton) {
      skipButton.disabled = moduleState.loading || lockedByMigration || !canEdit || !currentDay || currentResolved?.state !== 'pending';
      skipButton.textContent = currentResolved?.state === 'skipped'
        ? '✅ Séance déjà skippée (-25 XP)'
        : currentResolved?.state === 'completed'
          ? '✅ Séance terminée'
          : '⏭️ Skipper la séance (-25 XP)';
    }
    const allClosed = days.length > 0 && closed === days.length;
    if (reportButton) {
      reportButton.disabled = moduleState.loading || lockedByMigration || !allClosed || moduleState.reportBusy;
      reportButton.textContent = moduleState.reportBusy
        ? 'Création du PDF…'
        : allClosed
          ? '📄 Télécharger le compte rendu PDF'
          : `🔒 Compte rendu PDF (${closed}/${days.length})`;
    }
    if (note) {
      note.classList.toggle('ga-block-error', moduleState.migrationMissing);
      note.textContent = moduleState.migrationMissing
        ? 'Migration Supabase requise : exécute le SQL FIN DE BLOC V29.'
        : allClosed
          ? `${days.length} journées clôturées, dont ${skipped} skippée${skipped > 1 ? 's' : ''}. Le PDF est disponible.`
          : `Il reste ${Math.max(0, days.length - closed)} journée${days.length - closed > 1 ? 's' : ''} à terminer ou skipper.`;
    }

    const container = exerciseContainer();
    container?.classList.toggle('ga-day-skipped', currentResolved?.state === 'skipped');
    renderDayTabs(days);
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
  }

  function missingTableError(error) {
    return /workout_day_status|schema cache|does not exist|relation|could not find/i.test(String(error?.message || ''));
  }

  async function loadState({ syncCurrent = false } = {}) {
    if (!moduleState.cloudReady || !window.CoachingCloud?.client || moduleState.loading) return;
    moduleState.loading = true;
    render();
    const client = CoachingCloud.client;
    const base = query => query.eq('athlete_slug', cfg.slug).eq('program_key', String(cfg.programKey));
    const [setsResult, statusResult, sessionsResult] = await Promise.all([
      base(client.from('workout_sets').select('week_index,day_index,set_index,exercise_code,exercise_name,reps,load_kg,rpe,completed,completed_at,prescribed_load_min_kg,prescribed_load_max_kg')),
      base(client.from('workout_day_status').select('athlete_slug,program_key,week_index,day_index,status,duration_seconds,total_sets,completed_sets,xp_penalty,resolved_at,updated_at')),
      base(client.from('workout_sessions').select('week_index,day_index,total_sets,sbd_sets,accessory_sets,started_at,completed_at,actual_seconds,speed_multiplier,speed_bonus'))
    ]);
    moduleState.loading = false;
    if (setsResult.error) console.warn('Chargement des séries du bloc :', setsResult.error.message);
    else moduleState.setRows = setsResult.data || [];
    if (sessionsResult.error) console.warn('Chargement des durées du bloc :', sessionsResult.error.message);
    else moduleState.sessionRows = sessionsResult.data || [];
    if (statusResult.error) {
      moduleState.migrationMissing = missingTableError(statusResult.error);
      if (!moduleState.migrationMissing) console.warn('Chargement des statuts de séance :', statusResult.error.message);
    } else {
      moduleState.migrationMissing = false;
      moduleState.statusRows = statusResult.data || [];
    }
    render();
    if (syncCurrent && !moduleState.migrationMissing) await syncCurrentDayStatus();
  }

  async function setDayStatus(day, status, completedSets) {
    const session = sessionForDay(day.w, day.d);
    const duration = status === 'completed'
      ? (Number(session?.actual_seconds) || localDurationSeconds(day.w, day.d) || null)
      : null;
    const { data, error } = await CoachingCloud.client.rpc('set_workout_day_status_v29', {
      p_athlete_slug: cfg.slug,
      p_athlete_name: cfg.name || cfg.slug,
      p_program_key: String(cfg.programKey),
      p_week_index: day.w,
      p_day_index: day.d,
      p_status: status,
      p_duration_seconds: duration,
      p_total_sets: day.totalSets,
      p_completed_sets: Math.max(0, Number(completedSets) || 0)
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  }

  async function syncCurrentDayStatus() {
    if (!moduleState.cloudReady || moduleState.migrationMissing || !window.CoachingCloud?.canEditAthlete?.(cfg.slug)) return;
    const current = currentIndices();
    const day = plannedDays().find(item => item.w === current.w && item.d === current.d);
    if (!day) return;
    const resolved = resolvedDay(day);
    if (resolved.state === 'skipped') return;
    const stored = statusMap().get(day.key);
    try {
      if (resolved.completedSets >= day.totalSets && stored?.status !== 'completed') {
        await setDayStatus(day, 'completed', day.totalSets);
        await loadState();
      } else if (resolved.completedSets < day.totalSets && stored?.status === 'completed') {
        await setDayStatus(day, 'pending', resolved.completedSets);
        await loadState();
      }
    } catch (error) {
      if (missingTableError(error)) moduleState.migrationMissing = true;
      else console.warn('Mise à jour de la fin de séance :', error.message);
      render();
    }
  }

  async function skipCurrentSession() {
    if (!moduleState.cloudReady || moduleState.migrationMissing || !window.CoachingCloud?.client) return;
    if (!CoachingCloud.canEditAthlete(cfg.slug)) return toast('Ce compte ne peut pas modifier cette programmation.', true);
    const current = currentIndices();
    const day = plannedDays().find(item => item.w === current.w && item.d === current.d);
    if (!day) return;
    const resolved = resolvedDay(day);
    if (resolved.state !== 'pending') return;
    const partial = resolved.completedSets > 0 ? `\n\n${resolved.completedSets} série(s) déjà enregistrée(s) seront conservées dans le compte rendu.` : '';
    const accepted = window.confirm(`Marquer ${day.weekLabel} - ${day.dayName} comme séance skippée ?\n\nCette action clôture la journée et applique un malus unique de -25 XP.${partial}`);
    if (!accepted) return;
    moduleState.loading = true;
    render();
    try {
      const result = await setDayStatus(day, 'skipped', resolved.completedSets);
      const delta = Number(result?.xp_delta);
      toast(`Séance skippée. Malus appliqué : ${Number.isFinite(delta) ? delta : -25} XP.`);
      await loadState();
    } catch (error) {
      moduleState.loading = false;
      if (missingTableError(error)) moduleState.migrationMissing = true;
      toast(`Impossible de skipper la séance : ${error.message}`, true);
      render();
    }
  }

  function cleanPdfText(value) {
    return String(value ?? '')
      .replace(/œ/g, 'oe').replace(/Œ/g, 'OE')
      .replace(/[’‘]/g, "'").replace(/[“”]/g, '"')
      .replace(/[–—]/g, '-').replace(/…/g, '...')
      .replace(/×/g, 'x').replace(/·/g, '-')
      .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
      .replace(/\s+/g, ' ').trim();
  }

  function pdfEscape(text) {
    return cleanPdfText(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }

  function splitWords(text, maxChars) {
    const words = cleanPdfText(text).split(/\s+/).filter(Boolean);
    const lines = [];
    let current = '';
    for (const word of words) {
      if (!current) current = word;
      else if ((current + ' ' + word).length <= maxChars) current += ' ' + word;
      else { lines.push(current); current = word; }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [''];
  }

  function createPdfDocument() {
    const pages = [[]];
    let pageIndex = 0;
    function page() { return pages[pageIndex]; }
    function addPage() { pages.push([]); pageIndex += 1; }
    function text(value, x, y, size = 10, bold = false) {
      page().push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${pdfEscape(value)}) Tj ET`);
    }
    function line(x1, y1, x2, y2) { page().push(`q 0.78 G ${x1} ${y1} m ${x2} ${y2} l S Q`); }
    function blob() {
      pages.forEach((commands, index) => {
        commands.push(`BT /F1 8 Tf 44 24 Td (Page ${index + 1} / ${pages.length}) Tj ET`);
      });
      const objects = [];
      objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
      const pageObjectNumbers = [];
      objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
      objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
      let nextObject = 5;
      pages.forEach(commands => {
        const pageObject = nextObject++;
        const contentObject = nextObject++;
        pageObjectNumbers.push(pageObject);
        const stream = commands.join('\n');
        objects[pageObject] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObject} 0 R >>`;
        objects[contentObject] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
      });
      objects[2] = `<< /Type /Pages /Kids [${pageObjectNumbers.map(number => `${number} 0 R`).join(' ')}] /Count ${pages.length} >>`;
      let output = '%PDF-1.4\n%âãÏÓ\n';
      const offsets = [0];
      for (let i = 1; i < objects.length; i += 1) {
        offsets[i] = output.length;
        output += `${i} 0 obj\n${objects[i]}\nendobj\n`;
      }
      const xref = output.length;
      output += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
      for (let i = 1; i < objects.length; i += 1) output += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
      output += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
      const bytes = new Uint8Array(output.length);
      for (let i = 0; i < output.length; i += 1) bytes[i] = output.charCodeAt(i) & 255;
      return new Blob([bytes], { type: 'application/pdf' });
    }
    return { pages, addPage, text, line, blob };
  }

  function numberLabel(value, suffix = '') {
    const n = Number(value);
    return Number.isFinite(n) ? `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n)}${suffix}` : 'Non renseigné';
  }

  async function fetchReportData() {
    const client = CoachingCloud.client;
    const base = query => query.eq('athlete_slug', cfg.slug).eq('program_key', String(cfg.programKey));
    const [setsResult, checkinsResult, statusResult, sessionsResult] = await Promise.all([
      base(client.from('workout_sets').select('week_index,day_index,set_index,exercise_code,exercise_name,reps,load_kg,rpe,completed,completed_at,prescribed_load_min_kg,prescribed_load_max_kg')),
      base(client.from('workout_checkins').select('week_index,day_index,hydration_liters,upper_pain,lower_pain,sleep_hours,steps,notes,updated_at')),
      base(client.from('workout_day_status').select('week_index,day_index,status,duration_seconds,total_sets,completed_sets,xp_penalty,resolved_at,updated_at')),
      base(client.from('workout_sessions').select('week_index,day_index,total_sets,sbd_sets,accessory_sets,started_at,completed_at,actual_seconds,speed_multiplier,speed_bonus'))
    ]);
    const error = setsResult.error || checkinsResult.error || statusResult.error;
    if (error) throw error;
    return {
      sets: setsResult.data || [],
      checkins: checkinsResult.data || [],
      statuses: statusResult.data || [],
      sessions: sessionsResult.error ? [] : (sessionsResult.data || [])
    };
  }

  function reportModel(raw) {
    const days = plannedDays();
    const statusByDay = new Map(raw.statuses.map(row => [dayKey(row.week_index, row.day_index), row]));
    const checkinByDay = new Map(raw.checkins.map(row => [dayKey(row.week_index, row.day_index), row]));
    const sessionByDay = new Map(raw.sessions.map(row => [dayKey(row.week_index, row.day_index), row]));
    return days.map(day => {
      const rows = raw.sets.filter(row => Number(row.week_index) === day.w && Number(row.day_index) === day.d);
      const rowByIndex = new Map(rows.map(row => [Number(row.set_index), row]));
      const status = statusByDay.get(day.key);
      const session = sessionByDay.get(day.key);
      const completedSets = Math.min(day.totalSets, rows.filter(row => row.completed).length);
      const finalStatus = status?.status === 'skipped' ? 'skipped' : completedSets >= day.totalSets || status?.status === 'completed' ? 'completed' : 'pending';
      const dateValue = status?.resolved_at || session?.completed_at || rows.filter(row => row.completed_at).map(row => row.completed_at).sort().at(-1) || null;
      const duration = Number(status?.duration_seconds) || Number(session?.actual_seconds) || (() => {
        const stamps = rows.filter(row => row.completed_at).map(row => new Date(row.completed_at).getTime()).filter(Number.isFinite).sort((a,b) => a-b);
        return stamps.length > 1 ? Math.max(0, Math.floor((stamps.at(-1) - stamps[0]) / 1000)) : 0;
      })();
      return {
        ...day,
        status: finalStatus,
        statusRow: status,
        checkin: checkinByDay.get(day.key) || {},
        session,
        completedSets,
        dateValue,
        duration,
        performedSets: day.sets.map(planned => ({ ...planned, remote: rowByIndex.get(planned.setIndex) || null }))
      };
    });
  }

  function buildBlockPdf(days) {
    const pdf = createPdfDocument();
    const margin = 44;
    const maxY = 797;
    const minY = 54;
    let y = maxY;
    const newPage = () => { pdf.addPage(); y = maxY; };
    const ensure = height => { if (y - height < minY) newPage(); };
    const addLine = (text, { size = 10, bold = false, gap = 14, indent = 0, maxChars = 92 } = {}) => {
      const lines = splitWords(text, maxChars);
      ensure(lines.length * gap + 2);
      lines.forEach(line => { pdf.text(line, margin + indent, y, size, bold); y -= gap; });
    };
    const addHeading = text => { ensure(34); pdf.text(text, margin, y, 15, true); y -= 9; pdf.line(margin, y, 551, y); y -= 17; };

    const completed = days.filter(day => day.status === 'completed').length;
    const skipped = days.filter(day => day.status === 'skipped').length;
    const totalSets = days.reduce((sum, day) => sum + day.totalSets, 0);
    const completedSets = days.reduce((sum, day) => sum + day.completedSets, 0);

    addLine('GA COACHING - COMPTE RENDU DE FIN DE BLOC', { size: 18, bold: true, gap: 24, maxChars: 60 });
    addLine(`Athlète : ${cfg.name || cfg.slug}`, { size: 13, bold: true, gap: 19 });
    addLine(`Programme : ${cfg.programKey}`, { size: 10 });
    addLine(`Généré le : ${new Date().toLocaleString('fr-FR')}`, { size: 10 });
    y -= 8;
    addHeading('Résumé du bloc');
    addLine(`Journées prévues : ${days.length}`);
    addLine(`Journées terminées : ${completed}`);
    addLine(`Journées skippées : ${skipped}`);
    addLine(`Malus XP lié aux skips : -${skipped * 25} XP`);
    addLine(`Séries enregistrées : ${completedSets} / ${totalSets}`);
    y -= 8;
    addLine('Le détail de chaque séance figure dans les pages suivantes.', { size: 10, bold: true });

    days.forEach((day, dayIndex) => {
      newPage();
      addLine(`${day.weekLabel} - ${day.dayName}`, { size: 17, bold: true, gap: 23, maxChars: 65 });
      const statusLabel = day.status === 'skipped' ? 'SKIPPÉE (-25 XP)' : day.status === 'completed' ? 'TERMINÉE' : 'INCOMPLÈTE';
      addLine(`Statut : ${statusLabel}`, { size: 11, bold: true });
      addLine(`Date : ${day.dateValue ? new Date(day.dateValue).toLocaleString('fr-FR') : 'Non renseignée'}`);
      addLine(`Durée : ${formatDuration(day.duration)}`);
      addLine(`Séries réalisées : ${day.completedSets} / ${day.totalSets}`);
      y -= 5;
      addHeading('Bilan de séance');
      addLine(`Hydratation : ${numberLabel(day.checkin?.hydration_liters, ' L')}`);
      addLine(`Sommeil : ${numberLabel(day.checkin?.sleep_hours, ' h')}`);
      addLine(`Douleur upper : ${numberLabel(day.checkin?.upper_pain, '/10')}`);
      addLine(`Douleur lower : ${numberLabel(day.checkin?.lower_pain, '/10')}`);
      addLine(`Steps : ${numberLabel(day.checkin?.steps, ' pas')}`);
      addLine(`Notes : ${day.checkin?.notes ? String(day.checkin.notes) : 'Aucune note'}`, { maxChars: 88 });
      y -= 5;
      addHeading('Détail des séries');
      day.performedSets.forEach((set, index) => {
        const remote = set.remote || {};
        const done = remote.completed ? 'OK' : day.status === 'skipped' ? 'NON FAITE' : 'INCOMPLÈTE';
        const variant = set.variant ? ` - ${set.variant}` : '';
        const prescribed = [set.reps ? `${set.reps} reps` : '', set.percent !== null ? `${set.percent} %` : '', set.prescribedLoad ? `cible ${set.prescribedLoad}` : ''].filter(Boolean).join(' - ');
        const actual = [remote.load_kg !== null && remote.load_kg !== undefined ? `${remote.load_kg} kg` : '', remote.rpe !== null && remote.rpe !== undefined ? `RPE ${remote.rpe}` : ''].filter(Boolean).join(' - ') || 'aucune donnée';
        addLine(`${index + 1}. [${done}] ${set.exerciseName}${variant}`, { bold: true, size: 9, gap: 12, maxChars: 86 });
        addLine(`Prévu : ${prescribed || 'non renseigné'} | Réalisé : ${actual}`, { size: 8, gap: 11, indent: 12, maxChars: 104 });
      });
      if (dayIndex === days.length - 1) {
        y -= 6;
        addLine('Fin du compte rendu.', { bold: true });
      }
    });
    return pdf.blob();
  }

  function safeFilename(value) {
    return cleanPdfText(value).toLowerCase().replace(/[^a-z0-9à-ÿ]+/gi, '-').replace(/^-+|-+$/g, '') || 'athlete';
  }

  function deliverPdf(blob) {
    const filename = `compte-rendu-${safeFilename(cfg.name || cfg.slug)}-${safeFilename(cfg.programKey)}.pdf`;
    const url = URL.createObjectURL(blob);
    const isIOS = /iPad|iPhone|iPod/i.test(navigator.userAgent || '');
    if (isIOS) {
      const opened = window.open(url, '_blank');
      if (!opened) {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
      }
    } else {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 120000);
  }

  async function generateBlockReport() {
    if (moduleState.reportBusy) return;
    const days = plannedDays();
    const allClosed = days.length > 0 && days.every(day => resolvedDay(day).state !== 'pending');
    if (!allClosed) return toast('Le compte rendu se débloque lorsque toutes les journées sont terminées ou skippées.', true);
    moduleState.reportBusy = true;
    render();
    try {
      const raw = await fetchReportData();
      const model = reportModel(raw);
      if (model.some(day => day.status === 'pending')) throw new Error('Au moins une journée n’est pas encore clôturée.');
      const blob = buildBlockPdf(model);
      deliverPdf(blob);
      toast('Compte rendu PDF du bloc généré.');
    } catch (error) {
      if (missingTableError(error)) moduleState.migrationMissing = true;
      toast(`Création du PDF impossible : ${error.message}`, true);
    } finally {
      moduleState.reportBusy = false;
      render();
    }
  }

  function scheduleRefresh(syncCurrent = false, delay = 450) {
    clearTimeout(moduleState.refreshTimer);
    moduleState.refreshTimer = setTimeout(() => loadState({ syncCurrent }), delay);
  }

  document.addEventListener('click', event => {
    if (event.target.closest('.set-check,.check-btn,[data-cloud-checkbox]')) scheduleRefresh(true, 850);
    if (event.target.closest('.week-btn,.day-tab')) scheduleRefresh(false, 180);
  }, true);

  const observer = new MutationObserver(() => {
    ensurePanel();
    ensureSkippedBanner();
    const key = dayKey(currentIndices().w, currentIndices().d);
    if (key !== moduleState.lastCurrentKey) {
      moduleState.lastCurrentKey = key;
      scheduleRefresh(false, 120);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  ensurePanel();
  render();
  if (window.CoachingCloud?.onReady) {
    CoachingCloud.onReady(() => {
      moduleState.cloudReady = true;
      loadState({ syncCurrent: true });
    });
  }
  window.GABlockReport = { build: BUILD, refresh: () => loadState({ syncCurrent: true }), generate: generateBlockReport };
})();

/* ============================================================
   V127 — FIL PR PERMANENT
   - historique d'équipe séparé de l'activité générale ;
   - chaque nouveau PR reste conservé dans public.pr_history ;
   - ancien PR, date et durée de règne ;
   - PR automatiques et saisies manuelles.
   ============================================================ */
(function () {
  'use strict';

  const cfg = window.COACHING_ATHLETE || {};
  if (!cfg.slug) return;

  const PAGE_SIZE = 50;
  const pendingKey = `ga-pr-history-pending-v127-${cfg.slug}`;
  let historyRows = [];
  let historyOffset = 0;
  let historyHasMore = true;
  let historyLoading = false;
  let historyChannel = null;
  let currentFilter = 'all';
  let autoWrapped = false;
  let manualBound = false;

  const liftLabels = { sq: 'Squat', bn: 'Bench', dl: 'Deadlift' };
  const liftIcons = { sq: '🟥', bn: '🟦', dl: '🟪' };

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function fr(value, digits = 2) {
    const n = num(value);
    return n === null ? '—' : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits }).format(n);
  }

  function isoDate(value, fallbackNow = true) {
    if (!value) return fallbackNow ? new Date().toISOString() : null;
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? (fallbackNow ? new Date().toISOString() : null) : d.toISOString();
  }

  function parseLegacyDate(value) {
    const text = String(value || '').trim();
    if (!text) return null;
    const direct = isoDate(text, false);
    if (direct) return direct;
    const match = text.match(/^(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?$/);
    if (!match) return null;
    const day = Number(match[1]);
    const month = Number(match[2]);
    let year = match[3] ? Number(match[3]) : new Date().getFullYear();
    if (year < 100) year += 2000;
    const d = new Date(year, month - 1, day, 12, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  function formatDate(value, withTime = false) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return 'Date inconnue';
    return new Intl.DateTimeFormat('fr-FR', withTime
      ? { dateStyle: 'long', timeStyle: 'short' }
      : { dateStyle: 'long' }).format(date);
  }

  function durationSeconds(previousAt, achievedAt, explicit) {
    const stored = num(explicit);
    if (stored !== null && stored >= 0) return stored;
    const before = previousAt ? new Date(previousAt) : null;
    const after = achievedAt ? new Date(achievedAt) : null;
    if (!before || !after || Number.isNaN(before.getTime()) || Number.isNaN(after.getTime()) || after < before) return null;
    return Math.floor((after.getTime() - before.getTime()) / 1000);
  }

  function humanDuration(seconds) {
    const totalDays = Math.floor(Number(seconds) / 86400);
    if (!Number.isFinite(totalDays) || totalDays < 0) return 'durée inconnue';
    if (totalDays === 0) return 'moins d’un jour';
    const years = Math.floor(totalDays / 365);
    const months = Math.floor((totalDays % 365) / 30);
    const days = (totalDays % 365) % 30;
    const parts = [];
    if (years) parts.push(`${years} an${years > 1 ? 's' : ''}`);
    if (months) parts.push(`${months} mois`);
    if (days || !parts.length) parts.push(`${days} jour${days > 1 ? 's' : ''}`);
    return parts.slice(0, 2).join(' et ');
  }

  function readPending() {
    try {
      const rows = JSON.parse(localStorage.getItem(pendingKey) || '[]');
      return Array.isArray(rows) ? rows : [];
    } catch (error) {
      console.warn('Historique PR local illisible :', error);
      return [];
    }
  }

  function writePending(rows) {
    try {
      localStorage.setItem(pendingKey, JSON.stringify(rows));
    } catch (error) {
      console.warn('Historique PR local non sauvegardé :', error);
    }
  }

  function queueEvent(event) {
    const pending = readPending();
    const next = pending.filter(row => row.sourceKey !== event.sourceKey);
    next.push(event);
    writePending(next.slice(-100));
  }

  function removePending(sourceKey) {
    writePending(readPending().filter(row => row.sourceKey !== sourceKey));
  }

  function exerciseSeriesNumber(meta) {
    try {
      const container = document.getElementById('exerciseList') || document.getElementById('exercises');
      const row = container?.querySelectorAll('.set-row')?.[Number(meta?.idx)];
      const block = row?.closest('.exercise-block');
      if (!row || !block) return null;
      const blockRows = [...block.querySelectorAll('.set-row')];
      const index = blockRows.indexOf(row);
      return index >= 0 ? index + 1 : null;
    } catch (_) {
      return null;
    }
  }

  function normalizeHistoryEvent(raw) {
    const achievedAt = isoDate(raw.achievedAt);
    const previousAt = isoDate(raw.previousAchievedAt, false);
    const previousLoad = num(raw.previousLoad);
    const newLoad = num(raw.newLoad);
    const reps = Math.max(1, Math.min(10, Number(raw.reps) || 1));
    const code = ['sq', 'bn', 'dl'].includes(raw.code) ? raw.code : 'sq';
    return {
      sourceKey: String(raw.sourceKey || '').trim(),
      athleteSlug: String(raw.athleteSlug || cfg.slug),
      athleteName: String(raw.athleteName || cfg.name || cfg.slug),
      athleteEmoji: String(raw.athleteEmoji || cfg.emoji || '🏋️'),
      exerciseCode: code,
      exerciseName: String(raw.exerciseName || liftLabels[code]),
      setLabel: String(raw.setLabel || 'Série enregistrée'),
      reps,
      newLoad,
      previousLoad,
      achievedAt,
      previousAchievedAt: previousAt,
      previousDurationSeconds: durationSeconds(previousAt, achievedAt, raw.previousDurationSeconds),
      programKey: raw.programKey == null ? null : String(raw.programKey),
      weekIndex: num(raw.weekIndex),
      weekLabel: raw.weekLabel == null ? null : String(raw.weekLabel),
      dayIndex: num(raw.dayIndex),
      dayName: raw.dayName == null ? null : String(raw.dayName),
      setIndex: num(raw.setIndex),
      sourceLabel: String(raw.sourceLabel || 'GA Coaching App')
    };
  }

  async function sendHistoryEvent(raw, options = {}) {
    const event = normalizeHistoryEvent(raw);
    if (!event.sourceKey || !(event.newLoad > 0)) return false;
    const client = window.CoachingCloud?.client;
    const user = window.CoachingCloud?.session?.user;
    if (!client || !user) {
      if (options.queue !== false) queueEvent(event);
      return false;
    }

    const { error } = await client.rpc('record_pr_history', {
      p_source_key: event.sourceKey,
      p_athlete_slug: event.athleteSlug,
      p_athlete_name: event.athleteName,
      p_athlete_emoji: event.athleteEmoji,
      p_exercise_code: event.exerciseCode,
      p_exercise_name: event.exerciseName,
      p_set_label: event.setLabel,
      p_reps: event.reps,
      p_new_load_kg: event.newLoad,
      p_previous_load_kg: event.previousLoad,
      p_achieved_at: event.achievedAt,
      p_previous_achieved_at: event.previousAchievedAt,
      p_program_key: event.programKey,
      p_week_index: event.weekIndex,
      p_week_label: event.weekLabel,
      p_day_index: event.dayIndex,
      p_day_name: event.dayName,
      p_set_index: event.setIndex,
      p_source_label: event.sourceLabel
    });

    if (error) {
      console.warn('Historique PR non synchronisé :', error.message);
      if (options.queue !== false) queueEvent(event);
      return false;
    }
    removePending(event.sourceKey);
    if (document.getElementById('prHistoryView')?.classList.contains('show')) {
      await loadHistory(true);
    }
    return true;
  }

  async function flushPending() {
    const pending = readPending();
    for (const event of pending) {
      const ok = await sendHistoryEvent(event, { queue: false });
      if (ok) removePending(event.sourceKey);
      else break;
    }
  }

  function historyCard(row) {
    const code = row.exercise_code || 'sq';
    const newLoad = num(row.new_load_kg);
    const oldLoad = num(row.previous_load_kg);
    const achievedAt = row.achieved_at;
    const previousAt = row.previous_achieved_at;
    const held = durationSeconds(previousAt, achievedAt, row.previous_pr_duration_seconds);
    const context = [row.week_label, row.day_name, row.exercise_name, row.set_label].filter(Boolean).join(' · ');
    const manual = /manuelle/i.test(String(row.source_label || ''));
    const previousText = oldLoad > 0
      ? `Ancien PR : <strong>${fr(oldLoad)} kg</strong>${previousAt ? `, établi le ${esc(formatDate(previousAt))}` : ''}. Il avait tenu <strong>${esc(humanDuration(held))}</strong>.`
      : 'Premier PR enregistré pour ce mouvement et ce nombre de répétitions.';
    return `<article class="pr-history-card" data-pr-code="${esc(code)}">
      <div class="pr-history-avatar">${esc(row.athlete_emoji || '🏋️')}</div>
      <div class="pr-history-body">
        <div class="pr-history-kicker">${manual ? '✍️ SAISIE MANUELLE' : '⚡ PR VALIDÉ EN SÉANCE'} · ${esc(liftIcons[code] || '🏆')} ${esc(liftLabels[code] || code)}</div>
        <div class="pr-history-title"><strong>${esc(row.athlete_name || row.athlete_slug || 'Athlète')}</strong> a établi un nouveau PR</div>
        <div class="pr-history-performance"><span>${esc(String(row.reps || 1))} rep${Number(row.reps) > 1 ? 's' : ''}</span><b>${esc(fr(newLoad))} kg</b>${oldLoad > 0 ? `<em>+${esc(fr(newLoad - oldLoad))} kg</em>` : ''}</div>
        <div class="pr-history-previous">${previousText}</div>
        ${context ? `<div class="pr-history-context">${esc(context)}</div>` : ''}
        <div class="pr-history-date">Réalisé le <strong>${esc(formatDate(achievedAt, true))}</strong></div>
      </div>
    </article>`;
  }

  function renderHistory() {
    const list = document.getElementById('prHistoryList');
    const more = document.getElementById('prHistoryMore');
    if (!list) return;
    const filtered = currentFilter === 'all'
      ? historyRows
      : historyRows.filter(row => row.exercise_code === currentFilter);
    if (!filtered.length) {
      list.innerHTML = `<div class="pr-history-empty">Aucun PR permanent enregistré${currentFilter === 'all' ? '' : ` pour le ${esc(liftLabels[currentFilter])}`} pour le moment.</div>`;
    } else {
      list.innerHTML = filtered.map(historyCard).join('');
    }
    if (more) {
      more.hidden = !historyHasMore;
      more.disabled = historyLoading;
      more.textContent = historyLoading ? 'Chargement…' : 'Afficher les PR plus anciens';
    }
  }

  async function loadHistory(reset = false) {
    if (historyLoading) return;
    const client = window.CoachingCloud?.client;
    const user = window.CoachingCloud?.session?.user;
    const list = document.getElementById('prHistoryList');
    if (!client || !user) {
      if (list) list.innerHTML = '<div class="pr-history-empty">Connecte-toi pour afficher le fil permanent des PR.</div>';
      return;
    }
    if (reset) {
      historyRows = [];
      historyOffset = 0;
      historyHasMore = true;
    }
    if (!historyHasMore) return;
    historyLoading = true;
    renderHistory();
    const from = historyOffset;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await client
      .from('pr_history')
      .select('id,source_key,athlete_slug,athlete_name,athlete_emoji,exercise_code,exercise_name,set_label,reps,new_load_kg,previous_load_kg,achieved_at,previous_achieved_at,previous_pr_duration_seconds,program_key,week_index,week_label,day_index,day_name,set_index,source_label,created_at')
      .order('achieved_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to);
    historyLoading = false;
    if (error) {
      console.warn('Fil PR indisponible :', error.message);
      if (list) list.innerHTML = `<div class="pr-history-empty error">Le fil PR permanent n’est pas encore installé dans Supabase.<br>Exécute le SQL V127.</div>`;
      const more = document.getElementById('prHistoryMore');
      if (more) more.hidden = true;
      return;
    }
    const known = new Set(historyRows.map(row => String(row.id)));
    (data || []).forEach(row => {
      if (!known.has(String(row.id))) historyRows.push(row);
    });
    historyOffset += (data || []).length;
    historyHasMore = (data || []).length === PAGE_SIZE;
    renderHistory();
    ensureHistoryChannel();
  }

  function ensureHistoryChannel() {
    const client = window.CoachingCloud?.client;
    if (!client || historyChannel) return;
    historyChannel = client
      .channel('ga-pr-history-v127')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pr_history' }, () => loadHistory(true))
      .subscribe();
  }

  function switchPrView(mode) {
    const feed = document.getElementById('prHistoryView');
    const records = document.getElementById('prRecordsView');
    if (!feed || !records) return;
    const showFeed = mode !== 'records';
    feed.classList.toggle('show', showFeed);
    records.classList.toggle('show', !showFeed);
    document.querySelectorAll('[data-pr-history-view]').forEach(button => {
      button.classList.toggle('active', button.dataset.prHistoryView === (showFeed ? 'feed' : 'records'));
    });
    if (showFeed) loadHistory(true);
  }

  function enhancePrPanel() {
    const panel = document.getElementById('prPanel');
    if (!panel) return false;
    if (document.getElementById('prHistoryView')) return true;
    const head = panel.querySelector('.pr-panel-head');
    const source = document.getElementById('prSource');
    const manualToggle = document.getElementById('prManualToggle');
    const manualForm = document.getElementById('prManualForm');
    const content = document.getElementById('prPanelContent');
    if (!head || !source || !manualToggle || !manualForm || !content) return false;

    head.querySelector('h2').textContent = '🏆 PR de l’équipe';
    const switcher = document.createElement('div');
    switcher.className = 'pr-history-switch';
    switcher.innerHTML = `<button type="button" class="active" data-pr-history-view="feed">🔔 Fil des PR</button><button type="button" data-pr-history-view="records">📊 Mes records</button>`;
    head.after(switcher);

    const feed = document.createElement('div');
    feed.id = 'prHistoryView';
    feed.className = 'pr-history-view show';
    feed.innerHTML = `
      <div class="pr-history-intro">Chaque record reste archivé définitivement, même lorsqu’il est battu plus tard.</div>
      <div class="pr-history-filters"><button type="button" class="active" data-pr-history-filter="all">Tous</button><button type="button" data-pr-history-filter="sq">Squat</button><button type="button" data-pr-history-filter="bn">Bench</button><button type="button" data-pr-history-filter="dl">Deadlift</button></div>
      <div id="prHistoryList"><div class="pr-history-empty">Chargement des PR…</div></div>
      <button type="button" id="prHistoryMore" class="pr-history-more" hidden>Afficher les PR plus anciens</button>`;
    switcher.after(feed);

    const records = document.createElement('div');
    records.id = 'prRecordsView';
    records.className = 'pr-records-view';
    records.append(source, manualToggle, manualForm, content);
    feed.after(records);

    switcher.addEventListener('click', event => {
      const button = event.target.closest('[data-pr-history-view]');
      if (button) switchPrView(button.dataset.prHistoryView);
    });
    feed.querySelector('.pr-history-filters')?.addEventListener('click', event => {
      const button = event.target.closest('[data-pr-history-filter]');
      if (!button) return;
      currentFilter = button.dataset.prHistoryFilter || 'all';
      feed.querySelectorAll('[data-pr-history-filter]').forEach(item => item.classList.toggle('active', item === button));
      renderHistory();
    });
    document.getElementById('prHistoryMore')?.addEventListener('click', () => loadHistory(false));

    document.addEventListener('click', event => {
      if (event.target.closest('.pr-nav,[data-ga-pr-nav="1"]')) setTimeout(() => switchPrView('feed'), 30);
    }, true);
    return true;
  }

  function installStyle() {
    if (document.getElementById('prHistoryStyleV127')) return;
    const style = document.createElement('style');
    style.id = 'prHistoryStyleV127';
    style.textContent = `
      .pr-history-switch{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:0 0 11px;padding:4px;border:1px solid rgba(255,255,255,.07);border-radius:13px;background:var(--surface,#0e1421)}
      .pr-history-switch button,.pr-history-filters button{border:0;border-radius:9px;padding:9px 7px;background:transparent;color:var(--text-dim,#a0abc0);font:inherit;font-size:10px;font-weight:900;cursor:pointer}.pr-history-switch button.active,.pr-history-filters button.active{background:var(--surface-2,#141c2d);color:var(--accent-light,var(--accent,#f0c44d));box-shadow:0 4px 14px rgba(0,0,0,.18)}
      .pr-history-view,.pr-records-view{display:none}.pr-history-view.show,.pr-records-view.show{display:block}.pr-history-intro{margin-bottom:10px;padding:10px 11px;border:1px solid rgba(240,196,77,.14);border-radius:12px;background:rgba(240,196,77,.055);color:var(--text-dim,#a0abc0);font-size:10px;line-height:1.45}.pr-history-filters{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-bottom:10px}
      #prHistoryList{display:flex;flex-direction:column;gap:9px}.pr-history-card{display:flex;gap:10px;padding:12px;border:1px solid rgba(255,255,255,.07);border-radius:15px;background:linear-gradient(145deg,rgba(240,196,77,.055),rgba(141,20,32,.04)),var(--surface,#0e1421);box-shadow:0 8px 22px rgba(0,0,0,.16)}.pr-history-avatar{width:39px;height:39px;flex:none;display:flex;align-items:center;justify-content:center;border:1px solid rgba(240,196,77,.18);border-radius:11px;background:var(--surface-2,#141c2d);font-size:20px}.pr-history-body{min-width:0;flex:1}.pr-history-kicker{font-size:8px;font-weight:900;letter-spacing:.06em;color:var(--accent,#f0c44d)}.pr-history-title{margin-top:3px;font-size:12px;line-height:1.35}.pr-history-performance{display:flex;align-items:baseline;gap:7px;margin-top:8px}.pr-history-performance span{padding:4px 7px;border-radius:7px;background:rgba(255,255,255,.055);font-size:9px;font-weight:900}.pr-history-performance b{font-size:20px;color:var(--text,#eef2f7)}.pr-history-performance em{font-style:normal;font-size:9px;font-weight:900;color:#70d19b}.pr-history-previous{margin-top:7px;color:var(--text-dim,#a0abc0);font-size:9px;line-height:1.45}.pr-history-previous strong{color:var(--text,#eef2f7)}.pr-history-context{margin-top:7px;padding-top:7px;border-top:1px solid rgba(255,255,255,.05);color:var(--text-muted,#6c7892);font-size:8.5px;line-height:1.35}.pr-history-date{margin-top:5px;color:var(--text-muted,#6c7892);font-size:8.5px}.pr-history-date strong{color:var(--text-dim,#a0abc0)}.pr-history-empty{padding:28px 14px;text-align:center;border:1px dashed rgba(255,255,255,.09);border-radius:14px;color:var(--text-muted,#6c7892);font-size:10px;line-height:1.55}.pr-history-empty.error{color:#ff8a91}.pr-history-more{width:100%;margin-top:10px;border:1px solid rgba(255,255,255,.08);border-radius:11px;padding:10px;background:var(--surface-2,#141c2d);color:var(--text,#eef2f7);font:inherit;font-size:10px;font-weight:900;cursor:pointer}
      @media(max-width:360px){.pr-history-performance{flex-wrap:wrap}.pr-history-card{padding:10px}.pr-history-filters button{font-size:9px}}
    `;
    document.head.appendChild(style);
  }

  function wrapAutomaticPr() {
    if (autoWrapped || !window.CoachingPR?.registerIfBetter) return false;
    const original = window.CoachingPR.registerIfBetter.bind(window.CoachingPR);
    window.CoachingPR.registerIfBetter = async function (meta, achievedAt) {
      const reps = Math.max(1, Math.min(10, Number(meta?.reps) || 1));
      const before = window.CoachingPR.recordFor?.(meta?.code, reps) || null;
      const result = await original(meta, achievedAt);
      if (result?.isPr) {
        const when = isoDate(achievedAt);
        const seriesNumber = exerciseSeriesNumber(meta);
        const previousAt = result.previousAchievedAt || before?.achievedAt || parseLegacyDate(before?.label);
        result.previousAchievedAt = previousAt;
        result.achievedAt = when;
        await sendHistoryEvent({
          sourceKey: `auto|${cfg.slug}|${cfg.programKey || 'programme'}|${meta?.w ?? 0}|${meta?.d ?? 0}|${meta?.idx ?? 0}|${reps}|${result.newLoad}|${when}`,
          code: meta?.code,
          exerciseName: meta?.exerciseName || liftLabels[meta?.code],
          setLabel: seriesNumber ? `Série ${seriesNumber}` : `Série ${Number(meta?.idx || 0) + 1}`,
          reps,
          newLoad: result.newLoad,
          previousLoad: result.previousLoad ?? before?.load ?? null,
          achievedAt: when,
          previousAchievedAt: previousAt,
          programKey: cfg.programKey,
          weekIndex: meta?.w,
          weekLabel: meta?.weekLabel,
          dayIndex: meta?.d,
          dayName: meta?.dayName,
          setIndex: meta?.idx,
          sourceLabel: 'PR automatique en séance'
        });
      }
      return result;
    };
    autoWrapped = true;
    return true;
  }

  function bindManualPrHistory() {
    if (manualBound) return true;
    const form = document.getElementById('prManualForm');
    if (!form || !window.CoachingPR?.recordFor) return false;
    form.addEventListener('submit', event => {
      if (event.defaultPrevented) return;
      const code = document.getElementById('prManualLift')?.value;
      const reps = Number(document.getElementById('prManualReps')?.value);
      const load = Number(String(document.getElementById('prManualLoad')?.value || '').trim().replace(',', '.'));
      const dateValue = document.getElementById('prManualDate')?.value || '';
      if (!['sq', 'bn', 'dl'].includes(code) || !(reps >= 1 && reps <= 10) || !(load > 0)) return;
      const before = window.CoachingPR.recordFor(code, reps);
      const achievedAt = dateValue ? isoDate(`${dateValue}T12:00:00`) : new Date().toISOString();
      const previousAt = before?.achievedAt || parseLegacyDate(before?.label);
      const sameLoad = before && Number(before.load) === load;
      const sameDate = before && isoDate(before.achievedAt, false) === achievedAt;
      if (sameLoad && sameDate) return;
      setTimeout(() => sendHistoryEvent({
        sourceKey: `manual|${cfg.slug}|${code}|${reps}|${load}|${achievedAt}`,
        code,
        exerciseName: liftLabels[code],
        setLabel: 'Saisie manuelle',
        reps,
        newLoad: load,
        previousLoad: before?.load ?? null,
        achievedAt,
        previousAchievedAt: previousAt,
        programKey: cfg.programKey,
        sourceLabel: 'Saisie manuelle'
      }), 0);
    }, true);
    manualBound = true;
    return true;
  }

  function boot() {
    installStyle();
    const ready = enhancePrPanel();
    wrapAutomaticPr();
    bindManualPrHistory();
    if (!ready || !autoWrapped || !manualBound) setTimeout(boot, 150);
  }

  boot();
  if (window.CoachingCloud?.onReady) {
    window.CoachingCloud.onReady(async () => {
      await flushPending();
      if (document.getElementById('prHistoryView')) await loadHistory(true);
    });
  }
})();

