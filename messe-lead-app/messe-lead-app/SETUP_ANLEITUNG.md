# OKTOPUS Lead Capture — Setup & Deployment Anleitung

## Architektur-Übersicht

```
┌───────────────────────────────────────────────────────┐
│                    FRONTEND (Browser)                  │
│   index.html + css/styles.css + js/app.js             │
│   js/api.js (Calls an Backend) + js/camera.js (OCR)  │
│                                                        │
│   ⚠️  KEINE Secrets, KEINE API Keys, KEINE Tokens     │
│   ✅  OCR läuft lokal im Browser (Tesseract.js)       │
│   ✅  Offline-First (localStorage)                     │
└────────────────────────┬──────────────────────────────┘
                         │ HTTPS (Port 3001)
                         ▼
┌───────────────────────────────────────────────────────┐
│                    BACKEND (Node.js/Express)           │
│   server.js + routes/ + middleware/                    │
│                                                        │
│   🔐 Azure AD Client Secret (in .env)                 │
│   🔐 Dynamics CRM URL + Credentials                   │
│   🔐 Session-basierte Token-Verwaltung                │
│                                                        │
│   routes/auth.js     → Azure AD OAuth 2.0              │
│   routes/leads.js    → Dynamics 365 Web API            │
│   routes/email.js    → Microsoft Graph (Outlook)       │
│   routes/calendar.js → Microsoft Graph (Kalender)      │
└────────────────────────┬──────────────────────────────┘
                         │ HTTPS (Bearer Tokens)
              ┌──────────┴──────────┐
              ▼                     ▼
┌─────────────────────┐  ┌─────────────────────┐
│  Dynamics 365 CRM   │  │  Microsoft Graph    │
│  (Lead erstellen)   │  │  (E-Mail + Kalender)│
└─────────────────────┘  └─────────────────────┘
```

---

## Schritt-für-Schritt Deployment

### Phase 1: Azure AD App Registration (15 Min)

**Wer:** IT-Admin (Global Admin / Application Admin)

1. **Azure Portal öffnen**: https://portal.azure.com
2. **Azure Active Directory** → **App registrations** → **+ New registration**

```
Name:                   OKTOPUS Lead Capture
Supported account types: Accounts in this organizational directory only (Single tenant)
Redirect URI:           Web → https://EURE-DOMAIN/api/auth/callback
                        (für Dev: http://localhost:3001/api/auth/callback)
```

3. **Client Secret erstellen**:
   - Certificates & secrets → + New client secret
   - Beschreibung: "OKTOPUS Backend"
   - Ablauf: 24 Monate
   - ⚠️ **Secret SOFORT kopieren** (wird nur einmal angezeigt!)

4. **API Permissions hinzufügen**:
   - API permissions → + Add a permission

```
Microsoft Graph (Delegated):
  ✅ User.Read              — Benutzerinfo
  ✅ Mail.Send              — E-Mails senden als Vertriebler
  ✅ Calendars.ReadWrite    — Follow-up Termine

Dynamics CRM (Delegated):
  ✅ user_impersonation     — CRM Zugriff als User
```

5. **Admin Consent erteilen**:
   - "Grant admin consent for [Firma]" klicken
   - Alle Permissions müssen grünes Häkchen haben

6. **IDs notieren** (für .env):
   - Application (client) ID
   - Directory (tenant) ID
   - Client Secret Value

---

### Phase 2: Dynamics 365 Custom Fields (1-2 Std)

**Wer:** Dynamics 365 Admin / Customizer

In **Dynamics 365** → **Settings** → **Customizations** → **Customize the System** → **Lead Entity**:

#### Neue Felder anlegen:

| Schema Name         | Anzeigename       | Typ              |
|---------------------|--------------------|------------------|
| `new_bantbudget`    | BANT Budget        | Option Set       |
| `new_bantauthority` | BANT Entscheider   | Option Set       |
| `new_bantneed`      | BANT Bedarf        | Option Set       |
| `new_banttiming`    | BANT Timing        | Option Set       |
| `new_interests`     | Interessen         | Multiple Lines   |
| `new_messeevent`    | Messe/Event        | Single Line      |

