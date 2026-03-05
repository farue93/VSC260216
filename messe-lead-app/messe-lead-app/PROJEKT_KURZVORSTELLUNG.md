# OKTOPUS Lead Capture — Projektvorstellung

## Was ist das?

Eine **mobile Web-App für den Messestand**, mit der Vertriebsmitarbeiter Visitenkarten fotografieren, per OCR automatisch auslesen und als Lead erfassen können — inklusive BANT-Qualifizierung, Vertriebszuordnung und automatischem E-Mail-Versand.

**Kein App Store nötig** — läuft im Browser auf jedem Smartphone/Tablet.

---

## Was funktioniert bereits (Demo-fertig)

| Feature | Status |
|---------|--------|
| Visitenkarte fotografieren / hochladen | ✅ Fertig |
| OCR-Texterkennung (Tesseract.js, läuft komplett im Browser) | ✅ Fertig |
| Automatisches Befüllen der Kontaktfelder aus Visitenkarte | ✅ Fertig |
| Manuelle Lead-Eingabe als Fallback | ✅ Fertig |
| BANT-Qualifizierung (Budget/Authority/Need/Timing) | ✅ Fertig |
| Zuordnung an Vertriebsmitarbeiter | ✅ Fertig |
| Lead-Liste mit Suche und Filterfunktion | ✅ Fertig |
| CSV-Export aller Leads | ✅ Fertig |
| Offline-Fähigkeit (lokaler Speicher) | ✅ Fertig |
| Demo-Modus mit Beispiel-Visitenkarte | ✅ Fertig |
| E-Mail-Versand über EmailJS (Standalone-Variante) | ✅ Fertig |

**Die App ist jetzt schon eigenständig nutzbar** — auch ohne Microsoft-Integration (Leads werden lokal gespeichert + CSV-Export).

---

## Was brauchen wir von der IT?

### Für die Microsoft-Integration (Dynamics 365 + Outlook)

| # | Was | Wer muss das machen | Aufwand |
|---|-----|---------------------|---------|
| 1 | **Azure AD App Registration** erstellen | Global Admin oder Application Admin | 15 Min |
| 2 | **Admin Consent** für API-Berechtigungen erteilen | Global Admin | 5 Min |
| 3 | **Dynamics 365 Custom Fields** anlegen (7 Felder + 4 Option Sets für BANT) | Dynamics Admin | 1-2 Std |
| 4 | **Azure Static Web App** erstellen (Hosting) | Azure Subscription Contributor | 15 Min |
| 5 | *(Optional)* Exchange Send-As Delegation | Exchange Admin | 15 Min |

### Benötigte API-Berechtigungen (Azure AD)

```
Microsoft Graph (Delegated):
  • User.Read              — Benutzerinfo lesen
  • Mail.Send              — E-Mails senden als eingeloggter Vertriebler
  • Calendars.ReadWrite    — Follow-up Termine erstellen

Dynamics CRM (Delegated):
  • user_impersonation     — Leads im CRM anlegen
```

> **Alle Berechtigungen sind "Delegated"** = die App handelt immer im Namen des eingeloggten Benutzers, nie eigenständig. Kein Client Secret im Frontend.

### Voraussetzung: Bestehendes Lizenzbild klären

- [ ] Haben die Vertriebler **Microsoft 365 Business Basic** oder höher? (für Mail.Send)
- [ ] Haben wir **Dynamics 365 Sales** (Professional oder Enterprise)?
- [ ] Haben wir eine **Azure Subscription**?

---

## Ablauf nach Einrichtung

```
Vertriebler am Messestand
        │
        ▼
  Visitenkarte fotografieren
        │
        ▼
  OCR erkennt Text automatisch → Felder befüllt
        │
        ▼
  BANT-Qualifizierung + Notizen + Vertriebszuordnung
        │
        ▼
  "Lead speichern" drücken
        │
        ├──► Lead wird in Dynamics 365 CRM erstellt
        ├──► Willkommens-E-Mail geht raus (vom Outlook des Vertrieblers)
        └──► Follow-up Termin im Outlook-Kalender (3 Tage später)
```

---

## Kosten

### Einmalig

| Posten | Kosten |
|--------|--------|
| Azure Static Web App (Hosting) | **€0** (Free Tier reicht) |
| Azure AD App Registration | **€0** (im Tenant enthalten) |
| Tesseract.js OCR-Engine | **€0** (Open Source, läuft im Browser) |
| Entwicklung / Integration | **Intern** (bereits umgesetzt) |

### Laufend (pro Monat)

| Posten | Kosten | Anmerkung |
|--------|--------|-----------|
| Hosting (Azure Static Web Apps) | **€0 – €8** | Free Tier für diese App ausreichend |
| Microsoft Graph API Calls | **€0** | 10.000 kostenlose Calls/Monat enthalten |
| M365 Business Basic (pro Vertriebler) | **€5,60/User** | Nur falls nicht bereits vorhanden |
| Dynamics 365 Sales Professional | **€54,80/User** | Nur falls nicht bereits vorhanden |

### Fazit Kosten

- **Falls M365 + Dynamics bereits lizenziert sind**: → **€0 zusätzliche Kosten**
- **Falls Dynamics nicht vorhanden**: App funktioniert trotzdem standalone (lokaler Speicher + CSV-Export + EmailJS für E-Mails). CRM-Sync kann jederzeit nachgerüstet werden.
- **Keine externen Dienstleister, keine Server, kein App-Store, keine laufenden API-Kosten.**

---

## Nächste Schritte

1. **IT-Termin** → Lizenzbild klären + Azure AD App Registration beantragen
2. **Dynamics Admin** → Custom Fields anlegen (1-2 Stunden)
3. **Deployment** → App auf Azure Static Web App deployen (15 Min)
4. **Test** → End-to-End Test mit einem echten Lead
5. **Schulung** → 15-Minuten-Demo für Vertriebsteam

**Geschätzte Gesamtdauer bis Go-Live: 3-5 Arbeitstage** (abhängig von internen Freigaben)

---

## DSGVO-Hinweis

- Alle Daten bleiben im **eigenen Microsoft-Tenant** (Azure AD, Dynamics, Outlook)
- OCR läuft **komplett im Browser** — kein Upload an externe Server
- Offline-Daten liegen nur im localStorage des Geräts
- Verarbeitungsverzeichnis sollte aktualisiert werden (Visitenkartendaten = personenbezogene Daten)
