const AUDIO_KEY = 'ga_rpg_audio_settings_v2'

const DEFAULTS = {
  musicEnabled: true,
  sfxEnabled: true,
  musicVolume: 1,
  sfxVolume: 1,
}

const TRACKS = {
  menu: [
    'main-menu.mp3',
  ],

  battle_normal: [
    'combat-normal.mp3',
  ],

  battle_epic: [
    'mobs-epiques.mp3',
  ],

  battle_stage_67: [
    'palier-67.mp3',
  ],

  battle_boss_1_9: [
    'boss-1-9.mp3',
  ],

  battle_boss_10_19: [
    'boss-10-19.mp3',
  ],

  battle_boss_20_29: [
    'boss-20-29.mp3',
  ],

  battle_boss_30_39: [
    'boss-30-39.mp3',
  ],

  battle_boss_40_49: [
    'boss-40-49.mp3',
  ],

  battle_boss_50_59: [
    'boss-50-59.mp3',
  ],

  battle_boss_60_69: [
    'boss-60-69.mp3',
  ],

  battle_boss_70_79: [
    'boss-70-79.mp3',
    'boss-60-69.mp3',
  ],

  battle_boss_80_89: [
    'boss-80-89.mp3',
    'boss-100.mp3',
  ],

  battle_boss_90_99: [
    'boss-90-99.mp3',
    'boss-100.mp3',
  ],

  battle_boss_100: [
    'boss-100.mp3',
  ],

  damage_trial: [
    'test-degats.mp3',
  ],

  raid: [
    'raid.mp3',
    'sweatiershop-boss-theme.mp3',
  ],

  case_opening: [
    'casino.mp3',
  ],

  jackpot: [
    'jackpot.mp3',
  ],

  theme_noah: [
    'theme-noah.mp3',
  ],

  theme_hanzalone: [
    'theme-hanzalone.mp3',
  ],

  theme_kali: [
    'theme-kali.mp3',
  ],

  theme_greg: [
    'theme-greg.mp3',
  ],

  theme_jo: [
    'theme-jo.mp3',
  ],

  theme_rich: [
    'theme-rich.mp3',
  ],

  theme_val: [
    'theme-val.mp3',
  ],
}

let settings =
  loadSettings()

let music = null
let currentKey = ''
let currentIndex = 0
let currentMode = 'menu'

function clamp(value) {
  const number =
    Number(value)

  if (!Number.isFinite(number)) {
    return 1
  }

  return Math.max(
    0,
    Math.min(
      1,
      number
    )
  )
}

function loadSettings() {
  try {
    const saved =
      JSON.parse(
        localStorage.getItem(
          AUDIO_KEY
        ) || '{}'
      )

    return {
      musicEnabled:
        saved.musicEnabled !==
        false,

      sfxEnabled:
        saved.sfxEnabled !==
        false,

      musicVolume:
        clamp(
          saved.musicVolume ??
          1
        ),

      sfxVolume:
        clamp(
          saved.sfxVolume ??
          1
        ),
    }
  } catch {
    return {
      ...DEFAULTS,
    }
  }
}

function saveSettings() {
  localStorage.setItem(
    AUDIO_KEY,
    JSON.stringify(
      settings
    )
  )
}

function audioUrl(file) {
  return new URL(
    file,
    document.baseURI
  ).href
}

function ensureMusic() {
  if (music) {
    return music
  }

  music =
    new Audio()

  music.id =
    'gaRpgMusicV2'

  music.preload =
    'auto'

  music.loop =
    true

  music.volume =
    0.42 *
    settings.musicVolume

  music.addEventListener(
    'error',
    () => {
      const alternatives =
        TRACKS[currentKey] ||
        []

      if (
        currentIndex + 1 <
        alternatives.length
      ) {
        currentIndex++

        music.src =
          audioUrl(
            alternatives[
              currentIndex
            ]
          )

        music.load()

        if (
          settings.musicEnabled
        ) {
          music.play()
            .catch(() => {})
        }
      }
    }
  )

  return music
}

function setTrack(
  key,
  {
    loop = true,
    restart = true,
    mode = 'menu',
    volume = 0.42,
  } = {}
) {
  const tracks =
    TRACKS[key]

  if (
    !tracks ||
    !tracks.length
  ) {
    return false
  }

  const player =
    ensureMusic()

  const same =
    currentKey === key

  currentKey = key
  currentMode = mode

  if (!same) {
    currentIndex = 0

    player.src =
      audioUrl(
        tracks[0]
      )

    player.load()
  }

  if (
    same &&
    restart
  ) {
    try {
      player.currentTime = 0
    } catch {}
  }

  player.loop =
    loop

  player.volume =
    clamp(volume) *
    settings.musicVolume

  return true
}

