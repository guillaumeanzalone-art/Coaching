import { supabase } from './supabase.js'
import { getAthlete } from './athletes.js'

const CACHE_PREFIX =
  'ga_program_cloud_v1:'

let lastSourceInfo =
  new Map()

function cacheKey(
  athleteSlug
) {
  return (
    CACHE_PREFIX +
    String(
      athleteSlug ||
      ''
    ).toLowerCase()
  )
}

function readCache(
  athleteSlug
) {
  try {
    const raw =
      localStorage.getItem(
        cacheKey(
          athleteSlug
        )
      )

    if (!raw) {
      return null
    }

    const parsed =
      JSON.parse(
        raw
      )

    if (
      !parsed ||
      !parsed.program
    ) {
      return null
    }

    return parsed
  } catch (_) {
    return null
  }
}

function writeCache(
  athleteSlug,
  row,
  program
) {
  try {
    localStorage.setItem(
      cacheKey(
        athleteSlug
      ),
      JSON.stringify(
        {
          athleteSlug,
          programKey:
            row?.program_key ||
            program?.programKey ||
            '',
          version:
            Number(
              row?.version ||
              0
            ),
          publishedAt:
            row?.published_at ||
            null,
          cachedAt:
            new Date()
              .toISOString(),
          program,
        }
      )
    )
  } catch (_) {
    // Le cache est un bonus :
    // il ne doit jamais bloquer
    // le chargement du programme.
  }
}

function markSource(
  athleteId,
  info
) {
  lastSourceInfo.set(
    String(
      athleteId ||
      ''
    ),
    {
      ...info,
      at:
        new Date()
          .toISOString(),
    }
  )
}

function normalizeProgram(
  row,
  program
) {
  if (
    !program ||
    typeof program !==
      'object'
  ) {
    return null
  }

  return {
    ...program,
    programKey:
      program.programKey ||
      row?.program_key ||
      '',
    cloudVersion:
      Number(
        row?.version ||
        0
      ),
    cloudPublishedAt:
      row?.published_at ||
      null,
  }
}

function isMissingTableError(
  error
) {
  const code =
    String(
      error?.code ||
      ''
    )

  const message =
    String(
      error?.message ||
      ''
    ).toLowerCase()

  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    message.includes(
      'program_versions_v2'
    ) &&
    (
      message.includes(
        'does not exist'
      ) ||
      message.includes(
        'could not find'
      )
    )
  )
}

export function getProgramSourceInfo(
  athleteId
) {
  return (
    lastSourceInfo.get(
      String(
        athleteId ||
        ''
      )
    ) ||
    null
  )
}

export function clearProgramCloudCache(
  athleteId
) {
  const athlete =
    getAthlete(
      athleteId
    )

  const slug =
    athlete?.cloudSlug ||
    athlete?.slug ||
    athlete?.id ||
    athleteId

  try {
    localStorage.removeItem(
      cacheKey(
        slug
      )
    )
  } catch (_) {
    // no-op
  }
}

export function getCachedProgramForAthlete(
  athleteId
) {
  const athlete =
    getAthlete(
      athleteId
    )

  const athleteSlug =
    athlete?.cloudSlug ||
    athlete?.slug ||
    athlete?.id ||
    athleteId

  const programKey =
    athlete?.programKey ||
    athlete?.id ||
    athleteId

  const cached =
    readCache(
      athleteSlug
    )

  if (!cached?.program) {
    return null
  }

  return normalizeProgram(
    {
      program_key:
        cached.programKey ||
        programKey,
      version:
        cached.version ||
        0,
      published_at:
        cached.publishedAt ||
        null,
    },
    cached.program
  )
}

