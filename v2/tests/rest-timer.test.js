import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import {
  defaultRestSeconds,
  formatRestDuration,
  restTimerExerciseKey,
  restTimerRemaining,
} from '../src/rest-timer.js'

test('rest timer defaults are longer for SBD lifts', () => {
  assert.equal(
    defaultRestSeconds({
      isSbd:true,
      exercise:{
        type:'SBD',
        name:'Squat',
      },
    }),
    180
  )

  assert.equal(
    defaultRestSeconds({
      isSbd:false,
      exercise:{
        type:'Accessory',
        name:'Curl',
      },
    }),
    90
  )
})

test('rest timer formats compact durations', () => {
  assert.equal(
    formatRestDuration(60),
    '1 min'
  )

  assert.equal(
    formatRestDuration(105),
    '1:45'
  )
})

test('rest timer exercise key stays stable across accents and variants', () => {
  assert.equal(
    restTimerExerciseKey({
      type:'SBD',
      name:'Développé Couché',
      variant:'Pause 2s',
    }),
    'sbd:developpe-couche:pause-2s'
  )
})

test('rest timer remaining is based on absolute end time', () => {
  assert.equal(
    restTimerRemaining(
      {
        endAt:10_000,
      },
      7_500
    ),
    3
  )

  assert.equal(
    restTimerRemaining(
      {
        endAt:5_000,
      },
      7_500
    ),
    0
  )
})


test('uses the correct Capacitor and native permission methods', () => {
  const here =
    path.dirname(
      fileURLToPath(
        import.meta.url
      )
    )

  const source =
    readFileSync(
      path.join(
        here,
        '..',
        'src',
        'rest-timer.js'
      ),
      'utf8'
    )

  assert.match(
    source,
    /LocalNotifications\s*\.requestPermissions\(\)/
  )

  assert.match(
    source,
    /RestTimerNative\s*\.requestTimerPermissions\(\)/
  )

  assert.doesNotMatch(
    source,
    /LocalNotifications\s*\.requestTimerPermissions\(\)/
  )
})
