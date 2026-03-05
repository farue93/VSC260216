// ============================================
// API CLIENT - Backend-Kommunikation
// ============================================
// KEIN CRM. Nur E-Mail + Kalender über Microsoft Graph.
// Leads werden lokal verwaltet + CSV Export.

const API = {
    // ========================================
    // AUTH
    // ========================================

    async checkAuth() {
        try {
            const res = await fetch('/api/auth/status', { credentials: 'include' });
            return await res.json();
        } catch {
            return { authenticated: false, user: null };
        }
    },

    async login() {
        try {
            const res = await fetch('/api/auth/login', { credentials: 'include' });
            const data = await res.json();
            if (data.loginUrl) window.location.href = data.loginUrl;
        } catch (err) {
            console.error('Login Start fehlgeschlagen:', err);
            throw err;
        }
    },

    async logout() {
        try {
            await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
        } catch (err) {
            console.error('Logout fehlgeschlagen:', err);
        }
    },

    // ========================================
    // EMAIL — eine Absenderadresse, Vertriebler in CC
    // ========================================

    async sendWelcomeEmail(lead, ccRecipients, companyInfo) {
        const res = await fetch('/api/email/send-welcome', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ lead, ccRecipients, companyInfo })
        });
        if (!res.ok) {
            const error = await res.json().catch(() => ({}));
            throw new Error(error.error || `HTTP ${res.status}`);
        }
        return await res.json();
    },

    async checkEmailStatus() {
        try {
            const res = await fetch('/api/email/status', { credentials: 'include' });
            return await res.json();
        } catch {
            return { available: false };
        }
    },

    // ========================================
    // CALENDAR — Follow-up Termine
    // ========================================

    async createFollowUp(lead, daysFromNow = 3) {
        const res = await fetch('/api/calendar/follow-up', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ lead, daysFromNow })
        });
        if (!res.ok) {
            const error = await res.json().catch(() => ({}));
            throw new Error(error.error || `HTTP ${res.status}`);
        }
        return await res.json();
    },

    // ========================================
    // HEALTH CHECK
    // ========================================

    async healthCheck() {
        try {
            const res = await fetch('/api/health');
            return await res.json();
        } catch {
            return { status: 'offline' };
        }
    }
};
