# OKTOPUS Lead Capture - Microsoft Integration Konzept

## Übersicht

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        OKTOPUS Lead Capture App                              │
│                         (HTML Embed / PWA)                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Azure AD Authentifizierung                           │
│              (Microsoft Identity Platform / OAuth 2.0 / MSAL.js)            │
└─────────────────────────────────────────────────────────────────────────────┘
                          │                           │
                          ▼                           ▼
┌────────────────────────────────────┐  ┌────────────────────────────────────┐
│      Microsoft Dynamics 365        │  │       Microsoft Graph API          │
│            CRM / Sales             │  │         (Outlook E-Mail)           │
│                                    │  │                                    │
│  • Lead erstellen                  │  │  • E-Mail senden als Vertriebler   │
│  • Kontakt anlegen                 │  │  • Kalendereinträge erstellen      │
│  • Account zuordnen                │  │  • Teams Benachrichtigung          │
│  • Notizen hinzufügen              │  │  • OneDrive Visitenkarten-Backup   │
└────────────────────────────────────┘  └────────────────────────────────────┘
```

---

## Teil 1: Azure AD App Registration

### 1.1 App im Azure Portal registrieren

1. **Azure Portal öffnen**: https://portal.azure.com
2. **Azure Active Directory** → **App registrations** → **New registration**

```
Name:                   OKTOPUS Lead Capture
Supported account types: Accounts in this organizational directory only
Redirect URI:           Single-page application (SPA)
                        https://[EURE-DOMAIN].site.com/callback
                        https://localhost:3000 (für Entwicklung)
```

### 1.2 API Permissions konfigurieren

Im Azure Portal unter **API Permissions** folgende Berechtigungen hinzufügen:

```
Microsoft Graph:
├── Delegated permissions:
│   ├── User.Read                    (Benutzerinfo lesen)
│   ├── Mail.Send                    (E-Mails senden als User)
│   ├── Mail.ReadWrite               (E-Mail Entwürfe)
│   ├── Calendars.ReadWrite          (Follow-up Termine)
│   └── offline_access               (Refresh Token)
│
Dynamics CRM:
├── Delegated permissions:
│   └── user_impersonation           (CRM Zugriff als User)
```

### 1.3 App Credentials notieren

Nach der Registrierung notieren:
- **Application (client) ID**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- **Directory (tenant) ID**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- **Dynamics CRM URL**: `https://[FIRMA].crm4.dynamics.com` (crm4 = EMEA Region)

---

## Teil 2: Frontend Integration (MSAL.js)

### 2.1 Azure AD Login im HTML

```html
<!-- Microsoft Authentication Library -->
<script src="https://alcdn.msauth.net/browser/2.38.0/js/msal-browser.min.js"></script>

<script>
// ============================================
// AZURE AD KONFIGURATION
// ============================================

const msalConfig = {
    auth: {
        clientId: "EURE-CLIENT-ID-HIER",           // Aus Azure Portal
        authority: "https://login.microsoftonline.com/EURE-TENANT-ID",
        redirectUri: window.location.origin,
    },
    cache: {
        cacheLocation: "localStorage",
        storeAuthStateInCookie: true,
    }
};

const msalInstance = new msal.PublicClientApplication(msalConfig);

// Scopes für verschiedene APIs
const graphScopes = ["User.Read", "Mail.Send", "Calendars.ReadWrite"];
const crmScopes = ["https://[FIRMA].crm4.dynamics.com/user_impersonation"];

// ============================================
// LOGIN FLOW
// ============================================

async function loginMicrosoft() {
    try {
        // Popup Login
        const loginResponse = await msalInstance.loginPopup({
            scopes: graphScopes
        });
        
        console.log("Login erfolgreich:", loginResponse.account.username);
        
        // Account speichern
        msalInstance.setActiveAccount(loginResponse.account);
        
        // UI aktualisieren
        updateLoginUI(loginResponse.account);
        
        return loginResponse;
        
    } catch (error) {
        console.error("Login Fehler:", error);
        throw error;
    }
}

async function getAccessToken(scopes) {
    const account = msalInstance.getActiveAccount();
    
    if (!account) {
        throw new Error("Nicht eingeloggt");
    }
    
    try {
        // Silent Token Refresh
        const response = await msalInstance.acquireTokenSilent({
            scopes: scopes,
            account: account
        });
        return response.accessToken;
        
    } catch (error) {
        // Fallback: Popup
        const response = await msalInstance.acquireTokenPopup({
            scopes: scopes
        });
        return response.accessToken;
    }
}
</script>
```

