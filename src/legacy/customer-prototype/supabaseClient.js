import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ckqxmacpojierkyxmiip.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNrcXhtYWNwb2ppZXJreXhtaWlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMzY2MzYsImV4cCI6MjA5NzYxMjYzNn0.zjLykfQB6R9ziWV8aW-IL8F7bHyOvcA5ql7K_WxTC0A'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
