import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { COURSES, COURSE_GROUPS, courseUrl, filterCourses } from '../src/courses.js'

test('tous les cours publiés sont présents et identifiés', async () => {
  assert.equal(COURSES.length, 13)
  assert.equal(new Set(COURSES.map(course => course.id)).size, COURSES.length)
  assert.equal(new Set(COURSES.map(course => course.file)).size, COURSES.length)
  for (const course of COURSES) {
    assert.ok(COURSE_GROUPS.includes(course.group), 'Catégorie inconnue: ' + course.group)
    assert.ok(course.source.endsWith('.html'), 'Pas de provenance pour ' + course.id)
    assert.ok(courseUrl(course).endsWith('/cours/' + course.file))
    const html = await readFile(new URL('../public/cours/' + course.file, import.meta.url), 'utf8')
    assert.ok(html.length > 1000, 'Fichier incomplet pour ' + course.id)
    assert.match(html.slice(0, 1000), /<html|<!doctype/i, 'HTML invalide pour ' + course.id)
  }
})

test('recherche insensible aux accents et catégories indépendantes', () => {
  assert.equal(filterCourses('rétroversion').length, 1)
  assert.equal(filterCourses('retroversion')[0].id, 'stack')
  assert.equal(filterCourses('', 'Yoga & respiration').length, 3)
  assert.equal(filterCourses('squat', 'Squat').length, 5)
  assert.equal(filterCourses('hook grip')[0].id, 'hook-grip')
  assert.equal(filterCourses('absent').length, 0)
})