---

## Teil 3: Dynamics 365 CRM Integration

### 3.1 Lead in Dynamics erstellen

```javascript
// ============================================
// DYNAMICS CRM API
// ============================================

const CRM_URL = "https://[FIRMA].crm4.dynamics.com";

async function createLeadInDynamics(lead) {
    // Token für Dynamics holen
    const token = await getAccessToken([`${CRM_URL}/user_impersonation`]);
    
    // Lead-Entity für Dynamics formatieren
    const dynamicsLead = {
        // Pflichtfelder
        subject: `Messe Lead: ${lead.firstName} ${lead.lastName}`,
        firstname: lead.firstName,
        lastname: lead.lastName,
        companyname: lead.company,
        emailaddress1: lead.email,
        
        // Optionale Felder
        jobtitle: lead.jobTitle || null,
        telephone1: lead.phone || null,
        mobilephone: lead.mobile || null,
        
        // BANT Qualifizierung (Custom Fields - müssen in Dynamics existieren!)
        // Achtung: Feldnamen wie "new_bantbudget" müssen in eurem CRM angelegt sein
        new_bantbudget: mapBantValue(lead.bantBudget),
        new_bantauthority: mapBantValue(lead.bantAuthority),
        new_bantneed: mapBantValue(lead.bantNeed),
        new_banttiming: mapBantValue(lead.bantTiming),
        
        // Interessen als Text (oder Lookup auf Product)
        new_interests: lead.interests?.join(", ") || "",
        
        // Notizen
        description: lead.notes || "",
        
        // Lead-Quelle
        leadsourcecode: 8,  // 8 = Trade Show (Standard Option Set)
        
        // Kampagne/Event (wenn vorhanden)
        new_messeevent: lead.event || "IFAT Munich 2026",
        
        // Zuständiger Vertriebler (Owner) - über systemuser Lookup
        // "ownerid@odata.bind": `/systemusers(${salesRepGuid})`
    };
    
    // Lead erstellen via Web API
    const response = await fetch(`${CRM_URL}/api/data/v9.2/leads`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
            "OData-MaxVersion": "4.0",
            "OData-Version": "4.0",
            "Prefer": "return=representation"
        },
        body: JSON.stringify(dynamicsLead)
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(`CRM Fehler: ${error.error?.message || response.statusText}`);
    }
    
    const createdLead = await response.json();
    console.log("Lead erstellt in Dynamics:", createdLead.leadid);
    
    return createdLead;
}

// BANT Werte auf Dynamics Option Sets mappen
function mapBantValue(value) {
    const mapping = {
        // Budget
        'vorhanden': 100000001,
        'geplant': 100000002,
        'offen': 100000003,
        'kein': 100000004,
        // Authority
        'entscheider': 100000001,
        'beeinflusser': 100000002,
        'nutzer': 100000003,
        'info': 100000004,
        // Need
        'dringend': 100000001,
        'konkret': 100000002,
        'zukunft': 100000003,
        // Timing
        'sofort': 100000001,
        'quartal': 100000002,
        'jahr': 100000003,
        'spaeter': 100000004,
    };
    return mapping[value] || null;
}
```

### 3.2 Vertriebler in Dynamics finden

```javascript
// Vertriebler (SystemUser) in Dynamics anhand E-Mail finden
async function findSalesRepInDynamics(email) {
    const token = await getAccessToken([`${CRM_URL}/user_impersonation`]);
    
    const response = await fetch(
        `${CRM_URL}/api/data/v9.2/systemusers?$filter=internalemailaddress eq '${email}'&$select=systemuserid,fullname`,
        {
            headers: {
                "Authorization": `Bearer ${token}`,
                "OData-MaxVersion": "4.0",
                "OData-Version": "4.0"
            }
        }
    );
    
    const data = await response.json();
    return data.value[0] || null;
}

// Lead dem Vertriebler zuweisen
async function assignLeadToSalesRep(leadId, salesRepId) {
    const token = await getAccessToken([`${CRM_URL}/user_impersonation`]);
    
    await fetch(`${CRM_URL}/api/data/v9.2/leads(${leadId})`, {
        method: "PATCH",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
            "OData-MaxVersion": "4.0",
            "OData-Version": "4.0"
        },
        body: JSON.stringify({
            "ownerid@odata.bind": `/systemusers(${salesRepId})`
        })
    });
}
```

