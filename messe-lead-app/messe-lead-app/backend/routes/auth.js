// ============================================
// AUTH ROUTES - Azure AD OAuth 2.0
// ============================================
// Alle Token-Operationen laufen serverseitig.
// Das Frontend bekommt NIEMALS Client Secrets zu sehen.

const express = require('express');
const router = express.Router();
const msal = require('@azure/msal-node');

// ============================================
// MSAL Confidential Client (Server-seitig!)
// ============================================
// Unterschied zu Frontend-MSAL:
// - ConfidentialClient hat ein Client Secret (sicher auf Server)
// - PublicClient (Frontend) hat KEIN Secret → unsicher
// - Wir nutzen Authorization Code Flow mit PKCE

const msalConfig = {
    auth: {
        clientId: process.env.AZURE_CLIENT_ID,
        authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
        clientSecret: process.env.AZURE_CLIENT_SECRET, // NUR auf dem Server!
    },
    system: {
        loggerOptions: {
            loggerCallback(level, message) {
                if (process.env.NODE_ENV !== 'production') {
                    console.log('[MSAL]', message);
                }
            },
            piiLoggingEnabled: false,
            logLevel: msal.LogLevel.Warning,
        }
    }
};

const msalClient = new msal.ConfidentialClientApplication(msalConfig);

// Scopes für Microsoft Graph API (kein CRM nötig!)
const GRAPH_SCOPES = ['User.Read', 'Mail.Send', 'Calendars.ReadWrite'];

// ============================================
// GET /api/auth/login - Login starten
// ============================================
// Frontend ruft das auf → wird zu Microsoft Login weitergeleitet

router.get('/login', async (req, res) => {
    try {
        const authUrl = await msalClient.getAuthCodeUrl({
            scopes: GRAPH_SCOPES,
            redirectUri: `${req.protocol}://${req.get('host')}/api/auth/callback`,
            prompt: 'select_account', // User kann Account wählen
        });

        res.json({ loginUrl: authUrl });
    } catch (error) {
        console.error('Login URL Fehler:', error);
        res.status(500).json({ error: 'Login konnte nicht gestartet werden' });
    }
});

// ============================================
// GET /api/auth/callback - Azure AD Callback
// ============================================
// Microsoft leitet hierher zurück nach dem Login

router.get('/callback', async (req, res) => {
    try {
        const { code } = req.query;

        if (!code) {
            return res.status(400).send('Kein Authorization Code erhalten');
        }

        // Authorization Code → Access Token tauschen
        const tokenResponse = await msalClient.acquireTokenByCode({
            code,
            scopes: GRAPH_SCOPES,
            redirectUri: `${req.protocol}://${req.get('host')}/api/auth/callback`,
        });

        // Token sicher in Session speichern (NIE ans Frontend!)
        req.session.user = {
            name: tokenResponse.account.name,
            email: tokenResponse.account.username,
            homeAccountId: tokenResponse.account.homeAccountId,
            tenantId: tokenResponse.account.tenantId,
        };

        // Token im MSAL-Cache (automatisch verwaltet)
        req.session.homeAccountId = tokenResponse.account.homeAccountId;
        req.session.authenticated = true;

        // Zurück zum Frontend
        res.redirect('/');

    } catch (error) {
        console.error('Callback Fehler:', error);
        res.redirect('/?error=auth_failed');
    }
});

// ============================================
// GET /api/auth/status - Login-Status prüfen
// ============================================

router.get('/status', (req, res) => {
    if (req.session?.authenticated) {
        res.json({
            authenticated: true,
            user: req.session.user
        });
    } else {
        res.json({
            authenticated: false,
            user: null
        });
    }
});

// ============================================
// POST /api/auth/logout - Abmelden
// ============================================

router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Logout fehlgeschlagen' });
        }
        res.json({ success: true });
    });
});

// ============================================
// HELPER: Token für API-Calls holen
// ============================================
// Wird von anderen Routes verwendet (leads, email, calendar)

async function getAccessToken(req, scopes) {
    if (!req.session?.homeAccountId) {
        throw new Error('Nicht authentifiziert');
    }

    try {
        // Versuche Silent Token Refresh
        const account = await msalClient
            .getTokenCache()
            .getAccountByHomeId(req.session.homeAccountId);

        if (!account) {
            throw new Error('Account nicht im Cache - erneuter Login nötig');
        }

        const tokenResponse = await msalClient.acquireTokenSilent({
            account,
            scopes,
        });

        return tokenResponse.accessToken;

    } catch (error) {
        console.error('Token Refresh fehlgeschlagen:', error.message);
        // Session ungültig → Frontend muss neu einloggen
        req.session.authenticated = false;
        throw new Error('Token abgelaufen - bitte erneut einloggen');
    }
}

// Exportiere Router und Helper
module.exports = router;
module.exports.getAccessToken = getAccessToken;
module.exports.GRAPH_SCOPES = GRAPH_SCOPES;
