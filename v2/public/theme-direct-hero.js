/* =========================================================
   GA COACHING — LOUIS + SARAH DIRECT HERO V18

   IMPORTANT:
   We do NOT style or reuse .athlete-theme-banner.
   We replace it with a completely independent <section>.
   This removes every possible legacy CSS/pseudo-element conflict.
   ========================================================= */

(() => {
  const THEMES = {
    louis: {
      name: 'LOUIS',
      asset: '/themes/louis/louis-fusion.webp?v=18',
      alt: 'Univers personnalisé de Louis',
    },
    sarah: {
      name: 'SARAH',
      asset: '/themes/sarah/sarah-cosmic-final.webp?v=18',
      alt: 'Univers cosmique personnalisé de Sarah',
    },
  }

  const sourceCache = new Map()

  function bytesAreJpeg(bytes) {
    return bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
  }

  function bytesArePng(bytes) {
    return bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
  }

  function bytesAreWebp(bytes) {
    if (bytes.length < 12) return false
    const head = String.fromCharCode(...bytes.slice(0, 12))
    return head.slice(0, 4) === 'RIFF' && head.slice(8, 12) === 'WEBP'
  }

  async function getRenderableSource(config) {
    if (sourceCache.has(config.asset)) {
      return sourceCache.get(config.asset)
    }

    const promise = (async () => {
      const response = await fetch(config.asset, { cache: 'no-store' })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const buffer = await response.arrayBuffer()
      const bytes = new Uint8Array(buffer)

      if (!bytes.length) {
        throw new Error('fichier vide')
      }

      if (bytesAreWebp(bytes)) {
        return {
          src: URL.createObjectURL(new Blob([buffer], { type: 'image/webp' })),
          format: 'webp-binary',
        }
      }

      if (bytesAreJpeg(bytes)) {
        return {
          src: URL.createObjectURL(new Blob([buffer], { type: 'image/jpeg' })),
          format: 'jpeg-binary',
        }
      }

      if (bytesArePng(bytes)) {
        return {
          src: URL.createObjectURL(new Blob([buffer], { type: 'image/png' })),
          format: 'png-binary',
        }
      }

      const text = new TextDecoder()
        .decode(buffer)
        .replace(/\s+/g, '')
        .trim()

      if (text.startsWith('UklGR')) {
        return {
          src: `data:image/webp;base64,${text}`,
          format: 'webp-base64-text',
        }
      }

      if (text.startsWith('/9j/')) {
        return {
          src: `data:image/jpeg;base64,${text}`,
          format: 'jpeg-base64-text',
        }
      }

      if (text.startsWith('iVBOR')) {
        return {
          src: `data:image/png;base64,${text}`,
          format: 'png-base64-text',
        }
      }

      throw new Error('format image inconnu')
    })()

    sourceCache.set(config.asset, promise)
    return promise
  }

  function createHero(slug, config) {
    const hero = document.createElement('section')
    hero.className = `ga-direct-hero ga-direct-hero--${slug}`
    hero.dataset.gaDirectHero = slug

    const image = document.createElement('img')
    image.className = 'ga-direct-hero__image'
    image.alt = config.alt
    image.decoding = 'async'
    image.loading = 'eager'
    image.draggable = false

    const overlay = document.createElement('div')
    overlay.className = 'ga-direct-hero__overlay'
    overlay.setAttribute('aria-hidden', 'true')

    const light = document.createElement('div')
    light.className = 'ga-direct-hero__light'
    light.setAttribute('aria-hidden', 'true')

    const name = document.createElement('h2')
    name.className = 'ga-direct-hero__name'
    name.textContent = config.name

    hero.append(image, overlay, light, name)

    return { hero, image }
  }

  async function mountTheme(page, slug, config) {
    if (!page?.isConnected) return

    const alreadyMounted = page.querySelector(
      `.ga-direct-hero[data-ga-direct-hero="${slug}"]`
    )

    if (alreadyMounted) return

    const genericBanner = page.querySelector('.athlete-theme-banner')
    if (!genericBanner) return

    const { hero, image } = createHero(slug, config)

    genericBanner.replaceWith(hero)

    try {
      const source = await getRenderableSource(config)

      if (!hero.isConnected) return

      await new Promise((resolve, reject) => {
        image.onload = () => {
          if (!image.naturalWidth || !image.naturalHeight) {
            reject(new Error('image sans dimensions'))
            return
          }
          resolve()
        }

        image.onerror = () => reject(new Error('decodeur navigateur: erreur image'))
        image.src = source.src
      })

      hero.dataset.gaHeroReady = '1'
      hero.dataset.gaHeroFormat = source.format

      console.info(
        `[GA DIRECT HERO V18] ${slug} OK`,
        `${image.naturalWidth}x${image.naturalHeight}`,
        source.format
      )
    } catch (error) {
      hero.dataset.gaHeroError = '1'
      console.error(`[GA DIRECT HERO V18] ${slug} ECHEC`, error)
    }
  }

  function mountAll() {
    Object.entries(THEMES).forEach(([slug, config]) => {
      document
        .querySelectorAll(`.training-page[data-athlete-theme="${slug}"]`)
        .forEach((page) => {
          void mountTheme(page, slug, config)
        })
    })
  }

  let scheduled = false
  function scheduleMount() {
    if (scheduled) return
    scheduled = true

    requestAnimationFrame(() => {
      scheduled = false
      mountAll()
    })
  }

  const observer = new MutationObserver(scheduleMount)
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  })

  window.addEventListener('DOMContentLoaded', scheduleMount)
  window.addEventListener('hashchange', scheduleMount)
  window.addEventListener('popstate', scheduleMount)

  scheduleMount()
})()
