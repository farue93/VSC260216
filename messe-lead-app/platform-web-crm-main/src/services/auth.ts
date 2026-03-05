import axios, {
  type AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import type {
  AuthUser,
  LoginCredentials,
  LoginResponse,
  ResetPasswordRequest,
  SetNewPasswordData,
} from '../types/auth'

const API_BASE_URL = '/rest/api/auth'
const USERAPI_BASE_URL = '/rest/api/users'
const SESSION_EXPIRED_FLAG = 'session_expired'
const FIXED_CUSTOMER_ID = '2556'

const authApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
})

const userApi = axios.create({
  baseURL: USERAPI_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

authApi.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof window === 'undefined') return config
    const token = localStorage.getItem('auth_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error: AxiosError) => Promise.reject(error),
)

authApi.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    if (typeof window === 'undefined') return Promise.reject(error)
    if (error.response?.status === 401) {
      const token = localStorage.getItem('auth_token')
      const isLoginEndpoint =
        error.config?.url === '/login' || error.config?.url?.endsWith('/login')

      if (token && !isLoginEndpoint) {
        AuthService.setSessionExpiredFlag()
      }
    }
    return Promise.reject(error)
  },
)

export class AuthService {
  static async requestResetPassword(resetData: ResetPasswordRequest) {
    try {
      const jsonData = {
        email: resetData.email,
        tenant: resetData.tenant,
      }

      return await userApi.post('/password-reset', jsonData)
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        throw new Error('passwordReset.invalidCredentials')
      }
      throw new Error('passwordReset.unknownError')
    }
  }

  static async setNewPassword(resetData: SetNewPasswordData) {
    try {
      if (!resetData.passwd || resetData.passwd.trim().length < 1) {
        throw new Error('passwordSet.missingPasswordError')
      }
      if (resetData.passwd !== resetData.repeatedPasswd) {
        throw new Error('passwordSet.mismatchingPasswordsError')
      }

      const setPasswdApi = axios.create({
        baseURL: USERAPI_BASE_URL,
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'Xtrack-Password-Reset-Token': resetData.token,
        },
      })

      return await setPasswdApi.put('/password-reset', {
        newPassword: resetData.passwd,
      })
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        throw new Error('passwordSet.invalidCredentials')
      }
      throw new Error('passwordSet.unknownError')
    }
  }

  static async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      const formData = new URLSearchParams()
      formData.append('login', credentials.login)
      formData.append('password', credentials.password)
      formData.append('customer', FIXED_CUSTOMER_ID)
      formData.append('extended', credentials.extended ? 'true' : 'false')

      const response: AxiosResponse<LoginResponse> = await authApi.post(
        '/login',
        formData.toString(),
      )

      if (response.data.token) {
        localStorage.setItem('auth_token', response.data.token)
        localStorage.setItem(
          'auth_user',
          JSON.stringify({
            login: credentials.login,
            customer: FIXED_CUSTOMER_ID,
            token: response.data.token,
            privileges: ['EDVIEWUNITS', 'EDVIEWSERVICEREQUESTS', ...response.data.privileges],
          } satisfies AuthUser),
        )
      }

      return response.data
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        throw new Error('login.invalidCredentials')
      }
      throw new Error('login.unknownError')
    } finally {
      this.clearSessionExpiredFlag()
    }
  }

  static logout(isManualLogout: boolean = true): void {
    if (isManualLogout) {
      this.clearSessionExpiredFlag()
    }
    if (typeof window === 'undefined') return
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
  }

  static getStoredUser(): AuthUser | null {
    if (typeof window === 'undefined') return null
    const userData = localStorage.getItem('auth_user')
    return userData ? (JSON.parse(userData) as AuthUser) : null
  }

  static getStoredToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('auth_token')
  }

  static setSessionExpiredFlag(): void {
    localStorage.setItem(SESSION_EXPIRED_FLAG, 'true')
    AuthService.logout(false)
    if (typeof window !== 'undefined') {
      window.location.href = '/'
    }
  }

  static clearSessionExpiredFlag(): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem(SESSION_EXPIRED_FLAG)
  }

  static hasSessionExpired(): boolean {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(SESSION_EXPIRED_FLAG) === 'true'
  }

  static isAuthenticated(): boolean {
    return !!this.getStoredToken()
  }
}

export default authApi
