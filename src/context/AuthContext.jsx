import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

async function fetchProfile(email) {
  if (!email) return null
  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('email', email)
    .single()
  if (error) {
    console.warn('[Auth] No se encontró perfil para:', email)
    return null
  }
  return data
}

export function AuthProvider({ children }) {
  // undefined = todavía cargando, null = no autenticado, objeto = sesión activa
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    // Sesión inicial
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session ?? null)
      if (session?.user?.email) {
        const p = await fetchProfile(session.user.email)
        setProfile(p)
      }
    })

    // Escuchar cambios de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session ?? null)
        if (session?.user?.email) {
          const p = await fetchProfile(session.user.email)
          setProfile(p)
        } else {
          setProfile(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      // Traducir errores comunes
      if (error.message.includes('Invalid login credentials')) {
        throw new Error('Correo o contraseña incorrectos.')
      }
      if (error.message.includes('Email not confirmed')) {
        throw new Error('Debes confirmar tu correo antes de entrar.')
      }
      throw new Error(error.message)
    }

    // Verificar que el perfil exista y esté activo
    const p = await fetchProfile(email)
    if (!p) {
      await supabase.auth.signOut()
      throw new Error('Usuario no registrado en el sistema. Contacta al administrador.')
    }
    if (!p.activo) {
      await supabase.auth.signOut()
      throw new Error('Tu cuenta está desactivada. Contacta al administrador.')
    }

    setProfile(p)
    return data
  }

  async function signOut() {
    await supabase.auth.signOut()
    setProfile(null)
    setSession(null)
  }

  const value = {
    session,
    profile,
    loading: session === undefined,
    signIn,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