---

## Teil 4: Outlook E-Mail vom Vertriebler-Konto

### 4.1 E-Mail senden via Microsoft Graph

**Wichtig**: E-Mail wird vom eingeloggten User gesendet (= der Vertriebler am Messestand)

```javascript
// ============================================
// OUTLOOK E-MAIL VIA GRAPH API
// ============================================

async function sendOutlookEmail(lead, salesRep) {
    // Graph Token holen
    const token = await getAccessToken(["Mail.Send"]);
    
    // Interessen formatieren
    const interestsList = lead.interests?.map(id => {
        const interest = CONFIG.interests.find(i => i.id === id);
        return interest ? `• ${interest.name}` : null;
    }).filter(Boolean).join("\n") || "• Allgemeine Informationen";
    
    // E-Mail Body (HTML)
    const emailHtml = `
        <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
            <p>Sehr geehrte(r) ${lead.firstName} ${lead.lastName},</p>
            
            <p>vielen Dank für Ihren Besuch an unserem Messestand auf der <strong>${lead.event}</strong>!</p>
            
            <p>Es hat mich gefreut, Sie persönlich kennenzulernen und über Ihre Anforderungen 
            im Bereich Umweltwirtschaft zu sprechen.</p>
            
            <p>Wie besprochen interessieren Sie sich für:</p>
            <div style="margin: 16px 0; padding: 16px; background: #f5f5f5; border-radius: 8px;">
                ${interestsList.replace(/\n/g, "<br>")}
            </div>
            
            <p>Ich werde mich in den nächsten Tagen bei Ihnen melden, um die Details 
            zu besprechen und Ihnen ein passendes Angebot zu unterbreiten.</p>
            
            <p>Bei Fragen erreichen Sie mich jederzeit unter den unten stehenden Kontaktdaten.</p>
            
            <p>Mit freundlichen Grüßen<br><br>
            <strong>${salesRep.name}</strong><br>
            ${salesRep.role}<br>
            ${CONFIG.company.name}</p>
            
            <hr style="margin: 24px 0; border: none; border-top: 1px solid #ddd;">
            
            <p style="font-size: 12px; color: #666;">
                📧 ${salesRep.email}<br>
                📞 ${CONFIG.company.phone}<br>
                🌐 ${CONFIG.company.website}
            </p>
        </body>
        </html>
    `;
    
    // Graph API E-Mail Payload
    const emailPayload = {
        message: {
            subject: `Vielen Dank für Ihren Besuch - ${CONFIG.company.name}`,
            body: {
                contentType: "HTML",
                content: emailHtml
            },
            toRecipients: [
                {
                    emailAddress: {
                        address: lead.email,
                        name: `${lead.firstName} ${lead.lastName}`
                    }
                }
            ],
            // CC an internen Sales (optional)
            // ccRecipients: [
            //     { emailAddress: { address: "sales@oktopus-umwelt.de" } }
            // ],
            
            // Wichtigkeit
            importance: "normal",
            
            // Antworten gehen an Vertriebler
            replyTo: [
                {
                    emailAddress: {
                        address: salesRep.email,
                        name: salesRep.name
                    }
                }
            ]
        },
        // Direkt senden (nicht als Entwurf)
        saveToSentItems: true
    };
    
    // E-Mail senden
    const response = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(emailPayload)
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(`E-Mail Fehler: ${error.error?.message}`);
    }
    
    console.log("✅ E-Mail gesendet von", msalInstance.getActiveAccount()?.username);
    return true;
}
```

### 4.2 E-Mail als anderer User senden (Delegated Permissions)

Wenn der Vertriebler nicht eingeloggt ist, aber die E-Mail trotzdem von seinem Konto kommen soll:

```javascript
// Erfordert: Mail.Send.Shared Permission + Postfach-Delegation in Exchange
async function sendEmailAsUser(lead, salesRepEmail) {
    const token = await getAccessToken(["Mail.Send.Shared"]);
    
    // Senden vom Postfach des Vertrieblers
    const response = await fetch(
        `https://graph.microsoft.com/v1.0/users/${salesRepEmail}/sendMail`,
        {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: {
                    subject: "...",
                    body: { contentType: "HTML", content: "..." },
                    toRecipients: [{ emailAddress: { address: lead.email } }]
                }
            })
        }
    );
}
```

**Voraussetzung**: Im Exchange Admin Center muss "Send As" oder "Send on Behalf" für den App-User konfiguriert sein.

---

## Teil 5: Follow-Up Termin im Outlook Kalender

```javascript
// ============================================
// KALENDER-EINTRAG FÜR FOLLOW-UP
// ============================================

