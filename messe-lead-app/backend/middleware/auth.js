// ============================================
// AUTH MIDDLEWARE
// ============================================
// Prüft ob der User eingeloggt ist, bevor API-Calls durchgehen.

function requireAuth(req, res, next) {
    if (!req.session?.authenticated) {
        return res.status(401).json({
            error: 'Nicht authentifiziert',
            message: 'Bitte zuerst über /api/auth/login einloggen'
        });
    }
    next();
}

module.exports = { requireAuth };
