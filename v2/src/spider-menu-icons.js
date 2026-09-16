const ICON_TONES = {
  athletes: { body: '#ffd95a', belly: '#ff9f43', blush: '#ff7fa8' },
  activity: { body: '#58e4cf', belly: '#2aa8c7', blush: '#ff91b8' },
  editor: { body: '#c28aff', belly: '#7b61e8', blush: '#ff9ecb' },
  rpg: { body: '#ff7b7b', belly: '#d84a73', blush: '#ffd1e0' },
  leaderboard: { body: '#74b9ff', belly: '#4263eb', blush: '#ff9fc6' },
}

export function spiderMenuIcon(kind = 'athletes') {
  const tone = ICON_TONES[kind] || ICON_TONES.athletes

  return `
    <svg
      class="spider-menu-icon spider-menu-icon--cute"
      viewBox="0 0 72 72"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <g
        class="spider-menu-icon__legs"
        fill="none"
        stroke="${tone.body}"
        stroke-width="4"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M25 27 17 19 9 18"/>
        <path d="M23 33 13 30 6 34"/>
        <path d="M24 40 14 45 9 53"/>
        <path d="M28 46 23 56 24 64"/>
        <path d="M47 27 55 19 63 18"/>
        <path d="M49 33 59 30 66 34"/>
        <path d="M48 40 58 45 63 53"/>
        <path d="M44 46 49 56 48 64"/>
      </g>

      <circle cx="36" cy="25" r="10" fill="${tone.body}"/>
      <ellipse cx="36" cy="44" rx="15" ry="17" fill="${tone.body}"/>
      <ellipse cx="36" cy="46" rx="10" ry="12" fill="${tone.belly}" opacity=".72"/>

      <g class="spider-menu-icon__face">
        <ellipse cx="32" cy="23" rx="2.3" ry="3" fill="#142035"/>
        <ellipse cx="40" cy="23" rx="2.3" ry="3" fill="#142035"/>
        <circle cx="31.3" cy="22.1" r=".8" fill="#fff"/>
        <circle cx="39.3" cy="22.1" r=".8" fill="#fff"/>
        <circle cx="27.5" cy="27.3" r="2.1" fill="${tone.blush}" opacity=".9"/>
        <circle cx="44.5" cy="27.3" r="2.1" fill="${tone.blush}" opacity=".9"/>
        <path d="M33 27.5c1.8 1.8 4.2 1.8 6 0" fill="none" stroke="#142035" stroke-width="1.6" stroke-linecap="round"/>
      </g>

      <path d="m31 43 3 3 7-8" fill="none" stroke="#fff" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round" opacity=".88"/>
    </svg>
  `
}
