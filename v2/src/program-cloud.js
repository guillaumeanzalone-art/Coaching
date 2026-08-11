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

    const local =
      await localLoader()

    markSource(
      athleteId,
      {
        source:
          'local-offline',
        athleteSlug,
        programKey:
          local?.programKey ||
          programKey,
        version: 0,
      }
    )

    return local
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
  }

  const local =
    await localLoader()

  markSource(
    athleteId,
    {
      source:
        'local',
      athleteSlug,
      programKey:
        local?.programKey ||
        programKey,
      version: 0,
    }
  )

  return local
}
