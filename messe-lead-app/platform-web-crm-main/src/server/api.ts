import { createServerFn } from '@tanstack/react-start'
import { db, mapLeadRow, mapSettingsRow } from './db/client'
import type { Lead, Settings } from './db/schema'

interface AuthenticatedInput<T = Record<string, never>> {
  authToken: string
  payload?: T
}

export type LeadInput = Omit<
  Lead,
  'id' | 'createdAt' | 'updatedAt' | 'emailSent' | 'emailSentAt' | 'emailQueued' | 'followUp' | 'followUpAt' | 'calendarQueued' | 'crmDone'
> & { id?: string }

interface SendFollowUpEmailInput {
  leadId?: string
  to: string
  ccEmails?: string[]
  subject: string
  body: string
  senderName?: string
  senderEmail?: string
}

const DEFAULT_FIXED_SENDER_EMAIL = 'octrion@visy-gmbh.com'
let mailTransport: any | null = null

function getFixedSenderEmail() {
  return process.env.LEAD_APP_FIXED_SENDER_EMAIL ?? DEFAULT_FIXED_SENDER_EMAIL
}

async function getMailTransport() {
  if (mailTransport) return mailTransport

  const { config } = await import('dotenv')
  config()

  const host = process.env.LEAD_APP_SMTP_HOST ?? 'smtp.strato.de'
  const port = Number(process.env.LEAD_APP_SMTP_PORT ?? 587)
  const user = process.env.LEAD_APP_SMTP_USER
  const pass = process.env.LEAD_APP_SMTP_PASS

  if (!user || !pass) {
    throw new Error('Missing SMTP credentials: LEAD_APP_SMTP_USER / LEAD_APP_SMTP_PASS')
  }

  const { default: nodemailer } = await import('nodemailer')
  mailTransport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: {
      user,
      pass,
    },
  })

  return mailTransport
}

async function sendSmtpMail(input: SendFollowUpEmailInput) {
  const fromEmail = getFixedSenderEmail()
  const fromName = input.senderName || 'OCTRION Vertrieb'
  const transport = await getMailTransport()
  await transport.sendMail({
    from: `${fromName} <${fromEmail}>`,
    to: input.to,
    cc: (input.ccEmails ?? []).filter(Boolean).join(', ') || undefined,
    subject: input.subject,
    text: input.body,
    replyTo: fromEmail,
  })
}

function assertAuthenticated(authToken?: string) {
  if (!authToken || authToken.trim().length < 8) {
    throw new Error('Unauthorized')
  }
}

export const listLeads = createServerFn({ method: 'POST' })
  .inputValidator((data: AuthenticatedInput) => data)
  .handler(async ({ data }) => {
    assertAuthenticated(data.authToken)
  const rows = db.prepare('SELECT * FROM leads ORDER BY datetime(createdAt) DESC').all()
  return rows.map(mapLeadRow) as Lead[]
})

