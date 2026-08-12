const ICONS = {
  athletes: `
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M24 27 13 20M22 32 9 32M24 38 13 46M40 27 51 20M42 32 55 32M40 38 51 46"/>
        <circle cx="32" cy="25" r="5"/>
        <ellipse cx="32" cy="38" rx="8" ry="10"/>
        <circle cx="29" cy="36" r="1.2" fill="currentColor" stroke="none"/>
        <circle cx="35" cy="36" r="1.2" fill="currentColor" stroke="none"/>
        <path d="M27 42c3 2 7 2 10 0"/>
      </g>
    </svg>
  `,
  activity: `
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M24 27 13 20M22 32 9 32M24 38 13 46M40 27 51 20M42 32 55 32M40 38 51 46"/>
        <circle cx="32" cy="25" r="5"/>
        <ellipse cx="32" cy="38" rx="8" ry="10"/>
        <path d="M20 40h6l3-7 5 13 3-8h7"/>
      </g>
    </svg>
  `,
  editor: `
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M24 27 13 20M22 32 9 32M24 38 13 46M40 27 51 20M42 32 55 32M40 38 51 46"/>
        <circle cx="32" cy="25" r="5"/>
        <ellipse cx="32" cy="38" rx="8" ry="10"/>
        <path d="m26 43 12-12 4 4-12 12-6 2z"/>
        <path d="m38 31 3-3 4 4-3 3"/>
      </g>
    </svg>
  `,
  rpg: `
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M24 27 13 20M22 32 9 32M24 38 13 46M40 27 51 20M42 32 55 32M40 38 51 46"/>
        <circle cx="32" cy="25" r="5"/>
        <ellipse cx="32" cy="38" rx="8" ry="10"/>
        <path d="M24 47 43 28M40 27l4 4M21 28l20 20M24 27l-4 4"/>
      </g>
    </svg>
  `,
}

export function spiderMenuIcon(kind) {
  return ICONS[kind] || ICONS.rpg
}
