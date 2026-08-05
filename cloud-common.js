(function () {
  'use strict';

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
    setStatus('En ligne', 'online');
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
      setStatus('Mode local', 'pending');
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

  function canEditAthlete(slug) {
    return !!member && (member.role === 'coach' || (member.role === 'athlete' && member.athlete_slug === slug));
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
    clara: { name: 'Clara (Chouchou)', emoji: '🐱⚔️' },
    benoit: { name: 'Benoît', emoji: '✝️' },
    celia: { name: 'Célia', emoji: '🎖️' }
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
      } else {
        activityText = `<strong>${escapeHtml(display.name)}</strong> a réussi sa série de <strong>${escapeHtml(exerciseLabel(row.exercise_code, row.exercise_name))}</strong> à <strong>${numberFr(row.load_kg)} kg</strong> · ${reps} ${repLabel} · RPE ${numberFr(row.rpe, 1)}${targetLabel}`;
      }
      const typeLabel = isPr ? '🏆 NOUVEAU PR · ' : isLevel ? '🆙 LEVEL UP · ' : isSession ? '⚡ SÉANCE RAPIDE · ' : isCombat ? '⚔️ VICTOIRE RPG · ' : isLoot ? '🎁 LOOT RPG · ' : '';
      const xpLabel = xp > 0 ? ` · +${numberFr(xp, 2)} XP` : '';
      return `<article class="cloud-activity ${(isPr || isLevel || isSession || isCombat || isLoot) ? 'pr' : ''}">
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
