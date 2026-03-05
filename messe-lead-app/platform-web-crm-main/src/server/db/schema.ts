export type BantBudget = 'vorhanden' | 'geplant' | 'keins' | ''
export type BantAuthority = 'entscheider' | 'beeinflusser' | 'kein_einfluss' | ''
export type BantNeed = 'dringend' | 'konkret' | 'vage' | ''
export type BantTiming = 'sofort' | 'quartal' | 'jahr' | ''

export type InterestId =
  | 'abfall'
  | 'recycling'
  | 'luft'
  | 'sondermuell'
  | 'beratung'
  | 'digital'

export interface Lead {
  id: string
  createdAt: string
  updatedAt: string | null
  salutation: string
  title: string
  firstName: string
  lastName: string
  company: string
  jobTitle: string
  email: string
  phone: string
  mobile: string
  website: string
  address: string
  interests: InterestId[]
  interestProbabilities: Record<string, number>
  bantBudget: BantBudget
  bantAuthority: BantAuthority
  bantNeed: BantNeed
  bantTiming: BantTiming
  notes: string
  event: string
  emailSent: boolean
  emailSentAt: string | null
  emailQueued: boolean
  followUp: boolean
  followUpAt: string | null
  calendarQueued: boolean
  crmDone: boolean
}

export interface Settings {
  id: number
  event: string
  stand: string
  repName: string
  senderEmail: string
  senderName: string
  webhookUrl: string
  emailEnabled: boolean
  calendarEnabled: boolean
  interestReps: Record<string, string>
}

export interface EmailQueueItem {
  id: number
  leadId: string
  to: string
  ccEmails: string[]
  subject: string
  body: string
  queuedAt: string
}

export interface CalendarQueueItem {
  id: number
  leadId: string
  attendeeEmails: string[]
  start: string
  end: string
  queuedAt: string
}

