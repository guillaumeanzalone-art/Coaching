import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getCachedProgramForAthlete,
} from '../src/program-cloud.js'

function installLocalStorage(values = {}) {
  const store = new Map(
    Object.entries(values)
  )

  globalThis.localStorage = {
    getItem(key) {
      return store.has(key)
        ? store.get(key)
        : null
    },
    setItem(key, value) {
      store.set(key, String(value))
    },
    removeItem(key) {
      store.delete(key)
    },
  }
}

test('lit le programme de Noé depuis le cache sans requête cloud', () => {
  installLocalStorage({
    'ga_program_cloud_v1:noe': JSON.stringify({
      athleteSlug: 'Noe',
      programKey: 'noe',
      version: 3,
      publishedAt: '2026-09-19T11:33:35.234Z',
      program: {
        id: 'ga-noe-cloud',
        blocks: [],
      },
    }),
  })

  const program =
    getCachedProgramForAthlete(
      'noe'
    )

  assert.equal(program.id, 'ga-noe-cloud')
  assert.equal(program.programKey, 'noe')
  assert.equal(program.cloudVersion, 3)
})

test('renvoie null quand aucun cache local n’existe', () => {
  installLocalStorage()

  assert.equal(
    getCachedProgramForAthlete(
      'noe'
    ),
    null
  )
})
