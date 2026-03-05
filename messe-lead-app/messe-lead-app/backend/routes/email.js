// ============================================
// EMAIL ROUTES - Microsoft Graph API (Outlook)
// ============================================
// ALLE E-Mails gehen von EINER zentralen Absenderadresse raus.
// Die zuständigen Vertriebler stehen im CC (basierend auf Interessen).

const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const { requireAuth } = require('../middleware/auth');
const { getAccessToken } = require('./auth');

// ============================================
// POST /api/email/send-welcome - Willkommens-E-Mail
// ============================================
// Absender: der eingeloggte User (z.B. messe@firma.de)
// CC: zuständige Vertriebler (vom Frontend übergeben)

router.post('/send-welcome', requireAuth, async (req, res) => {
    try {
        const { lead, ccRecipients, companyInfo } = req.body;

        if (!lead?.email || !lead?.firstName || !lead?.lastName) {
            return res.status(400).json({ error: 'Lead-Daten unvollständig' });
        }

        const token = await getAccessToken(req, ['Mail.Send']);

        // Interessen formatieren
        const interestsList = lead.interests
            ?.map(name => `<tr><td style="padding: 8px 16px; font-size: 15px; color: #333;">▸ ${name}</td></tr>`)
            .join('') || '<tr><td style="padding: 8px 16px;">▸ Allgemeine Informationen</td></tr>';

        // Premium HTML E-Mail
        const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, Helvetica, sans-serif; background: #f4f4f4;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 640px; margin: 0 auto; background: #ffffff;">
        <tr>
            <td style="background: linear-gradient(135deg, #FF9B37 0%, #FF6B1A 100%); padding: 40px 32px; text-align: center;">
                <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 700;">${companyInfo?.name || 'Unser Unternehmen'}</h1>
                <p style="color: rgba(255,255,255,0.9); font-size: 14px; margin: 8px 0 0;">${lead.event || 'Messe'} — Vielen Dank für Ihren Besuch!</p>
            </td>
        </tr>
        <tr>
            <td style="padding: 40px 32px;">
                <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 20px;">
                    Sehr geehrte${lead.salutation === 'Frau' ? '' : 'r'} 
                    ${lead.title ? lead.title + ' ' : ''}${lead.firstName} ${lead.lastName},
                </p>
                <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 20px;">
                    vielen Dank für Ihren Besuch an unserem Messestand! Es hat uns sehr gefreut, Sie persönlich kennenzulernen.
                </p>
                <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 12px;">
                    Wie besprochen interessieren Sie sich für:
                </p>
                <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px; background: #FFF8F0; border-radius: 12px; border-left: 4px solid #FF9B37;">
                    ${interestsList}
                </table>
                ${lead.notes ? `
                <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 0 0 24px;">
                    <p style="font-size: 13px; color: #666; margin: 0 0 4px; font-weight: 600;">Ihre Anmerkungen:</p>
                    <p style="font-size: 14px; color: #333; margin: 0; font-style: italic;">${lead.notes}</p>
                </div>` : ''}
                <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 20px;">
                    Wir melden uns in Kürze bei Ihnen, um die nächsten Schritte zu besprechen.
                </p>
                <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 8px;">Mit freundlichen Grüßen</p>
                <p style="font-size: 16px; color: #333; font-weight: 600; margin: 0;">${companyInfo?.name || 'Unser Vertriebsteam'}</p>
            </td>
        </tr>
        <tr>
            <td style="background: #2A2A2C; padding: 24px 32px; text-align: center;">
                <p style="color: rgba(255,255,255,0.7); font-size: 13px; margin: 0; line-height: 1.8;">
                    ${companyInfo?.phone ? '📞 ' + companyInfo.phone : ''}${companyInfo?.phone && companyInfo?.website ? ' · ' : ''}${companyInfo?.website ? '🌐 ' + companyInfo.website : ''}
                </p>
            </td>
        </tr>
    </table>
</body>
</html>`;

        // CC-Empfänger (Vertriebler basierend auf Interessen)
        const ccList = (ccRecipients || []).map(rep => ({
            emailAddress: { address: rep.email, name: rep.name }
        }));

        const emailPayload = {
            message: {
                subject: `Vielen Dank für Ihren Besuch${lead.event ? ' — ' + lead.event : ''}${companyInfo?.name ? ' | ' + companyInfo.name : ''}`,
                body: { contentType: 'HTML', content: emailHtml },
                toRecipients: [{
                    emailAddress: { address: lead.email, name: `${lead.firstName} ${lead.lastName}` }
                }],
                ccRecipients: ccList,
                importance: 'normal',
            },
            saveToSentItems: true
        };

        const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(emailPayload)
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            return res.status(response.status).json({
                error: 'E-Mail konnte nicht gesendet werden',
                details: error.error?.message || response.statusText
            });
        }

        res.json({
            success: true,
            message: `E-Mail an ${lead.email} gesendet`,
            ccCount: ccList.length,
            sentBy: req.session.user?.email
        });

    } catch (error) {
        console.error('E-Mail Fehler:', error);
        if (error.message.includes('einloggen')) {
            return res.status(401).json({ error: error.message });
        }
        res.status(500).json({ error: 'E-Mail Versand fehlgeschlagen', details: error.message });
    }
});

// ============================================
// GET /api/email/status - E-Mail-Fähigkeit prüfen
// ============================================

router.get('/status', requireAuth, async (req, res) => {
    try {
        const token = await getAccessToken(req, ['User.Read']);
        const response = await fetch('https://graph.microsoft.com/v1.0/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const user = await response.json();
            res.json({
                available: true,
                senderEmail: user.mail || user.userPrincipalName,
                senderName: user.displayName
            });
        } else {
            res.json({ available: false });
        }
    } catch (error) {
        res.json({ available: false, error: error.message });
    }
});

module.exports = router;