async function playTrack(
  key,
  options = {}
) {
  if (
    !settings.musicEnabled ||
    settings.musicVolume <= 0
  ) {
    return false
  }

  if (
    !setTrack(
      key,
      options
    )
  ) {
    return false
  }

  try {
    await ensureMusic().play()
    return true
  } catch {
    return false
  }
}

export function rpgMusicAllowed() {
  return (
    settings.musicEnabled &&
    settings.musicVolume > 0
  )
}

export function rpgSfxAllowed() {
  return (
    settings.sfxEnabled &&
    settings.sfxVolume > 0
  )
}

export function rpgSfxVolume(
  base = 1
) {
  return (
    clamp(base) *
    settings.sfxVolume
  )
}

export async function playRpgMenuMusic() {
  return playTrack(
    'menu',
    {
      loop: true,
      restart: false,
      mode: 'menu',
      volume: 0.42,
    }
  )
}

function normalizeName(value) {
  return String(
    value || ''
  )
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toLowerCase()
}

export function resolveRpgBattleTrack(
  context = {}
) {
  const name =
    normalizeName(
      context.monsterName ||
      context.bossName
    )

  const difficulty =
    Math.max(
      1,
      Math.trunc(
        Number(
          context.difficulty ||
          context.raidLevel ||
          1
        )
      )
    )

  const cycle =
    (
      (
        difficulty - 1
      ) %
      100
    ) + 1

  if (
    name.includes('noah') ||
    name.includes(
      'nain furtif'
    )
  ) {
    return 'theme_noah'
  }

  if (
    name.includes(
      'hanzalone'
    )
  ) {
    return 'theme_hanzalone'
  }

  if (
    name.includes(
      'kali muscleton'
    ) ||
    name.includes(
      'prisonnier proteine'
    )
  ) {
    return 'theme_kali'
  }

  if (
    name.includes(
      'greg doucette de porc'
    ) ||
    name.includes(
      'crieur hypocalorique'
    )
  ) {
    return 'theme_greg'
  }

  if (
    name.includes(
      'jo lindner'
    ) ||
    name.includes(
      'jo lindnergarten'
    ) ||
    name.includes(
      'jardinier veineux'
    )
  ) {
    return 'theme_jo'
  }

  if (
    name.includes(
      'rich piano'
    ) ||
    name.includes(
      'musicien a huit repas'
    )
  ) {
    return 'theme_rich'
  }

  if (
    name.includes('kazuto') ||
    name.includes(
      'lonely shadow cowboy'
    ) ||
    name.startsWith('val')
  ) {
    return 'theme_val'
  }

  if (
    context.mode ===
    'trial'
  ) {
    return 'damage_trial'
  }

  if (
    context.mode ===
    'raid'
  ) {
    return 'raid'
  }

  if (cycle === 67) {
    return 'battle_stage_67'
  }

  if (context.isBoss) {
    if (cycle === 100) {
      return 'battle_boss_100'
    }

    if (cycle >= 90) {
      return 'battle_boss_90_99'
    }

    if (cycle >= 80) {
      return 'battle_boss_80_89'
    }

    if (cycle >= 70) {
      return 'battle_boss_70_79'
    }

    if (cycle >= 60) {
      return 'battle_boss_60_69'
    }

    if (cycle >= 50) {
      return 'battle_boss_50_59'
    }

    if (cycle >= 40) {
      return 'battle_boss_40_49'
    }

    if (cycle >= 30) {
      return 'battle_boss_30_39'
    }

    if (cycle >= 20) {
      return 'battle_boss_20_29'
    }

    if (cycle >= 10) {
      return 'battle_boss_10_19'
    }

    return 'battle_boss_1_9'
  }

  return context.isEliteSpecial
    ? 'battle_epic'
    : 'battle_normal'
}

export async function playRpgBattleMusic(
  context = {}
) {
  return playTrack(
    resolveRpgBattleTrack(
      context
    ),
    {
      loop: true,
      restart: true,
      mode: 'battle',
      volume: 0.55,
    }
  )
}

export async function playRpgEventMusic(
  key
) {
  return playTrack(
    key,
    {
      loop: false,
      restart: true,
      mode: 'event',
      volume: 0.65,
    }
  )
}

export function pauseRpgMusic() {
  if (!music) {
    return
  }

  try {
    music.pause()
  } catch {}
}

export function stopRpgMusic() {
  if (!music) {
    return
  }

  try {
    music.pause()
    music.currentTime = 0
  } catch {}

  currentKey = ''
  currentIndex = 0
}

function applyVolumes() {
  if (music) {
    const base =
      currentMode === 'battle'
        ? 0.55
        : currentMode === 'event'
          ? 0.65
          : 0.42

    music.volume =
      base *
      settings.musicVolume
  }
}

