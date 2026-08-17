import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = url && anon ? createClient(url, anon) : null

if (supabase) {
  const originalSignUp = supabase.auth.signUp.bind(supabase.auth)

  supabase.auth.signUp = async (credentials) => {
    const signupResult = await originalSignUp(credentials)
    const alreadyRegistered =
      signupResult.error?.code === 'user_already_exists' ||
      /already registered|already exists/i.test(signupResult.error?.message || '')

    if (!alreadyRegistered) return signupResult

    const loginResult = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password
    })

    if (loginResult.error) {
      return {
        ...loginResult,
        error: {
          ...loginResult.error,
          message: 'Diese E-Mail-Adresse existiert bereits. Bitte verwende das Passwort des bestehenden Kontos oder setze das Passwort zurück.'
        }
      }
    }

    return loginResult
  }
}
