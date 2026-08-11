export const athletes = [
  {
    id: 'killian',
    name: 'Killian',
    emoji: '⚡',
    bodyWeight: 67,
    programKey: 'killian',
  },

  {
    id: 'saya',
    name: 'Saya',
    emoji: '🌸',
    bodyWeight: null,
    programKey: 'saya',
  },

  {
    id: 'janel',
    name: 'Janel',
    emoji: '🔥',
    bodyWeight: null,
    programKey: 'janel',
  },
]

export function getAthlete(athleteId) {
  return athletes.find(
    (athlete) =>
      athlete.id === athleteId
  ) ?? null
}