/* LOUIS HERO LOADER V7
   /themes/louis/louis-fusion-fixed.jpg is BASE64 TEXT in the repository,
   not a binary JPEG. We read that text and inject a real <img> using a
   data:image/jpeg;base64 URL. This avoids the previous CSS/Blob issues.
*/

let louisHeroDataUrlPromise = null

async function getLouisHeroDataUrl() {
  if (louisHeroDataUrlPromise) return louisHeroDataUrlPromise

  louisHeroDataUrlPromise = (async () => {
    const response = await fetch('/themes/louis/louis-fusion-fixed.jpg?v=7', {
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error(`Louis hero fetch failed: ${response.status}`)
    }

    const base64 = (await response.text()).replace(/\s+/g, '').trim()

    if (!base64.startsWith('/9j/')) {
      throw new Error('Louis hero payload is not JPEG base64 text')
    }

    return `data:image/jpeg;base64,${base64}`
  })()

  return louisHeroDataUrlPromise
}

async function applyLouisHero() {
  const pages = document.querySelectorAll(
    '.training-page[data-athlete-theme="louis"]'
  )

  if (!pages.length) return

  try {
    const dataUrl = await getLouisHeroDataUrl()

    pages.forEach((page) => {
      const banner = page.querySelector('.athlete-theme-banner')
      if (!banner) return

      let image = banner.querySelector('.louis-hero-image')

      if (!image) {
        image = document.createElement('img')
        image.className = 'louis-hero-image'
        image.alt = ''
        image.setAttribute('aria-hidden', 'true')
        image.decoding = 'async'
        image.draggable = false
        banner.prepend(image)
      }

      if (image.src !== dataUrl) image.src = dataUrl

      image.onload = () => {
        page.dataset.louisHeroReady = '1'
        delete page.dataset.louisHeroError
      }

      image.onerror = () => {
        page.dataset.louisHeroError = '1'
        console.error('[Louis hero] decoded image could not be displayed')
      }

      if (image.complete && image.naturalWidth > 0) {
        page.dataset.louisHeroReady = '1'
      }
    })
  } catch (error) {
    pages.forEach((page) => {
      page.dataset.louisHeroError = '1'
    })
    console.error('[Louis hero]', error)
  }
}

let scheduled = false
function scheduleLouisHero() {
  if (scheduled) return
  scheduled = true

  requestAnimationFrame(() => {
    scheduled = false
    applyLouisHero()
  })
}

const observer = new MutationObserver(scheduleLouisHero)
observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
})

window.addEventListener('DOMContentLoaded', scheduleLouisHero)
window.addEventListener('popstate', scheduleLouisHero)
scheduleLouisHero()
