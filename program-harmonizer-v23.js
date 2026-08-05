/* GA Coaching — harmonisation universelle des pages athlètes
   Build: 2026-08-01-harmonisation-v23
*/
(function () {
  'use strict';
  const BUILD = '2026-08-01-harmonisation-v23';

  function ensureMeta(name, content) {
    let meta = document.head.querySelector(`meta[name="${name}"]`);
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = name;
      document.head.appendChild(meta);
    }
    meta.content = content;
  }

  function ensureHeader() {
    const headerTop = document.querySelector('.header-top,.top');
    if (!headerTop) return;
    let back = headerTop.querySelector('.back-btn,.back');
    if (!back) {
      back = document.createElement('a');
      back.className = 'back-btn';
      back.textContent = '‹';
      headerTop.prepend(back);
    }
    if (back.tagName === 'A') back.setAttribute('href', 'index.html');
    back.setAttribute('aria-label', 'Retour à la liste des athlètes');

    if (!headerTop.querySelector('.header-logo-wrap')) {
      const wrap = document.createElement('div');
      wrap.className = 'header-logo-wrap';
      wrap.innerHTML = '<img class="header-logo" src="logo-araignee.png" alt="Logo GA Coaching">';
      back.insertAdjacentElement('afterend', wrap);
    }
  }

  function normalizeNavigation() {
    const nav = document.querySelector('.bottom-nav');
    if (!nav) return;
    nav.setAttribute('aria-label', 'Navigation du programme');
    const items = [...nav.querySelectorAll('.nav-item,button,a')];
    items.forEach((item, index) => {
      if (!item.dataset.view) item.dataset.view = index === 0 ? 'workout' : 'notes';
      if (!item.getAttribute('aria-label')) item.setAttribute('aria-label', index === 0 ? 'Afficher la séance' : 'Afficher les consignes');
    });
  }

  function normalizeTimer() {
    const overlay = document.getElementById('timerOverlay');
    if (!overlay) return;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Temps de repos');
    const add = [...overlay.querySelectorAll('button')].find(btn => /\+\s*30/.test(btn.textContent || ''));
    if (add) add.setAttribute('aria-label', 'Ajouter trente secondes au repos');
    const close = [...overlay.querySelectorAll('button')].find(btn => /skip|passer|rush|fermer|stop/i.test(btn.textContent || ''));
    if (close) close.setAttribute('aria-label', 'Fermer le minuteur de repos');
  }

  function normalizeDynamicRows() {
    document.querySelectorAll('.exercise-block').forEach((block, blockIndex) => {
      block.dataset.exerciseIndex = String(blockIndex);
      const title = block.querySelector('.exercise-name');
      if (title && !title.getAttribute('title')) title.setAttribute('title', title.textContent.trim());
    });
    document.querySelectorAll('.set-row,.row').forEach((row, rowIndex) => {
      row.dataset.harmonizedSetIndex = String(rowIndex);
      const check = row.querySelector('.set-check,.check,.check-btn');
      if (check) {
        check.setAttribute('role', check.tagName === 'BUTTON' ? 'button' : 'checkbox');
        check.setAttribute('aria-label', `Valider la série ${rowIndex + 1}`);
        check.setAttribute('aria-checked', String(check.classList.contains('checked') || row.classList.contains('completed') || row.classList.contains('done')));
      }
      row.querySelectorAll('input,select').forEach(field => {
        if (!field.getAttribute('autocomplete')) field.setAttribute('autocomplete', 'off');
      });
    });
  }

  function markBuild() {
    document.body.dataset.gaProgramBuild = BUILD;
    let marker = document.querySelector('.ga-harmonized-build');
    if (!marker) {
      marker = document.createElement('span');
      marker.className = 'ga-harmonized-build';
      marker.textContent = BUILD;
      document.body.appendChild(marker);
    }
  }

  function refresh() {
    document.body.classList.add('ga-program-harmonized');
    ensureMeta('apple-mobile-web-app-capable', 'yes');
    ensureMeta('theme-color', getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#0a0a0f');
    ensureHeader();
    normalizeNavigation();
    normalizeTimer();
    normalizeDynamicRows();
    markBuild();
  }

  let queued = false;
  function queueRefresh() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      refresh();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refresh, { once: true });
  else refresh();

  const observer = new MutationObserver(queueRefresh);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('click', event => {
    if (event.target.closest('.week-btn,.week,.day-tab,.day,.nav-item,.set-check,.check-btn')) setTimeout(refresh, 60);
  }, true);
})();