function silenceForSpotify() {
  settings.musicEnabled =
    false

  settings.sfxEnabled =
    false

  saveSettings()

  stopRpgMusic()
}

function controlsHtml() {
  const spotifyMode =
    !settings.musicEnabled &&
    !settings.sfxEnabled

  return `
    <button
      type="button"
      class="rpg-audio-toggle-v2"
      data-rpg-audio-open
      aria-label="Réglages audio"
    >
      ${
        spotifyMode
          ? '🎧'
          : settings.musicEnabled
            ? '🔊'
            : '🔇'
      }
    </button>

    <div
      class="rpg-audio-panel-v2"
      data-rpg-audio-panel
      hidden
    >
      <div class="rpg-audio-panel-head-v2">
        <strong>
          🎵 Audio RPG
        </strong>

        <button
          type="button"
          data-rpg-audio-close
        >
          ✕
        </button>
      </div>

      <label class="rpg-audio-switch-v2">
        <span>
          🎵 Musique du jeu
        </span>

        <input
          type="checkbox"
          data-rpg-music-enabled
          ${
            settings.musicEnabled
              ? 'checked'
              : ''
          }
        >
      </label>

      <label class="rpg-audio-volume-v2">
        <span>
          Volume musique
        </span>

        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value="${
            settings.musicVolume
          }"
          data-rpg-music-volume
        >
      </label>

      <label class="rpg-audio-switch-v2">
        <span>
          💥 Effets sonores
        </span>

        <input
          type="checkbox"
          data-rpg-sfx-enabled
          ${
            settings.sfxEnabled
              ? 'checked'
              : ''
          }
        >
      </label>

      <label class="rpg-audio-volume-v2">
        <span>
          Volume effets
        </span>

        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value="${
            settings.sfxVolume
          }"
          data-rpg-sfx-volume
        >
      </label>

      <button
        type="button"
        class="rpg-spotify-mode-v2"
        data-rpg-spotify
      >
        🎧 Mode Spotify
        <small>
          Coupe totalement les sons du jeu
          puis ouvre Spotify
        </small>
      </button>

      ${
        spotifyMode
          ? `
            <div class="rpg-spotify-active-v2">
              🎧 Mode Spotify actif ·
              L'Araignée Coaching reste silencieuse.
            </div>
          `
          : ''
      }
    </div>
  `
}

function renderControls(
  host
) {
  host.innerHTML =
    controlsHtml()
}

export function installRpgAudioControls() {
  let host =
    document.querySelector(
      '[data-rpg-audio-host]'
    )

  if (!host) {
    host =
      document.createElement(
        'div'
      )

    host.dataset.rpgAudioHost =
      '1'

    host.className =
      'rpg-audio-host-v2'

    document.body.appendChild(
      host
    )
  }

  renderControls(host)

  if (
    host.dataset.bound ===
    '1'
  ) {
    return
  }

  host.dataset.bound =
    '1'

  host.addEventListener(
    'click',
    async event => {
      if (
        event.target.closest(
          '[data-rpg-audio-open]'
        )
      ) {
        const panel =
          host.querySelector(
            '[data-rpg-audio-panel]'
          )

        if (panel) {
          panel.hidden =
            false
        }

        return
      }

      if (
        event.target.closest(
          '[data-rpg-audio-close]'
        )
      ) {
        const panel =
          host.querySelector(
            '[data-rpg-audio-panel]'
          )

        if (panel) {
          panel.hidden =
            true
        }

        return
      }

      if (
        event.target.closest(
          '[data-rpg-spotify]'
        )
      ) {
        silenceForSpotify()

        renderControls(host)

        window.open(
          'https://open.spotify.com/',
          '_blank',
          'noopener,noreferrer'
        )
      }
    }
  )

  host.addEventListener(
    'change',
    async event => {
      if (
        event.target.matches(
          '[data-rpg-music-enabled]'
        )
      ) {
        settings.musicEnabled =
          event.target.checked

        saveSettings()

        if (
          settings.musicEnabled
        ) {
          await playRpgMenuMusic()
        } else {
          stopRpgMusic()
        }

        renderControls(host)
        return
      }

      if (
        event.target.matches(
          '[data-rpg-sfx-enabled]'
        )
      ) {
        settings.sfxEnabled =
          event.target.checked

        saveSettings()
        renderControls(host)
      }
    }
  )

  host.addEventListener(
    'input',
    event => {
      if (
        event.target.matches(
          '[data-rpg-music-volume]'
        )
      ) {
        settings.musicVolume =
          clamp(
            event.target.value
          )

        saveSettings()
        applyVolumes()
        return
      }

      if (
        event.target.matches(
          '[data-rpg-sfx-volume]'
        )
      ) {
        settings.sfxVolume =
          clamp(
            event.target.value
          )

        saveSettings()
      }
    }
  )
}
