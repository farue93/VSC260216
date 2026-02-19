// ============================================
// CAMERA & OCR MODULE
// ============================================
// Tesseract OCR läuft komplett im Browser.
// Kein Backend-Call nötig für die Texterkennung.

const CameraModule = {
    stream: null,

    async init() {
        const zone = document.getElementById('cameraZone');
        const preview = document.getElementById('cameraPreview');
        const video = document.getElementById('cameraVideo');
        const actions = document.getElementById('cameraActions');

        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
            });
            video.srcObject = this.stream;

            zone.classList.add('active');
            document.getElementById('cameraTitle').textContent = 'Kamera aktiv';
            document.getElementById('cameraDesc').textContent = 'Visitenkarte ins Bild halten';

            preview.classList.add('show');
            video.style.display = 'block';
            document.getElementById('capturedImage').style.display = 'none';
            actions.style.display = 'flex';

        } catch (err) {
            console.error('Kamera-Fehler:', err);
            App.showStatus('Kamera nicht verfügbar (HTTPS erforderlich)', 'error');
        }
    },

    capture() {
        const video = document.getElementById('cameraVideo');
        const canvas = document.getElementById('cameraCanvas');
        const img = document.getElementById('capturedImage');

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        img.src = dataUrl;
        img.style.display = 'block';
        video.style.display = 'none';

        if (this.stream) {
            this.stream.getTracks().forEach(t => t.stop());
            this.stream = null;
        }

        document.getElementById('cameraActions').innerHTML = `
            <button class="btn btn-ghost" onclick="CameraModule.retake()">↺ Neu</button>
            <button class="btn btn-accent" onclick="CameraModule.runOCR()">🔍 Text erkennen</button>
        `;

        App.showStatus('Foto aufgenommen', 'success');
    },

    retake() {
        document.getElementById('cameraPreview').classList.remove('show');
        document.getElementById('cameraActions').style.display = 'none';
        document.getElementById('cameraZone').classList.remove('active');
        document.getElementById('cameraTitle').textContent = 'Antippen zum Scannen';
        document.getElementById('cameraDesc').textContent = 'Visitenkarte ins Bild halten';
        document.getElementById('ocrProgress').classList.remove('show');

        document.getElementById('cameraActions').innerHTML = `
            <button class="btn btn-ghost" onclick="CameraModule.retake()">↺ Neu</button>
            <button class="btn btn-accent" onclick="CameraModule.capture()">📷 Aufnehmen</button>
        `;

        this.init();
    },

    async runOCR() {
        const img = document.getElementById('capturedImage');
        const progress = document.getElementById('ocrProgress');
        const ocrText = document.getElementById('ocrText');
        const ocrPercent = document.getElementById('ocrPercent');

        progress.classList.add('show');
        ocrText.textContent = 'Texterkennung wird gestartet...';

        try {
            const result = await Tesseract.recognize(img.src, 'deu+eng', {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        const pct = Math.round(m.progress * 100);
                        ocrPercent.textContent = pct + '%';
                        ocrText.textContent = 'Texterkennung läuft...';
                    }
                }
            });

            this.parseOCRResult(result.data.text);
            ocrText.textContent = 'Fertig! Formular wurde ausgefüllt.';
            ocrPercent.textContent = '100%';

            setTimeout(() => progress.classList.remove('show'), 2000);
            App.showStatus('Visitenkarte erkannt', 'success');

        } catch (err) {
            console.error('OCR Fehler:', err);
            ocrText.textContent = 'Fehler bei der Texterkennung';
            App.showStatus('OCR fehlgeschlagen', 'error');
        }
    },

    parseOCRResult(text) {
        console.log('OCR Text:', text);
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        // Email
        const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        if (emailMatch) this.setField('email', emailMatch[0]);

        // Phone
        const phonePatterns = text.match(/(?:\+49|0049|0)[\s.-]?\d{2,4}[\s.-]?\d{3,}[\s.-]?\d{0,}/g);
        if (phonePatterns) {
            if (phonePatterns[0]) this.setField('phone', phonePatterns[0].replace(/\s+/g, ' '));
            if (phonePatterns[1]) this.setField('mobile', phonePatterns[1].replace(/\s+/g, ' '));
        }

        // Website
        const webMatch = text.match(/(?:www\.|https?:\/\/)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i);
        if (webMatch) this.setField('website', webMatch[0]);

        // Title
        if (/\bProf\.\s*Dr\./i.test(text)) document.getElementById('title').value = 'Prof. Dr.';
        else if (/\bProf\.\s/i.test(text)) document.getElementById('title').value = 'Prof.';
        else if (/\bDr\.\s/i.test(text)) document.getElementById('title').value = 'Dr.';
        else if (/\bDipl\.-Ing\./i.test(text)) document.getElementById('title').value = 'Dipl.-Ing.';

        // Company
        const companyPatterns = [/GmbH/i, /AG\b/i, /KG\b/i, /SE\b/i, /Inc\./i, /Ltd\./i, /Stadtwerke/i, /Group/i];
        for (const line of lines) {
            if (companyPatterns.some(p => p.test(line))) {
                this.setField('company', line);
                break;
            }
        }

        // Position
        const positionKeywords = ['Leiter', 'Manager', 'Director', 'Geschäftsführ', 'CEO', 'CTO', 'Head of', 'Abteilungsleiter', 'Bereichsleiter', 'Vertrieb', 'Einkauf'];
        for (const line of lines) {
            if (positionKeywords.some(k => line.toLowerCase().includes(k.toLowerCase()))) {
                this.setField('jobTitle', line);
                break;
            }
        }

        // Name
        for (const line of lines.slice(0, 4)) {
            const words = line.split(/\s+/);
            if (words.length >= 2 && words.length <= 4
                && !line.includes('@') && !line.includes('www')
                && !companyPatterns.some(p => p.test(line))
                && !/\d{4,}/.test(line)) {

                let nameWords = [...words];
                const titlePrefixes = ['Dr.', 'Prof.', 'Dipl.-Ing.', 'MBA'];
                while (titlePrefixes.includes(nameWords[0]) && nameWords.length > 2) {
                    nameWords.shift();
                }

                if (nameWords.length >= 2) {
                    this.setField('firstName', nameWords[0]);
                    this.setField('lastName', nameWords.slice(1).join(' '));

                    const femaleNames = ['Anna', 'Maria', 'Sabine', 'Lisa', 'Julia', 'Sarah', 'Laura', 'Petra', 'Claudia'];
                    const maleNames = ['Michael', 'Thomas', 'Klaus', 'Peter', 'Andreas', 'Stefan', 'Markus', 'Martin', 'Frank'];
                    if (femaleNames.some(n => nameWords[0].includes(n))) document.getElementById('salutation').value = 'Frau';
                    else if (maleNames.some(n => nameWords[0].includes(n))) document.getElementById('salutation').value = 'Herr';
                    break;
                }
            }
        }

        // Address
        const addressMatch = text.match(/\d{5}\s+[A-ZÄÖÜ][a-zäöüß]+/);
        if (addressMatch) {
            for (const line of lines) {
                if (line.includes(addressMatch[0])) {
                    this.setField('address', line);
                    break;
                }
            }
        }
    },

    setField(fieldId, value) {
        const field = document.getElementById(fieldId);
        if (field && value) {
            field.value = value;
            field.classList.add('autofilled');
            setTimeout(() => field.classList.remove('autofilled'), 3000);
        }
    },

    reset() {
        if (this.stream) {
            this.stream.getTracks().forEach(t => t.stop());
            this.stream = null;
        }
        document.getElementById('cameraPreview').classList.remove('show');
        document.getElementById('cameraActions').style.display = 'none';
        document.getElementById('cameraZone').classList.remove('active');
        document.getElementById('cameraTitle').textContent = 'Antippen zum Scannen';
        document.getElementById('cameraDesc').textContent = 'Visitenkarte ins Bild halten';
        document.getElementById('ocrProgress').classList.remove('show');
    }
};