async function createFollowUpEvent(lead, salesRep) {
    const token = await getAccessToken(["Calendars.ReadWrite"]);
    
    // Follow-up in 3 Tagen
    const followUpDate = new Date();
    followUpDate.setDate(followUpDate.getDate() + 3);
    followUpDate.setHours(10, 0, 0, 0);
    
    const endDate = new Date(followUpDate);
    endDate.setMinutes(endDate.getMinutes() + 30);
    
    const event = {
        subject: `Follow-up: ${lead.firstName} ${lead.lastName} (${lead.company})`,
        body: {
            contentType: "HTML",
            content: `
                <p><strong>Lead von ${lead.event}</strong></p>
                <p>Kontakt: ${lead.email} | ${lead.phone || 'Kein Telefon'}</p>
                <p>Interessen: ${lead.interests?.join(", ") || "Nicht angegeben"}</p>
                <hr>
                <p>Notizen vom Messestand:</p>
                <p>${lead.notes || "Keine Notizen"}</p>
            `
        },
        start: {
            dateTime: followUpDate.toISOString(),
            timeZone: "Europe/Berlin"
        },
        end: {
            dateTime: endDate.toISOString(),
            timeZone: "Europe/Berlin"
        },
        location: {
            displayName: "Telefonat / Teams"
        },
        isReminderOn: true,
        reminderMinutesBeforeStart: 60,
        
        // Als Kategorie markieren
        categories: ["Messe Lead"]
    };
    
    const response = await fetch("https://graph.microsoft.com/v1.0/me/events", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(event)
    });
    
    if (!response.ok) {
        throw new Error("Kalender-Eintrag fehlgeschlagen");
    }
    
    console.log("📅 Follow-up Termin erstellt");
}
```

---

## Teil 6: Kompletter Workflow

```javascript
// ============================================
// LEAD SPEICHERN - VOLLSTÄNDIGER WORKFLOW
// ============================================

async function saveLead() {
    // 1. Formulardaten sammeln
    const lead = collectFormData();
    
    // 2. Validierung
    if (!validateLead(lead)) return;
    
    // 3. Lokal speichern (Offline-Fallback)
    leads.unshift(lead);
    saveLeadsToStorage();
    
    showStatus("Synchronisiere mit Microsoft...", "loading");
    
    try {
        // 4. Prüfen ob eingeloggt
        const account = msalInstance.getActiveAccount();
        if (!account) {
            await loginMicrosoft();
        }
        
        // 5. Lead in Dynamics CRM erstellen
        const crmLead = await createLeadInDynamics(lead);
        lead.crmId = crmLead.leadid;
        
        // 6. Vertriebler finden und zuweisen
        const salesRep = CONFIG.salesReps.find(r => r.id === lead.salesRep);
        if (salesRep) {
            const crmUser = await findSalesRepInDynamics(salesRep.email);
            if (crmUser) {
                await assignLeadToSalesRep(crmLead.leadid, crmUser.systemuserid);
            }
        }
        
        // 7. Willkommens-E-Mail vom Outlook des Vertrieblers senden
        if (salesRep) {
            await sendOutlookEmail(lead, salesRep);
            lead.emailSent = true;
            lead.emailSentAt = new Date().toISOString();
        }
        
        // 8. Follow-up Termin erstellen
        await createFollowUpEvent(lead, salesRep);
        
        // 9. Lokalen Speicher aktualisieren
        lead.synced = true;
        saveLeadsToStorage();
        
        showStatus("Lead gespeichert & synchronisiert! 🎉", "success");
        
    } catch (error) {
        console.error("Sync Fehler:", error);
        lead.synced = false;
        lead.syncError = error.message;
        saveLeadsToStorage();
        
        showStatus("Lokal gespeichert (Sync später)", "warning");
    }
    
    // 10. UI Reset
    setTimeout(() => {
        hideStatus();
        resetForm();
        showSection('capture');
    }, 2000);
}
```

---

## Teil 7: Dynamics CRM Setup

### 7.1 Custom Fields in Dynamics anlegen

In **Dynamics 365 → Settings → Customizations → Customize the System → Lead Entity**:

| Feld Name (Schema) | Anzeigename | Typ |
|-------------------|-------------|-----|
| `new_bantbudget` | BANT Budget | Option Set |
| `new_bantauthority` | BANT Entscheider | Option Set |
| `new_bantneed` | BANT Bedarf | Option Set |
| `new_banttiming` | BANT Timing | Option Set |
| `new_interests` | Interessen | Multiline Text |
| `new_messeevent` | Messe/Event | Single Line Text |
| `new_standnumber` | Standnummer | Single Line Text |

### 7.2 Option Sets erstellen

Für jedes BANT-Feld ein **Global Option Set** anlegen:

**Budget Options:**
```
100000001 = Budget vorhanden
100000002 = Budget geplant
100000003 = Noch offen
100000004 = Kein Budget
```

**Authority Options:**
```
100000001 = Entscheider
100000002 = Beeinflusser
100000003 = Anwender
100000004 = Nur Info
```

(analog für Need und Timing)

### 7.3 Lead-Formular anpassen

1. Neuen **Tab** "Messe-Qualifizierung" hinzufügen
2. Custom Fields auf das Formular ziehen
3. **Publish** nicht vergessen!

---



## Teil 9: Sicherheit & Best Practices

### 9.1 Token Handling

```javascript
// Tokens NICHT im localStorage speichern (MSAL macht das sicher)
// Kein Client Secret im Frontend (nur Public Client)
// Immer acquireTokenSilent vor API Calls
```

### 9.2 Rate Limiting

```javascript
// Microsoft Graph: 10.000 Requests / 10 Minuten / App
// Dynamics: Variiert je nach Lizenz

