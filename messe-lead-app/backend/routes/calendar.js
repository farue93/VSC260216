// ============================================
// CALENDAR ROUTES - Microsoft Graph API
// ============================================
// Follow-Up Termine im Outlook-Kalender erstellen

const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const { requireAuth } = require('../middleware/auth');
const { getAccessToken } = require('./auth');

// ============================================
// POST /api/calendar/follow-up - Termin erstellen
// ============================================

router.post('/follow-up', requireAuth, async (req, res) => {
    try {
        const { lead, daysFromNow = 3, durationMinutes = 30 } = req.body;

        if (!lead?.firstName || !lead?.lastName) {
            return res.status(400).json({ error: 'Lead-Daten unvollständig' });
        }

        const token = await getAccessToken(req, ['Calendars.ReadWrite']);

        // Follow-up Datum berechnen
        const followUpDate = new Date();
        followUpDate.setDate(followUpDate.getDate() + daysFromNow);
        followUpDate.setHours(10, 0, 0, 0);

        const endDate = new Date(followUpDate);
        endDate.setMinutes(endDate.getMinutes() + durationMinutes);

        const event = {
            subject: `Follow-up: ${lead.firstName} ${lead.lastName} (${lead.company || 'Firma'})`,
            body: {
                contentType: 'HTML',
                content: `
                    <p><strong>Messe-Lead Follow-up</strong></p>
                    <p><strong>Kontakt:</strong> ${lead.email} | ${lead.phone || 'kein Telefon'}</p>
                    <p><strong>Unternehmen:</strong> ${lead.company || '-'}</p>
                    <p><strong>Position:</strong> ${lead.jobTitle || '-'}</p>
                    <p><strong>Interessen:</strong> ${lead.interests?.join(', ') || 'Nicht angegeben'}</p>
                    <hr>
                    <p><strong>Notizen vom Messestand:</strong></p>
                    <p>${lead.notes || 'Keine Notizen'}</p>
                `
            },
            start: {
                dateTime: followUpDate.toISOString(),
                timeZone: 'Europe/Berlin'
            },
            end: {
                dateTime: endDate.toISOString(),
                timeZone: 'Europe/Berlin'
            },
            location: {
                displayName: 'Telefonat / Teams'
            },
            isReminderOn: true,
            reminderMinutesBeforeStart: 60,
            categories: ['Messe Lead'],
            showAs: 'busy'
        };

        const response = await fetch('https://graph.microsoft.com/v1.0/me/events', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(event)
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            return res.status(response.status).json({
                error: 'Kalendereintrag fehlgeschlagen',
                details: error.error?.message || response.statusText
            });
        }

        const createdEvent = await response.json();

        res.json({
            success: true,
            eventId: createdEvent.id,
            scheduledFor: followUpDate.toISOString(),
            message: `Follow-up Termin für ${followUpDate.toLocaleDateString('de-DE')} erstellt`
        });

    } catch (error) {
        console.error('Kalender Fehler:', error);

        if (error.message.includes('einloggen')) {
            return res.status(401).json({ error: error.message });
        }

        res.status(500).json({
            error: 'Termin konnte nicht erstellt werden',
            details: error.message
        });
    }
});

module.exports = router;
