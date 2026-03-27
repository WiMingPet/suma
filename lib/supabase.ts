import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface User {
  id: string
  phone: string
  is_pro: boolean
  daily_count: number
  created_at: string
}

export interface App {
  id: string
  user_id: string
  name: string
  code: string
  type: string
  created_at: string
}

export interface Favorite {
  id: string
  user_id: string
  app_id: string
  created_at: string
}