export async function getProgramWithCloudFallback({
  athleteId,
  localLoader,
}) {
  const athlete =
    getAthlete(
      athleteId
    )

  const athleteSlug =
    athlete?.cloudSlug ||
    athlete?.slug ||
    athlete?.id ||
    athleteId

  const programKey =
    athlete?.programKey ||
    athlete?.id ||
    athleteId

  const cached =
    readCache(
      athleteSlug
    )

  if (
    typeof navigator !==
      'undefined' &&
    navigator.onLine ===
      false
  ) {
    if (
      cached?.program
    ) {
      const program =
        normalizeProgram(
          {
            program_key:
              cached.programKey ||
              programKey,
            version:
              cached.version ||
              0,
            published_at:
              cached.publishedAt ||
              null,
          },
          cached.program
        )

      markSource(
        athleteId,
        {
          source:
            'cache',
          athleteSlug,
          programKey:
            program?.programKey ||
            programKey,
          version:
            cached.version ||
            0,
        }
      )

      return program
    }

    // Bundled programs may contain archived blocks (for example Kaoutar
    // Bloc 2). Without a previously synchronized cloud snapshot, never
    // show one of these old programs as if it were the active workout.
    markSource(
      athleteId,
      {
        source: 'offline-no-cache',
        athleteSlug,
        programKey,
        version: 0,
      }
    )

    throw new Error(
      'Programme actuel non disponible hors connexion. Ouvre le profil une fois en ligne pour le synchroniser.'
    )
  }

  try {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          'program_versions_v2'
        )
        .select(
          'athlete_slug,program_key,version,status,current_week,program_json,published_at,updated_at'
        )
        .eq(
          'athlete_slug',
          athleteSlug
        )
        .eq(
          'status',
          'active'
        )
        .order(
          'version',
          {
            ascending:
              false,
          }
        )
        .limit(
          1
        )
        .maybeSingle()

    if (error) {
      throw error
    }

    if (
      data?.program_json
    ) {
      const program =
        normalizeProgram(
          data,
          data.program_json
        )

      if (
        data.current_week &&
        !program.currentWeek &&
        !program.current_week
      ) {
        program.currentWeek =
          Number(
            data.current_week
          )
      }

      writeCache(
        athleteSlug,
        data,
        program
      )

      markSource(
        athleteId,
        {
          source:
            'cloud',
          athleteSlug,
          programKey:
            data.program_key ||
            programKey,
          version:
            Number(
              data.version ||
              0
            ),
          publishedAt:
            data.published_at ||
            null,
        }
      )

      return program
    }
  } catch (
    error
  ) {
    if (
      !isMissingTableError(
        error
      )
    ) {
      console.warn(
        'Programme cloud indisponible :',
        athleteSlug,
        error?.message ||
        error
      )
    }


  }

  // A silent fallback to the old bundled program can display an archived
  // block while Supabase has a newer active one. Surface the sync failure
  // instead, so athletes cannot mistake historical loads for prescriptions.
  markSource(
    athleteId,
    {
      source: 'cloud-unavailable',
      athleteSlug,
      programKey,
      version: 0,
    }
  )

  throw new Error(
    'Impossible de vérifier le programme actif. Vérifie la connexion et réessaie ; aucun ancien bloc ne sera affiché à sa place.'
  )
}


/* ================================================================
   GA COACHING V3 — BLOCS + OVERVIEW SUPABASE
   Ces fonctions sont additives : le système V2 actuel reste intact.
   ================================================================ */

function resolveAthleteSlugV3(
  athleteIdOrSlug
) {
  const athlete =
    getAthlete(
      athleteIdOrSlug
    )

  return String(
    athlete?.cloudSlug ||
    athlete?.slug ||
    athlete?.id ||
    athleteIdOrSlug ||
    ''
  )
    .trim()
    .toLowerCase()
}

export async function getAthleteBlocksV3(
  athleteIdOrSlug
) {
  const athleteSlug =
    resolveAthleteSlugV3(
      athleteIdOrSlug
    )

  if (!athleteSlug) {
    throw new Error(
      'Athlète V3 introuvable.'
    )
  }

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'list_athlete_program_blocks_v3',
      {
        p_athlete_slug:
          athleteSlug,
      }
    )

  if (error) {
    console.error(
      'Liste des blocs V3 indisponible :',
      athleteSlug,
      error
    )

    throw error
  }

  return Array.isArray(data)
    ? data
    : []
}

export async function getAthleteBlockV3(
  athleteIdOrSlug,
  blockKey
) {
  const athleteSlug =
    resolveAthleteSlugV3(
      athleteIdOrSlug
    )

  const cleanBlockKey =
    String(
      blockKey ||
      ''
    ).trim()

  if (!athleteSlug) {
    throw new Error(
      'Athlète V3 introuvable.'
    )
  }

  if (!cleanBlockKey) {
    throw new Error(
      'Bloc V3 introuvable.'
    )
  }

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'get_athlete_program_block_v3',
      {
        p_athlete_slug:
          athleteSlug,
        p_block_key:
          cleanBlockKey,
      }
    )

  if (error) {
    console.error(
      'Bloc V3 indisponible :',
      athleteSlug,
      cleanBlockKey,
      error
    )

    throw error
  }

  return data ?? null
}