#### Option Set Werte:

**Budget:**
| Wert       | Label            |
|------------|------------------|
| 100000001  | Budget vorhanden |
| 100000002  | Budget geplant   |
| 100000003  | Noch offen       |
| 100000004  | Kein Budget      |

**Authority:**
| Wert       | Label        |
|------------|--------------|
| 100000001  | Entscheider  |
| 100000002  | Beeinflusser |
| 100000003  | Anwender     |
| 100000004  | Nur Info     |

**Need:**
| Wert       | Label     |
|------------|-----------|
| 100000001  | Dringend  |
| 100000002  | Konkret   |
| 100000003  | Zukünftig |

**Timing:**
| Wert       | Label          |
|------------|----------------|
| 100000001  | Sofort         |
| 100000002  | Dieses Quartal |
| 100000003  | Dieses Jahr    |
| 100000004  | Später         |

**Nicht vergessen:** → **Publish All Customizations**!

---

### Phase 3: Server Deployment (30 Min)

**Wer:** DevOps / IT

#### Option A: Azure App Service (empfohlen)

```bash
# 1. Azure CLI installiert? Sonst: https://aka.ms/installazurecli
az login

# 2. Resource Group + App Service erstellen
az group create --name oktopus-rg --location westeurope
az appservice plan create --name oktopus-plan --resource-group oktopus-rg --sku B1 --is-linux
az webapp create --name oktopus-app --resource-group oktopus-rg --plan oktopus-plan --runtime "NODE:20-lts"

# 3. Umgebungsvariablen setzen (NICHT in Code!)
az webapp config appsettings set --name oktopus-app --resource-group oktopus-rg --settings \
  AZURE_CLIENT_ID="eure-client-id" \
  AZURE_CLIENT_SECRET="euer-secret" \
  AZURE_TENANT_ID="eure-tenant-id" \
  DYNAMICS_CRM_URL="https://FIRMA.crm4.dynamics.com" \
  SESSION_SECRET="$(openssl rand -hex 32)" \
  NODE_ENV="production" \
  FRONTEND_URL="https://oktopus-app.azurewebsites.net"

# 4. Code deployen
cd messe-lead-app/backend
zip -r ../deploy.zip .
az webapp deploy --name oktopus-app --resource-group oktopus-rg --src-path ../deploy.zip --type zip
```

#### Option B: Interner IIS Server

```bash
# 1. Node.js 20 LTS installieren
# https://nodejs.org/en/download

# 2. iisnode installieren (Node.js auf IIS)
# https://github.com/Azure/iisnode/releases

# 3. Backend einrichten
cd C:\inetpub\wwwroot\oktopus
xcopy /E backend\* .
npm install --production

# 4. .env erstellen (NICHT im Web-Root!)
copy .env.example .env
# → .env mit echten Werten füllen

# 5. web.config für IIS erstellen
```

**web.config für IIS:**
```xml
<configuration>
  <system.webServer>
    <handlers>
      <add name="iisnode" path="server.js" verb="*" modules="iisnode" />
    </handlers>
    <rewrite>
      <rules>
        <rule name="API">
          <match url="/*" />
          <action type="Rewrite" url="server.js" />
        </rule>
      </rules>
    </rewrite>
    <iisnode nodeProcessCommandLine="C:\Program Files\nodejs\node.exe" />
  </system.webServer>
</configuration>
```

#### Option C: Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --production
COPY backend/ ./
COPY frontend/ ./frontend/
EXPOSE 3001
CMD ["node", "server.js"]
```

```bash
docker build -t oktopus .
docker run -d --name oktopus -p 3001:3001 --env-file .env oktopus
```

---

### Phase 4: Lokale Entwicklung (5 Min)

```bash
# 1. Repository klonen / in den Ordner navigieren
cd messe-lead-app/backend

# 2. Dependencies installieren
npm install

# 3. .env erstellen
copy .env.example .env
# → .env mit Azure AD Werten füllen

