import { jsPDF } from 'jspdf'

function safeText(value) {
  return String(
    value ?? ''
  )
}

function durationLabel(seconds) {
  const total =
    Math.max(
      0,
      Math.floor(
        Number(seconds) || 0
      )
    )

  const hours =
    Math.floor(
      total / 3600
    )

  const minutes =
    Math.floor(
      (total % 3600) / 60
    )

  const remaining =
    total % 60

  return [
    hours,
    minutes,
    remaining,
  ]
    .map(
      (value) =>
        String(value)
          .padStart(
            2,
            '0'
          )
    )
    .join(':')
}

function metricLabel(
  value,
  suffix = ''
) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return '—'
  }

  return `${value}${suffix}`
}

export function exportBlockReportPdf({
  athleteName,
  blockLabel,
  report,
}) {
  const doc =
    new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    })

  const pageWidth =
    doc.internal.pageSize
      .getWidth()

  const margin = 15
  const contentWidth =
    pageWidth -
    margin * 2

  let y = 18

  function ensureSpace(
    required = 15
  ) {
    if (y + required > 282) {
      doc.addPage()
      y = 18
    }
  }

  function text(
    value,
    size = 10,
    {
      bold = false,
      gap = 5,
    } = {}
  ) {
    doc.setFont(
      'helvetica',
      bold
        ? 'bold'
        : 'normal'
    )

    doc.setFontSize(
      size
    )

    const lines =
      doc.splitTextToSize(
        safeText(value),
        contentWidth
      )

    ensureSpace(
      lines.length *
        gap +
      4
    )

    doc.text(
      lines,
      margin,
      y
    )

    y +=
      lines.length *
      gap
  }

  doc.setFont(
    'helvetica',
    'bold'
  )
  doc.setFontSize(18)

  doc.text(
    'L’Araignée Coaching',
    margin,
    y
  )

  y += 9

  text(
    `Compte rendu total du bloc — ${blockLabel}`,
    14,
    {
      bold: true,
      gap: 6,
    }
  )

  text(
    `Athlète : ${athleteName}`,
    11,
    {
      bold: true,
    }
  )

  y += 2

  text(
    `Séances terminées : ${report.completedDays}/${report.totalDays}`
  )

  text(
    `Séries réalisées : ${report.completedSets}/${report.totalSets}`
  )

  text(
    `Temps cumulé : ${durationLabel(report.totalSeconds)}`
  )

  y += 4

  report.sessions.forEach(
    (
      session,
      index
    ) => {
      ensureSpace(55)

      doc.setDrawColor(
        210,
        210,
        210
      )

      doc.line(
        margin,
        y,
        pageWidth - margin,
        y
      )

      y += 7

      text(
        `${session.weekLabel} · ${session.dayName}`,
        12,
        {
          bold: true,
          gap: 6,
        }
      )

      text(
        `Séries : ${session.completed}/${session.total}`
      )

      text(
        `Durée : ${durationLabel(session.duration)}`
      )

      text(
        `Hydratation : ${metricLabel(session.hydrationLiters, ' L')} · Sommeil : ${metricLabel(session.sleepHours, ' h')}`
      )

      text(
        `Douleur upper : ${metricLabel(session.painUpper, '/10')} · Douleur lower : ${metricLabel(session.painLower, '/10')}`
      )

      text(
        `Pas : ${metricLabel(session.steps)}`
      )

      text(
        `Notes : ${session.note || 'Aucune note.'}`
      )

      if (
        index <
        report.sessions.length - 1
      ) {
        y += 3
      }
    }
  )

  const safeAthlete =
    safeText(
      athleteName
    )
      .normalize('NFD')
      .replace(
        /[\u0300-\u036f]/g,
        ''
      )
      .replace(
        /[^a-zA-Z0-9_-]+/g,
        '-'
      )
      .replace(
        /-+/g,
        '-'
      )
      .replace(
        /^-|-$|/g,
        ''
      ) ||
    'athlete'

  const safeBlock =
    safeText(
      blockLabel
    )
      .normalize('NFD')
      .replace(
        /[\u0300-\u036f]/g,
        ''
      )
      .replace(
        /[^a-zA-Z0-9_-]+/g,
        '-'
      )
      .replace(
        /-+/g,
        '-'
      )
      .replace(
        /^-|-$|/g,
        ''
      ) ||
    'bloc'

  doc.save(
    `GA-Coaching-${safeAthlete}-${safeBlock}.pdf`
  )
}
