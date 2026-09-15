let louisHeroObjectUrl = null
let louisHeroPromise = null

async function buildLouisHeroObjectUrl() {
  if (louisHeroObjectUrl) {
    return louisHeroObjectUrl
  }

  if (louisHeroPromise) {
    return louisHeroPromise
  }

  louisHeroPromise = (async () => {
    const response = await fetch(
      '/themes/louis/louis-fusion-fixed.jpg?v=4',
      { cache: 'no-store' }
    )

    if (!response.ok) {
      throw new Error(`Louis hero fetch failed: ${response.status}`)
    }

    const base64 = (await response.text())
      .replace(/\s+/g, '')
      .trim()

    if (!base64.startsWith('/9j/')) {
      throw new Error('Louis hero payload is not a JPEG base64 payload')
    }

    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)

    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i)
    }

    const blob = new Blob([bytes], { type: 'image/jpeg' })
    louisHeroObjectUrl = URL.createObjectURL(blob)

    return louisHeroObjectUrl
  })()

  return louisHeroPromise
}

async function applyLouisHero() {
  const pages = document.querySelectorAll(
    '.training-page[data-athlete-theme="louis"]'
  )

  if (!pages.length) {
    return
  }

  try {
    const objectUrl = await buildLouisHeroObjectUrl()

    pages.forEach((page) => {
      page.style.setProperty(
        '--louis-hero-image',
        `url("${objectUrl}")`
      )
      page.dataset.louisHeroReady = '1'
    })
  } catch (error) {
    console.error('[Louis hero]', error)
  }
}

const observer = new MutationObserver(() => {
  applyLouisHero()
})

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
})

window.addEventListener('DOMContentLoaded', applyLouisHero)
applyLouisHero()