// Batch Requests für viele Leads:
async function batchSyncLeads(leads) {
    // Max 20 Requests pro Batch
    const batches = chunk(leads, 20);
    
    for (const batch of batches) {
        await Promise.all(batch.map(l => createLeadInDynamics(l)));
        await sleep(1000); // Rate Limit Buffer
    }
}
```

### 9.3 Offline First

```javascript
// Service Worker für Offline-Fähigkeit
// Leads werden lokal gespeichert und synchronisiert wenn online
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
}
```

---

## Teil 10: Kosten & Lizenzen

### Erforderliche Microsoft Lizenzen

| Komponente | Lizenz | Kosten (ca.) |
|------------|--------|--------------|
| Azure AD App | Azure Free Tier | Kostenlos |
| Graph API (Mail) | Microsoft 365 Business Basic | €5,60/User/Monat |
| Dynamics 365 Sales | Professional | €54,80/User/Monat |
| Dynamics 365 Sales | Enterprise | €80,10/User/Monat |

### Azure API Calls

- **Microsoft Graph**: 10.000 kostenlose API Calls/Monat
- **Dynamics Web API**: In Dynamics-Lizenz enthalten

---

## Implementierungs-Roadmap

### Phase 1: Basis (1-2 Tage)
- [ ] Azure AD App Registration
- [ ] MSAL.js Integration
- [ ] Login/Logout Flow

### Phase 2: CRM (2-3 Tage)
- [ ] Custom Fields in Dynamics anlegen
- [ ] Lead-Erstellung via API
- [ ] Vertriebler-Zuweisung

### Phase 3: E-Mail (1 Tag)
- [ ] Outlook Mail via Graph
- [ ] E-Mail Templates
- [ ] Kalender-Integration

### Phase 4: Polish (1-2 Tage)
- [ ] Offline Sync
- [ ] Error Handling


---

## Kontakte für Setup

| Rolle | Aufgabe |
|-------|---------|
| **IT-Admin** | Azure AD App Registration, API Permissions |
| **Dynamics Admin** | Custom Fields, Option Sets, User Lookup |
| **Exchange Admin** | Mail.Send.Shared Permissions (falls delegiert) |
| **Entwickler** | Frontend Integration, Testing |

---

## Support & Dokumentation

- **Microsoft Graph API**: https://learn.microsoft.com/graph/
- **Dynamics Web API**: https://learn.microsoft.com/dynamics365/customer-engagement/web-api/
- **MSAL.js**: https://github.com/AzureAD/microsoft-authentication-library-for-js
- **Azure AD**: https://portal.azure.com

