const ICON_TONES = {
  athletes: '#f4c542',
  activity: '#3fe0d0',
  editor: '#b67cff',
  rpg: '#ff6b6b',
}

export function spiderMenuIcon(
  kind = 'athletes'
) {
  const tone =
    ICON_TONES[kind] ||
    ICON_TONES.athletes

  return `
    <svg
      class="spider-menu-icon spider-menu-icon--8"
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      style="color:${tone}"
    >
      <g
        fill="none"
        stroke="currentColor"
        stroke-width="3.1"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M26 24 19 14 11 9"/>
        <path d="M23 28 13 24 6 25"/>
        <path d="M23 34 13 39 7 45"/>
        <path d="M26 39 20 49 14 56"/>

        <path d="M38 24 45 14 53 9"/>
        <path d="M41 28 51 24 58 25"/>
        <path d="M41 34 51 39 57 45"/>
        <path d="M38 39 44 49 50 56"/>
      </g>

      <circle
        cx="32"
        cy="22"
        r="7"
        fill="currentColor"
      />

      <ellipse
        cx="32"
        cy="39"
        rx="12"
        ry="15"
        fill="currentColor"
      />

      <text
        x="32"
        y="44"
        text-anchor="middle"
        fill="#07101f"
        font-size="15"
        font-weight="950"
        font-family="Avenir Next, SF Pro Display, Inter, system-ui, sans-serif"
      >8</text>
    </svg>
  `
}
