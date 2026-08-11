import { createClient } from '@supabase/supabase-js'

const supabaseUrl =
  'https://vqxlymvxndpttitbfwoj.supabase.co'

const supabasePublishableKey =
  'sb_publishable_6-a6pRgJbTqV-_D6HGJYvA_6g0NvQ-x'

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
)