# 4. Server starten
npm run dev
# → http://localhost:3001 öffnen
```

---

## Kostenvergleich: OKTOPUS vs. PowerApps

### OKTOPUS (diese Lösung)

| Posten                    | Kosten/Monat         | Anmerkung                          |
|---------------------------|----------------------|-------------------------------------|
| Azure App Service (B1)    | ~€11,68              | 1 vCPU, 1.75 GB RAM                |
| Azure AD App              | €0                   | Im M365 enthalten                  |
| Microsoft Graph API       | €0                   | In M365-Lizenz enthalten           |
| Dynamics 365 API          | €0                   | In Dynamics-Lizenz enthalten       |
| Node.js / Express         | €0                   | Open Source                        |
| Tesseract OCR             | €0                   | Open Source, läuft im Browser      |
| SSL-Zertifikat            | €0                   | Azure managed / Let's Encrypt      |
| **GESAMT**                | **~€12/Monat**       | **Für unbegrenzte User**           |

### PowerApps (Alternative des IT-Vorgesetzten)

| Posten                         | Kosten/Monat          | Anmerkung                          |
|--------------------------------|-----------------------|-------------------------------------|
| Power Apps per User Plan       | **€18,70/User/Monat** | Jeder Vertriebler braucht Lizenz   |
| Power Apps per App Plan        | **€4,70/User/App**    | Günstiger, aber begrenzt           |
| Premium Connector (Dynamics)   | Im per-User enthalten | Dynamics = Premium Connector       |
| AI Builder (für OCR)           | **€468,50/Monat**     | 1M Credits, oder einzeln kaufbar   |
| Custom Connector (falls nötig) | Im Premium enthalten  |                                     |

**Beispielrechnung PowerApps (5 Vertriebler):**

| Posten                          | Kosten              |
|----------------------------------|----------------------|
| 5× Power Apps per User           | 5 × €18,70 = €93,50 |
| AI Builder für OCR               | ~€468,50             |
| **GESAMT PowerApps/Monat**       | **~€562/Monat**      |
| **GESAMT PowerApps/Jahr**        | **~€6.744/Jahr**     |

**Beispielrechnung OKTOPUS (5 Vertriebler):**

| Posten                          | Kosten              |
|----------------------------------|----------------------|
| Azure App Service                | €11,68               |
| Alles andere                     | €0                   |
| **GESAMT OKTOPUS/Monat**         | **~€12/Monat**       |
| **GESAMT OKTOPUS/Jahr**          | **~€144/Jahr**       |

### Ersparnis: ~€6.600/Jahr (bei 5 Usern)
### Bei 10 Usern: ~€13.200/Jahr Ersparnis

---

## Vorteile OKTOPUS vs. PowerApps

| Kriterium              | OKTOPUS                          | PowerApps                        |
|------------------------|-----------------------------------|-----------------------------------|
| **Kosten**             | ~€12/Monat (flat)                | €93-562+/Monat (pro User)       |
| **OCR/Kamera**         | Tesseract.js (kostenlos)         | AI Builder (€470/Monat)         |
| **Offline**            | ✅ Voll offline-fähig            | ⚠️ Eingeschränkt                 |
| **Performance**        | ✅ Native Browser-Speed          | ⚠️ PowerApps Runtime overhead    |
| **Anpassbarkeit**      | ✅ 100% Custom Code              | ⚠️ Low-Code Limits               |
| **UI/UX**              | ✅ Custom Dark Mode UI           | ⚠️ Standard PowerApps Look       |
| **Deployment**         | 1 Server, fertig                 | PowerApps Environment nötig      |
| **Bestehendes Team**   | Bereits entwickelt               | Muss komplett neu gebaut werden  |
| **Vendor Lock-in**     | ✅ Minimal (Node.js portabel)    | ❌ Komplett an MS Platform       |
| **Dynamics Integration**| ✅ Direkte Web API              | ✅ Native (einziger Vorteil)     |

---

## Sicherheitsarchitektur

```
Frontend (Browser)          Backend (Server)           Microsoft Cloud
──────────────────          ────────────────           ───────────────
                            
❌ Kein Client Secret       ✅ Client Secret in .env   
❌ Kein Access Token        ✅ Token im Session-Store  
❌ Keine API URLs           ✅ CRM URL in .env         
❌ Kein direkter CRM-Call   ✅ Proxy zu Dynamics       
                            
