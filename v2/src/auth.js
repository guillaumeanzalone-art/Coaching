import { supabase } from './supabase.js'

export async function signIn(
  email,
  password
) {
  const {
    data,
    error,
  } =
    await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

  if (error) {
    return {
      session: null,
      user: null,
      member: null,
      error,
    }
  }

  const memberResult =
    await loadMember(
      data.user
    )

  return {
    session: data.session,
    user: data.user,
    member: memberResult.member,
    error: memberResult.error,
  }
}

export async function loadMember(
  user
) {
  if (!user) {
    return {
      member: null,
      error: null,
    }
  }

  const {
    data,
    error,
  } =
    await supabase
      .from('app_users')
      .select(
        `
        user_id,
        email,
        display_name,
        role,
        athlete_slug
        `
      )
      .eq(
        'user_id',
        user.id
      )
      .maybeSingle()

  return {
    member: data ?? null,
    error,
  }
}

export async function getCurrentAuth() {
  const {
    data,
    error,
  } =
    await supabase.auth.getUser()

  if (
    error ||
    !data.user
  ) {
    return {
      user: null,
      member: null,
      error: error ?? null,
    }
  }

  const memberResult =
    await loadMember(
      data.user
    )

  return {
    user: data.user,
    member: memberResult.member,
    error: memberResult.error,
  }
}

export async function signOut() {
  const {
    error,
  } =
    await supabase.auth.signOut({
      scope: 'local',
    })

  return {
    error,
  }
}
