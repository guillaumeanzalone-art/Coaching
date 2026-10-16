import test from 'node:test'
import assert from 'node:assert/strict'

import {
  BRUTE_PARTS,
  BRUTE_PALETTES,
  DEFAULT_APPEARANCE,
  randomAppearance,
} from '../src/brute-config.js'

import {
  renderBruteSvg,
} from '../src/brute-svg.js'

function assertCleanSvg(svg) {
  assert.match(
    svg,
    /^<svg/
  )

  assert.ok(
    svg.includes(
      'class="ga-brute-svg'
    ),
    'renderer should produce a GA Brute SVG'
  )

  assert.equal(
    svg.includes('NaN'),
    false,
    'SVG should never contain NaN'
  )

  assert.equal(
    svg.includes('undefined'),
    false,
    'SVG should never contain undefined'
  )

  assert.equal(
    svg.includes('null'),
    false,
    'SVG should never contain null values'
  )
}

test('GA Brute renderer supports every avatar axis without broken markup', () => {
  const axes = [
    ['body',BRUTE_PARTS.bodies],
    ['head',BRUTE_PARTS.heads],
    ['skin',BRUTE_PARTS.skins],
    ['hair',BRUTE_PARTS.hairs],
    ['hairColor',BRUTE_PARTS.hairColors],
    ['beard',BRUTE_PARTS.beards],
    ['eyes',BRUTE_PARTS.eyes],
    ['nose',BRUTE_PARTS.noses],
    ['mouth',BRUTE_PARTS.mouths],
    ['marking',BRUTE_PARTS.markings],
    ['top',BRUTE_PARTS.tops],
    ['bottom',BRUTE_PARTS.bottoms],
    ['acc',BRUTE_PARTS.accessories],
  ]

  for (
    const [
      key,
      values,
    ] of axes
  ) {
    values.forEach(
      (_value,index) => {
        const appearance = {
          ...DEFAULT_APPEARANCE,
          colors:[
            ...DEFAULT_APPEARANCE.colors,
          ],
          [key]:index,
        }

        assertCleanSvg(
          renderBruteSvg(
            appearance,
            {
              label:
                key + '-' + index,
            }
          )
        )
      }
    )
  }
})

test('GA Brute renderer supports the full clothing palettes', () => {
  for (
    const primary
    of BRUTE_PALETTES.primary
  ) {
    for (
      const secondary
      of BRUTE_PALETTES.secondary
    ) {
      assertCleanSvg(
        renderBruteSvg(
          {
            ...DEFAULT_APPEARANCE,
            colors:[
              primary,
              secondary,
            ],
          }
        )
      )
    }
  }
})

test('GA Brute random creator only returns valid catalog values', () => {
  for (
    let index = 0;
    index < 150;
    index += 1
  ) {
    const appearance =
      randomAppearance()

    assert.ok(
      appearance.body >= 0 &&
      appearance.body <
        BRUTE_PARTS.bodies.length
    )

    assert.ok(
      appearance.skin >= 0 &&
      appearance.skin <
        BRUTE_PARTS.skins.length
    )

    assert.ok(
      appearance.hair >= 0 &&
      appearance.hair <
        BRUTE_PARTS.hairs.length
    )

    assert.ok(
      BRUTE_PALETTES.primary.includes(
        appearance.colors[0]
      )
    )

    assert.ok(
      BRUTE_PALETTES.secondary.includes(
        appearance.colors[1]
      )
    )

    assertCleanSvg(
      renderBruteSvg(
        appearance
      )
    )
  }
})
