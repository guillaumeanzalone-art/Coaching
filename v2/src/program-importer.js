const TYPE_BY_LABEL = { sq: 'SQ', bn: 'BN', dl: 'DL', ac: 'AC' }
const DAY_EMOJIS = ['🎯', '⚡', '🏋️', '🔥', '🏆', '💪', '✅']

const clean = (value = '') => String(value)
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/&nbsp;/gi, ' ')
  .replace(/\*{1,3}/g, '')
  .replace(/^\s*[`_]+|[`_]+\s*$/g, '')
  .replace(/\s+/g, ' ')
  .trim()

const normalized = (value = '') => clean(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()

const slug = (value = '') => normalized(value)
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 70) || 'programme'

function parseMarkdownRow(line) {
  let value = line.trim()
  if (value.startsWith('|')) value = value.slice(1)
  if (value.endsWith('|')) value = value.slice(0, -1)
  return value.split('|').map(clean)
}

function parseRows(input) {
  const text = String(input || '').replace(/\r/g, '').trim()
  if (!text) throw new Error('Colle d’abord une programmation Google Sheets.')

  const lines = text.split('\n').filter((line) => line.trim())
  const markdown = lines.filter((line) => line.trim().startsWith('|')).length >= 2

  return lines
    .map((line) => {
      if (markdown) return parseMarkdownRow(line)
      if (line.includes('\t')) return line.split('\t').map(clean)
      return line.split(';').map(clean)
    })
    .filter((row) => {
      const filled = row.filter(Boolean)
      return !(filled.length && filled.every((cell) => /^:?-{3,}:?$/.test(cell)))
    })
}

function frenchNumber(value) {
  const text = clean(value).replace(/\s/g, '').replace(',', '.')
  if (!/^-?\d+(?:\.\d+)?$/.test(text)) return null
  const result = Number(text)
  return Number.isFinite(result) ? result : null
}

function parseSetCount(value) {
  const match = clean(value).match(/\d+/)
  return match ? Math.max(1, Math.min(30, Number(match[0]))) : 1
}

function parsePercent(value) {
  const match = clean(value).match(/^(\d+(?:[.,]\d+)?)\s*%$/)
  return match ? frenchNumber(match[1]) : null
}

function extractMetrics(rows) {
  const maxes = { squat: null, bench: null, deadlift: null }
  let bodyWeight = null

  rows.slice(0, 24).forEach((row) => {
    const key = normalized(row[0])
    const value = frenchNumber(row[1])
    if (key === 'squat') maxes.squat = value
    if (key === 'bench') maxes.bench = value
    if (key === 'deadlift') maxes.deadlift = value
    if (key === 'body weight' || key === 'pdc') bodyWeight = value
  })

  return { maxes, bodyWeight }
}

function detectWeekCount(rows) {
  const weeks = new Set()
  rows.forEach((row) => row.forEach((cell) => {
    const match = normalized(cell).match(/^(?:week|semaine)\s*(\d+)$/)
    if (match) weeks.add(Number(match[1]))
  }))
  return weeks.size || 1
}

function readHeader(row) {
  const anchors = []
  let dayNumber = null
  let title = ''

  row.forEach((cell, index) => {
    if (normalized(cell) === 'label') anchors.push(index)
    const match = clean(cell).match(/^Jour\s*(\d+)\b.*$/i)
    if (!title && match) {
      title = clean(cell)
      dayNumber = Number(match[1])
    }
  })

  return title && anchors.length ? { anchors, dayNumber, title } : null
}

function nearestWeek(cellIndex, anchors, weekCount) {
  let selected = 0
  let distance = Infinity
  anchors.slice(0, weekCount).forEach((anchor, index) => {
    const nextDistance = Math.abs(anchor - cellIndex)
    if (nextDistance < distance) {
      selected = index
      distance = nextDistance
    }
  })
  return selected
}

function readExercise(row, labelIndex) {
  const label = normalized(row[labelIndex])
  const name = clean(row[labelIndex + 2])
  if (!TYPE_BY_LABEL[label] || !name || /^(jour|sets?|reps?|volume)$/i.test(name)) return null

  return {
    label,
    type: TYPE_BY_LABEL[label],
    intention: clean(row[labelIndex + 1]),
    name,
    setsText: clean(row[labelIndex + 3]),
    reps: clean(row[labelIndex + 4]),
    intensity: clean(row[labelIndex + 5]),
    targetLoad: clean(row[labelIndex + 6]),
    notes: clean(row[labelIndex + 12]),
  }
}

