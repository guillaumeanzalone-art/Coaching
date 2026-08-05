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
  let raid = null;
  let raidParticipants = [];
  let raidBattle = null;
  let raidBattleTimer = null;
  let raidPollTimer = null;
  let raidClockTimer = null;
  let activeTab = 'progress';
  let collectionSubTab = 'bestiary';
  let collectionBusy = false;
  let openingCase = false;
  let inventorySort = localStorage.getItem(`rpg_inventory_sort_${cfg.slug}`) || 'rarity';
  let inventorySlotFilter = localStorage.getItem(`rpg_inventory_slot_${cfg.slug}`) || 'all';
  let inventoryTypeFilter = localStorage.getItem(`rpg_inventory_type_${cfg.slug}`) || 'all';
  let bestiarySearch = '';
  let bestiaryRarityFilter = 'all';
  let bestiaryCategoryFilter = 'all';
  let bestiaryStatusFilter = 'all';
  const CASE_COUNTS = [1, 10, 100];
  const RARITY_RANK = { normal:1, common:2, uncommon:3, rare:4, epic:5, legendary:6, mythic:7, ultra_mythic:8, abyssal:9 };

  const CLASS_DEFS = {
    warrior: {
      icon: '⚔️', title: 'Guerrier', subtitle: 'Spécialiste Squat', lift: 'sq', liftName: 'squat',
      mainStat: 'Force', masteryStat: 'Chance',
      perk: '+25 % d’XP sur les séries et PR de squat',
      combat: 'Chaque frappe inflige 20 % de dégâts supplémentaires.'
    },
    archer: {
      icon: '🏹', title: 'Archer', subtitle: 'Spécialiste Bench', lift: 'bn', liftName: 'bench',
      mainStat: 'Précision', masteryStat: 'Chance',
      perk: '+25 % d’XP sur les séries et PR de bench',
      combat: 'Chaque 5e flèche est un coup critique à dégâts doublés.'
    },
    mage: {
      icon: '🔮', title: 'Mage', subtitle: 'Spécialiste Deadlift', lift: 'dl', liftName: 'deadlift',
      mainStat: 'Magie', masteryStat: 'Chance',
      perk: '+25 % d’XP sur les séries et PR de deadlift',
      combat: 'Chaque 10e sort déclenche une explosion à dégâts triplés.'
    }
  };

  const RARITY_DEFS = {
    normal: { label: 'Normal', chance: '48,889 %', rate: 48.889, icon: '⚪' },
    common: { label: 'Commun', chance: '25 %', rate: 25, icon: '🟢' },
    uncommon: { label: 'Peu commun', chance: '15 %', rate: 15, icon: '🔵' },
    rare: { label: 'Rare', chance: '7 %', rate: 7, icon: '🟣' },
    epic: { label: 'Épique', chance: '3 %', rate: 3, icon: '🟠' },
    legendary: { label: 'Légendaire', chance: '1 %', rate: 1, icon: '🟡' },
    mythic: { label: 'Mythique', chance: '0,1 %', rate: 0.1, icon: '🔴' },
    ultra_mythic: { label: 'Ultra méga mythique', chance: '0,01 %', rate: 0.01, icon: '🌟' },
    abyssal: { label: 'Abyssal', chance: '0,001 %', rate: 0.001, icon: '🫧' }
  };

  const MONSTER_RARITY_DEFS = {
    common: { label: 'Commun', bonus: 1, icon: '🟢' },
    uncommon: { label: 'Peu commun', bonus: 2, icon: '🔵' },
    rare: { label: 'Rare', bonus: 5, icon: '🟣' },
    epic: { label: 'Épique', bonus: 10, icon: '🟠' },
    legendary: { label: 'Légendaire', bonus: 20, icon: '🟡' },
    mythic: { label: 'Mythique', bonus: 50, icon: '🔴' },
    secret: { label: '???', bonus: 100, icon: '🌈' }
  };

  const SLOT_DEFS = {
    weapon: { label: 'Arme', icon: '🗡️' },
    armor: { label: 'Armure', icon: '🛡️' },
    relic: { label: 'Relique', icon: '💎' }
  };


  const PASSIVE_DEFS = {
    epic_hunter: { icon: '👹', label: 'Chasseur épique', unit: '%', description: 'Augmente la probabilité de rencontrer un monstre épique.' },
    case_luck: { icon: '🎁', label: 'Instinct du coffre', unit: '', description: 'Augmente très légèrement le poids des raretés supérieures dans les caisses.' },
    resale_bonus: { icon: '🪙', label: 'Marchandage', unit: '%', description: 'Augmente la valeur de revente des objets.' }
  };

  const ITEM_VALUE_RARITY_MULTIPLIER = {
    normal:0.8, common:1, uncommon:1.2, rare:1.6, epic:2.2,
    legendary:3, mythic:5, ultra_mythic:8, abyssal:15
  };

  const COLLECTION_DEPOSIT_MULTIPLIER = 4;

  const css = `
    .xp-chip{flex:0 0 auto;border:1px solid rgba(240,196,77,.18);border-radius:11px;padding:6px 9px;background:rgba(240,196,77,.07);color:var(--accent,#f0c44d);font:900 10px Inter,system-ui,sans-serif;cursor:pointer;white-space:nowrap}
    .xp-panel{display:none;position:fixed;z-index:430;left:50%;transform:translateX(-50%);top:56px;bottom:62px;width:100%;max-width:430px;padding:13px 16px 22px;box-sizing:border-box;overflow-y:auto;overflow-x:hidden;background:var(--bg,#05070d);color:var(--text,#eef2f7)}.xp-panel *{box-sizing:border-box;min-width:0}
    .xp-panel.show{display:block}.xp-panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:2px 0 10px}.xp-panel-head h2{margin:0;font-size:17px}.xp-panel-head button{border:1px solid rgba(255,255,255,.07);border-radius:10px;background:var(--surface-2,#141c2d);color:inherit;padding:8px 11px;font-weight:800;cursor:pointer}
    .xp-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-bottom:12px;padding:4px;border-radius:13px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.045)}.xp-tab{border:0;border-radius:10px;padding:9px 4px;background:transparent;color:var(--text-muted,#5d6780);font:850 10px Inter,system-ui,sans-serif;cursor:pointer}.xp-tab.active{background:var(--surface-2,#141c2d);color:var(--accent,#f0c44d);box-shadow:0 7px 16px rgba(0,0,0,.18)}
    .xp-hero{padding:17px;border:1px solid rgba(240,196,77,.16);border-radius:18px;background:radial-gradient(circle at 50% 0,rgba(179,27,42,.19),transparent 55%),linear-gradient(145deg,rgba(255,255,255,.035),rgba(255,255,255,.012));box-shadow:0 18px 38px rgba(0,0,0,.2)}
    .xp-level{font-size:11px;color:var(--text-muted,#5d6780);font-weight:900;letter-spacing:.08em;text-transform:uppercase}.xp-total{margin-top:4px;font-size:30px;font-weight:950;color:var(--accent,#f0c44d)}.xp-total small{font-size:12px;color:var(--text-dim,#a0abc0)}
    .xp-progress{height:8px;margin-top:12px;border-radius:999px;background:rgba(255,255,255,.06);overflow:hidden}.xp-progress span{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#cf2b3d,var(--accent,#f0c44d))}.xp-next{display:flex;justify-content:space-between;gap:8px;margin-top:6px;font-size:10px;color:var(--text-muted,#5d6780)}
    .xp-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:11px}.xp-stat{padding:10px 8px;border-radius:12px;background:rgba(255,255,255,.035);text-align:center}.xp-stat b{display:block;font-size:16px;color:var(--text,#eef2f7)}.xp-stat span{display:block;margin-top:3px;font-size:8px;color:var(--text-muted,#5d6780);text-transform:uppercase;letter-spacing:.05em}
    .xp-section{margin-top:12px;padding:14px;border:1px solid rgba(255,255,255,.055);border-radius:17px;background:linear-gradient(145deg,rgba(255,255,255,.032),rgba(255,255,255,.012))}.xp-section-title{font-size:12px;font-weight:950;letter-spacing:.06em;text-transform:uppercase;color:var(--accent,#f0c44d);margin-bottom:10px}
    .rpg-choice-intro{font-size:11px;line-height:1.55;color:var(--text-dim,#a0abc0);margin-bottom:10px}.rpg-warning{color:#ff8c95;font-weight:850}
    .rpg-class-grid{display:grid;gap:8px}.rpg-class-card{width:100%;text-align:left;border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:12px;background:rgba(255,255,255,.025);color:inherit;cursor:pointer}.rpg-class-card:active{transform:scale(.985)}.rpg-class-card strong{display:block;font-size:14px}.rpg-class-card small{display:block;margin-top:3px;color:var(--text-dim,#a0abc0);line-height:1.45}.rpg-class-icon{font-size:25px;float:left;margin-right:10px;line-height:1.2}
    .rpg-profile{display:flex;gap:12px;align-items:center}.rpg-avatar{width:58px;height:58px;border-radius:17px;display:grid;place-items:center;font-size:31px;background:radial-gradient(circle at 50% 25%,rgba(240,196,77,.24),rgba(179,27,42,.12) 55%,rgba(255,255,255,.02));border:1px solid rgba(240,196,77,.18)}.rpg-profile-copy{min-width:0}.rpg-profile-copy b{display:block;font-size:16px}.rpg-profile-copy span{display:block;margin-top:3px;font-size:10px;color:var(--text-dim,#a0abc0)}
    .rpg-statline{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:12px}.rpg-statbox{padding:9px 5px;text-align:center;border-radius:11px;background:rgba(255,255,255,.035);overflow:hidden}.rpg-statbox b{display:block;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rpg-statbox span{display:block;font-size:8px;color:var(--text-muted,#5d6780);text-transform:uppercase;letter-spacing:.04em}.rpg-statbox small{display:block;margin-top:3px;font-size:7px;line-height:1.35;color:#78849b;overflow-wrap:anywhere}.rpg-influence-grid{display:grid;grid-template-columns:1fr;gap:7px;margin-top:10px}.rpg-influence{padding:9px 10px;border-radius:12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05);font-size:9px;line-height:1.45;color:var(--text-dim,#a0abc0)}.rpg-influence b{display:block;margin-bottom:3px;font-size:9px;color:#eef2f7}.rpg-perks{margin-top:10px;font-size:10px;line-height:1.52;color:var(--text-dim,#a0abc0);overflow-wrap:anywhere}
    .rpg-combat-record{display:flex;justify-content:center;gap:14px;margin:10px 0 0;font-size:10px;color:var(--text-dim,#a0abc0)}.rpg-combat-record b{color:var(--text,#eef2f7)}
    .rpg-launch{display:block;width:100%;margin-top:12px;border:0;border-radius:13px;padding:13px 16px;background:linear-gradient(135deg,#cf2b3d,var(--accent,#f0c44d));color:#11151d;font-weight:950;font-size:13px;cursor:pointer;box-shadow:0 12px 28px rgba(207,43,61,.18)}.rpg-launch:disabled{opacity:.45;cursor:not-allowed}
    .difficulty-box{margin-top:12px;padding:12px;border-radius:14px;background:rgba(255,255,255,.028);border:1px solid rgba(255,255,255,.055)}.difficulty-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.difficulty-head b{font-size:12px}.difficulty-value{font-size:17px;color:var(--accent,#f0c44d);font-weight:950}.difficulty-box input[type=range]{width:100%;margin:10px 0 5px;accent-color:#f0c44d}.difficulty-mults{display:flex;justify-content:space-between;gap:8px;font-size:9px;color:var(--text-dim,#a0abc0)}.boss-gate{margin-top:12px;padding:14px;border-radius:16px;background:radial-gradient(circle at 50% 0,rgba(207,43,61,.18),transparent 65%),rgba(255,255,255,.025);border:1px solid rgba(240,196,77,.16)}.boss-gate-head{display:flex;justify-content:space-between;align-items:center;gap:10px}.boss-gate-head b{font-size:12px}.boss-level{font-size:20px;font-weight:950;color:#f0c44d}.boss-progress{height:9px;margin:10px 0 6px;border-radius:999px;background:rgba(255,255,255,.06);overflow:hidden}.boss-progress span{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#cf2b3d,#f0c44d)}.boss-copy{font-size:9px;line-height:1.5;color:#a0abc0}.boss-mults{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:9px}.boss-mults span{padding:8px;border-radius:10px;background:rgba(255,255,255,.03);font-size:9px;text-align:center;color:#dbe2ef}.boss-launch{width:100%;margin-top:9px;border:1px solid rgba(240,196,77,.28);border-radius:12px;padding:11px;background:linear-gradient(135deg,rgba(207,43,61,.28),rgba(240,196,77,.15));color:#fff;font-weight:950;cursor:pointer}.boss-launch:disabled{opacity:.38;cursor:not-allowed}.boss-lock{margin-top:7px;font-size:8px;text-align:center;color:#77839a}
    .xp-rules{margin-top:12px;padding:13px;border:1px solid rgba(255,255,255,.05);border-radius:15px;background:rgba(255,255,255,.025);font-size:11px;line-height:1.62;color:var(--text-dim,#a0abc0)}.xp-rules strong{color:var(--text,#eef2f7)}
    .gold-wallet{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:15px 16px;border-radius:17px;border:1px solid rgba(240,196,77,.2);background:radial-gradient(circle at 0 0,rgba(240,196,77,.17),transparent 55%),rgba(255,255,255,.025)}.gold-wallet strong{font-size:23px;color:#ffd45d}.gold-wallet span{font-size:10px;color:var(--text-dim,#a0abc0)}
    .upgrade-grid{display:grid;gap:8px}.upgrade-card{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:12px;border-radius:13px;background:rgba(255,255,255,.028);border:1px solid rgba(255,255,255,.05)}.upgrade-card b{display:block;font-size:13px}.upgrade-card small{display:block;margin-top:3px;font-size:9px;color:var(--text-dim,#a0abc0);line-height:1.4}.upgrade-card button,.equip-button,.case-open-button{border:0;border-radius:10px;padding:9px 10px;background:var(--accent,#f0c44d);color:#11151d;font-weight:900;font-size:10px;cursor:pointer}.upgrade-card button:disabled,.equip-button:disabled,.case-open-button:disabled{opacity:.38;cursor:not-allowed}.upgrade-rank{color:var(--accent,#f0c44d)}
    .equipment-slots{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.equipment-slot{min-height:112px;padding:9px 7px;border-radius:13px;border:1px dashed rgba(255,255,255,.1);background:rgba(255,255,255,.018);text-align:center}.equipment-slot .slot-icon{font-size:23px}.equipment-slot .slot-label{display:block;margin-top:3px;font-size:8px;color:var(--text-muted,#5d6780);text-transform:uppercase}.equipment-slot .slot-item{display:block;margin-top:7px;font-size:9px;font-weight:800;line-height:1.3}.equipment-slot .slot-stats{display:block;margin-top:5px;font-size:8px;color:var(--text-dim,#a0abc0)}
    .inventory-list{display:grid;gap:8px}.inventory-card{padding:12px;border-radius:14px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.055)}.inventory-top{display:flex;justify-content:space-between;gap:9px;align-items:flex-start}.inventory-name{font-size:12px;font-weight:900;line-height:1.35}.inventory-meta{font-size:9px;color:var(--text-muted,#5d6780);margin-top:3px}.inventory-stats{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}.inventory-stats span{padding:4px 7px;border-radius:999px;background:rgba(255,255,255,.045);font-size:8px;color:var(--text-dim,#a0abc0)}.inventory-actions{display:flex;justify-content:flex-end;margin-top:8px}.inventory-card.equipped{border-color:rgba(240,196,77,.3);box-shadow:inset 0 0 0 1px rgba(240,196,77,.08)}
    .stack-badge{display:inline-grid;place-items:center;min-width:28px;height:24px;padding:0 7px;border-radius:999px;background:rgba(240,196,77,.14);border:1px solid rgba(240,196,77,.24);color:#f0c44d;font-size:10px;font-weight:950}.inventory-copy-count{color:#f0c44d;font-weight:900}
    .rarity-normal{--rarity:#c4cad4}.rarity-common{--rarity:#61d38b}.rarity-uncommon{--rarity:#5ca9ff}.rarity-rare{--rarity:#aa73ff}.rarity-epic{--rarity:#ff8b49}.rarity-legendary{--rarity:#ffd04f}.rarity-mythic{--rarity:#ff5368}.inventory-card[class*="rarity-"],.case-result-card[class*="rarity-"]{border-color:color-mix(in srgb,var(--rarity) 38%,transparent)}.inventory-name,.case-result-rarity{color:var(--rarity,#eef2f7)}
    .odds-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:6px}.odds-row{display:flex;justify-content:space-between;gap:8px;padding:8px 9px;border-radius:10px;background:rgba(255,255,255,.025);font-size:9px}.odds-row b{color:var(--rarity,#eef2f7)}.case-note{font-size:9px;line-height:1.5;color:var(--text-muted,#5d6780);margin-top:9px}.case-list{display:grid;gap:9px}.case-card{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;padding:13px;border-radius:15px;border:1px solid rgba(255,255,255,.055);background:rgba(255,255,255,.025)}.case-card.locked{opacity:.48}.case-crate{font-size:30px}.case-card b{display:block;font-size:12px}.case-card small{display:block;margin-top:3px;font-size:9px;color:var(--text-dim,#a0abc0)}
    .empty-state{padding:18px 10px;text-align:center;color:var(--text-muted,#5d6780);font-size:10px;line-height:1.5}
    .xp-levelup{display:none;position:fixed;inset:0;z-index:7200;align-items:center;justify-content:center;padding:20px;background:rgba(2,4,8,.9);backdrop-filter:blur(12px)}.xp-levelup.show{display:flex}.xp-levelup-card{width:min(100%,380px);padding:25px 20px;border:1px solid rgba(240,196,77,.35);border-radius:22px;background:radial-gradient(circle at 50% 0,rgba(183,26,40,.25),transparent 55%),#0e1421;text-align:center;box-shadow:0 25px 80px rgba(0,0,0,.55)}.xp-levelup h2{margin:0;color:var(--accent,#f0c44d);font-size:25px}.xp-levelup p{margin:12px 0 0;line-height:1.55}.xp-levelup button{margin-top:18px;border:0;border-radius:12px;padding:11px 18px;background:var(--accent,#f0c44d);color:#11151d;font-weight:900;cursor:pointer}
    .rpg-overlay{display:none;position:fixed;inset:0;z-index:7600;background:radial-gradient(circle at 50% 25%,rgba(150,22,36,.21),transparent 38%),rgba(2,4,8,.97);backdrop-filter:blur(13px);color:#eef2f7;padding:18px}.rpg-overlay.show{display:flex;align-items:center;justify-content:center}.rpg-arena{width:min(100%,410px);text-align:center}.rpg-arena-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;font-size:11px;color:#a0abc0}.rpg-clock{font-size:27px;font-weight:950;color:#f0c44d;font-variant-numeric:tabular-nums}.rpg-monster-name{font-size:17px;font-weight:950}.rpg-hp{height:13px;margin:9px 0 4px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden;border:1px solid rgba(255,255,255,.05)}.rpg-hp span{display:block;height:100%;width:100%;background:linear-gradient(90deg,#b91f35,#f04f5f);transition:width .1s}.rpg-hp-label{font-size:10px;color:#a0abc0}.rpg-enemy-stage{position:relative;min-height:250px;display:grid;place-items:center;margin:6px 0}.rpg-enemy{width:190px;height:190px;border:0;border-radius:50%;background:radial-gradient(circle at 50% 42%,rgba(240,196,77,.16),rgba(180,25,41,.17) 45%,rgba(255,255,255,.02) 70%);font-size:105px;cursor:pointer;touch-action:manipulation;user-select:none;filter:drop-shadow(0 24px 30px rgba(0,0,0,.5));transition:transform .06s}.rpg-enemy:active,.rpg-enemy.hit{transform:scale(.91) rotate(-2deg)}.rpg-damage-pop{position:absolute;left:50%;top:35%;font-size:22px;font-weight:950;color:#ffd35a;pointer-events:none;animation:rpgPop .55s ease-out forwards;text-shadow:0 3px 12px #000}.rpg-damage-pop.crit{color:#ff6f7d;font-size:28px}.rpg-combat-info{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.rpg-combat-info div{padding:9px;border-radius:11px;background:rgba(255,255,255,.035);font-size:9px;color:#818da6}.rpg-combat-info b{display:block;color:#eef2f7;font-size:14px;margin-bottom:2px}.rpg-abandon,.rpg-result-close{margin-top:13px;border:1px solid rgba(255,255,255,.08);border-radius:11px;padding:10px 15px;background:#141c2d;color:#eef2f7;font-weight:850;cursor:pointer}.rpg-result{display:none;padding:21px;border:1px solid rgba(240,196,77,.22);border-radius:18px;background:#0e1421}.rpg-result.show{display:block}.rpg-result h2{margin:0;font-size:25px;color:#f0c44d}.rpg-result p{line-height:1.55;color:#a0abc0}.rpg-result strong{color:#eef2f7}
.rpg-boss-skin{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px}.rpg-boss-face{font-size:82px;line-height:1;filter:drop-shadow(0 0 12px rgba(96,170,255,.35))}.rpg-boss-note{font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#8fb8ff}.rpg-boss-note small{display:block;color:#9ea8be;font-size:8px;letter-spacing:.03em;text-transform:none;margin-top:2px}.rpg-enemy.boss-val{background:radial-gradient(circle at 50% 35%,rgba(95,165,255,.28),rgba(180,25,41,.14) 42%,rgba(255,255,255,.02) 72%);border:1px solid rgba(95,165,255,.18)}
    .damage-trial-launch{display:block;width:100%;margin-top:9px;border:1px solid rgba(100,190,255,.22);border-radius:13px;padding:12px 14px;background:linear-gradient(135deg,rgba(32,76,145,.95),rgba(103,40,155,.95));color:#f2f7ff;font-weight:950;font-size:12px;cursor:pointer;box-shadow:0 12px 28px rgba(60,105,210,.18)}.damage-trial-launch:disabled{opacity:.45;cursor:not-allowed}.damage-trial-note{margin-top:7px;font-size:9px;color:#7e8aa4;text-align:center}.damage-trial-note b{color:#8fc9ff}
    .trial-overlay{display:none;position:fixed;inset:0;z-index:7750;padding:18px;color:#eef5ff;background:radial-gradient(circle at 50% 20%,rgba(66,119,255,.22),transparent 34%),radial-gradient(circle at 14% 75%,rgba(181,54,255,.18),transparent 30%),linear-gradient(180deg,#050715,#090d22 56%,#02040b);overflow:hidden}.trial-overlay.show{display:flex;align-items:center;justify-content:center}.trial-overlay:before,.trial-overlay:after{content:'';position:absolute;inset:-20%;pointer-events:none;background-image:radial-gradient(circle,#8ec8ff 0 1px,transparent 1.6px);background-size:34px 34px;opacity:.22;animation:trialStars 12s linear infinite}.trial-overlay:after{background-size:57px 57px;opacity:.12;animation-duration:20s;animation-direction:reverse}.trial-arena{position:relative;z-index:1;width:min(100%,410px);text-align:center}.trial-map-title{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#8fc9ff;font-weight:950}.trial-map-subtitle{margin-top:3px;font-size:22px;font-weight:950}.trial-clock{margin:8px 0 5px;font-size:37px;font-weight:950;color:#f4ce58;font-variant-numeric:tabular-nums}.trial-stage{position:relative;min-height:270px;display:grid;place-items:center;margin:5px 0}.trial-portal{position:absolute;width:250px;height:250px;border-radius:50%;background:conic-gradient(from 0deg,#4e8fff,#9d4dff,#48d7ff,#4e8fff);filter:blur(.2px) drop-shadow(0 0 34px rgba(78,143,255,.35));animation:trialPortal 4s linear infinite}.trial-portal:after{content:'';position:absolute;inset:15px;border-radius:50%;background:radial-gradient(circle,#121934 0 38%,#050817 68%);box-shadow:inset 0 0 45px rgba(100,170,255,.25)}.trial-dummy{position:relative;z-index:2;width:176px;height:176px;border:0;border-radius:50%;background:radial-gradient(circle at 50% 36%,rgba(255,225,100,.24),rgba(37,50,95,.88) 48%,rgba(4,8,20,.95) 72%);font-size:91px;cursor:pointer;touch-action:manipulation;user-select:none;filter:drop-shadow(0 24px 30px rgba(0,0,0,.55));transition:transform .055s}.trial-dummy:active,.trial-dummy.hit{transform:scale(.91) rotate(-2deg)}.trial-map-floor{position:absolute;z-index:1;bottom:8px;width:300px;height:64px;border-radius:50%;background:radial-gradient(ellipse,rgba(91,159,255,.34),rgba(30,38,83,.13) 55%,transparent 72%);transform:perspective(120px) rotateX(55deg)}.trial-info{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.trial-info div{padding:10px 7px;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.04);font-size:9px;color:#8492ae}.trial-info b{display:block;font-size:15px;color:#eef5ff;margin-bottom:2px}.trial-result{display:none;padding:22px;border-radius:20px;border:1px solid rgba(103,170,255,.28);background:rgba(10,16,36,.95);box-shadow:0 30px 90px rgba(0,0,0,.55)}.trial-result.show{display:block}.trial-result h2{margin:0;color:#8fc9ff;font-size:25px}.trial-result p{line-height:1.6;color:#a4afc4}.trial-result strong{color:#fff}.trial-close{margin-top:14px;border:0;border-radius:11px;padding:11px 16px;background:#8fc9ff;color:#07101e;font-weight:950;cursor:pointer}
    .case-overlay{display:none;position:fixed;inset:0;z-index:7900;align-items:center;justify-content:center;padding:20px;background:rgba(2,4,8,.95);backdrop-filter:blur(14px)}.case-overlay.show{display:flex}.case-result-card{width:min(100%,370px);padding:24px 18px;border-radius:22px;background:radial-gradient(circle at 50% 0,color-mix(in srgb,var(--rarity,#f0c44d) 28%,transparent),transparent 55%),#0e1421;border:1px solid color-mix(in srgb,var(--rarity,#f0c44d) 45%,transparent);text-align:center;box-shadow:0 30px 90px rgba(0,0,0,.6);animation:caseReveal .5s cubic-bezier(.2,.9,.2,1)}.case-result-icon{font-size:62px;filter:drop-shadow(0 12px 20px rgba(0,0,0,.45))}.case-result-rarity{margin-top:7px;font-size:11px;font-weight:950;text-transform:uppercase;letter-spacing:.1em}.case-result-card h2{margin:8px 0 0;font-size:20px}.case-result-card p{margin:11px 0 0;color:#a0abc0;font-size:11px;line-height:1.55}.case-result-card button{margin-top:18px;border:0;border-radius:12px;padding:11px 18px;background:var(--rarity,#f0c44d);color:#10141d;font-weight:950;cursor:pointer}
    .case-buy-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:8px}.case-buy-button{border:0;border-radius:10px;padding:8px 4px;background:rgba(240,196,77,.11);border:1px solid rgba(240,196,77,.16);color:#f0c44d;font-size:9px;font-weight:950;cursor:pointer}.case-buy-button strong{display:block;font-size:11px}.case-buy-button:disabled{opacity:.32;cursor:not-allowed}.case-card{grid-template-columns:auto 1fr}.case-card .case-buy-grid{grid-column:1/-1}
    .case-opening-shell{width:min(100%,420px);text-align:center}.case-opening-title{font-size:13px;font-weight:950;letter-spacing:.12em;color:#f0c44d;text-transform:uppercase}.case-opening-subtitle{margin-top:5px;font-size:9px;color:#8792a8}.case-roulette{position:relative;height:190px;margin-top:16px;border-radius:18px;overflow:hidden;background:linear-gradient(180deg,#0b101b,#05070d);border:1px solid rgba(255,255,255,.07);box-shadow:inset 0 0 45px rgba(0,0,0,.7)}.case-roulette::before,.case-roulette::after{content:"";position:absolute;z-index:5;top:0;bottom:0;width:62px;pointer-events:none}.case-roulette::before{left:0;background:linear-gradient(90deg,#05070d,transparent)}.case-roulette::after{right:0;background:linear-gradient(-90deg,#05070d,transparent)}.case-center-marker{position:absolute;z-index:6;top:0;bottom:0;left:50%;width:2px;background:linear-gradient(transparent,#f0c44d 18%,#f0c44d 82%,transparent);box-shadow:0 0 16px rgba(240,196,77,.65)}.case-roll-track{position:absolute;left:0;top:20px;height:150px;display:flex;align-items:center;gap:10px;will-change:transform}.case-roll-tile{flex:0 0 112px;height:138px;border-radius:16px;border:1px solid color-mix(in srgb,var(--rarity,#c4cad4) 42%,transparent);background:radial-gradient(circle at 50% 10%,color-mix(in srgb,var(--rarity,#c4cad4) 23%,transparent),transparent 56%),#101724;display:grid;place-items:center;box-shadow:0 12px 24px rgba(0,0,0,.35)}.sbd-chest{display:flex;flex-direction:column;align-items:center;gap:2px}.sbd-chest span{font-size:55px;filter:drop-shadow(0 10px 13px rgba(0,0,0,.4))}.sbd-chest b{padding:3px 10px;border-radius:999px;background:#080c13;color:var(--rarity,#f0c44d);font-size:12px;letter-spacing:.12em}.case-lock-note{margin-top:12px;font-size:9px;color:#7f8aa0}.case-opening-results{display:none;max-height:70vh;overflow:auto;margin-top:12px;padding:14px;border-radius:18px;background:#0e1421;border:1px solid rgba(255,255,255,.07)}.case-opening-results.show{display:block;animation:caseReveal .45s ease}.case-opening-results h2{margin:0;color:#f0c44d;font-size:22px}.case-opening-results p{font-size:10px;color:#98a3b8}.case-results-grid{display:grid;gap:7px;margin-top:12px;text-align:left}.case-result-row{display:grid;grid-template-columns:auto 1fr auto;gap:9px;align-items:center;padding:9px;border-radius:12px;border:1px solid color-mix(in srgb,var(--rarity,#c4cad4) 30%,transparent);background:rgba(255,255,255,.025)}.case-result-row .result-icon{font-size:24px}.case-result-row b{display:block;font-size:10px;color:var(--rarity,#eef2f7)}.case-result-row small{font-size:8px;color:#7f8aa0}.case-result-row .result-count{font-weight:950;color:#f0c44d}.case-opening-close{display:none;margin-top:14px;border:0;border-radius:12px;padding:11px 18px;background:#f0c44d;color:#10151d;font-weight:950;cursor:pointer}.case-opening-close.ready{display:inline-block}.case-progress-label{margin-top:10px;font-size:10px;color:#aab4c8;font-variant-numeric:tabular-nums}

    .collection-subtabs{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:11px}.collection-subtab{border:1px solid rgba(255,255,255,.055);border-radius:11px;padding:9px;background:rgba(255,255,255,.025);color:var(--text-muted,#5d6780);font-weight:900;font-size:10px;cursor:pointer}.collection-subtab.active{color:#f0c44d;border-color:rgba(240,196,77,.24);background:rgba(240,196,77,.07)}
    .collection-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:10px}.collection-summary div{padding:10px 6px;border-radius:12px;background:rgba(255,255,255,.03);text-align:center}.collection-summary b{display:block;font-size:15px;color:#f0c44d}.collection-summary span{font-size:8px;color:#68748c;text-transform:uppercase}
    .bestiary-tools{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:10px 0}.bestiary-tools input,.bestiary-tools select{min-width:0;width:100%;border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:9px;background:#0c111c;color:#eef2f7;font-size:9px}.bestiary-tools input{grid-column:1/-1}.bestiary-filter-count{grid-column:1/-1;font-size:8px;color:#7e8aa2}.monster-category{margin-top:4px;font-size:7px;color:#667085;line-height:1.25}.monster-discovery-date{margin-top:4px;font-size:7px;color:#8b96ad}    .bestiary-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.monster-card{position:relative;min-height:155px;padding:12px 9px;border-radius:16px;border:1px solid rgba(255,255,255,.055);background:radial-gradient(circle at 50% 0,color-mix(in srgb,var(--monster-color,#667085) 18%,transparent),transparent 55%),rgba(255,255,255,.022);text-align:center;overflow:hidden}.monster-card.undiscovered{filter:saturate(.25);opacity:.62}.monster-card.hidden-monster{filter:none;opacity:1}.monster-icon{font-size:45px;line-height:1.1;min-height:52px;display:grid;place-items:center}.monster-name{margin-top:6px;font-size:10px;font-weight:950;line-height:1.25}.monster-meta{margin-top:5px;font-size:8px;color:#7e8aa2}.monster-bonus{margin-top:7px;font-size:9px;color:#f0c44d;font-weight:850}.monster-kills{position:absolute;right:7px;top:7px;padding:3px 6px;border-radius:999px;background:rgba(0,0,0,.35);font-size:8px}.rarity-secret{--rarity:#fff}.monster-card.rarity-secret,.codex-card.rarity-secret{background:linear-gradient(120deg,rgba(255,60,80,.13),rgba(255,210,60,.13),rgba(60,255,130,.13),rgba(60,160,255,.13),rgba(190,80,255,.13));animation:rainbowPulse 3s linear infinite}
    .deposited-list{display:grid;gap:8px;margin-bottom:12px}.deposited-row{--deposit-color:var(--rarity,#eef2f7);display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:start;padding:11px;border-radius:13px;border:1px solid color-mix(in srgb,var(--deposit-color) 38%,transparent);background:linear-gradient(135deg,color-mix(in srgb,var(--deposit-color) 10%,transparent),rgba(255,255,255,.018))}.deposited-icon{font-size:27px}.deposited-copy b{display:block;color:var(--deposit-color);font-size:11px;line-height:1.3}.deposited-copy span{display:block;margin-top:4px;color:#8d98ad;font-size:8px;line-height:1.45}.deposited-copy strong{color:#eef2f7}.codex-card .card-probability{margin-top:4px;font-size:7px;color:#f0c44d}.codex-card .card-date{margin-top:3px;font-size:7px;color:#8d98ad}
    .codex-groups{display:grid;gap:10px}.codex-group{border:1px solid rgba(255,255,255,.05);border-radius:15px;background:rgba(255,255,255,.015);overflow:hidden}.codex-group summary{cursor:pointer;padding:11px 12px;font-size:11px;font-weight:950;color:var(--rarity,#eef2f7);list-style:none}.codex-group summary::-webkit-details-marker{display:none}.codex-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;padding:0 9px 10px}.codex-card{position:relative;min-height:128px;padding:9px 6px;border-radius:13px;border:1px solid color-mix(in srgb,var(--rarity,#778) 35%,transparent);background:radial-gradient(circle at 50% 0,color-mix(in srgb,var(--rarity,#778) 17%,transparent),transparent 60%),rgba(255,255,255,.02);text-align:center}.codex-card.missing{filter:grayscale(.85);opacity:.47}.codex-card .card-icon{font-size:34px}.codex-card .card-name{font-size:8px;font-weight:900;line-height:1.25;margin-top:5px}.codex-card .card-status{font-size:7px;margin-top:5px;color:#77839a}.codex-tooltip{visibility:hidden;opacity:0;position:absolute;z-index:20;left:50%;bottom:calc(100% + 5px);transform:translateX(-50%);width:180px;padding:9px;border-radius:10px;background:#111827;border:1px solid rgba(255,255,255,.1);font-size:8px;line-height:1.45;color:#dbe2ef;box-shadow:0 15px 35px rgba(0,0,0,.5);transition:.15s}.codex-card:hover .codex-tooltip,.codex-card:focus .codex-tooltip{visibility:visible;opacity:1}.inventory-actions{gap:6px;flex-wrap:wrap}.inventory-actions .sell-button,.inventory-actions .deposit-button{border:0;border-radius:9px;padding:8px 9px;font-size:9px;font-weight:900;cursor:pointer}.sell-button{background:rgba(240,196,77,.12);color:#f0c44d}.deposit-button{background:rgba(95,165,255,.13);color:#8fb8ff}.sell-button:disabled,.deposit-button:disabled{opacity:.35;cursor:not-allowed}.inventory-bulk-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:9px 0 11px}.inventory-bulk-actions button{border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:11px 8px;font:900 10px Inter,system-ui,sans-serif;cursor:pointer}.inventory-bulk-actions .deposit-all-button{background:rgba(95,165,255,.13);color:#91bdff}.inventory-bulk-actions .sell-all-button{background:rgba(240,196,77,.12);color:#f0c44d}.inventory-bulk-actions button:disabled{opacity:.35;cursor:not-allowed}.inventory-bulk-note{grid-column:1/-1;margin-top:-2px;font-size:8px;line-height:1.45;color:#68758e;text-align:center}
    @keyframes trialStars{to{transform:translate3d(34px,34px,0)}}@keyframes trialPortal{to{transform:rotate(360deg)}}
    @keyframes rainbowPulse{0%{box-shadow:inset 0 0 18px rgba(255,70,70,.12)}33%{box-shadow:inset 0 0 18px rgba(70,255,150,.12)}66%{box-shadow:inset 0 0 18px rgba(100,100,255,.15)}100%{box-shadow:inset 0 0 18px rgba(255,70,70,.12)}}
    @keyframes rpgPop{0%{opacity:0;transform:translate(-50%,10px) scale(.7)}25%{opacity:1}100%{opacity:0;transform:translate(-50%,-70px) scale(1.2)}}@keyframes caseReveal{0%{opacity:0;transform:scale(.65) rotate(-4deg)}70%{transform:scale(1.04) rotate(1deg)}100%{opacity:1;transform:scale(1)}}

    .item-passive{grid-column:1/-1;padding:7px 8px;border-radius:9px;background:rgba(139,92,246,.10);border:1px solid rgba(139,92,246,.18);color:#c7b8ff!important;font-size:8px!important;line-height:1.4}.sale-preview{color:#f0c44d!important;font-weight:900}.combat-loot-line[class*="rarity-"]{border:1px solid color-mix(in srgb,var(--rarity,#f0c44d) 42%,transparent);background:color-mix(in srgb,var(--rarity,#f0c44d) 12%,rgba(255,255,255,.03));color:#eef2f7}.combat-loot-line .loot-rarity{color:var(--rarity,#eef2f7);font-weight:950}.monster-special-drop{display:block;margin-top:9px;padding:8px;border-radius:10px;background:rgba(255,255,255,.04)}.monster-special-drop[class*="rarity-"]{border:1px solid color-mix(in srgb,var(--rarity,#f0c44d) 42%,transparent);background:color-mix(in srgb,var(--rarity,#f0c44d) 12%,rgba(255,255,255,.03))}.rpg-monster-tag{display:inline-flex;align-items:center;justify-content:center;margin:8px auto 0;padding:5px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);font-size:8px;font-weight:950;letter-spacing:.08em;text-transform:uppercase;color:#c8d2e2}.rpg-monster-tag.rarity-epic,.rpg-monster-tag.rarity-legendary,.rpg-monster-tag.rarity-mythic,.rpg-monster-tag.rarity-secret{border-color:color-mix(in srgb,var(--rarity,#f0c44d) 45%,transparent);background:color-mix(in srgb,var(--rarity,#f0c44d) 14%,rgba(255,255,255,.02));color:var(--rarity,#fff)}.rpg-enemy-stage.epic-aura{background:radial-gradient(circle at 50% 35%,color-mix(in srgb,var(--rarity,#ff8b49) 26%,transparent),transparent 55%),linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.015))}.rpg-enemy.epic-aura{box-shadow:0 0 0 1px color-mix(in srgb,var(--rarity,#ff8b49) 24%,transparent),0 0 26px color-mix(in srgb,var(--rarity,#ff8b49) 26%,transparent),0 0 60px color-mix(in srgb,var(--rarity,#ff8b49) 18%,transparent)}
    .sale-preview{color:#f0c44d!important;font-weight:900}.inventory-toolbar{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:10px}.inventory-toolbar label{display:grid;gap:4px;font-size:8px;color:#8490a7;text-transform:uppercase;letter-spacing:.05em}.inventory-toolbar select{width:100%;border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:9px 8px;background:#101724;color:#eaf0f8;font:800 9px Inter,system-ui}.inventory-toolbar .wide{grid-column:1/-1}.inventory-empty-filter{padding:20px;text-align:center;color:#7f8ba2;font-size:10px}.item-level-badge{display:inline-flex;align-items:center;padding:3px 7px;border-radius:999px;background:rgba(95,165,255,.12);color:#8fb8ff;font-size:8px;font-weight:900}.damage-pct{color:#ff8f68!important;font-weight:900}.item-type-label{color:#aab4c8}.case-roll-tile.target-tile{box-shadow:0 0 0 2px var(--rarity,#f0c44d),0 0 32px color-mix(in srgb,var(--rarity,#f0c44d) 55%,transparent)}.sbd-chest-art{position:relative;width:72px;height:58px;margin-bottom:8px;filter:drop-shadow(0 12px 14px rgba(0,0,0,.42))}.sbd-chest-lid{position:absolute;left:5px;right:5px;top:2px;height:23px;border:3px solid #161a20;border-radius:13px 13px 6px 6px;background:linear-gradient(180deg,color-mix(in srgb,var(--rarity,#c4cad4) 88%,white),var(--rarity,#c4cad4))}.sbd-chest-body{position:absolute;left:2px;right:2px;bottom:0;height:39px;border:3px solid #161a20;border-radius:7px 7px 11px 11px;background:linear-gradient(135deg,color-mix(in srgb,var(--rarity,#c4cad4) 82%,white),color-mix(in srgb,var(--rarity,#c4cad4) 68%,black))}.sbd-chest-band{position:absolute;z-index:2;left:31px;top:6px;bottom:4px;width:10px;border:2px solid #141820;border-radius:3px;background:#f1c84e}.sbd-chest-lock{position:absolute;z-index:3;left:27px;top:28px;width:18px;height:16px;border:2px solid #11151c;border-radius:4px;background:#f5d563;color:#151922;font-size:7px;font-weight:950;display:grid;place-items:center}.case-target-caption{position:absolute;left:50%;bottom:5px;transform:translateX(-50%);font-size:7px;color:var(--rarity,#fff);font-weight:900;white-space:nowrap;max-width:100px;overflow:hidden;text-overflow:ellipsis}.combat-loot-line{display:block;margin-top:9px;padding:8px;border-radius:10px;background:rgba(255,255,255,.04);color:#eaf0f8}
    @media(max-width:390px){.xp-chip{padding:5px 7px;font-size:9px}.xp-stats{grid-template-columns:1fr}.rpg-statline{grid-template-columns:1fr}.rpg-statbox b{font-size:16px}.xp-panel{top:52px}.rpg-enemy{width:165px;height:165px;font-size:90px}.rpg-enemy-stage{min-height:220px}.equipment-slots{grid-template-columns:1fr}.odds-grid{grid-template-columns:1fr}.bestiary-grid{grid-template-columns:1fr}.codex-grid{grid-template-columns:repeat(2,1fr)}}
  `;
  const style = document.createElement('style');
  style.textContent = css;

  style.textContent += `
    .raid-card{margin-top:12px;padding:15px;border-radius:18px;border:1px solid rgba(137,88,255,.28);background:radial-gradient(circle at 50% 0,rgba(105,61,255,.22),transparent 58%),linear-gradient(145deg,rgba(255,255,255,.035),rgba(255,255,255,.012));box-shadow:0 18px 40px rgba(14,8,40,.3)}
    .raid-card-head{display:flex;align-items:center;gap:10px}.raid-card-icon{font-size:34px}.raid-card-copy{min-width:0;flex:1}.raid-card-copy b{display:block;font-size:13px}.raid-card-copy span{display:block;margin-top:3px;font-size:9px;color:#a8a0c8}.raid-status{padding:5px 8px;border-radius:999px;font-size:8px;font-weight:950;background:rgba(143,105,255,.15);color:#c9b8ff}.raid-countdown{margin-top:11px;text-align:center;font-size:24px;font-weight:950;color:#c9b8ff;letter-spacing:.04em}.raid-meta-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:7px;margin-top:10px}.raid-meta-grid div{padding:9px;border-radius:11px;background:rgba(255,255,255,.035);text-align:center}.raid-meta-grid b{display:block;font-size:12px}.raid-meta-grid span{display:block;margin-top:3px;font-size:7px;color:#8580a0;text-transform:uppercase}.raid-message{margin-top:10px;font-size:9px;line-height:1.5;color:#b6afca}.raid-action{width:100%;margin-top:10px;border:1px solid rgba(177,143,255,.35);border-radius:12px;padding:12px;background:linear-gradient(135deg,rgba(98,54,230,.42),rgba(207,43,61,.24));color:#fff;font-weight:950;cursor:pointer}.raid-action:disabled{opacity:.45;cursor:not-allowed}.raid-roster{display:grid;gap:5px;margin-top:10px}.raid-roster-row{display:grid;grid-template-columns:1fr auto;gap:8px;padding:7px 9px;border-radius:9px;background:rgba(255,255,255,.025);font-size:8px}.raid-roster-row strong{color:#eee}.raid-roster-row span{color:#a6a0b8}.raid-case-card{padding:13px;border-radius:15px;border:1px solid rgba(157,108,255,.25);background:radial-gradient(circle at 20% 0,rgba(113,65,255,.22),transparent 55%),rgba(255,255,255,.025)}.raid-case-head{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:9px}.raid-case-head b{display:block;font-size:11px}.raid-case-head small{display:block;margin-top:3px;color:#9c95b1;font-size:8px}.raid-case-head>strong{font-size:22px;color:#c9b8ff}.raid-case-icon{font-size:26px}.raid-case-rates{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin:10px 0;font-size:8px;color:#bdb5d1}.raid-overlay{display:none;position:fixed;z-index:650;inset:0;background:radial-gradient(circle at 50% 30%,rgba(85,48,190,.35),rgba(3,5,12,.97) 62%);padding:18px;overflow:auto}.raid-overlay.show{display:grid;place-items:center}.raid-arena{width:min(100%,430px);padding:18px;border-radius:24px;border:1px solid rgba(170,133,255,.25);background:#080b15;box-shadow:0 30px 80px rgba(0,0,0,.65)}.raid-arena-head{display:flex;justify-content:space-between;align-items:center}.raid-arena-title{font-size:12px;font-weight:950;color:#c9b8ff}.raid-clock{font-size:24px;font-weight:950;color:#fff}.raid-boss-name{text-align:center;margin-top:9px;font-size:15px;font-weight:950}.raid-infinite{text-align:center;margin-top:4px;font-size:10px;color:#9c95b1}.raid-stage{position:relative;min-height:250px;margin-top:10px;border-radius:20px;display:grid;place-items:center;overflow:hidden;background:radial-gradient(circle at 50% 50%,rgba(111,64,242,.24),transparent 45%),linear-gradient(180deg,#11162a,#070912)}.raid-stage:before{content:"";position:absolute;inset:-40%;background:repeating-conic-gradient(from 0deg,rgba(150,110,255,.1) 0 8deg,transparent 8deg 20deg);animation:raidSpin 12s linear infinite}.raid-boss-button{position:relative;z-index:2;width:170px;height:170px;border:0;border-radius:50%;background:radial-gradient(circle,rgba(148,99,255,.35),rgba(18,13,38,.9) 60%);font-size:92px;cursor:pointer;filter:drop-shadow(0 0 25px rgba(141,88,255,.42))}.raid-boss-button.hit{transform:scale(.94)}.raid-info{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:10px}.raid-info div{padding:9px;border-radius:11px;background:rgba(255,255,255,.035);text-align:center}.raid-info b{display:block;font-size:13px}.raid-info span{font-size:7px;color:#8f89a2;text-transform:uppercase}.raid-result{display:none;text-align:center}.raid-result.show{display:block}.raid-result h2{color:#c9b8ff}.raid-result p{font-size:10px;line-height:1.6;color:#c8c3d4}.raid-close{width:100%;border:0;border-radius:12px;padding:12px;background:#c9b8ff;color:#111522;font-weight:950}.raid-key-overlay{display:none;position:fixed;z-index:720;inset:0;background:rgba(2,4,10,.88);padding:20px}.raid-key-overlay.show{display:grid;place-items:center}.raid-key-card{max-width:390px;padding:24px;border-radius:24px;text-align:center;border:1px solid rgba(240,196,77,.35);background:radial-gradient(circle at 50% 0,rgba(240,196,77,.16),transparent 55%),#0a0d16;box-shadow:0 30px 80px rgba(0,0,0,.6)}.raid-key-icon{font-size:62px}.raid-key-card h2{color:#f0c44d}.raid-key-card p{font-size:13px;line-height:1.6}.raid-key-card button{border:0;border-radius:12px;padding:12px 16px;background:#f0c44d;color:#171a22;font-weight:950}.rpg-damage-pop.raid-pop{color:#d6c4ff}
    @keyframes raidSpin{to{transform:rotate(360deg)}}
  `;
  document.head.appendChild(style);

  function n(value, fallback = 0) {
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
    // Niveau 1 -> 2 : 50 XP, puis chaque niveau coûte x1,20 (arrondi à l'entier).
    return Math.max(1, Math.round(50 * Math.pow(1.2, Math.max(0, n(level, 1) - 1))));
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
    return { level, into: totalXp - spent, cost };
  }

  function levelFromXp(xp) {
    return xpProgressFromTotal(xp).level;
  }

  function caseCost(tier) {
    return 100 + Math.max(0, n(tier)) * 150;
  }

  function upgradeCost(rank) {
    return 75 * (Math.max(0, n(rank)) + 1);
  }



