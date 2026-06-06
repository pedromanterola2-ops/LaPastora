import { createClient } from '@supabase/supabase-js'

// Credenciales de La Pastora (anon key es pública — segura en cliente)
// Se usan directamente para evitar que env vars mal configuradas en Vercel
// sobreescriban los valores y rompan la conexión.
const SUPABASE_URL = 'https://ygeuqlohycckwngcmmxl.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnZXVxbG9oeWNja3duZ2NtbXhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyNDE1MTksImV4cCI6MjA5NTgxNzUxOX0.fuFaUcYKaTjBpunDqIc-xMIGm3gA17r5Cn_E_JxFR_Q'

// Solo usar env var si es una URL HTTPS válida (evita placeholders o vacíos)
const envUrl = import.meta.env.VITE_SUPABASE_URL
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(
  (envUrl && envUrl.startsWith('https://')) ? envUrl : SUPABASE_URL,
  (envKey && envKey.startsWith('eyJ')) ? envKey : SUPABASE_ANON_KEY,
)