function compressedLiftGroups(exercises) {
  return exercises.reduce((groups, exercise, index) => {
    if (!['SQ', 'BN', 'DL'].includes(exercise.type)) return groups
    const previous = groups[groups.length - 1]
    if (previous?.type === exercise.type) return groups
    groups.push({ type: exercise.type, start: index })
    return groups
  }, [])
}

function repeatedSbdStart(exercises) {
  const groups = compressedLiftGroups(exercises)
  for (let index = 0; index <= groups.length - 6; index += 1) {
    const sequence = groups.slice(index, index + 6).map((group) => group.type).join(',')
    if (sequence === 'SQ,BN,DL,SQ,BN,DL') return groups[index + 3].start
  }
  return null
}

function exerciseSignature(exercise) {
  return [
    exercise.type,
    normalized(exercise.name),
    normalized(exercise.intention),
    normalized(exercise.setsText),
    normalized(exercise.reps),
    normalized(exercise.intensity),
    normalized(exercise.targetLoad),
  ].join('|')
}

function removeRepeatedSbdSuffixes(weeks) {
  const warnings = []
  const dayNumbers = new Set(
    weeks.flatMap((week) => week.days.map((day) => day.number)),
  )

  dayNumbers.forEach((dayNumber) => {
    const matchingDays = weeks
      .map((week) => week.days.find((day) => day.number === dayNumber))
      .filter(Boolean)
    if (matchingDays.length !== weeks.length || matchingDays.length < 2) return

    const starts = matchingDays.map((day) => repeatedSbdStart(day.exercises))
    if (starts.some((start) => start === null) || new Set(starts).size !== 1) return

    const suffixes = matchingDays.map((day, index) => day.exercises
      .slice(starts[index])
      .map(exerciseSignature)
      .join('||'))
    if (new Set(suffixes).size !== 1) return

    const prefixes = matchingDays.map((day, index) => day.exercises
      .slice(0, starts[index])
      .map(exerciseSignature)
      .join('||'))
    if (new Set(prefixes).size === 1) return

    const removedPerWeek = matchingDays[0].exercises.length - starts[0]
    matchingDays.forEach((day, index) => {
      day.exercises = day.exercises.slice(0, starts[index])
    })
    warnings.push({
      code: 'repeated-sbd-suffix',
      dayNumber,
      removedExerciseCount: removedPerWeek * matchingDays.length,
      message: `Deux séances SBD consécutives détectées au Jour ${dayNumber} : la seconde, identique sur toutes les semaines, a été ignorée.`,
    })
  })

  return warnings
}

export function parseProgramSheet(input) {
  const rows = parseRows(input)
  const weekCount = detectWeekCount(rows)
  const metrics = extractMetrics(rows)
  const headers = rows
    .map((row, index) => ({ index, info: readHeader(row) }))
    .filter((item) => item.info)

  if (!headers.length) {
    throw new Error('Aucun en-tête « Jour 1, Jour 2… » n’a été détecté.')
  }

  const weeks = Array.from({ length: weekCount }, (_, index) => ({
    number: index + 1,
    days: [],
  }))

  headers.forEach((header, headerIndex) => {
    const end = headers[headerIndex + 1]?.index ?? rows.length
    const exercisesByWeek = Array.from({ length: weekCount }, () => [])

    for (let rowIndex = header.index + 1; rowIndex < end; rowIndex += 1) {
      const row = rows[rowIndex]
      row.forEach((cell, cellIndex) => {
        if (!TYPE_BY_LABEL[normalized(cell)]) return
        const weekIndex = nearestWeek(cellIndex, header.info.anchors, weekCount)
        const exercise = readExercise(row, cellIndex)
        if (exercise) exercisesByWeek[weekIndex].push(exercise)
      })
    }

    weeks.forEach((week, weekIndex) => {
      if (!exercisesByWeek[weekIndex].length) return
      week.days.push({
        number: header.info.dayNumber,
        title: header.info.title,
        exercises: exercisesByWeek[weekIndex],
      })
    })
  })

  const sourceExerciseCount = weeks.reduce(
    (total, week) => total + week.days.reduce(
      (dayTotal, day) => dayTotal + day.exercises.length,
      0,
    ),
    0,
  )
  const warnings = removeRepeatedSbdSuffixes(weeks)

  const dayCount = weeks.reduce((total, week) => total + week.days.length, 0)
  const exerciseCount = weeks.reduce(
    (total, week) => total + week.days.reduce(
      (dayTotal, day) => dayTotal + day.exercises.length,
      0,
    ),
    0,
  )

  if (!exerciseCount) {
    throw new Error('Aucun exercice sq, bn, dl ou ac n’a été détecté.')
  }

  return {
    weeks,
    metrics,
    warnings,
    summary: {
      weekCount,
      dayCount,
      exerciseCount,
      sourceExerciseCount,
      ignoredExerciseCount: sourceExerciseCount - exerciseCount,
    },
  }
}

