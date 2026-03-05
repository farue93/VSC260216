export interface AuthUser {
  login: string
  customer: string
  token: string
  privileges: string[]
}

export interface LoginCredentials {
  login: string
  password: string
  extended?: boolean
}

export interface LoginResponse {
  token: string
  privileges: string[]
}

export interface ResetPasswordRequest {
  email: string
  tenant: string
}

export interface SetNewPasswordData {
  passwd: string
  repeatedPasswd: string
  token: string
}
