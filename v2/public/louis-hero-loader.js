let louisHeroDataUrl = null
let louisHeroPromise = null

async function buildLouisHeroDataUrl() {
  if (louisHeroDataUrl) return louisHeroDataUrl
  if (louisHeroPromise) return louisHeroPromise

  louisHeroPromise = (async () => {
    const response = await fetch('/themes/louis/louis-fusion-fixed.jpg?v=6', {
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error(`Louis hero fetch failed: ${response.status}`)
    }

    const base64 = (await response.text()).replace(/\s+/g, '').trim()

    if (!base64.startsWith('/9j/')) {
      throw new Error('Louis hero payload is not a JPEG base64 payload')
    }

    louisHeroDataUrl = `data:image/jpeg;base64,${base64}`
    return louisHeroDataUrl
  })()

  return louisHeroPromise
}

async function applyLouisHero() {
  const pages = document.querySelectorAll(
    '.training-page[data-athlete-theme="louis"]'
  )

  if (!pages.length) return

  try {
    const dataUrl = await buildLouisHeroDataUrl()

    pages.forEach((page) => {
      page.dataset.louisHeroReady = '1'

      page.querySelectorAll('.athlete-theme-banner').forEach((banner) => {
        banner.style.setProperty(
          'background-image',
          `linear-gradient(180deg, rgba(2,10,14,.02) 0%, rgba(2,10,14,.02) 62%, rgba(2,10,14,.20) 100%), url("${dataUrl}")`,
          'important'
        )
        banner.style.setProperty('background-size', 'cover', 'important')
        banner.style.setProperty('background-repeat', 'no-repeat', 'important')
        banner.style.setProperty('background-position', 'center center', 'important')
      })
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