✅ OCR lokal im Browser     ✅ Auth Middleware          ✅ Azure AD OAuth 2.0
✅ localStorage für Leads   ✅ CORS Whitelist           ✅ Token Refresh
✅ Nur /api/* Calls         ✅ Helmet Security Headers  ✅ Scoped Permissions
```

**Was ein User im Browser sehen kann (View Source):**
- HTML, CSS, JavaScript der UI
- API-Endpunkte (`/api/leads/sync`, `/api/auth/login`)
- Firmen-Konfiguration (Interessen, Vertriebsnamen)

**Was ein User NICHT sehen kann:**
- Azure AD Client Secret
- Dynamics CRM URL
- Access Tokens
- Tenant ID / Client ID
- Session Daten anderer User

---

## Projektstruktur

```
messe-lead-app/
├── backend/
│   ├── server.js              # Express Server (Entry Point)
│   ├── package.json           # Dependencies
│   ├── .env.example           # Template für Secrets
│   ├── .env                   # ECHTE Secrets (NIE committen!)
│   ├── routes/
│   │   ├── auth.js            # Azure AD Login/Callback/Logout
│   │   ├── leads.js           # Dynamics 365 CRM Sync
│   │   ├── email.js           # Outlook E-Mail via Graph
│   │   └── calendar.js        # Outlook Kalender via Graph
│   └── middleware/
│       └── auth.js            # Session-Prüfung
├── frontend/
│   ├── index.html             # App UI (keine Secrets!)
│   ├── css/
│   │   └── styles.css         # Styles
│   └── js/
│       ├── app.js             # App-Logik
│       ├── api.js             # Backend API Client
│       └── camera.js          # Kamera + OCR
├── SETUP_ANLEITUNG.md         # Diese Datei
├── KONZEPT_MS_INTEGRATION.md  # Detailkonzept
└── oktopus-complete.html      # Original (Backup)
```

---

## Checkliste für Go-Live

- [ ] Azure AD App registriert + Admin Consent erteilt
- [ ] Client ID, Tenant ID, Client Secret notiert
- [ ] Dynamics 365 Custom Fields angelegt + Published
- [ ] Backend auf Server deployed
- [ ] .env mit echten Werten befüllt
- [ ] HTTPS konfiguriert (SSL Zertifikat)
- [ ] Redirect URI in Azure AD aktualisiert
- [ ] Test: Login funktioniert
- [ ] Test: Lead wird in Dynamics erstellt
- [ ] Test: E-Mail wird über Outlook gesendet
- [ ] Test: Kalender-Eintrag wird erstellt
- [ ] Test: CSV Export funktioniert
- [ ] Test: Offline-Modus (Backend aus) → Leads lokal gespeichert

---

## FAQ für den IT-Vorgesetzten

**F: "Warum nicht PowerApps?"**
A: PowerApps kostet bei 5 Vertrieblem ~€6.700/Jahr mehr. Die App existiert bereits, ist schneller, offline-fähig, und hat bessere UX. Die Dynamics-Integration ist identisch — beide nutzen die gleiche Web API.

**F: "Ist das sicher?"**
A: Sicherer als PowerApps im Browser. Alle Secrets liegen auf dem Server (nicht im Browser). OAuth 2.0 Authorization Code Flow mit Client Secret — der sicherste Flow für Web-Apps.

**F: "Wer wartet das?"**
A: Node.js + Express ist der weltweit meistgenutzte Web-Stack. Jeder Webentwickler kann das warten. Bei PowerApps braucht man spezialisierte Power Platform-Kenntnisse.

**F: "Was wenn der Server ausfällt?"**
A: Die App funktioniert offline! Leads werden lokal gespeichert und synchronisiert sobald der Server wieder da ist. Bei PowerApps → keine App, keine Leads.

**F: "Brauchen wir zusätzliche Lizenzen?"**
A: Nein. Die bestehenden M365 + Dynamics 365 Lizenzen der Vertriebler reichen. Der Server kostet ~€12/Monat auf Azure.
