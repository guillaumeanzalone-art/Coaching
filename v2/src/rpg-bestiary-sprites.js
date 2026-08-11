
import {
  rpgMonsterSprite,
} from './rpg-sprites.js'

const CARD_SELECTORS = [
  '.monster-card',
  '.rpg-monster-card',
  '.rpg-bestiary-card',
  '.rpg-collection-monster',
  '[data-rpg-monster]',
  '[data-monster-key]',
]

const NAME_SELECTORS = [
  '[data-monster-name]',
  '.monster-name',
  '.rpg-monster-name',
  '.rpg-bestiary-name',
  '[class*="monster-name"]',
  '[class*="bestiary-name"]',
  'strong',
]

const VISUAL_SELECTORS = [
  '.monster-icon',
  '.rpg-monster-icon',
  '.rpg-bestiary-icon',
  '.monster-sprite-host',
  '[class*="monster-icon"]',
  '[class*="bestiary-icon"]',
  '[class*="monster-visual"]',
  '[class*="bestiary-visual"]',
]

function cleanText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function monsterNameFromCard(card) {
  const fromDataset =
    cleanText(
      card?.dataset?.monsterName ||
      card?.getAttribute?.('data-monster-name')
    )

  if (fromDataset) {
    return fromDataset
  }

  for (const selector of NAME_SELECTORS) {
    const el = card.querySelector(selector)
    const text = cleanText(
      el?.dataset?.monsterName ||
      el?.textContent
    )

    if (
      text &&
      text !== '???' &&
      !/^×?\d+$/.test(text)
    ) {
      return text
    }
  }

  return ''
}

function visualHostFromCard(card) {
  for (const selector of VISUAL_SELECTORS) {
    const host = card.querySelector(selector)
    if (host) {
      return host
    }
  }

  const nameEl = card.querySelector(
    '.monster-name, .rpg-monster-name, .rpg-bestiary-name, [class*="monster-name"], [class*="bestiary-name"]'
  )

  if (
    nameEl?.previousElementSibling &&
    nameEl.previousElementSibling instanceof HTMLElement
  ) {
    return nameEl.previousElementSibling
  }

  return null
}

function hideEmojiFallback(host) {
  host
    .querySelectorAll(
      '.monster-emoji-fallback, .rpg-monster-emoji, .rpg-bestiary-emoji, [class*="emoji"]'
    )
    .forEach((element) => {
      if (
        element instanceof HTMLElement
      ) {
        element.classList.add(
          'rpg-bestiary-emoji-hidden-v2'
        )
      }
    })

  for (const node of Array.from(host.childNodes)) {
    if (
      node.nodeType === Node.TEXT_NODE &&
      cleanText(node.textContent)
    ) {
      const text =
        cleanText(
          node.textContent
        )

      const looksLikeLabel =
        /[A-Za-zÀ-ÿ0-9]{3,}/.test(
          text
        )

      if (!looksLikeLabel) {
        node.textContent = ''
      }
    }
  }
}

function enhanceCard(card) {
  if (
    !(card instanceof HTMLElement) ||
    card.dataset.rpgBestiarySpriteV2 === 'done'
  ) {
    return
  }

  const name =
    monsterNameFromCard(
      card
    )

  if (!name) {
    return
  }

  const skinPath =
    card.dataset.skinPath ||
    card.getAttribute(
      'data-skin-path'
    ) ||
    ''

  const sprite =
    rpgMonsterSprite(
      name,
      skinPath
    )

  if (!sprite) {
    card.dataset.rpgBestiarySpriteV2 =
      'missing'

    return
  }

  const host =
    visualHostFromCard(
      card
    )

  if (!host) {
    return
  }

  if (
    host.querySelector(
      '.rpg-bestiary-sprite-v2'
    )
  ) {
    card.dataset.rpgBestiarySpriteV2 =
      'done'

    return
  }

  host.classList.add(
    'rpg-bestiary-visual-v2'
  )

  const image =
    document.createElement(
      'img'
    )

  image.className =
    'rpg-bestiary-sprite-v2'

  image.src =
    sprite

  image.alt =
    name

  image.loading =
    'lazy'

  image.decoding =
    'async'

  image.addEventListener(
    'load',
    () => {
      card.classList.add(
        'rpg-bestiary-has-sprite-v2'
      )

      hideEmojiFallback(
        host
      )

      card.dataset.rpgBestiarySpriteV2 =
        'done'
    },
    {
      once: true,
    }
  )

  image.addEventListener(
    'error',
    () => {
      image.remove()

      card.dataset.rpgBestiarySpriteV2 =
        'missing'
    },
    {
      once: true,
    }
  )

  host.appendChild(
    image
  )
}

function collectCards(root) {
  const cards =
    new Set()

  for (const selector of CARD_SELECTORS) {
    root
      .querySelectorAll(
        selector
      )
      .forEach(
        (card) =>
          cards.add(
            card
          )
      )
  }

  if (!cards.size) {
    root
      .querySelectorAll(
        'article, li, [class*="card"]'
      )
      .forEach(
        (element) => {
          const className =
            String(
              element.className ||
              ''
            ).toLowerCase()

          if (
            className.includes(
              'monster'
            ) ||
            className.includes(
              'bestiary'
            )
          ) {
            cards.add(
              element
            )
          }
        }
      )
  }

  return Array.from(
    cards
  )
}

export function enhanceRpgBestiarySprites(
  root
) {
  if (
    !root ||
    !root.querySelectorAll
  ) {
    return 0
  }

  const cards =
    collectCards(
      root
    )

  cards.forEach(
    enhanceCard
  )

  return cards.length
}

export function installRpgBestiarySpriteEnhancer(
  root
) {
  if (
    !root ||
    !root.querySelectorAll ||
    root.dataset.rpgBestiaryObserverV2 ===
      '1'
  ) {
    return
  }

  root.dataset.rpgBestiaryObserverV2 =
    '1'

  let scheduled =
    false

  const schedule =
    () => {
      if (scheduled) {
        return
      }

      scheduled =
        true

      queueMicrotask(
        () => {
          scheduled =
            false

          enhanceRpgBestiarySprites(
            root
          )
        }
      )
    }

  schedule()

  const observer =
    new MutationObserver(
      schedule
    )

  observer.observe(
    root,
    {
      childList: true,
      subtree: true,
    }
  )
}