export const upsertLead = createServerFn({ method: 'POST' })
  .inputValidator((data: AuthenticatedInput<LeadInput>) => data)
  .handler(async ({ data }) => {
    assertAuthenticated(data.authToken)
    const input = data.payload as LeadInput
    const now = new Date().toISOString()
    const id = input.id || crypto.randomUUID()

    const existing = db.prepare('SELECT * FROM leads WHERE id = ?').get(id) as any | undefined

    const payload: Lead = {
      id,
      createdAt: existing?.createdAt ?? now,
      updatedAt: existing ? now : null,
      salutation: input.salutation,
      title: input.title,
      firstName: input.firstName,
      lastName: input.lastName,
      company: input.company,
      jobTitle: input.jobTitle,
      email: input.email,
      phone: input.phone,
      mobile: input.mobile,
      website: input.website,
      address: input.address,
      interests: input.interests,
      interestProbabilities: input.interestProbabilities ?? {},
      bantBudget: input.bantBudget,
      bantAuthority: input.bantAuthority,
      bantNeed: input.bantNeed,
      bantTiming: input.bantTiming,
      notes: input.notes,
      event: input.event,
      emailSent: existing?.emailSent ?? false,
      emailSentAt: existing?.emailSentAt ?? null,
      emailQueued: existing?.emailQueued ?? false,
      followUp: existing?.followUp ?? false,
      followUpAt: existing?.followUpAt ?? null,
      calendarQueued: existing?.calendarQueued ?? false,
      crmDone: existing?.crmDone ?? false,
    }

    db.prepare(
      `INSERT INTO leads (
        id, createdAt, updatedAt, salutation, title, firstName, lastName, company, jobTitle,
        email, phone, mobile, website, address,
        interests, interestProbabilities,
        bantBudget, bantAuthority, bantNeed, bantTiming,
        notes, event,
        emailSent, emailSentAt, emailQueued,
        followUp, followUpAt, calendarQueued, crmDone
       ) VALUES (
        @id, @createdAt, @updatedAt, @salutation, @title, @firstName, @lastName, @company, @jobTitle,
        @email, @phone, @mobile, @website, @address,
        @interests, @interestProbabilities,
        @bantBudget, @bantAuthority, @bantNeed, @bantTiming,
        @notes, @event,
        @emailSent, @emailSentAt, @emailQueued,
        @followUp, @followUpAt, @calendarQueued, @crmDone
       )
       ON CONFLICT(id) DO UPDATE SET
        updatedAt = excluded.updatedAt,
        salutation = excluded.salutation,
        title = excluded.title,
        firstName = excluded.firstName,
        lastName = excluded.lastName,
        company = excluded.company,
        jobTitle = excluded.jobTitle,
        email = excluded.email,
        phone = excluded.phone,
        mobile = excluded.mobile,
        website = excluded.website,
        address = excluded.address,
        interests = excluded.interests,
        interestProbabilities = excluded.interestProbabilities,
        bantBudget = excluded.bantBudget,
        bantAuthority = excluded.bantAuthority,
        bantNeed = excluded.bantNeed,
        bantTiming = excluded.bantTiming,
        notes = excluded.notes,
        event = excluded.event
      `,
    ).run({
      ...payload,
      interests: JSON.stringify(payload.interests),
      interestProbabilities: JSON.stringify(payload.interestProbabilities ?? {}),
      emailSent: payload.emailSent ? 1 : 0,
      emailQueued: payload.emailQueued ? 1 : 0,
      followUp: payload.followUp ? 1 : 0,
      calendarQueued: payload.calendarQueued ? 1 : 0,
      crmDone: payload.crmDone ? 1 : 0,
    })

    const row = db.prepare('SELECT * FROM leads WHERE id = ?').get(id)
    return mapLeadRow(row) as Lead
  })

export const deleteLead = createServerFn({ method: 'POST' })
  .inputValidator((data: AuthenticatedInput<{ id: string }>) => data)
  .handler(async ({ data }) => {
    assertAuthenticated(data.authToken)
    db.prepare('DELETE FROM leads WHERE id = ?').run(data.payload?.id)
    return { ok: true }
  })

export const getSettings = createServerFn({ method: 'POST' })
  .inputValidator((data: AuthenticatedInput) => data)
  .handler(async ({ data }) => {
  assertAuthenticated(data.authToken)
  const row = db.prepare('SELECT * FROM settings WHERE id = 1').get()
  const settings = mapSettingsRow(row) as Settings
  return {
    ...settings,
    senderEmail: getFixedSenderEmail(),
  } satisfies Settings
})

export const updateSettings = createServerFn({ method: 'POST' })
  .inputValidator((data: AuthenticatedInput<Partial<Settings>>) => data)
  .handler(async ({ data }) => {
    assertAuthenticated(data.authToken)
    const partial = data.payload ?? {}
    const current = mapSettingsRow(db.prepare('SELECT * FROM settings WHERE id = 1').get())
    const next: Settings = {
      ...current,
      ...partial,
      id: 1,
      senderEmail: getFixedSenderEmail(),
      interestReps: partial.interestReps ?? current.interestReps,
    }

    db.prepare(
      `UPDATE settings SET
        event = @event,
        stand = @stand,
        repName = @repName,
        senderEmail = @senderEmail,
        senderName = @senderName,
        webhookUrl = @webhookUrl,
        emailEnabled = @emailEnabled,
        calendarEnabled = @calendarEnabled,
        interestReps = @interestReps
       WHERE id = 1`,
    ).run({
      ...next,
      emailEnabled: next.emailEnabled ? 1 : 0,
      calendarEnabled: next.calendarEnabled ? 1 : 0,
      interestReps: JSON.stringify(next.interestReps ?? {}),
    })

    const row = db.prepare('SELECT * FROM settings WHERE id = 1').get()
    return mapSettingsRow(row) as Settings
  })

export const sendFollowUpEmail = createServerFn({ method: 'POST' })
  .inputValidator((data: AuthenticatedInput<SendFollowUpEmailInput>) => data)
  .handler(async ({ data }) => {
    assertAuthenticated(data.authToken)
    const input = data.payload as SendFollowUpEmailInput
    if (!input.to || !input.subject || !input.body) {
      throw new Error('Missing email fields')
    }

    await sendSmtpMail(input)

    if (input.leadId) {
      db.prepare(
        `UPDATE leads
         SET emailSent = 1, emailSentAt = @now, emailQueued = 0
         WHERE id = @leadId`,
      ).run({
        now: new Date().toISOString(),
        leadId: input.leadId,
      })
    }

    return { ok: true }
  })