function createSet(exerciseId, index, exercise) {
  const percent = parsePercent(exercise.intensity)
  return {
    id: `${exerciseId}-s${index + 1}`,
    reps: exercise.reps || '1',
    percent,
    loadRange: exercise.targetLoad || null,
    intensity: percent === null ? exercise.intensity || null : null,
    source: 'google-sheets',
    load: '',
    rpe: '',
    status: 'pending',
  }
}

function sameExerciseSegment(left, right) {
  return left?.type === right?.type
    && normalized(left?.name) === normalized(right?.name)
    && normalized(left?.intention) === normalized(right?.intention)
}

function groupExerciseSegments(exercises) {
  return exercises.reduce((groups, exercise) => {
    const previous = groups[groups.length - 1]
    if (previous && sameExerciseSegment(previous[previous.length - 1], exercise)) {
      previous.push(exercise)
    } else {
      groups.push([exercise])
    }
    return groups
  }, [])
}

function createExercise({ blockId, weekNumber, dayNumber, index, segments }) {
  const exerciseId = `${blockId}-w${weekNumber}-d${dayNumber}-e${index + 1}`
  const exercise = segments[0]
  const notes = [...new Set(segments.map((segment) => segment.notes).filter(Boolean))]
  const sets = segments.flatMap((segment) => Array.from(
    { length: parseSetCount(segment.setsText) },
    () => segment,
  ))

  return {
    id: exerciseId,
    name: exercise.name,
    type: exercise.type,
    variant: exercise.intention || '',
    notes: notes.join(' · '),
    usesRpe: exercise.type !== 'AC',
    sets: sets.map((segment, setIndex) => createSet(exerciseId, setIndex, segment)),
  }
}

export function createImportedProgram({ parsed, athlete, blockNumber, blockLabel, blockKey }) {
  if (!parsed?.weeks?.length || !athlete) {
    throw new Error('Import analysé ou athlète manquant.')
  }

  const cleanBlockNumber = Math.max(1, Number(blockNumber) || 1)
  const resolvedBlockKey = slug(blockKey || `${athlete.id}-block-${cleanBlockNumber}`)
  const label = clean(blockLabel) || `Bloc ${cleanBlockNumber}`
  const block = {
    id: resolvedBlockKey,
    label,
    kicker: 'Import Google Sheets',
    sourceKey: resolvedBlockKey,
    sourceType: 'google-sheets',
    importedAt: new Date().toISOString(),
    sheetMetrics: parsed.metrics,
    weeks: parsed.weeks.map((week) => ({
      id: `${resolvedBlockKey}-week-${week.number}`,
      number: week.number,
      label: `S${week.number}`,
      days: week.days.map((day) => ({
        id: `${resolvedBlockKey}-w${week.number}-d${day.number}`,
        name: day.title,
        emoji: DAY_EMOJIS[day.number - 1] || '🏋️',
        exercises: groupExerciseSegments(day.exercises).map((segments, index) => createExercise({
          blockId: resolvedBlockKey,
          weekNumber: week.number,
          dayNumber: day.number,
          index,
          segments,
        })),
      })),
    })),
  }

  const program = {
    id: `ga-${athlete.id}-cloud`,
    athlete: { id: athlete.id, name: athlete.name },
    programKey: athlete.programKey || athlete.id,
    currentWeek: 1,
    defaultBlockId: block.id,
    blocks: [block],
  }

  const setCount = block.weeks.reduce(
    (total, week) => total + week.days.reduce(
      (dayTotal, day) => dayTotal + day.exercises.reduce(
        (exerciseTotal, exercise) => exerciseTotal + exercise.sets.length,
        0,
      ),
      0,
    ),
    0,
  )
  const exerciseCount = block.weeks.reduce(
    (total, week) => total + week.days.reduce(
      (dayTotal, day) => dayTotal + day.exercises.length,
      0,
    ),
    0,
  )

  return {
    program,
    block,
    overview: {
      source: 'google-sheets-importer',
      importedAt: block.importedAt,
      metrics: parsed.metrics,
      summary: {
        ...parsed.summary,
        sourceRowCount: parsed.summary.sourceExerciseCount ?? parsed.summary.exerciseCount,
        exerciseCount,
        setCount,
      },
      warnings: parsed.warnings || [],
    },
  }
}