function currentAdventureDifficulty() {
  return Math.min(1000, Math.max(1, Math.floor(n(progress?.adventure_difficulty, 1))));
}

function difficultyHpMultiplier(value = currentAdventureDifficulty()) {
  const d = Math.min(1000, Math.max(1, Math.floor(n(value, 1))));
  return Math.pow(20000, (d - 1) / 99);
}

function difficultyXpMultiplier() {
  return 1;
}

function difficultyGoldMultiplier(value = currentAdventureDifficulty()) {
  const d = Math.min(1000, Math.max(1, Math.floor(n(value, 1))));
  if (d <= 100) return 0.12 * Math.pow(100, (d - 1) / 99);
  return 12 * Math.pow(100, (d - 100) / 900);
}

function effectiveChancePoints() {
  return Math.max(0, n(statSnapshot().total.mastery));
}

function equippedPassiveTotal(type) {
  return inventory.filter(item => item.equipped && item.passive_type === type)
    .reduce((sum, item) => sum + n(item.passive_value), 0);
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
  return Math.min(5, 1 + equippedPassiveTotal('epic_hunter'));
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
      power: sum.power + n(item.collection_power_bonus) / 10 * COLLECTION_DEPOSIT_MULTIPLIER,
      mastery: sum.mastery + n(item.collection_mastery_bonus) / 10 * COLLECTION_DEPOSIT_MULTIPLIER,
      fortune: sum.fortune + n(item.collection_fortune_bonus) / 10 * COLLECTION_DEPOSIT_MULTIPLIER
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
      { key: 'power', label: def.mainStat, value: stats.total.power, detail: `${fr(stats.base.power,1)} + ${fr(stats.gear.power,1)} équipement + ${fr(stats.collection.power,1)} collection` },
      { key: 'mastery', label: def.masteryStat, value: stats.total.mastery, detail: `${fr(stats.base.mastery,1)} + ${fr(stats.gear.mastery,1)} équipement + ${fr(stats.collection.mastery,1)} collection` },
      { key: 'fortune', label: 'Fortune', value: stats.total.fortune, detail: `${fr(stats.base.fortune,1)} + ${fr(stats.gear.fortune,1)} équipement + ${fr(stats.collection.fortune,1)} collection` }
    ];
  }

  function monsterEmoji(name) {
  const value = String(name || '').toLowerCase();
  if (value.includes('noah')) return '🥸';
  if (value.includes('kazuto') || value.includes('lonely shadow cowboy') || value.includes('val,')) return '🧔‍♂️';
  if (value.includes('donut')) return '🍩';
  if (value.includes('poulet')) return '🍗';
  if (value.includes('fromage blanc')) return '🥣';
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

function monsterVisual(name) {
  const value = String(name || '').toLowerCase();
  if (value.includes('kazuto') || value.includes('lonely shadow cowboy') || value.includes('val,')) {
    return `<div class="rpg-boss-skin"><div class="rpg-boss-face">🧔‍♂️</div><div class="rpg-boss-note">yeux bleus · tatouages<small>The Shadow · Lonely Shadow Cowboy</small></div></div>`;
  }
  return esc(monsterEmoji(name));
}

  function inject() {
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
        <div class="xp-panel-head"><h2>⚡ Progression RPG</h2><button type="button" id="xpPanelClose">Fermer</button></div>
        <div id="xpPanelBody"></div>`;
      document.body.appendChild(panel);
      chip?.addEventListener('click', () => { panel.classList.toggle('show'); render(); });
      document.getElementById('xpPanelClose')?.addEventListener('click', () => panel.classList.remove('show'));
      panel.addEventListener('click', event => {
        const tabButton = event.target.closest('[data-xp-tab]');
        if (tabButton) {
          activeTab = tabButton.dataset.xpTab;
          render();
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
        const equipButton = event.target.closest('[data-equip-item]');
        if (equipButton) equipItem(equipButton.dataset.equipItem);
        const sellButton = event.target.closest('[data-sell-item]');
        if (sellButton) sellItem(sellButton.dataset.sellItem);
        const depositButton = event.target.closest('[data-deposit-item]');
        if (depositButton) depositItem(depositButton.dataset.depositItem);
        if (event.target.closest('[data-deposit-all]')) depositAllItems();
        if (event.target.closest('[data-sell-all]')) sellAllItems();
        const caseButton = event.target.closest('[data-open-case]');
        if (caseButton) openCases(n(caseButton.dataset.openCase), n(caseButton.dataset.openCount, 1));
      });
      panel.addEventListener('input', event => {
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

  function statInfluenceHtml(stats) {
    const powerTotal = n(stats.find(stat => stat.key === 'power')?.value);
    const fortuneTotal = n(stats.find(stat => stat.key === 'fortune')?.value);
    return `<div class="rpg-influence-grid">
      <div class="rpg-influence"><b>Force</b> dégâts de base +${fr(powerTotal * 4, 1)} %</div>
      <div class="rpg-influence"><b>Chance</b> critique ${fr(critChancePct(),2)} % · jackpot gold ×10 ${fr(goldJackpotChancePct(),2)} % · influence caisse ${fr(caseLuckBoostPct(),2)} % · monstre épique ${fr(epicMonsterChancePct(),2)} %</div>
      <div class="rpg-influence"><b>Fortune</b> gold +${fr(fortuneTotal * 3, 1)} %</div>
    </div>`;
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
        <div class="rpg-avatar">${def.icon}</div>
        <div class="rpg-profile-copy"><b>${def.title}</b><span>${def.subtitle} · choix définitif</span></div>
      </div>
      <div class="rpg-statline">${stats.map(stat => `<div class="rpg-statbox"><b title="${esc(fr(stat.value,3))}">${fr(stat.value,1)}</b><span>${esc(stat.label)}</span><small>${esc(stat.detail)}</small></div>`).join('')}</div>
      ${statInfluenceHtml(stats)}
      <div class="rpg-combat-record"><span>Victoires <b>${n(progress?.combat_wins)}</b></span><span>Défaites <b>${n(progress?.combat_losses)}</b></span><span>Boss vaincus <b>${n(progress?.boss_wins)}</b></span></div>
      <div class="boss-gate">
        <div class="boss-gate-head"><b>Palier de difficulté actuel</b><span class="boss-level">${currentAdventureDifficulty()}</span></div>
        <div class="boss-progress"><span style="width:${Math.min(100,n(progress?.kills_toward_boss)/50*100)}%"></span></div>
        <div class="boss-copy"><strong>${n(progress?.kills_toward_boss)}/50 monstres vaincus</strong> avant l’accès au boss. Chaque boss battu débloque le palier suivant, jusqu’au palier ultime 1000.</div>
        <div class="boss-mults"><span>Monstres : PV ×${fr(difficultyHpMultiplier(),2)}</span><span>Gold ×${fr(difficultyGoldMultiplier(),2)}</span></div>
        <button type="button" id="rpgBossLaunch" class="boss-launch" ${!canPlay || n(progress?.kills_toward_boss)<50 ? 'disabled' : ''}>${n(progress?.kills_toward_boss)>=50 ? (currentAdventureDifficulty() >= 1000 ? '👑 Affronter le boss final du palier 1000' : `👑 Affronter le boss du palier ${currentAdventureDifficulty()}`) : `🔒 Boss verrouillé · ${50-n(progress?.kills_toward_boss)} victoire${50-n(progress?.kills_toward_boss)===1?'':'s'} restante${50-n(progress?.kills_toward_boss)===1?'':'s'}`}</button>
        <div class="boss-lock">Boss : environ ×6 les PV du palier. ${currentAdventureDifficulty() >= 1000 ? 'Victoire = palier ultime validé.' : `Victoire = difficulté ${currentAdventureDifficulty()+1} débloquée.`}</div>
      </div>
      <button type="button" id="rpgLaunch" class="rpg-launch" ${canPlay ? '' : 'disabled'}>${canPlay ? `⚔️ Combattre au palier ${currentAdventureDifficulty()}` : 'Combat en lecture seule'}</button>
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
    const level = xpProgress.level;
    const into = xpProgress.into;
    const nextCost = xpProgress.cost;
    const pct = Math.max(0, Math.min(100, into / nextCost * 100));
    const gl = n(progress?.gl_points, 0);
    const mult = n(progress?.gl_multiplier, 1);
    const gold = n(progress?.gold_balance, 0);
    return `
      <div class="xp-hero">
        <div class="xp-level">Niveau ${level}</div>
        <div class="xp-total">${fr(xp, 1)} <small>XP au total</small></div>
        <div class="xp-progress"><span style="width:${pct}%"></span></div>
        <div class="xp-next"><span>${fr(into, 1)} / ${fr(nextCost, 0)} XP</span><span>Niveau ${level + 1}</span></div>
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
    const tier = Math.floor((level - 1) / 5);
    const casePrice = 100 + tier * 150;
    const fullValue = casePrice * Math.pow(1.01, level - 1) * (ITEM_VALUE_RARITY_MULTIPLIER[item?.rarity] || 1);
    return Math.max(1, Math.floor(fullValue * 0.10 * (1 + equippedPassiveTotal('resale_bonus') / 100)));
  }

  function passiveText(item) {
    const def = PASSIVE_DEFS[item?.passive_type];
    if (!def || n(item?.passive_value) <= 0) return '';
    const value = fr(item.passive_value, item.passive_type === 'case_luck' ? 3 : 2);
    if (item.passive_type === 'case_luck') return `${def.icon} ${def.label} +${value} · bonus de caisse extrêmement faible`;
    if (item.passive_type === 'epic_hunter') return `${def.icon} ${def.label} +${value} points de rencontre épique`;
    return `${def.icon} ${def.label} +${value} % de revente`;
  }

  function itemStatsText(item) {
    const values = [];
    const power = n(item.scaled_power_bonus, n(item.power_bonus));
    const mastery = n(item.scaled_mastery_bonus, n(item.mastery_bonus));
    const fortune = n(item.scaled_fortune_bonus, n(item.fortune_bonus));
    if (n(item.item_level)) values.push(`Niveau ${n(item.item_level)}`);
    if (n(item.damage_bonus_pct)) values.push(`Dégâts +${fr(item.damage_bonus_pct, 2)} %`);
    if (power) values.push(`Puissance +${fr(power, 2)}`);
    if (mastery) values.push(`Chance +${fr(mastery, 2)}`);
    if (fortune) values.push(`Fortune +${fr(fortune, 2)}`);
    if (n(item.stat_growth_rate)) values.push(`Stats ×${fr(item.stat_growth_rate, 4)}/niveau`);
    if (n(item.passive_growth_rate)) values.push(`Passifs ×${fr(item.passive_growth_rate, 4)}/niveau`);
    if (passiveText(item)) values.push(passiveText(item));
    values.push(`Revente ${fr(itemSaleEstimate(item),0)} gold`);
    if (String(item?.item_name || '').toLowerCase() === 'licence pwl') values.push('Gold combat +10 %');
    return values.join(' · ') || 'Aucun bonus';
  }

  function catalogCollectionText(item) {
    const values = [];
    if (n(item.collection_power_bonus)) values.push(`Force +${fr(n(item.collection_power_bonus) / 10 * COLLECTION_DEPOSIT_MULTIPLIER, 1)}`);
    if (n(item.collection_mastery_bonus)) values.push(`Chance +${fr(n(item.collection_mastery_bonus) / 10 * COLLECTION_DEPOSIT_MULTIPLIER, 1)}`);
    if (n(item.collection_fortune_bonus)) values.push(`Fortune +${fr(n(item.collection_fortune_bonus) / 10 * COLLECTION_DEPOSIT_MULTIPLIER, 1)}`);
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
      if (!item.catalog_key || deposited.has(item.catalog_key)) continue;
      if (item.equipped && n(item.quantity, 1) <= 1) continue;
      eligible.add(item.catalog_key);
    }
    return eligible.size;
  }

  function sellAllEligibleQuantity() {
    return inventory
      .filter(item => !item.equipped)
      .reduce((sum, item) => sum + n(item.quantity, 1), 0);
  }

  function inventoryHtml() {
    if (!inventory.length) return '<div class="empty-state">Ton inventaire est vide.<br>Ouvre une case ou bats un monstre pour obtenir ton premier objet.</div>';
    const level = currentAdventureDifficulty();
    const canEdit = !!window.CoachingCloud?.canEditAthlete?.(cfg.slug);
    const visible = filteredSortedInventory();
    const depositCount = depositAllEligibleCount();
    const sellCount = sellAllEligibleQuantity();
    const bulkActions = `<div class="inventory-bulk-actions">
      <button type="button" class="deposit-all-button" data-deposit-all ${!canEdit || collectionBusy || depositCount <= 0 ? 'disabled' : ''}>📚 Tout déposer<br><small>${depositCount} objet${depositCount>1?'s':''} unique${depositCount>1?'s':''}</small></button>
      <button type="button" class="sell-all-button" data-sell-all ${!canEdit || collectionBusy || sellCount <= 0 ? 'disabled' : ''}>🪙 Tout vendre<br><small>${sellCount} exemplaire${sellCount>1?'s':''}</small></button>
      <div class="inventory-bulk-note">Tout déposer consomme un exemplaire de chaque objet unique absent du codex. Tout vendre supprime tous les objets non équipés ; les objets actuellement portés sont protégés.</div>
    </div>`;
    return `${bulkActions}${inventoryToolbarHtml()}${visible.length ? `<div class="inventory-list">${visible.map(item => {
      const rarity = RARITY_DEFS[item.rarity] || RARITY_DEFS.normal;
      const slot = SLOT_DEFS[item.slot] || { label: item.slot, icon: '🎒' };
      const locked = level < n(item.required_level, 1);
      return `<article class="inventory-card rarity-${esc(item.rarity)} ${item.equipped ? 'equipped' : ''}">
        <div class="inventory-top"><div><div class="inventory-name">${rarity.icon} ${esc(item.item_name)}</div><div class="inventory-meta">${slot.icon} ${esc(slot.label)} · <span class="item-type-label">${esc(item.item_type || 'generic')}</span> · ${rarity.label} · <span class="item-level-badge">Niv. ${n(item.item_level,1)}</span> · <span class="inventory-copy-count">${n(item.quantity,1)} exemplaire${n(item.quantity,1)>1?'s':''}</span></div></div><div>${item.equipped ? '<span title="Équipé">✅</span>' : ''}${n(item.quantity,1)>1?`<span class="stack-badge">×${n(item.quantity,1)}</span>`:''}</div></div>
        <div class="inventory-stats">${itemStatsText(item).split(' · ').map(value => { const cls=value.startsWith('Dégâts')?'damage-pct':value.startsWith('Revente')?'sale-preview':/Chasseur épique|Instinct du coffre|Marchandage/.test(value)?'item-passive':''; return `<span class="${cls}">${esc(value)}</span>`; }).join('')}</div>
        <div class="inventory-actions"><button type="button" class="equip-button" data-equip-item="${esc(item.id)}" ${!canEdit || item.equipped || locked || collectionBusy ? 'disabled' : ''}>${item.equipped ? 'Équipé' : locked ? `Palier ${n(item.required_level)}` : 'Équiper'}</button><button type="button" class="deposit-button" data-deposit-item="${esc(item.id)}" ${!canEdit || collectionBusy || itemCollection.some(row => row.catalog_key === item.catalog_key) ? 'disabled' : ''}>${itemCollection.some(row => row.catalog_key === item.catalog_key) ? 'Déjà au codex' : 'Déposer 1'}</button><button type="button" class="sell-button" data-sell-item="${esc(item.id)}" ${!canEdit || collectionBusy || item.equipped ? 'disabled' : ''}>Vendre 1<br><small>${fr(itemSaleEstimate(item),0)} 🪙</small></button></div>
      </article>`;
    }).join('')}</div>` : '<div class="inventory-empty-filter">Aucun objet ne correspond à ces filtres.</div>'}`;
  }

  function equipmentHtml() {
    const def = CLASS_DEFS[progress?.rpg_class] || CLASS_DEFS.warrior;
    return `
      <div class="gold-wallet"><div><span>TON PORTE-MONNAIE</span><strong>🪙 ${fr(progress?.gold_balance, 0)} gold</strong></div><span>Total gagné : ${fr(progress?.gold_total_earned, 0)}</span></div>
      <div class="xp-section"><div class="xp-section-title">Améliorer les statistiques</div><div class="upgrade-grid">
        ${statUpgradeHtml('power', def.mainStat, 'Dégâts +4 % / rang.')}
        ${statUpgradeHtml('mastery', 'Chance', 'Critique · jackpot gold ×10 · caisse très faible.')}
        ${statUpgradeHtml('fortune', 'Fortune', 'Gold +3 % / rang.')}
      </div></div>
      <div class="xp-section"><div class="xp-section-title">Équipement porté</div>${equippedSlotsHtml()}</div>
      <div class="xp-section"><div class="xp-section-title">Inventaire (${inventory.reduce((sum,item)=>sum+n(item.quantity,1),0)} objets · ${inventory.length} piles)</div>${inventoryHtml()}</div>`;
  }

  function casesHtml() {
    const level = n(progress?.level, 1);
    const gold = n(progress?.gold_balance, 0);
    const maxTier = Math.floor(level / 5);
    const lastShownTier = Math.min(30, Math.max(4, maxTier + 2));
    const canEdit = !!window.CoachingCloud?.canEditAthlete?.(cfg.slug);
    const cases = Array.from({ length: lastShownTier + 1 }, (_, tier) => {
      const cost = caseCost(tier);
      const locked = tier > maxTier;
      return `<div class="case-card ${locked ? 'locked' : ''}">
        <div class="case-crate">${locked ? '🔒' : '🧰'}</div>
        <div><b>Case SBD niveaux ${tier * 5}-${tier * 5 + 4}</b><small>${locked ? `Déblocage niveau ${tier * 5}` : `Une animation obligatoire accompagne chaque ouverture · ${cost} gold/unité`}</small></div>
        <div class="case-buy-grid">${CASE_COUNTS.map(count => `<button type="button" class="case-buy-button" data-open-case="${tier}" data-open-count="${count}" ${locked || gold < cost * count || !canEdit || openingCase ? 'disabled' : ''}><strong>×${count}</strong>${fr(cost * count,0)} 🪙</button>`).join('')}</div>
      </div>`;
    }).join('');
    const raidBalance = n(progress?.raid_ultra_cases);
    const raidCase = `<div class="raid-case-card"><div class="raid-case-head"><span class="raid-case-icon">🌀🎁</span><div><b>Caisse Ultra de raid</b><small>Récompense des portails mondiaux · niveau d’objet égal au niveau du raid</small></div><strong>${raidBalance}</strong></div><div class="raid-case-rates"><span>🫧 Abyssal 0,01 %</span><span>🌟 Ultra méga mythique 0,10 %</span><span>🔴 Mythique 1 %</span><span>🟡 Légendaire 10 %</span><span>🟠 Épique 30 %</span><span>🟣 Rare 35 %</span></div><div class="case-buy-grid">${CASE_COUNTS.map(count => `<button type="button" class="case-buy-button" data-open-raid-case="${count}" ${raidBalance<count || !canEdit || openingCase ? 'disabled' : ''}><strong>×${count}</strong>GRATUIT</button>`).join('')}</div></div>`;
    return `
      <div class="gold-wallet"><div><span>GOLD DISPONIBLE</span><strong>🪙 ${fr(gold, 0)}</strong></div><span>Caisses Ultra : ${raidBalance}</span></div>
      <div class="xp-section"><div class="xp-section-title">Récompenses de raid</div>${raidCase}</div>
      <div class="xp-section"><div class="xp-section-title">Probabilités transparentes</div><div class="odds-grid">${Object.entries(RARITY_DEFS).map(([key, rarity]) => { const odds=normalCaseOdds()[key] ?? rarity.rate; return `<div class="odds-row rarity-${key}"><b>${rarity.icon} ${rarity.label}</b><span>${fr(odds, odds < 0.01 ? 5 : odds < 1 ? 3 : 2)} %</span></div>`; }).join('')}</div><div class="case-note">La Chance applique une pondération très faible et dégressive. Ton Abyssal reste actuellement autour de 1 chance sur ${Math.max(1,Math.round(100/(normalCaseOdds().abyssal||0.001))).toLocaleString('fr-FR')}. Le passif Instinct du coffre améliore légèrement cette pondération, sans transformer les objets ultimes en drops courants.</div></div>
      <div class="xp-section"><div class="xp-section-title">Case opening par tranche de niveau</div><div class="case-list">${cases}</div></div>`;
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
    <div class="bestiary-tools"><input id="bestiarySearch" type="search" value="${esc(bestiarySearch)}" placeholder="Rechercher parmi les ${total} monstres…"><select id="bestiaryRarityFilter"><option value="all">Toutes raretés</option>${Object.entries(MONSTER_RARITY_DEFS).map(([key,def])=>`<option value="${key}" ${bestiaryRarityFilter===key?'selected':''}>${def.icon} ${def.label}</option>`).join('')}</select><select id="bestiaryStatusFilter"><option value="all" ${bestiaryStatusFilter==='all'?'selected':''}>Tous</option><option value="found" ${bestiaryStatusFilter==='found'?'selected':''}>Découverts</option><option value="missing" ${bestiaryStatusFilter==='missing'?'selected':''}>Non découverts</option></select><select id="bestiaryCategoryFilter"><option value="all">Toutes catégories</option>${categories.map(category=>`<option value="${esc(category)}" ${bestiaryCategoryFilter===category?'selected':''}>${esc(category)}</option>`).join('')}</select><div class="bestiary-filter-count">${filtered.length} monstre${filtered.length>1?'s':''} affiché${filtered.length>1?'s':''} · Val : 1/10 000 · Noah : 1/1 000 · Hanzalone : 1/1 000 000 à difficulté 1.</div></div>
    <div class="bestiary-grid">${filtered.map(monster => {
      const entry = discovered.get(monster.monster_key);
      const hidden = !monster.visible_before_discovery && !entry;
      const def = MONSTER_RARITY_DEFS[monster.rarity] || MONSTER_RARITY_DEFS.common;
      const name = hidden ? '???' : monster.monster_name;
      const icon = hidden ? (monster.rarity === 'secret' ? '🌈❓' : '❓') : monster.icon;
      return `<article class="monster-card rarity-${esc(monster.rarity)} ${entry ? 'discovered' : 'undiscovered'} ${hidden ? 'hidden-monster' : ''}">
        ${entry ? `<span class="monster-kills">×${n(entry.kills)}</span>` : ''}<div class="monster-icon">${esc(icon)}</div><div class="monster-name">${esc(name)}</div>
        <div class="monster-meta">${def.icon} ${hidden ? 'Rareté inconnue' : def.label}${entry ? ' · découvert' : ' · non découvert'}</div>
        <div class="monster-category">${hidden ? 'Archive inconnue' : esc(monster.category || 'Autres')}</div>
        ${entry ? `<div class="monster-discovery-date">Première victoire : ${esc(formatCollectionDate(entry.first_discovered_at))}</div>` : ''}
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
      .select('athlete_slug,xp_total,level,unopened_packs,gl_points,gl_multiplier,rpg_class,class_chosen_at,combat_wins,combat_losses,best_combat_damage,gold_balance,gold_total_earned,stat_power,stat_mastery,stat_fortune,collection_xp_bonus,best_damage_trial,damage_trial_attempts,last_damage_trial_at,adventure_difficulty,kills_toward_boss,boss_wins,last_boss_at,raid_ultra_cases')
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
      best_damage_trial: 0, damage_trial_attempts: 0, last_damage_trial_at: null, raid_ultra_cases: 0, adventure_difficulty: 1, kills_toward_boss: 0, boss_wins: 0, last_boss_at: null
    };
    progress = {
      best_damage_trial: 0, damage_trial_attempts: 0, last_damage_trial_at: null,
      raid_ultra_cases: 0, adventure_difficulty: 1, kills_toward_boss: 0,
      boss_wins: 0, last_boss_at: null,
      ...progress
    };
    render();
  }

  async function loadInventory() {
    if (!window.CoachingCloud?.client || !CoachingCloud.session?.user) return;
    let result = await CoachingCloud.client
      .from('rpg_inventory')
      .select('id,athlete_slug,item_name,rarity,slot,case_tier,required_level,power_bonus,mastery_bonus,fortune_bonus,scaled_power_bonus,scaled_mastery_bonus,scaled_fortune_bonus,stat_growth_rate,passive_growth_rate,equipped,source,catalog_key,quantity,item_level,damage_bonus_pct,item_type,passive_type,passive_value,obtained_at')
      .eq('athlete_slug', cfg.slug)
      .order('obtained_at', { ascending: false });
    if (result.error && /(passive_|growth_rate|scaled_)/i.test(result.error.message || '')) {
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
    else monsterCatalog = Array.isArray(monsters.data) ? monsters.data : [];

    if (monsterOwned.error) console.warn('Bestiaire de l’athlète indisponible :', monsterOwned.error.message);
    else monsterCollection = Array.isArray(monsterOwned.data) ? monsterOwned.data : [];

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
          monster_name: owned.monster_name || owned.monster_key.replaceAll('_', ' '),
          rarity: owned.rarity || 'common',
          icon: '👾',
          xp_bonus: 0,
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

  async function openRaidCases(count = 1) {
    count = CASE_COUNTS.includes(Number(count)) ? Number(count) : 1;
    if (openingCase || n(progress?.raid_ultra_cases) < count) return;
    openingCase = true;
    render();
    const { data, error } = await CoachingCloud.client.rpc('open_rpg_raid_cases', {
      p_athlete_slug: cfg.slug,
      p_quantity: count
    });
    if (error) {
      openingCase = false;
      CoachingCloud.toast(`Ouverture Ultra impossible : ${error.message}`, true);
      render();
      return;
    }
    const items = (Array.isArray(data) ? data : data ? [data] : []).map(row => ({
      ...row,
      item_level: row.item_level ?? row.awarded_item_level,
      damage_bonus_pct: row.damage_bonus_pct ?? row.awarded_damage_bonus_pct,
      power_bonus: row.power_bonus ?? row.awarded_power_bonus,
      mastery_bonus: row.mastery_bonus ?? row.awarded_mastery_bonus,
      fortune_bonus: row.fortune_bonus ?? row.awarded_fortune_bonus,
      item_slot: row.item_slot ?? row.slot
    }));
    if (!items.length) {
      openingCase = false;
      render();
      return;
    }
    progress = { ...progress, raid_ultra_cases: n(items.at(-1)?.raid_cases_balance_after, progress?.raid_ultra_cases) };
    await loadInventory();
    await playCaseOpeningAnimation(items, Math.floor(n(items[0]?.item_level, 1) / 5), count, 'Ouverture des caisses Ultra de raid');
    for (const item of items.filter(item => ['legendary','mythic','ultra_mythic','abyssal'].includes(item.item_rarity))) await publishLootActivity(item);
    openingCase = false;
    render();
  }

  async function loadAll() {
    await Promise.all([loadProgress(), loadInventory(), loadCollections(), loadRaid()]);
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
    if (!confirm(`Déposer automatiquement ${count} objet${count>1?'s':''} unique${count>1?'s':''} dans le codex ? Un exemplaire de chaque objet sera consommé. Les objets équipés sans doublon seront conservés.`)) return;
    collectionBusy = true;
    render();
    const { data, error } = await CoachingCloud.client.rpc('deposit_all_rpg_collection_items', {
      p_athlete_slug: cfg.slug
    });
    collectionBusy = false;
    if (error) {
      CoachingCloud.toast(`Dépôt global impossible : ${error.message}`, true);
      render();
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    CoachingCloud.toast(`${n(row?.deposited_count)} objet${n(row?.deposited_count)>1?'s':''} ajouté${n(row?.deposited_count)>1?'s':''} au codex${n(row?.skipped_count)>0?` · ${n(row.skipped_count)} ignoré${n(row.skipped_count)>1?'s':''}`:''}.`);
    activeTab = 'collection';
    collectionSubTab = 'items';
    await Promise.all([loadInventory(), loadCollections(), loadProgress()]);
  }

  async function sellAllItems() {
    const count = sellAllEligibleQuantity();
    if (collectionBusy || count <= 0) return;
    if (!confirm(`Vendre définitivement les ${count} exemplaire${count>1?'s':''} non équipé${count>1?'s':''} de ton inventaire ? Les objets portés ne seront pas vendus.`)) return;
    collectionBusy = true;
    render();
    const { data, error } = await CoachingCloud.client.rpc('sell_all_rpg_items', {
      p_athlete_slug: cfg.slug
    });
    collectionBusy = false;
    if (error) {
      CoachingCloud.toast(`Vente globale impossible : ${error.message}`, true);
      render();
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    CoachingCloud.toast(`${n(row?.items_sold)} objet${n(row?.items_sold)>1?'s':''} vendu${n(row?.items_sold)>1?'s':''} · +${fr(row?.gold_gained,0)} gold.`);
    await Promise.all([loadProgress(), loadInventory()]);
  }

  async function openCases(tier, count = 1) {
    count = CASE_COUNTS.includes(Number(count)) ? Number(count) : 1;
    if (openingCase) return;
    openingCase = true;
    render();
    const { data, error } = await CoachingCloud.client.rpc('open_rpg_cases', {
      p_athlete_slug: cfg.slug,
      p_case_tier: tier,
      p_quantity: count
    });
    if (error) {
      openingCase = false;
      CoachingCloud.toast(`Ouverture impossible : ${error.message}`, true);
      render();
      return;
    }
    const items = (Array.isArray(data) ? data : data ? [data] : []).map(row => ({
      ...row,
      power_bonus: row.power_bonus ?? row.awarded_power_bonus,
      mastery_bonus: row.mastery_bonus ?? row.awarded_mastery_bonus,
      fortune_bonus: row.fortune_bonus ?? row.awarded_fortune_bonus,
      item_level: row.item_level ?? row.awarded_item_level,
      damage_bonus_pct: row.damage_bonus_pct ?? row.awarded_damage_bonus_pct,
      item_slot: row.item_slot ?? row.slot,
      opened_case_tier: row.opened_case_tier ?? row.case_tier
    }));
    if (!items.length) {
      openingCase = false;
      render();
      return;
    }
    progress = { ...progress, gold_balance: n(items.at(-1)?.gold_balance_after, progress?.gold_balance) };
    await loadInventory();
    await playCaseOpeningAnimation(items, tier, count);
    for (const item of items.filter(item => ['legendary', 'mythic', 'ultra_mythic', 'abyssal'].includes(item.item_rarity))) {
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
      overlay.classList.remove('show');
      panel?.classList.add('show');
      activeTab = 'equipment';
      render();
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
        <div class="rpg-monster-tag" id="rpgMonsterTag">Monstre</div>
        <div class="rpg-hp"><span id="rpgHpBar"></span></div><div class="rpg-hp-label" id="rpgHpLabel">0 / 0 PV</div>
        <div class="rpg-enemy-stage" id="rpgEnemyStage"><button type="button" class="rpg-enemy" id="rpgEnemy">👹</button></div>
        <div class="rpg-combat-info"><div><b id="rpgClicks">0</b>Coups</div><div><b id="rpgDamage">0</b>Dégâts</div><div><b id="rpgPerHit">0</b>Base / coup</div></div>
        <button type="button" class="rpg-abandon" id="rpgAbandon">Abandonner</button>
      </div>
      <div class="rpg-result" id="rpgResult"><h2 id="rpgResultTitle"></h2><p id="rpgResultText"></p><button type="button" class="rpg-result-close" id="rpgResultClose">Revenir à la progression</button></div>
    </div>`;
    document.body.appendChild(overlay);
    document.getElementById('rpgEnemy').addEventListener('click', hitMonster);
    document.getElementById('rpgAbandon').addEventListener('click', finishCombat);
    document.getElementById('rpgResultClose').addEventListener('click', () => {
      overlay.classList.remove('show');
      panel?.classList.add('show');
      combat = null;
    });
    return overlay;
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
        <div class="raid-stage" id="raidStage"><button type="button" class="raid-boss-button" id="raidBossButton">🌀</button></div>
        <div class="raid-info"><div><b id="raidClicks">0</b><span>Coups</span></div><div><b id="raidRawDamage">0</b><span>Dégâts personnels</span></div><div><b id="raidEffectiveDamage">0</b><span>Dégâts avec équipe</span></div></div>
      </div>
      <div class="raid-result" id="raidBattleResult"><h2>CONTRIBUTION ENREGISTRÉE</h2><p id="raidBattleResultText"></p><button type="button" class="raid-close" id="raidBattleClose">Revenir au raid</button></div>
    </div>`;
    document.body.appendChild(overlay);
    document.getElementById('raidBossButton').addEventListener('click', hitRaidBoss);
    document.getElementById('raidBattleClose').addEventListener('click', async () => {
      overlay.classList.remove('show');
      panel?.classList.add('show');
      raidBattle = null;
      await Promise.all([loadProgress(), loadRaid()]);
    });
    return overlay;
  }

  async function startRaidRun() {
    if (!raid?.raid_id || raidBattle || combat || damageTrial) return;
    const button = document.getElementById('rpgRaidStart');
    if (button) button.disabled = true;
    const { data, error } = await CoachingCloud.client.rpc('start_rpg_raid_run', {
      p_athlete_slug: cfg.slug,
      p_raid_id: raid.raid_id
    });
    if (button) button.disabled = false;
    if (error) {
      CoachingCloud.toast(`Raid impossible : ${error.message}`, true);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return;
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
      startedAt: new Date(row.started_at).getTime(),
      clicks: 0,
      rawDamage: 0,
      teamMultiplier: n(row.team_multiplier, 2),
      finishing: false
    };
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
    const elapsed = Date.now() - raidBattle.startedAt;
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
      p_clicks: raidBattle.clicks
    });
    if (error) {
      raidBattle.finishing = false;
      CoachingCloud.toast(`Contribution non enregistrée : ${error.message}`, true);
      return;
    }
    const result = Array.isArray(data) ? data[0] : data;
    document.getElementById('raidFightView').style.display = 'none';
    document.getElementById('raidBattleResult').classList.add('show');
    document.getElementById('raidBattleResultText').innerHTML = `Tu as infligé <strong>${fr(result?.raw_damage,0)} dégâts personnels</strong> en <strong>${n(result?.clicks)} coups</strong>.<br>Avec ${n(result?.participant_count)} participant${n(result?.participant_count)===1?'':'s'}, le bonus collectif est <strong>×${fr(result?.team_multiplier,0)}</strong>, soit <strong>${fr(result?.effective_damage,0)} dégâts effectifs</strong>.<br><br>Récompense estimée : <strong>${n(result?.projected_reward_cases)} caisse${n(result?.projected_reward_cases)===1?'':'s'} Ultra</strong> sur 100 maximum.<br>Le total final est recalculé à la fermeture du portail selon le nombre définitif de participants.<br>Critiques de Chance : <strong>${n(result?.crit_count)}</strong>.`;
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
        <div class="trial-stage" id="trialStage"><div class="trial-portal"></div><div class="trial-map-floor"></div><button type="button" class="trial-dummy" id="trialDummy">🗿</button></div>
        <div class="trial-info"><div><b id="trialClicks">0</b>Coups</div><div><b id="trialDamage">0</b>Dégâts</div><div><b id="trialPerHit">0</b>Base / coup</div></div>
      </div>
      <div class="trial-result" id="trialResult"><h2>TEST TERMINÉ</h2><p id="trialResultText"></p><button type="button" class="trial-close" id="trialClose">Revenir à la progression</button></div>
    </div>`;
    document.body.appendChild(overlay);
    document.getElementById('trialDummy').addEventListener('click', hitDamageTrial);
    document.getElementById('trialClose').addEventListener('click', () => {
      overlay.classList.remove('show');
      panel?.classList.add('show');
      damageTrial = null;
    });
    return overlay;
  }

  async function startDamageTrial() {
    if (!progress?.rpg_class || damageTrial || combat) return;
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
      startedAt: new Date(row.started_at).getTime(),
      clicks: 0,
      damage: 0,
      finishing: false
    };
    const overlay = ensureDamageTrialOverlay();
    panel?.classList.remove('show');
    overlay.classList.add('show');
    document.getElementById('trialFightView').style.display = '';
    document.getElementById('trialResult').classList.remove('show');
    document.getElementById('trialPerHit').textContent = fr(damageTrial.baseDamage, 0);
    updateDamageTrialUi();
    clearInterval(damageTrialTimer);
    damageTrialTimer = setInterval(updateDamageTrialClock, 50);
    updateDamageTrialClock();
  }

  function updateDamageTrialClock() {
    if (!damageTrial || damageTrial.finishing) return;
    const elapsed = Date.now() - damageTrial.startedAt;
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

  async function finishDamageTrial() {
    if (!damageTrial || damageTrial.finishing) return;
    damageTrial.finishing = true;
    clearInterval(damageTrialTimer);
    const { data, error } = await CoachingCloud.client.rpc('finish_rpg_damage_trial', {
      p_trial_id: damageTrial.id,
      p_clicks: damageTrial.clicks
    });
    if (error) {
      damageTrial.finishing = false;
      CoachingCloud.toast(`Test non enregistré : ${error.message}`, true);
      return;
    }
    const result = Array.isArray(data) ? data[0] : data;
    const score = n(result?.damage_dealt);
    const isRecord = !!result?.is_personal_record;
    document.getElementById('trialFightView').style.display = 'none';
    document.getElementById('trialResult').classList.add('show');
    document.getElementById('trialResultText').innerHTML = `Tu as infligé <strong>${fr(score,0)} dégâts</strong> en <strong>${n(result?.clicks)} coups</strong>.<br>${isRecord ? '<strong>🏆 Nouveau record personnel !</strong><br>' : ''}Meilleur score : <strong>${fr(result?.best_damage_trial,0)}</strong>.<br>Critiques de Chance : <strong>${n(result?.crit_count)}</strong>.<br><br>Aucun XP, gold ou objet n’est distribué sur cette carte.`;
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
    let classCrit = false;
    if (classKey === 'warrior') damage = Math.floor(baseDamage * 1.2);
    else if (classKey === 'archer' && clickNo % 5 === 0) { damage = baseDamage * 2; classCrit = true; }
    else if (classKey === 'mage' && clickNo % 10 === 0) { damage = baseDamage * 3; classCrit = true; }
    const luckCrit = deterministicLuckRoll(critSeed, clickNo) < Math.max(0, chancePct) / 100;
    if (luckCrit) damage *= 2;
    return { damage, crit: classCrit || luckCrit, luckCrit };
  }

  function rarityBadgeText(rarity) {
    const def = MONSTER_RARITY_DEFS[rarity];
    return def ? `${def.icon} ${def.label}` : '';
  }

  function applyMonsterRarityUi(rarity, isBoss = false) {
    const enemyEl = document.getElementById('rpgEnemy');
    const stageEl = document.getElementById('rpgEnemyStage');
    const tagEl = document.getElementById('rpgMonsterTag');
    if (!enemyEl || !stageEl || !tagEl) return;
    const auraRarities = ['epic','legendary','mythic','secret'];
    const all = ['normal','common','uncommon','rare','epic','legendary','mythic','ultra_mythic','abyssal','secret'];
    enemyEl.classList.remove('epic-aura', ...all.map(key => `rarity-${key}`));
    stageEl.classList.remove('epic-aura', ...all.map(key => `rarity-${key}`));
    tagEl.className = 'rpg-monster-tag';
    if (isBoss) {
      tagEl.textContent = '👑 Boss';
      return;
    }
    const safeRarity = String(rarity || 'common');
    tagEl.textContent = rarityBadgeText(safeRarity) || 'Monstre';
    tagEl.classList.add(`rarity-${safeRarity}`);
    if (auraRarities.includes(safeRarity)) {
      enemyEl.classList.add('epic-aura', `rarity-${safeRarity}`);
      stageEl.classList.add('epic-aura', `rarity-${safeRarity}`);
    }
  }

  async function startCombat() {
    if (!progress?.rpg_class || combat) return;
    const button = document.getElementById('rpgLaunch');
    if (button) button.disabled = true;
    const { data, error } = await CoachingCloud.client.rpc('start_rpg_combat', { p_athlete_slug: cfg.slug });
    if (button) button.disabled = false;
    if (error) {
      CoachingCloud.toast(`Combat impossible : ${error.message}`, true);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return;
    combat = {
      id: row.combat_id,
      classKey: row.rpg_class,
      level: n(row.level, 1),
      xp: n(row.xp_total),
      monsterName: row.monster_name,
      monsterRarity: row.monster_rarity || 'common',
      maxHp: n(row.monster_hp, 1),
      hp: n(row.monster_hp, 1),
      baseDamage: n(row.base_damage, 1),
      critSeed: n(row.crit_seed, 1),
      critChance: n(row.crit_chance_pct, critChancePct()),
      duration: n(row.duration_seconds, 30),
      difficulty: n(row.difficulty, currentAdventureDifficulty()),
      hpMultiplier: n(row.hp_multiplier, difficultyHpMultiplier()),
      xpMultiplier: n(row.xp_multiplier, difficultyXpMultiplier()),
      startedAt: new Date(row.started_at).getTime(),
      clicks: 0,
      damage: 0,
      finishing: false
    };
    const overlay = ensureCombatOverlay();
    panel?.classList.remove('show');
    overlay.classList.add('show');
    document.getElementById('rpgFightView').style.display = '';
    document.getElementById('rpgResult').classList.remove('show');
    document.getElementById('rpgMonsterName').textContent = combat.monsterName;
    const enemyEl = document.getElementById('rpgEnemy');
    if (enemyEl) {
      enemyEl.innerHTML = monsterVisual(combat.monsterName);
      enemyEl.classList.toggle('boss-val', /kazuto|lonely shadow cowboy|val,|hanzalone/i.test(String(combat.monsterName || '')));
    }
    applyMonsterRarityUi(combat.monsterRarity, false);
    const def = CLASS_DEFS[combat.classKey];
    document.getElementById('rpgClassLabel').textContent = `${def?.icon || ''} ${def?.title || 'Combattant'} · niveau ${combat.level} · difficulté ${combat.difficulty} · critique ${fr(combat.critChance,1)} %`;
    document.getElementById('rpgPerHit').textContent = fr(combat.baseDamage, 0);
    updateCombatUi();
    clearInterval(combatTimer);
    combatTimer = setInterval(updateCombatClock, 50);
    updateCombatClock();
  }

  async function startBossCombat() {
    if (!progress?.rpg_class || combat || n(progress?.kills_toward_boss) < 50) return;
    const button = document.getElementById('rpgBossLaunch');
    if (button) button.disabled = true;
    const { data, error } = await CoachingCloud.client.rpc('start_rpg_boss', { p_athlete_slug: cfg.slug });
    if (button) button.disabled = false;
    if (error) {
      CoachingCloud.toast(`Boss inaccessible : ${error.message}`, true);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return;
    combat = {
      id: row.combat_id,
      classKey: row.rpg_class,
      level: n(row.level, 1),
      xp: n(row.xp_total),
      monsterName: row.monster_name,
      monsterRarity: row.monster_rarity || 'common',
      maxHp: n(row.monster_hp, 1),
      hp: n(row.monster_hp, 1),
      baseDamage: n(row.base_damage, 1),
      critSeed: n(row.crit_seed, 1),
      critChance: n(row.crit_chance_pct, critChancePct()),
      duration: n(row.duration_seconds, 30),
      difficulty: n(row.difficulty, currentAdventureDifficulty()),
      hpMultiplier: n(row.hp_multiplier, difficultyHpMultiplier()),
      xpMultiplier: 1,
      startedAt: new Date(row.started_at).getTime(),
      clicks: 0,
      damage: 0,
      finishing: false,
      isBoss: true
    };
    const overlay = ensureCombatOverlay();
    panel?.classList.remove('show');
    overlay.classList.add('show');
    document.getElementById('rpgFightView').style.display = '';
    document.getElementById('rpgResult').classList.remove('show');
    document.getElementById('rpgMonsterName').textContent = combat.monsterName;
    const enemyEl = document.getElementById('rpgEnemy');
    if (enemyEl) {
      enemyEl.innerHTML = '👑';
      enemyEl.classList.add('boss-val');
    }
    applyMonsterRarityUi('legendary', true);
    const def = CLASS_DEFS[combat.classKey];
    document.getElementById('rpgClassLabel').textContent = `${def?.icon || ''} ${def?.title || 'Combattant'} · BOSS DU PALIER ${combat.difficulty} · critique ${fr(combat.critChance,1)} %`;
    document.getElementById('rpgPerHit').textContent = fr(combat.baseDamage, 0);
    updateCombatUi();
    clearInterval(combatTimer);
    combatTimer = setInterval(updateCombatClock, 50);
    updateCombatClock();
  }

  function updateCombatClock() {
    if (!combat || combat.finishing) return;
    const elapsed = Date.now() - combat.startedAt;
    const remaining = Math.max(0, combat.duration * 1000 - elapsed);
    const clock = document.getElementById('rpgClock');
    if (clock) clock.textContent = (remaining / 1000).toFixed(1).replace('.', ',');
    if (remaining <= 0) finishCombat();
  }

  function hitMonster() {
    if (!combat || combat.finishing) return;
    if (Date.now() - combat.startedAt >= combat.duration * 1000) return finishCombat();
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
    if (combat.hp <= 0) finishCombat();
  }

  function updateCombatUi() {
    if (!combat) return;
    const pct = Math.max(0, Math.min(100, combat.hp / combat.maxHp * 100));
    document.getElementById('rpgHpBar').style.width = `${pct}%`;
    document.getElementById('rpgHpLabel').textContent = `${fr(combat.hp, 0)} / ${fr(combat.maxHp, 0)} PV`;
    document.getElementById('rpgClicks').textContent = combat.clicks;
    document.getElementById('rpgDamage').textContent = fr(combat.damage, 0);
  }

  async function finishCombat() {
    if (!combat || combat.finishing) return;
    combat.finishing = true;
    clearInterval(combatTimer);
    const { data, error } = await CoachingCloud.client.rpc(combat.isBoss ? 'finish_rpg_boss' : 'finish_rpg_combat', {
      p_combat_id: combat.id,
      p_clicks: combat.clicks
    });
    if (error) {
      combat.finishing = false;
      CoachingCloud.toast(`Résultat non enregistré : ${error.message}`, true);
      return;
    }
    const result = Array.isArray(data) ? data[0] : data;
    const won = !!result?.won;
    const goldEarned = n(result?.gold_earned);
    document.getElementById('rpgFightView').style.display = 'none';
    document.getElementById('rpgResult').classList.add('show');
    document.getElementById('rpgResultTitle').textContent = won ? (combat.isBoss ? 'BOSS TERRASSÉ !' : 'VICTOIRE BG !') : 'DÉFAITE';
    document.getElementById('rpgResultText').innerHTML = won
      ? (combat.isBoss
        ? `Tu as vaincu <strong>${esc(combat.monsterName)}</strong> en <strong>${n(result.clicks)} coups</strong> avec <strong>${fr(result.damage_dealt,0)} dégâts</strong>.<br><br>Récompense : <strong>🪙 +${fr(goldEarned,0)} gold</strong>${result?.gold_jackpot ? ' · <strong>🍀 JACKPOT ×10 !</strong>' : ''}.<br>${n(result?.difficulty_unlocked, combat.difficulty) >= 1000 ? '<strong>Palier ultime 1000 validé !</strong>' : `<strong>Palier ${n(result?.difficulty_unlocked, combat.difficulty + 1)} débloqué !</strong>`} Le compteur repart à 0/50.<br>Critiques de Chance : <strong>${n(result?.crit_count)}</strong>.`
        : `Tu as terrassé <strong>${esc(combat.monsterName)}</strong> en <strong>${n(result.clicks)} coups</strong> avec <strong>${fr(result.damage_dealt, 0)} dégâts</strong>.<br><br>Récompenses : <strong>🪙 +${fr(goldEarned, 0)} gold</strong>${result?.gold_jackpot ? ' · <strong>🍀 JACKPOT ×10 !</strong>' : ''} · <strong>0 XP de combat</strong> · difficulté <strong>${n(combat.difficulty,1)}</strong> · critiques de Chance <strong>${n(result?.crit_count)}</strong>.${result?.combat_item_name ? `<span class="combat-loot-line rarity-${esc(result.combat_item_rarity || 'normal')}"><strong>🎁 Objet de combat garanti :</strong> ${esc(result.combat_item_name)} · <span class="loot-rarity">${RARITY_DEFS[result.combat_item_rarity]?.label || esc(result.combat_item_rarity)}</span> · niveau ${n(result.combat_item_level,1)} · dégâts +${fr(result.combat_item_damage_bonus_pct,2)} %${n(result.combat_item_quantity_after,1)>1?` · pile ×${n(result.combat_item_quantity_after)}`:''}</span>` : ''}${result?.discovered_new ? `<br><br><strong>📖 NOUVELLE DÉCOUVERTE :</strong> ${esc(result.discovered_monster_name)}<br>Bonus permanent : <strong>+${fr(result.discovery_xp_bonus,0)} % XP</strong> · total bestiaire : +${fr(result.collection_xp_bonus,1)} %.` : ''}${result?.special_drop_name ? `<span class="monster-special-drop ${result?.combat_item_rarity ? `rarity-${esc(result.combat_item_rarity)}` : ''}"><strong>Drop spécial :</strong> ${esc(result.special_drop_name)}${result?.special_drop_note ? ` · ${esc(result.special_drop_note)}` : ''}</span>` : ''}`)
      : `<strong>${esc(combat.monsterName)}</strong> avait encore ${fr(Math.max(0, n(result.monster_hp) - n(result.damage_dealt)), 0)} PV. Tu as infligé <strong>${fr(result.damage_dealt, 0)} dégâts</strong> en ${n(result.clicks)} coups.`;
    progress = {
      ...progress,
      combat_wins: n(result.combat_wins, progress?.combat_wins),
      combat_losses: n(result.combat_losses, progress?.combat_losses),
      best_combat_damage: n(result.best_combat_damage, progress?.best_combat_damage),
      gold_balance: n(result.gold_balance, progress?.gold_balance),
      gold_total_earned: n(progress?.gold_total_earned) + goldEarned,
      collection_xp_bonus: n(result?.collection_xp_bonus, progress?.collection_xp_bonus),
      adventure_difficulty: n(result?.difficulty_unlocked, progress?.adventure_difficulty),
      kills_toward_boss: n(result?.kills_toward_boss, progress?.kills_toward_boss),
      boss_wins: n(result?.boss_wins, progress?.boss_wins)
    };
    render();
    if (won) {
      await Promise.all([loadProgress(), loadInventory(), loadCollections()]);
      await publishCombatActivity(result, combat);
      if (navigator.vibrate) navigator.vibrate([100, 60, 140, 60, 220]);
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
      details_text: `${cfg.name} a terrassé ${battle.monsterName} en ${n(result.clicks)} coups, ${fr(result.damage_dealt, 0)} dégâts et gagne ${fr(result.gold_earned, 0)} gold.${result?.discovered_new ? ` Nouvelle découverte ajoutée au bestiaire.` : ''}`, 
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
    let text = `+${fr(totalGain, 2)} XP`;
    if (result.speedBonus > 0) text += ` · bonus vitesse +${fr(result.speedBonus, 2)}`;
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
    const { data, error } = await CoachingCloud.client.rpc('award_set_xp', {
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
