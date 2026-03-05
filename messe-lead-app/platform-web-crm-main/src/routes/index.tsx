import { createFileRoute } from '@tanstack/react-router'
import type { FormEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import {
  deleteLead,
  getSettings,
  listLeads,
  sendFollowUpEmail,
  updateSettings,
  upsertLead,
} from '../server/api'
import { AuthService } from '../services/auth'
import type { AuthUser, LoginCredentials } from '../types/auth'

export const Route = createFileRoute('/')({
  component: LeadAppPage,
})

type BridgeMethod =
  | 'listLeads'
  | 'syncLeads'
  | 'getSettings'
  | 'updateSettings'
  | 'sendFollowUpEmail'
  | 'clearAllData'

interface BridgeAdapter {
  request: (method: BridgeMethod, payload?: unknown) => Promise<unknown>
}

interface LegacyAuthUser {
  login?: string
  email?: string
}

declare global {
  interface Window {
    __LEAD_APP_BRIDGE__?: BridgeAdapter
    __LEAD_APP_AUTH_USER__?: LegacyAuthUser
  }
}

function sanitizeLeadInput(raw: any) {
  return {
    id: typeof raw?.id === 'string' ? raw.id : undefined,
    salutation: raw?.salutation ?? '',
    title: raw?.title ?? '',
    firstName: raw?.firstName ?? '',
    lastName: raw?.lastName ?? '',
    company: raw?.company ?? '',
    jobTitle: raw?.jobTitle ?? '',
    email: raw?.email ?? '',
    phone: raw?.phone ?? '',
    mobile: raw?.mobile ?? '',
    website: raw?.website ?? '',
    address: raw?.address ?? '',
    interests: Array.isArray(raw?.interests) ? raw.interests : [],
    interestProbabilities:
      raw && typeof raw.interestProbabilities === 'object' ? raw.interestProbabilities : {},
    bantBudget: raw?.bantBudget ?? '',
    bantAuthority: raw?.bantAuthority ?? '',
    bantNeed: raw?.bantNeed ?? '',
    bantTiming: raw?.bantTiming ?? '',
    notes: raw?.notes ?? '',
    event: raw?.event ?? '',
  }
}

function LeadAppPage() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const hostRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setAuthUser(AuthService.getStoredUser())
    setIsHydrated(true)
  }, [])

  useEffect(() => {
    const onStorage = () => {
      setAuthUser(AuthService.getStoredUser())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    if (!authUser) return

    let disposed = false
    const injectedScripts: HTMLScriptElement[] = []
    const injectedStyles: HTMLStyleElement[] = []

    const handleBridgeRequest = async (
      method: BridgeMethod,
      payload?: unknown,
    ): Promise<unknown> => {
      const authToken = AuthService.getStoredToken()
      if (!authToken) {
        throw new Error('Unauthorized')
      }

      if (method === 'listLeads') {
        return listLeads({ data: { authToken } })
      }

      if (method === 'syncLeads') {
        const nextLeads = Array.isArray((payload as { leads?: unknown[] } | undefined)?.leads)
          ? (((payload as { leads?: unknown[] }).leads ?? []) as unknown[])
          : []

        const existing = await listLeads({ data: { authToken } })
        const nextIds = new Set<string>()

        for (const rawLead of nextLeads) {
          const saved = await upsertLead({
            data: {
              authToken,
              payload: sanitizeLeadInput(rawLead),
            },
          })
          nextIds.add(saved.id)
        }

        for (const existingLead of existing) {
          if (!nextIds.has(existingLead.id)) {
            await deleteLead({
              data: {
                authToken,
                payload: { id: existingLead.id },
              },
            })
          }
        }

        return listLeads({ data: { authToken } })
      }

      if (method === 'getSettings') {
        return getSettings({ data: { authToken } })
      }

      if (method === 'updateSettings') {
        return updateSettings({
          data: {
            authToken,
            payload: ((payload as { settings?: unknown } | undefined)?.settings ?? {}) as any,
          },
        })
      }

      if (method === 'sendFollowUpEmail') {
        return sendFollowUpEmail({
          data: {
            authToken,
            payload: ((payload as { email?: unknown } | undefined)?.email ?? {}) as any,
          },
        })
      }

      if (method === 'clearAllData') {
        const existing = await listLeads({ data: { authToken } })
        for (const lead of existing) {
          await deleteLead({
            data: {
              authToken,
              payload: { id: lead.id },
            },
          })
        }
        await updateSettings({
          data: {
            authToken,
            payload: {
              event: '',
              stand: '',
              repName: '',
              senderEmail: '',
              senderName: '',
              webhookUrl: '',
              emailEnabled: false,
              calendarEnabled: false,
              interestReps: {},
            },
          },
        })
        return { ok: true }
      }

      throw new Error(`Unsupported bridge method: ${method}`)
    }

    window.__LEAD_APP_BRIDGE__ = {
      request: handleBridgeRequest,
    }
    window.__LEAD_APP_AUTH_USER__ = {
      login: authUser.login,
      email: ((authUser as unknown as { email?: string }).email ?? authUser.login) || undefined,
    }

    const run = async () => {
      const response = await fetch('/legacy-lead-app.html', { cache: 'no-cache' })
      const html = await response.text()
      if (disposed || !hostRef.current) return

      const doc = new DOMParser().parseFromString(html, 'text/html')
      const host = hostRef.current
      host.innerHTML = doc.body.innerHTML

      const styleNodes = Array.from(doc.head.querySelectorAll('style'))
      for (const styleNode of styleNodes) {
        const style = document.createElement('style')
        style.setAttribute('data-legacy-lead-app', 'true')
        style.textContent = styleNode.textContent ?? ''
        document.head.appendChild(style)
        injectedStyles.push(style)
      }

      const scriptNodes = Array.from(doc.querySelectorAll('script'))
      for (const scriptNode of scriptNodes) {
        if (disposed) return
        const script = document.createElement('script')
        script.setAttribute('data-legacy-lead-app', 'true')
        if (scriptNode.src) {
          script.src = scriptNode.src
          script.async = false
          const loaded = new Promise<void>((resolve, reject) => {
            script.onload = () => resolve()
            script.onerror = () => reject(new Error(`Failed to load script: ${script.src}`))
          })
          document.body.appendChild(script)
          injectedScripts.push(script)
          await loaded
        } else {
          script.textContent = scriptNode.textContent ?? ''
          document.body.appendChild(script)
          injectedScripts.push(script)
        }
      }
    }

    run().catch((error) => {
      console.error('[LeadApp] Failed to boot legacy UI:', error)
    })

    return () => {
      disposed = true
      delete window.__LEAD_APP_BRIDGE__
      delete window.__LEAD_APP_AUTH_USER__
      for (const script of injectedScripts) script.remove()
      for (const style of injectedStyles) style.remove()
      if (hostRef.current) hostRef.current.innerHTML = ''
    }
  }, [authUser])

  async function handleLogin(credentials: LoginCredentials) {
    setIsLoggingIn(true)
    setAuthError(null)
    try {
      await AuthService.login(credentials)
      setAuthUser(AuthService.getStoredUser())
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'login.unknownError')
    } finally {
      setIsLoggingIn(false)
    }
  }

  function handleLogout() {
    AuthService.logout(true)
    setAuthUser(null)
  }

  if (!isHydrated) {
    return <div className="auth-screen">Loading...</div>
  }

  if (!authUser) {
    return <LoginScreen onLogin={handleLogin} isLoading={isLoggingIn} error={authError} />
  }

  return (
    <div className="app-shell">
      <button type="button" className="auth-logout-btn" onClick={handleLogout}>
        Logout {authUser.login}
      </button>
      <div ref={hostRef} className="legacy-lead-app-wrapper" />
    </div>
  )
}

interface LoginScreenProps {
  onLogin: (credentials: LoginCredentials) => Promise<void>
  isLoading: boolean
  error: string | null
}

function LoginScreen({ onLogin, isLoading, error }: LoginScreenProps) {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')

  const sessionExpired = AuthService.hasSessionExpired()

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await onLogin({
      login: login.trim(),
      password,
      extended: true,
    })
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={onSubmit}>
        <img
          src="/assets/images/13459_OCTRION_Bildmarke_RGB_lila.png"
          alt="OCTRION"
          className="auth-logo"
        />
        <h1>Lead App Login</h1>
        {sessionExpired && <p className="auth-warning">Session expired. Please login again.</p>}
        {error && <p className="auth-error">{error}</p>}
        <label>
          Login
          <input
            className="auth-input"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            className="auth-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <button type="submit" className="auth-submit-btn" disabled={isLoading}>
          {isLoading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
