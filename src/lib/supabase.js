import { createClient } from '@supabase/supabase-js'

// El anon key es una clave pública (segura en el cliente).
// Se usa como fallback para garantizar la conexión aunque el build cache
// no incluya las variables de entorno de Vercel.
const SUPABASE_URL = 'https://ygeuqlohycckwngcmmxl.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnZXVxbG9oeWNja3duZ2NtbXhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyNDE1MTksImV4cCI6MjA5NTgxNzUxOX0.fuFaUcYKaTjBpunDqIc-xMIGm3gA17r5Cn_E_JxFR_Q'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
