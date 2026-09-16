(() => {
  const THEMES = {
    louis: {
      name: 'LOUIS',
      asset: '/louis-theme.webp?v=19',
      alt: 'Univers personnalisé de Louis',
      showName: true,
    },
    sarah: {
      name: 'SARAH',
      asset: '/sarah-theme.webp?v=19',
      alt: 'Univers cosmique personnalisé de Sarah',
      showName: false,
    },
  }

  function buildHero(slug, config) {
    const hero = document.createElement('section')
    hero.className = `ga-direct-hero ga-direct-hero--${slug}`
    hero.dataset.gaDirectHero = slug

    const image = document.createElement('img')
    image.className = 'ga-direct-hero__image'
    image.src = config.asset
    image.alt = config.alt
    image.loading = 'eager'
    image.decoding = 'async'
    image.draggable = false

    image.addEventListener('load', () => {
      hero.dataset.gaHeroReady = '1'
      console.info(`[GA HERO V19] ${slug} OK`, image.currentSrc, `${image.naturalWidth}x${image.naturalHeight}`)
    })

    image.addEventListener('error', () => {
      hero.dataset.gaHeroError = '1'
      console.error(`[GA HERO V19] ${slug} image introuvable`, image.currentSrc || config.asset)
    })

    const overlay = document.createElement('div')
    overlay.className = 'ga-direct-hero__overlay'
    overlay.setAttribute('aria-hidden', 'true')

    const glow = document.createElement('div')
    glow.className = 'ga-direct-hero__glow'
    glow.setAttribute('aria-hidden', 'true')

    const light = document.createElement('div')
    light.className = 'ga-direct-hero__light'
    light.setAttribute('aria-hidden', 'true')

    hero.append(image, overlay, glow, light)

    if (config.showName) {
      const name = document.createElement('h2')
      name.className = 'ga-direct-hero__name'
      name.textContent = config.name
      hero.append(name)
    }

    return hero
  }

  function mountOne(page, slug, config) {
    if (!page || !page.isConnected) return

    const existing = page.querySelector(`.ga-direct-hero[data-ga-direct-hero="${slug}"]`)
    if (existing) return

    const oldBanner = page.querySelector('.athlete-theme-banner')
    if (!oldBanner) return

    oldBanner.replaceWith(buildHero(slug, config))
  }

  function mountAll() {
    Object.entries(THEMES).forEach(([slug, config]) => {
      document
        .querySelectorAll(`.training-page[data-athlete-theme="${slug}"]`)
        .forEach((page) => mountOne(page, slug, config))
    })
  }

  let queued = false
  const schedule = () => {
    if (queued) return
    queued = true
    requestAnimationFrame(() => {
      queued = false
      mountAll()
    })
  }

  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true,
  })

  window.addEventListener('DOMContentLoaded', schedule)
  window.addEventListener('hashchange', schedule)
  window.addEventListener('popstate', schedule)
  schedule()
})()
