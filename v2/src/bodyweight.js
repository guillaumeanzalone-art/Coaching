const MIN_BODY_WEIGHT_KG = 20
const MAX_BODY_WEIGHT_KG = 400

export function normalizeBodyWeightKg(
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null
  }

  const number =
    Number(
      String(value)
        .replace(',', '.')
    )

  if (
    !Number.isFinite(number) ||
    number < MIN_BODY_WEIGHT_KG ||
    number > MAX_BODY_WEIGHT_KG
  ) {
    return null
  }

  return number
}

export function averageBodyWeightsKg(
  values
) {
  const recorded =
    (values || [])
      .map(
        normalizeBodyWeightKg
      )
      .filter(
        value =>
          value !== null
      )

  if (!recorded.length) {
    return null
  }

  return (
    recorded.reduce(
      (sum, value) =>
        sum + value,
      0
    ) /
    recorded.length
  )
}

export function formatBodyWeightKg(
  value
) {
  const bodyWeight =
    normalizeBodyWeightKg(
      value
    )

  if (bodyWeight === null) {
    return '—'
  }

  return new Intl.NumberFormat(
    'fr-FR',
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }
  ).format(bodyWeight)
}
