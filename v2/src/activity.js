import { supabase } from './supabase.js'

export async function getRecentActivities(limit = 50) {
  const { data, error } = await supabase
    .from('workout_activities')
    .select('*,activity_likes(user_id)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Erreur chargement activities:', error)
    throw error
  }

  return data ?? []
}

export async function getCurrentActivityUserId() {
  const { data, error } = await supabase.auth.getUser()

  if (error) {
    throw error
  }

  return data?.user?.id ?? null
}

export async function toggleActivityLike(activityId, liked) {
  const { data, error: userError } =
    await supabase.auth.getUser()

  const user = data?.user

  if (userError || !user) {
    throw userError || new Error('Connexion requise')
  }

  let result

  if (liked) {
    result = await supabase
      .from('activity_likes')
      .delete()
      .eq('activity_id', activityId)
      .eq('user_id', user.id)
  } else {
    result = await supabase
      .from('activity_likes')
      .insert({
        activity_id: activityId,
        user_id: user.id,
      })
  }

  if (result.error) {
    throw result.error
  }
}