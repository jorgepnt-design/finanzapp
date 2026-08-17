import { createClient } from '@supabase/supabase-js'
import { initializeApp, getApps, getApp } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut
} from 'firebase/auth'

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

const firebaseConfig = {
  apiKey: 'AIzaSyCKQWleDp5ksPq5HcDFmUYtMRDBlcSYbCk',
  authDomain: 'finanzblick-9c08c.firebaseapp.com',
  projectId: 'finanzblick-9c08c',
  storageBucket: 'finanzblick-9c08c.firebasestorage.app',
  messagingSenderId: '304201015649',
  appId: '1:304201015649:web:6e2e33067f879f32322520'
}

const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig)
export const firebaseAuth = getAuth(firebaseApp)
firebaseAuth.languageCode = 'de'

const dataClient = url && anon ? createClient(url, anon, {
  accessToken: async () => {
    const user = firebaseAuth.currentUser
    return user ? user.getIdToken(false) : null
  },
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
}) : null

function authError(error) {
  const code = error?.code || ''
  const messages = {
    'auth/invalid-credential': 'E-Mail-Adresse oder Passwort ist falsch.',
    'auth/invalid-email': 'Bitte gib eine gültige E-Mail-Adresse ein.',
    'auth/email-already-in-use': 'Für diese E-Mail-Adresse gibt es bereits ein FinanzBlick-Konto.',
    'auth/weak-password': 'Das Passwort ist zu schwach. Bitte verwende mindestens 6 Zeichen.',
    'auth/too-many-requests': 'Zu viele Anmeldeversuche. Bitte versuche es später erneut.',
    'auth/user-disabled': 'Dieses Benutzerkonto wurde deaktiviert.',
    'auth/network-request-failed': 'Netzwerkfehler. Bitte prüfe deine Internetverbindung.',
    'auth/email-not-verified': 'Bitte bestätige zuerst deine E-Mail-Adresse über den Link, den FinanzBlick dir geschickt hat.'
  }
  return { ...error, message: messages[code] || error?.message || 'Anmeldung fehlgeschlagen.' }
}

async function buildSession(user) {
  if (!user || !dataClient) return null
  await user.reload()

  if (!user.emailVerified) {
    const error = new Error('Email not verified')
    error.code = 'auth/email-not-verified'
    throw error
  }

  // The RPC maps the verified Firebase email to a stable FinanzBlick owner UUID.
  // Existing Supabase-finance data is therefore preserved for the same email address.
  await user.getIdToken(true)
  const { data: ownerId, error } = await dataClient.rpc('ensure_finanzblick_identity')
  if (error) throw error

  return {
    user: {
      id: ownerId,
      email: user.email,
      firebaseUid: user.uid
    }
  }
}

const authBridge = {
  async getSession() {
    try {
      const session = await buildSession(firebaseAuth.currentUser)
      return { data: { session }, error: null }
    } catch (error) {
      return { data: { session: null }, error: authError(error) }
    }
  },

  async getUser() {
    try {
      const session = await buildSession(firebaseAuth.currentUser)
      return { data: { user: session?.user || null }, error: null }
    } catch (error) {
      return { data: { user: null }, error: authError(error) }
    }
  },

  onAuthStateChange(callback) {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      try {
        const session = await buildSession(user)
        callback(user ? 'SIGNED_IN' : 'SIGNED_OUT', session)
      } catch (error) {
        console.error('FinanzBlick Auth-Fehler:', error)
        callback('SIGNED_OUT', null)
      }
    })

    return { data: { subscription: { unsubscribe } } }
  },

  async signInWithPassword({ email, password }) {
    try {
      const credential = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password)
      const session = await buildSession(credential.user)
      return { data: { user: session.user, session }, error: null }
    } catch (error) {
      return { data: { user: null, session: null }, error: authError(error) }
    }
  },

  async signUp({ email, password }) {
    try {
      const credential = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password)
      await sendEmailVerification(credential.user)
      await firebaseSignOut(firebaseAuth)
      return {
        data: {
          user: { id: credential.user.uid, email: credential.user.email },
          session: null
        },
        error: null
      }
    } catch (error) {
      return { data: { user: null, session: null }, error: authError(error) }
    }
  },

  async resetPasswordForEmail(email) {
    try {
      await sendPasswordResetEmail(firebaseAuth, email.trim())
      return { data: {}, error: null }
    } catch (error) {
      return { data: null, error: authError(error) }
    }
  },

  async signOut() {
    try {
      await firebaseSignOut(firebaseAuth)
      return { error: null }
    } catch (error) {
      return { error: authError(error) }
    }
  }
}

export const supabase = dataClient ? new Proxy(dataClient, {
  get(target, prop) {
    if (prop === 'auth') return authBridge
    const value = target[prop]
    return typeof value === 'function' ? value.bind(target) : value
  }
}) : null
