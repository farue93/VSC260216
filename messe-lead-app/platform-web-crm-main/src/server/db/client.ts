import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import type { Lead, Settings, EmailQueueItem, CalendarQueueItem } from './schema'

const dbFile = process.env.LEAD_APP_DB_PATH
  ? path.resolve(process.env.LEAD_APP_DB_PATH)
  : path.resolve(process.cwd(), 'data', 'lead-app.db')

const dbDir = path.dirname(dbFile)
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

export const db = new Database(dbFile)

db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    createdAt TEXT NOT NULL,
    updatedAt TEXT,
    salutation TEXT,
    title TEXT,
    firstName TEXT NOT NULL,
    lastName TEXT NOT NULL,
    company TEXT NOT NULL,
    jobTitle TEXT,
    email TEXT NOT NULL,
    phone TEXT,
    mobile TEXT,
    website TEXT,
    address TEXT,
    interests TEXT NOT NULL,
    interestProbabilities TEXT NOT NULL,
    bantBudget TEXT,
    bantAuthority TEXT,
    bantNeed TEXT,
    bantTiming TEXT,
    notes TEXT,
    event TEXT,
    emailSent INTEGER NOT NULL DEFAULT 0,
    emailSentAt TEXT,
    emailQueued INTEGER NOT NULL DEFAULT 0,
    followUp INTEGER NOT NULL DEFAULT 0,
    followUpAt TEXT,
    calendarQueued INTEGER NOT NULL DEFAULT 0,
    crmDone INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    event TEXT,
    stand TEXT,
    repName TEXT,
    senderEmail TEXT,
    senderName TEXT,
    webhookUrl TEXT,
    emailEnabled INTEGER NOT NULL DEFAULT 0,
    calendarEnabled INTEGER NOT NULL DEFAULT 0,
    interestReps TEXT NOT NULL DEFAULT '{}'
  );

  INSERT OR IGNORE INTO settings (id, event, stand, repName, senderEmail, senderName, webhookUrl)
  VALUES (1, '', '', '', '', '', '');

  CREATE TABLE IF NOT EXISTS email_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    leadId TEXT NOT NULL,
    toAddress TEXT NOT NULL,
    ccEmails TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    queuedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS calendar_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    leadId TEXT NOT NULL,
    attendeeEmails TEXT NOT NULL,
    start TEXT NOT NULL,
    end TEXT NOT NULL,
    queuedAt TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_leads_createdAt ON leads (createdAt DESC);
  CREATE INDEX IF NOT EXISTS idx_leads_emailSent ON leads (emailSent);
  CREATE INDEX IF NOT EXISTS idx_leads_followUp ON leads (followUp);
`)

export function mapLeadRow(row: any): Lead {
  return {
    ...row,
    interests: JSON.parse(row.interests),
    interestProbabilities: JSON.parse(row.interestProbabilities),
    emailSent: !!row.emailSent,
    emailQueued: !!row.emailQueued,
    followUp: !!row.followUp,
    calendarQueued: !!row.calendarQueued,
    crmDone: !!row.crmDone,
  }
}

export function mapSettingsRow(row: any): Settings {
  return {
    ...row,
    interestReps: JSON.parse(row.interestReps ?? '{}'),
  }
}

export function mapEmailQueueRow(row: any): EmailQueueItem {
  return {
    id: row.id,
    leadId: row.leadId,
    to: row.toAddress,
    ccEmails: JSON.parse(row.ccEmails),
    subject: row.subject,
    body: row.body,
    queuedAt: row.queuedAt,
  }
}

export function mapCalendarQueueRow(row: any): CalendarQueueItem {
  return {
    id: row.id,
    leadId: row.leadId,
    attendeeEmails: JSON.parse(row.attendeeEmails),
    start: row.start,
    end: row.end,
    queuedAt: row.queuedAt,
  }
}

