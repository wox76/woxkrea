// Elementi DOM
const inputCanvas = document.getElementById('inputCanvas');
const outputCanvas = document.getElementById('outputCanvas');
const ctx = inputCanvas.getContext('2d');
const status = document.getElementById('status');
const promptInput = document.getElementById('prompt');
const hfTokenInput = document.getElementById('hfToken');

// Endpoint per modello Image-to-Image veloce e generativo
// Utilizziamo le API Serverless di HF. Il modello "stabilityai/stable-diffusion-xl-base-1.0" 
// per img2img tramite Inference API. (Altrimenti LCM-LoRA per max velocità)
const HF_MODEL_URL = 'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-refiner-1.0';

// Stato
let drawing = false;
let isGenerating = false;
let debounceTimer = null;

status.textContent = "IA Pronta! Inserisci il token HF e disegna...";

// --- LOGICA DISEGNO ---
inputCanvas.addEventListener('mousedown', () => drawing = true);
inputCanvas.addEventListener('mouseup', () => {
    drawing = false;
    ctx.beginPath();

    // Debounce: Inizia la generazione 500ms dopo l'ultimo tratto per non intasare l'API
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        generateImage();
    }, 500);
});
inputCanvas.addEventListener('mousemove', draw);
promptInput.addEventListener('change', () => {
    if (!drawing) generateImage();
});

function draw(e) {
    if (!drawing) return;
    ctx.lineWidth = document.getElementById('brushSize').value;
    ctx.lineCap = 'round';
    ctx.strokeStyle = document.getElementById('colorPicker').value;
    const rect = inputCanvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
}

// Converti Canvas in Blob
function getCanvasBlob(canvas) {
    // Esporta il canvas intero a risoluzione nativa
    return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
}

// --- GENERAZIONE AI TRAMITE API ---
async function generateImage() {
    const token = hfTokenInput ? hfTokenInput.value.trim() : "";
    if (!token) {
        status.textContent = "Errore: Inserisci il token Hugging Face nel box in alto per generare via Server!";
        return;
    }

    if (isGenerating) return;
    isGenerating = true;
    status.textContent = "Generazione Cloud in corso...";
    console.time('Generazione Immagine API');

    try {
        const imageBlob = await getCanvasBlob(inputCanvas);
        const promptText = promptInput.value || "A beautiful highly detailed digital painting";

        // Modalità API per image-to-image (generalmente FormData o JSON con field inputs).
        // HuggingFace Inference API per Image-to-Text accetta FormData e per Image-to-Image varia a seconda del modello.
        // Proviamo il passaggio JSON (image encodata base64) che è uno standard diffuso,
        // oppure chiamiamo il modello passandogli il blob con header Custom.

        const b64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(imageBlob);
        });

        const requestBody = JSON.stringify({
            inputs: promptText,
            parameters: {
                image: b64, // Questo non tutti i modelli lo accettano, ma è il default di Diffusers
                // strength: 0.8
            }
        });

        const response = await fetch(HF_MODEL_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: requestBody
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Errore API ${response.status}: ${errText}`);
        }

        const outBlob = await response.blob();

        // Controlla se abbiamo beccato l'errore JSON "Model is loading"
        if (outBlob.type.startsWith('application/json')) {
            const text = await outBlob.text();
            throw new Error("Risposta anomala JSON: " + text);
        }

        const outUrl = URL.createObjectURL(outBlob);

        // Disegna l'immagine risultante sul canvas di output
        const outputCtx = outputCanvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
            outputCtx.imageSmoothingEnabled = true;
            outputCtx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
            outputCtx.drawImage(img, 0, 0, outputCanvas.width, outputCanvas.height);
            URL.revokeObjectURL(outUrl);
            status.textContent = "IA Pronta! Disegna ancora...";
            console.timeEnd('Generazione Immagine API');
            isGenerating = false;
        };
        img.onerror = () => {
            throw new Error("Impossibile caricare l'immagine generata.");
        };
        img.src = outUrl;

    } catch (err) {
        status.textContent = "Errore Server: " + err.message;
        console.error("Inference API Error:", err);
        isGenerating = false;
        console.timeEnd('Generazione Immagine API');
    }
}

document.getElementById('clearBtn').onclick = () => {
    // Sfondo bianco invece che trasparente
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, inputCanvas.width, inputCanvas.height);
    outputCanvas.getContext('2d').clearRect(0, 0, outputCanvas.width, outputCanvas.height);
};

// Inizializza sfondo bianco per il canvas di input
ctx.fillStyle = 'white';
ctx.fillRect(0, 0, inputCanvas.width, inputCanvas.height);