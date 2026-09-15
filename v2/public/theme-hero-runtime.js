/* GA COACHING — HERO MEDIA RUNTIME V11
   Robust image mounting for Louis + Sarah.

   This deliberately does NOT rely on CSS background-image for the actual art.
   It mounts a real <img>, resolves its URL from the theme stylesheet that is
   already loaded, forces it visible above the banner background, then keeps
   the existing ::before energy layer and ::after athlete name above it.
*/

const HERO_THEMES = {
  louis: {
    cssHint: 'theme-louis',
    asset: 'themes/louis/louis-fusion-fixed.jpg?v=11',
    className: 'ga-runtime-hero ga-runtime-hero--louis',
    duration: 12000,
  },
  sarah: {
    cssHint: 'theme-sarah',
    asset: 'themes/sarah/sarah-fusion.jpg?v=11',
    className: 'ga-runtime-hero ga-runtime-hero--sarah',
    duration: 12500,
  },
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function resolveCandidates(config) {
  const cleanAsset = config.asset.replace(/^\/+/, '')
  const candidates = []

  const themeLink = [...document.querySelectorAll('link[rel="stylesheet"]')]
    .find((link) => String(link.href || '').includes(config.cssHint))

  // Most reliable: same public base as the theme CSS that already loaded.
  if (themeLink?.href) {
    try {
      candidates.push(new URL(cleanAsset, themeLink.href).href)
    } catch {}
  }

  // Vite localhost root.
  try {
    candidates.push(new URL(`/${cleanAsset}`, window.location.origin).href)
  } catch {}

  // Current document base.
  try {
    candidates.push(new URL(cleanAsset, document.baseURI).href)
  } catch {}

  // GitHub Pages / project-folder fallback.
  try {
    const parts = window.location.pathname.split('/').filter(Boolean)
    if (parts.length) {
      candidates.push(
        new URL(`/${parts[0]}/${cleanAsset}`, window.location.origin).href
      )
    }
  } catch {}

  return unique(candidates)
}

function forceStyle(element, property, value) {
  element.style.setProperty(property, value, 'important')
}

function styleHeroImage(image, slug) {
  forceStyle(image, 'display', 'block')
  forceStyle(image, 'position', 'absolute')
  forceStyle(image, 'z-index', '0')
  forceStyle(image, 'inset', '-2%')
  forceStyle(image, 'width', '104%')
  forceStyle(image, 'height', '104%')
  forceStyle(image, 'max-width', 'none')
  forceStyle(image, 'max-height', 'none')
  forceStyle(image, 'object-fit', 'cover')
  forceStyle(image, 'object-position', 'center center')
  forceStyle(image, 'opacity', '1')
  forceStyle(image, 'visibility', 'visible')
  forceStyle(image, 'pointer-events', 'none')
  forceStyle(image, 'user-select', 'none')
  forceStyle(image, 'border', '0')
  forceStyle(image, 'border-radius', 'inherit')
  forceStyle(image, 'transform-origin', '50% 50%')
  forceStyle(
    image,
    'filter',
    slug === 'louis'
      ? 'saturate(1.08) contrast(1.03) brightness(1.03)'
      : 'saturate(1.06) contrast(1.025) brightness(1.025)'
  )
}

function animateHeroImage(image, config, slug) {
  if (image.__gaHeroAnimation) return

  const frames = slug === 'louis'
    ? [
        { transform: 'scale(1.01) translate3d(0,0,0)' },
        { transform: 'scale(1.055) translate3d(-0.7%,-0.4%,0)' },
        { transform: 'scale(1.075) translate3d(0.5%,-0.2%,0)' },
        { transform: 'scale(1.01) translate3d(0,0,0)' },
      ]
    : [
        { transform: 'scale(1.01) translate3d(0,0,0)' },
        { transform: 'scale(1.05) translate3d(-0.4%,-0.5%,0)' },
        { transform: 'scale(1.07) translate3d(0.6%,-0.25%,0)' },
        { transform: 'scale(1.01) translate3d(0,0,0)' },
      ]

  try {
    image.__gaHeroAnimation = image.animate(frames, {
      duration: config.duration,
      iterations: Infinity,
      direction: 'alternate',
      easing: 'ease-in-out',
    })
  } catch {
    // Older WebViews still keep the static image visible.
  }
}

function loadWithFallback(image, candidates, page, banner, slug, config) {
  let index = 0

  const tryNext = () => {
    if (index >= candidates.length) {
      page.dataset.heroMediaError = slug
      console.error(`[GA hero] ${slug}: all asset URLs failed`, candidates)
      return
    }

    const candidate = candidates[index]
    index += 1

    image.onload = () => {
      if (!image.naturalWidth || !image.naturalHeight) {
        tryNext()
        return
      }

      // The real <img> is now authoritative. Remove any CSS background-art
      // attempt so there is no stale/failed image layer underneath it.
      forceStyle(banner, 'background-image', 'none')

      page.dataset.heroMediaReady = slug
      delete page.dataset.heroMediaError
      image.dataset.loadedUrl = candidate
      image.dataset.naturalSize = `${image.naturalWidth}x${image.naturalHeight}`
      animateHeroImage(image, config, slug)
    }

    image.onerror = tryNext
    image.src = candidate
  }

  tryNext()
}

function mountThemeHero(page, slug, config) {
  const banner = page.querySelector('.athlete-theme-banner')
  if (!banner) return

  forceStyle(banner, 'position', 'relative')
  forceStyle(banner, 'isolation', 'isolate')
  forceStyle(banner, 'overflow', 'hidden')

  let image = banner.querySelector(`.ga-runtime-hero--${slug}`)

  if (!image) {
    banner.querySelectorAll('.ga-runtime-hero').forEach((node) => node.remove())

    image = document.createElement('img')
    image.className = config.className
    image.alt = ''
    image.setAttribute('aria-hidden', 'true')
    image.decoding = 'async'
    image.draggable = false

    styleHeroImage(image, slug)
    banner.prepend(image)
    loadWithFallback(
      image,
      resolveCandidates(config),
      page,
      banner,
      slug,
      config
    )
  } else {
    styleHeroImage(image, slug)

    if (image.complete && image.naturalWidth > 0) {
      forceStyle(banner, 'background-image', 'none')
      animateHeroImage(image, config, slug)
      page.dataset.heroMediaReady = slug
    }
  }
}

function mountAllThemeHeroes() {
  Object.entries(HERO_THEMES).forEach(([slug, config]) => {
    document
      .querySelectorAll(`.training-page[data-athlete-theme="${slug}"]`)
      .forEach((page) => mountThemeHero(page, slug, config))
  })
}

let scheduled = false
function scheduleMount() {
  if (scheduled) return
  scheduled = true

  requestAnimationFrame(() => {
    scheduled = false
    mountAllThemeHeroes()
  })
}

const observer = new MutationObserver(scheduleMount)
observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
})

window.addEventListener('DOMContentLoaded', scheduleMount)
window.addEventListener('popstate', scheduleMount)
window.addEventListener('hashchange', scheduleMount)

scheduleMount()
