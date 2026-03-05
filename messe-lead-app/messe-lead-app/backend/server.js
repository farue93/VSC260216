// ============================================
// OKTOPUS Lead Capture - Backend Server
// ============================================
// Alle sensiblen Operationen (Azure AD, Dynamics CRM, Graph API)
// laufen hier - NICHT im Frontend.

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const session = require('express-session');
const path = require('path');

const authRoutes = require('./routes/auth');
const emailRoutes = require('./routes/email');
const calendarRoutes = require('./routes/calendar');

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================
// MIDDLEWARE
// ============================================

// Sicherheits-Header
app.use(helmet({
    contentSecurityPolicy: false // Frontend braucht externe Fonts/Scripts
}));

// CORS - nur euer Frontend darf zugreifen
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Request Logging
app.use(morgan('dev'));

// JSON Body Parser
app.use(express.json({ limit: '10mb' })); // Für Visitenkarten-Bilder

// Session (für Azure AD Token-Speicherung)
app.use(session({
    secret: process.env.SESSION_SECRET || 'oktopus-dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 8 * 60 * 60 * 1000 // 8 Stunden (ein Messetag)
    }
}));

// ============================================
// STATISCHE DATEIEN (Frontend)
// ============================================

// In Produktion: Frontend wird vom gleichen Server ausgeliefert
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ============================================
// API ROUTES
// ============================================

app.use('/api/auth', authRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/calendar', calendarRoutes);

// Health Check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        email: process.env.AZURE_CLIENT_ID ? 'configured' : 'not configured',
        mode: 'email-only (kein CRM)'
    });
});

// ============================================
// SPA FALLBACK
// ============================================

// Alle nicht-API Routes → Frontend
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
    }
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((err, req, res, next) => {
    console.error('Server Error:', err.message);
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production'
            ? 'Interner Serverfehler'
            : err.message
    });
});

// ============================================
// START
// ============================================

app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════╗
║          OKTOPUS Lead Capture API            ║
║──────────────────────────────────────────────║
║  Server:    http://localhost:${PORT}              ║
║  Frontend:  ${process.env.FRONTEND_URL || 'http://localhost:3000'}       ║
║  CRM:       ${(process.env.DYNAMICS_CRM_URL || 'Nicht konfiguriert').substring(0, 32).padEnd(32)}║
║  Azure AD:  ${process.env.AZURE_CLIENT_ID ? 'Konfiguriert ✓' : 'Nicht konfiguriert ✗'}                  ║
╚══════════════════════════════════════════════╝
    `);
});

module.exports = app;
