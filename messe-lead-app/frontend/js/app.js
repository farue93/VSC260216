// ============================================
// OKTOPUS APP — Premium Messe Lead Capture
// ============================================
// Kein CRM — nur CSV + E-Mail (CC an Vertriebler) + Kalender.
// Alles Sensible läuft über das Backend (api.js).

const App = {
    // ========================================
    // KONFIGURATION
    // ========================================
    // ► Interessen: Jedes Interesse hat zugeordnete CC-Empfänger.
    //   Beim Speichern werden alle Vertriebler der gewählten
    //   Interessen automatisch ins CC gesetzt.

    CONFIG: {
        interests: [
            { id: 'abfall', name: 'Abfallentsorgung', desc: 'Gewerbe & Industrie',
              cc: [{ name: 'Lisa Winter', email: 'l.winter@oktopus-umwelt.de' }] },
            { id: 'recycling', name: 'Recycling', desc: 'Wertstoffkreisläufe',
              cc: [{ name: 'Thomas Bergmann', email: 't.bergmann@oktopus-umwelt.de' }] },
            { id: 'luft', name: 'Luftreinhaltung', desc: 'Industrieabluft',
              cc: [{ name: 'Mehmet Kaya', email: 'm.kaya@oktopus-umwelt.de' }] },
            { id: 'sondermuell', name: 'Sondermüll', desc: 'Gefahrstoffe',
              cc: [{ name: 'Mehmet Kaya', email: 'm.kaya@oktopus-umwelt.de' }] },
            { id: 'beratung', name: 'Umweltberatung', desc: 'Nachhaltigkeitskonzepte',
              cc: [{ name: 'Dr. Sabine Fischer', email: 's.fischer@oktopus-umwelt.de' }] },
            { id: 'digital', name: 'Digitalisierung', desc: 'Smart Waste',
              cc: [{ name: 'Thomas Bergmann', email: 't.bergmann@oktopus-umwelt.de' },
                   { name: 'Lisa Winter', email: 'l.winter@oktopus-umwelt.de' }] },
        ],

        company: {
            name: 'OKTOPUS Umweltwirtschaft',
            phone: '+49 89 123456-0',
            website: 'www.oktopus-umwelt.de'
        }
    },

    leads: [],
    editingLeadId: null,
    isAuthenticated: false,
    currentUser: null,

    // ========================================
    // INIT
    // ========================================

    async init() {
        this.loadLeads();
        this.renderInterests();
        this.updateStats();
        this.loadSettings();

        if (this.leads.length === 0) this.loadDemoLeads();

        await this.checkBackendStatus();
        await this.checkAuthStatus();
    },

    async checkBackendStatus() {
        const health = await API.healthCheck();
        const desc = document.getElementById('apiStatusDesc');
        const val  = document.getElementById('apiStatusValue');
        if (health.status === 'ok') {
            desc.textContent = `${health.environment} | ${health.mode || 'E-Mail only'}`;
            val.textContent = 'Online';
            val.style.color = 'var(--success)';
        } else {
            desc.textContent = 'Backend nicht erreichbar';
            val.textContent = 'Offline';
            val.style.color = 'var(--danger)';
        }
    },

    async checkAuthStatus() {
        const auth = await API.checkAuth();
        this.isAuthenticated = auth.authenticated;
        this.currentUser = auth.user;

        const status  = document.getElementById('authStatus');
        const label   = document.getElementById('authLabel');
        const msLabel = document.getElementById('msStatusLabel');
        const msDesc  = document.getElementById('msStatusDesc');
        const msBtn   = document.getElementById('msLoginBtn');

        if (auth.authenticated) {
            status.classList.add('connected');
            label.textContent = auth.user?.name?.split(' ')[0] || 'Verbunden';
            msLabel.textContent = `Verbunden als ${auth.user?.name}`;
            msDesc.textContent  = auth.user?.email;
            msBtn.textContent   = 'Trennen';
            msBtn.classList.remove('btn-accent');
            msBtn.classList.add('btn-danger');
        } else {
            status.classList.remove('connected');
            label.textContent   = 'Offline';
            msLabel.textContent = 'Nicht verbunden';
            msDesc.textContent  = 'Mit Microsoft anmelden für E-Mail & Kalender';
            msBtn.textContent   = 'Verbinden';
            msBtn.classList.add('btn-accent');
            msBtn.classList.remove('btn-danger');
        }
    },

    // ========================================
    // CC-EMPFÄNGER AUS INTERESSEN BERECHNEN
    // ========================================

    getCCRecipients(interestIds) {
        const map = new Map(); // email → { name, email } (dedupliziert)
        interestIds.forEach(id => {
            const interest = this.CONFIG.interests.find(i => i.id === id);
            if (interest?.cc) {
                interest.cc.forEach(r => map.set(r.email, r));
            }
        });
        return [...map.values()];
    },

    // ========================================
    // DEMO DATA
    // ========================================

    loadDemoLeads() {
        this.leads = [
            {
                id: '1', createdAt: new Date(Date.now() - 3600000).toISOString(),
                salutation: 'Herr', title: '', firstName: 'Michael', lastName: 'Schneider',
                company: 'Stadtwerke München', jobTitle: 'Leiter Abfallwirtschaft',
                email: 'm.schneider@swm.de', phone: '+49 89 2361-0', mobile: '+49 170 1234567',
                website: 'www.swm.de', address: 'Emmy-Noether-Straße 2, 80992 München',
                interests: ['abfall', 'digital'],
                bantBudget: 'vorhanden', bantAuthority: 'entscheider', bantNeed: 'dringend', bantTiming: 'quartal',
                notes: 'Interessiert an IoT-Sensoren für Containerfüllstände.',
                event: 'IFAT Munich 2026', emailSent: true, followUp: true,
            },
            {
                id: '2', createdAt: new Date(Date.now() - 7200000).toISOString(),
                salutation: 'Frau', title: 'Dr.', firstName: 'Anna', lastName: 'Weber',
                company: 'BMW Group', jobTitle: 'Environmental Manager',
                email: 'anna.weber@bmw.de', phone: '+49 89 382-0', mobile: '',
                website: 'www.bmw.de', address: 'Petuelring 130, 80788 München',
                interests: ['recycling', 'luft', 'beratung'],
                bantBudget: 'geplant', bantAuthority: 'beeinflusser', bantNeed: 'konkret', bantTiming: 'jahr',
                notes: 'Sucht Partner für CO2-Neutralität bis 2030.',
                event: 'IFAT Munich 2026', emailSent: true, followUp: false,
            },
            {
                id: '3', createdAt: new Date(Date.now() - 10800000).toISOString(),
                salutation: 'Herr', title: 'Prof. Dr.', firstName: 'Klaus', lastName: 'Hoffmann',
                company: 'Chempark Leverkusen', jobTitle: 'HSE Director',
                email: 'k.hoffmann@chempark.de', phone: '+49 214 30-1', mobile: '+49 151 9876543',
                website: 'www.chempark.de', address: 'Kaiser-Wilhelm-Allee, 51373 Leverkusen',
                interests: ['sondermuell', 'beratung'],
                bantBudget: 'vorhanden', bantAuthority: 'entscheider', bantNeed: 'dringend', bantTiming: 'sofort',
                notes: 'HOT LEAD — Akuter Bedarf an Sondermüllentsorgung.',
                event: 'IFAT Munich 2026', emailSent: false, followUp: false,
            },
        ];
        this.saveLeads();
        this.updateStats();
    },

    // ========================================
    // LEAD SPEICHERN
    // ========================================

    async saveLead() {
        const lead = {
            id: this.editingLeadId || Date.now().toString(),
            createdAt: this.editingLeadId
                ? this.leads.find(l => l.id === this.editingLeadId)?.createdAt
                : new Date().toISOString(),
            salutation: document.getElementById('salutation').value,
            title: document.getElementById('title').value,
            firstName: document.getElementById('firstName').value.trim(),
            lastName: document.getElementById('lastName').value.trim(),
            company: document.getElementById('company').value.trim(),
            jobTitle: document.getElementById('jobTitle').value.trim(),
            email: document.getElementById('email').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            mobile: document.getElementById('mobile').value.trim(),
            website: document.getElementById('website').value.trim(),
            address: document.getElementById('address').value.trim(),
            interests: Array.from(document.querySelectorAll('input[name="interests"]:checked')).map(c => c.value),
            bantBudget: document.getElementById('bantBudget').value,
            bantAuthority: document.getElementById('bantAuthority').value,
            bantNeed: document.getElementById('bantNeed').value,
            bantTiming: document.getElementById('bantTiming').value,
            notes: document.getElementById('notes').value.trim(),
            event: document.getElementById('settingsEvent')?.value || 'IFAT Munich 2026',
            emailSent: false,
            followUp: false,
        };

        // Validierung
        if (!lead.firstName || !lead.lastName) return this.showStatus('Vor- und Nachname erforderlich', 'error');
        if (!lead.email) return this.showStatus('E-Mail erforderlich', 'error');
        if (!lead.company) return this.showStatus('Unternehmen erforderlich', 'error');

        // Lokal speichern (Offline-First!)
        if (this.editingLeadId) {
            const idx = this.leads.findIndex(l => l.id === this.editingLeadId);
            if (idx !== -1) {
                lead.emailSent = this.leads[idx].emailSent;
                lead.followUp  = this.leads[idx].followUp;
                this.leads[idx] = lead;
            }
            this.editingLeadId = null;
        } else {
            this.leads.unshift(lead);
        }

        this.saveLeads();
        this.updateStats();

        // 🎉 Confetti!
        this.fireConfetti();

        this.showStatus('Lead gespeichert!', 'success');

        // Microsoft-Integration (wenn eingeloggt)
        const settings = this.getSettings();

        if (this.isAuthenticated) {
            try {
                // 1. E-Mail senden (CC = relevante Vertriebler)
                if (settings.emailEnabled) {
                    this.showStatus('Sende Willkommens-E-Mail...', 'loading');
                    const ccRecipients = this.getCCRecipients(lead.interests);
                    await API.sendWelcomeEmail(
                        {
                            ...lead,
                            interests: lead.interests.map(id =>
                                this.CONFIG.interests.find(x => x.id === id)?.name || id
                            )
                        },
                        ccRecipients,
                        this.CONFIG.company
                    );
                    lead.emailSent = true;
                }

                // 2. Follow-up Termin
                if (settings.calendarEnabled) {
                    await API.createFollowUp(lead);
                    lead.followUp = true;
                }

                this.saveLeads();
                this.updateStats();
                this.showStatus('Lead gespeichert & E-Mail gesendet!', 'success');

            } catch (err) {
                console.error('Sync Fehler:', err);
                this.showStatus('Lokal gespeichert — E-Mail wird nachgeholt', 'warning');
            }
        }

        this.resetForm();
    },

    // ========================================
    // CONFETTI 🎉
    // ========================================

    fireConfetti() {
        if (typeof confetti !== 'function') return;

        // Linke Seite
        confetti({
            particleCount: 60, angle: 60, spread: 55,
            origin: { x: 0, y: 0.65 },
            colors: ['#FF9B37', '#FF5722', '#FFB366', '#00E676', '#667eea']
        });
        // Rechte Seite
        confetti({
            particleCount: 60, angle: 120, spread: 55,
            origin: { x: 1, y: 0.65 },
            colors: ['#FF9B37', '#FF5722', '#FFB366', '#00E676', '#667eea']
        });
    },

    // ========================================
    // FORM
    // ========================================

    resetForm() {
        ['firstName', 'lastName', 'company', 'jobTitle', 'email',
         'phone', 'mobile', 'website', 'address', 'notes'].forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.value = ''; el.classList.remove('autofilled'); }
        });
        document.getElementById('salutation').value = '';
        document.getElementById('title').value = '';
        ['bantBudget', 'bantAuthority', 'bantNeed', 'bantTiming'].forEach(id => {
            document.getElementById(id).value = '';
        });
        document.querySelectorAll('#interestsGrid .interest-chip').forEach(el => {
            el.classList.remove('selected');
            el.querySelector('input').checked = false;
        });

        CameraModule.reset();
        this.editingLeadId = null;

        // Scroll zum Anfang
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    editLead(id) {
        const lead = this.leads.find(l => l.id === id);
        if (!lead) return;

        this.editingLeadId = id;

        document.getElementById('salutation').value    = lead.salutation || '';
        document.getElementById('title').value         = lead.title || '';
        document.getElementById('firstName').value     = lead.firstName;
        document.getElementById('lastName').value      = lead.lastName;
        document.getElementById('company').value       = lead.company;
        document.getElementById('jobTitle').value      = lead.jobTitle || '';
        document.getElementById('email').value         = lead.email;
        document.getElementById('phone').value         = lead.phone || '';
        document.getElementById('mobile').value        = lead.mobile || '';
        document.getElementById('website').value       = lead.website || '';
        document.getElementById('address').value       = lead.address || '';
        document.getElementById('notes').value         = lead.notes || '';
        document.getElementById('bantBudget').value    = lead.bantBudget || '';
        document.getElementById('bantAuthority').value = lead.bantAuthority || '';
        document.getElementById('bantNeed').value      = lead.bantNeed || '';
        document.getElementById('bantTiming').value    = lead.bantTiming || '';

        // Interessen-Chips setzen
        document.querySelectorAll('#interestsGrid .interest-chip').forEach(el => {
            const val = el.querySelector('input').value;
            const checked = lead.interests?.includes(val);
            el.classList.toggle('selected', checked);
            el.querySelector('input').checked = checked;
        });

        this.showSection('new');
        this.showStatus('Bearbeitung: ' + lead.firstName + ' ' + lead.lastName, 'warning');
    },

    deleteLead(id) {
        if (!confirm('Lead wirklich löschen?')) return;
        this.leads = this.leads.filter(l => l.id !== id);
        this.saveLeads();
        this.updateStats();
        this.showStatus('Lead gelöscht', 'success');
    },

    // ========================================
    // RENDER
    // ========================================

    renderInterests() {
        const grid = document.getElementById('interestsGrid');
        grid.innerHTML = this.CONFIG.interests.map(i => `
            <label class="interest-chip" id="int-${i.id}">
                <input type="checkbox" name="interests" value="${i.id}"
                       onchange="App.toggleInterest(this)">
                <div class="interest-dot"></div>
                <div>
                    <div class="interest-name">${i.name}</div>
                    <div class="interest-sub">${i.desc}</div>
                </div>
            </label>
        `).join('');
    },

    toggleInterest(checkbox) {
        const chip = checkbox.closest('.interest-chip');
        chip.classList.toggle('selected', checkbox.checked);
    },

    showSection(name) {
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.getElementById(`section-${name}`).classList.add('active');
        document.querySelectorAll('.nav-tab').forEach(n => n.classList.remove('active'));
        document.querySelector(`.nav-tab[data-section="${name}"]`)?.classList.add('active');
        window.scrollTo(0, 0);
        // Leads-Liste immer aktualisieren beim Öffnen
        if (name === 'leads') this.renderLeadsList();
    },

    // ========================================
    // LEADS LIST
    // ========================================

    renderLeadsList() {
        const list = document.getElementById('leadsList');
        const search = document.getElementById('searchInput')?.value.toLowerCase() || '';

        let filtered = this.leads;
        if (search) {
            filtered = this.leads.filter(l =>
                l.firstName.toLowerCase().includes(search) ||
                l.lastName.toLowerCase().includes(search) ||
                l.company.toLowerCase().includes(search) ||
                l.email.toLowerCase().includes(search)
            );
        }

        if (!filtered.length) {
            list.innerHTML = `
                <div class="empty-state">
                    <div style="font-size:48px;margin-bottom:16px">${search ? '🔍' : '🐙'}</div>
                    <div class="empty-state-title">${search ? 'Keine Treffer' : 'Noch keine Leads'}</div>
                    <div>${search ? 'Andere Suche probieren' : 'Ersten Lead erfassen → Erfassen Tab'}</div>
                </div>`;
            return;
        }

        list.innerHTML = filtered.map(lead => {
            let status = 'new', label = 'Neu';
            if ((lead.bantTiming === 'sofort' || lead.bantTiming === 'quartal') && lead.bantBudget === 'vorhanden') {
                status = 'hot'; label = '🔥 Hot';
            } else if (lead.bantNeed === 'konkret' || lead.bantNeed === 'dringend') {
                status = 'warm'; label = 'Warm';
            }

            const initials = (lead.firstName[0] || '') + (lead.lastName[0] || '');
            const tags = lead.interests?.map(id => {
                const i = this.CONFIG.interests.find(x => x.id === id);
                return i ? `<span class="lead-tag">${i.name}</span>` : '';
            }).join('') || '';

            const time = new Date(lead.createdAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

            const badges = [
                `<span class="lead-badge ${status}">${label}</span>`,
                lead.emailSent ? '<span class="lead-badge email">📧</span>' : '',
            ].filter(Boolean).join('');

            const displayName = [lead.title, lead.firstName, lead.lastName].filter(Boolean).join(' ');

            return `
                <div class="lead-card" onclick="App.editLead('${lead.id}')">
                    <div class="lead-card-top">
                        <div class="lead-avatar">${initials}</div>
                        <div class="lead-info">
                            <div class="lead-name">${displayName}</div>
                            <div class="lead-company">${lead.company}</div>
                            <div class="lead-position">${lead.jobTitle || ''}</div>
                        </div>
                        <div class="lead-badges">${badges}</div>
                    </div>
                    ${tags ? `<div class="lead-tags">${tags}</div>` : ''}
                    <div class="lead-meta">
                        <span>${lead.email}</span>
                        <span>${time}</span>
                    </div>
                </div>
            `;
        }).join('');
    },

    filterLeads() { this.renderLeadsList(); },

    // ========================================
    // STORAGE
    // ========================================

    saveLeads() { localStorage.setItem('oktopus_leads_v3', JSON.stringify(this.leads)); },

    loadLeads() {
        const v3 = localStorage.getItem('oktopus_leads_v3');
        const v2 = localStorage.getItem('oktopus_leads_v2');
        const v1 = localStorage.getItem('oktopus_leads_pro');
        if (v3) {
            this.leads = JSON.parse(v3);
        } else if (v2) {
            this.leads = JSON.parse(v2);
            this.saveLeads();
        } else if (v1) {
            this.leads = JSON.parse(v1);
            this.saveLeads();
        }
    },

    updateStats() {
        const total = this.leads.length;
        const hot   = this.leads.filter(l =>
            (l.bantTiming === 'sofort' || l.bantTiming === 'quartal') && l.bantBudget === 'vorhanden'
        ).length;
        const today = this.leads.filter(l => {
            const d = new Date(l.createdAt);
            const now = new Date();
            return d.toDateString() === now.toDateString();
        }).length;
        const emails   = this.leads.filter(l => l.emailSent).length;
        const followups = this.leads.filter(l => l.followUp).length;

        // Header
        document.getElementById('leadCount').textContent = total;
        // Quick Stats
        document.getElementById('qsTotal').textContent   = total;
        document.getElementById('qsHot').textContent     = hot;
        document.getElementById('qsToday').textContent   = today;
        document.getElementById('qsEmails').textContent  = emails;
        // Leads Tab
        document.getElementById('leadsCount').textContent = total;
        // Settings Stats
        document.getElementById('statsTotal').textContent    = total;
        document.getElementById('statsHot').textContent      = hot;
        document.getElementById('statsEmails').textContent   = emails;
        document.getElementById('statsFollowups').textContent = followups;

        this.renderLeadsList();
    },

    // ========================================
    // CSV EXPORT
    // ========================================

    exportCSV() {
        if (!this.leads.length) return this.showStatus('Keine Leads vorhanden', 'error');

        const headers = [
            'Anrede', 'Titel', 'Vorname', 'Nachname', 'Unternehmen', 'Position',
            'E-Mail', 'Telefon', 'Mobil', 'Website', 'Adresse',
            'Interessen', 'CC-Vertriebler', 'Budget', 'Entscheider', 'Bedarf', 'Timing',
            'Notizen', 'Event', 'E-Mail gesendet', 'Follow-up', 'Erstellt'
        ];

        const rows = this.leads.map(l => {
            const interestNames = l.interests?.map(id =>
                this.CONFIG.interests.find(i => i.id === id)?.name
            ).filter(Boolean).join('; ') || '';

            const ccNames = this.getCCRecipients(l.interests || [])
                .map(r => r.name).join('; ');

            return [
                l.salutation || '', l.title || '', l.firstName, l.lastName,
                l.company, l.jobTitle || '',
                l.email, l.phone || '', l.mobile || '', l.website || '', l.address || '',
                interestNames, ccNames,
                l.bantBudget || '', l.bantAuthority || '', l.bantNeed || '', l.bantTiming || '',
                l.notes?.replace(/\n/g, ' ') || '', l.event || '',
                l.emailSent ? 'Ja' : 'Nein', l.followUp ? 'Ja' : 'Nein',
                new Date(l.createdAt).toLocaleString('de-DE')
            ];
        });

        const csv = [headers, ...rows]
            .map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(','))
            .join('\n');

        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `oktopus_leads_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();

        this.showStatus(`${this.leads.length} Leads als CSV exportiert`, 'success');
    },

    // ========================================
    // SETTINGS
    // ========================================

    getSettings() {
        return JSON.parse(localStorage.getItem('oktopus_settings_v3') || '{}');
    },

    loadSettings() {
        const s = this.getSettings();
        if (s.event) {
            document.getElementById('settingsEvent').value  = s.event;
            document.getElementById('eventBadge').textContent = s.event;
        }
        if (s.stand) document.getElementById('settingsStand').value = s.stand;
        if (s.emailEnabled)    document.getElementById('toggleEmail').classList.add('active');
        if (s.calendarEnabled) document.getElementById('toggleCalendar').classList.add('active');
    },

    saveSettings() {
        const s = {
            event: document.getElementById('settingsEvent').value,
            stand:  document.getElementById('settingsStand').value,
            emailEnabled:    document.getElementById('toggleEmail').classList.contains('active'),
            calendarEnabled: document.getElementById('toggleCalendar').classList.contains('active'),
        };
        localStorage.setItem('oktopus_settings_v3', JSON.stringify(s));
        document.getElementById('eventBadge').textContent = s.event;
    },

    toggleSetting(type) {
        const toggleMap = { email: 'toggleEmail', calendar: 'toggleCalendar' };
        const toggle = document.getElementById(toggleMap[type]);
        if (!toggle) return;
        toggle.classList.toggle('active');
        this.saveSettings();
    },

    clearAllData() {
        if (!confirm('Wirklich ALLE Leads und Einstellungen löschen?\nDas kann nicht rückgängig gemacht werden.')) return;
        localStorage.removeItem('oktopus_leads_v3');
        localStorage.removeItem('oktopus_settings_v3');
        this.leads = [];
        this.updateStats();
        this.showStatus('Alle Daten gelöscht', 'success');
    },

    // ========================================
    // TOAST STATUS
    // ========================================

    _toastTimer: null,

    showStatus(msg, type = 'success') {
        const toast = document.getElementById('statusBar');
        const text  = document.getElementById('statusText');
        const icon  = document.getElementById('toastIcon');

        text.textContent = msg;

        // Icon basierend auf Typ
        const icons = {
            success: '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>',
            error:   '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>',
            warning: '<svg viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>',
            loading: '<svg viewBox="0 0 24 24" class="spin"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>',
        };

        icon.innerHTML = icons[type] || icons.success;
        toast.className = 'toast show ' + type;

        clearTimeout(this._toastTimer);
        if (type !== 'loading') {
            this._toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
        }
    }
};

// ========================================
// GLOBAL HANDLERS
// ========================================

async function handleAuthClick() {
    if (App.isAuthenticated) {
        if (confirm('Von Microsoft abmelden?')) {
            await API.logout();
            App.isAuthenticated = false;
            App.currentUser = null;
            await App.checkAuthStatus();
            App.showStatus('Abgemeldet', 'success');
        }
    } else {
        await API.login();
    }
}

// ========================================
// APP START
// ========================================

document.addEventListener('DOMContentLoaded', () => App.init());
