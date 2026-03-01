import { pipeline } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';

// Elementi DOM
const inputCanvas = document.getElementById('inputCanvas');
const outputCanvas = document.getElementById('outputCanvas');
const ctx = inputCanvas.getContext('2d');
const status = document.getElementById('status');

// Stato
let drawing = false;
let model;
let isGenerating = false;

// --- 1. INIZIALIZZAZIONE IA ---
async function initAI() {
    status.textContent = "Download modello in corso...";
    try {
        // NOTA: WebGPU sta causando crash di memoria ('mapAsync' su GPUBuffer), 
        // per cui blocchiamo temporaneamente in 'wasm' (CPU) con q8.
        const device = 'wasm';
        const dtype = 'q8';
        console.log(`Inizializzazione AI forzata a: device: ${device}, dtype: ${dtype}`);

        const opts = {
            device: device,
            dtype: dtype,
            progress_callback: (info) => {
                if (info.status === 'downloading' && info.total) {
                    const pct = Math.round((info.loaded / info.total) * 100);
                    status.textContent = `Download: ${pct}%`;
                } else if (info.status === 'loading') {
                    status.textContent = `Caricamento in memoria (${device})...`;
                }
            }
        };
        model = await pipeline('image-to-image', 'Xenova/swin2SR-classical-sr-x2-64', opts);
        status.textContent = "IA Pronta! Disegna qualcosa...";
    } catch (err) {
        status.textContent = "Errore caricamento modello.";
        console.error("Init Error:", err);
    }
}

// --- 2. LOGICA DISEGNO ---
inputCanvas.addEventListener('mousedown', () => drawing = true);
inputCanvas.addEventListener('mouseup', () => {
    drawing = false;
    ctx.beginPath();
    generateImage();
});
inputCanvas.addEventListener('mousemove', draw);

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

// --- 3. GENERAZIONE AI ---
async function generateImage() {
    if (!model || isGenerating) return;
    isGenerating = true;
    status.textContent = "Generazione in corso...";

    try {
        console.time('Generazione Immagine');
        console.log('Inizio generazione, attendere (il browser potrebbe freezare per qualche secondo)...');

        // --- 1. RIDUZIONE RISOLUZIONE ---
        // Il Canvas è grande (512x512), ma i modelli SR in WASM esplodono o ci mettono minuti.
        // Ridimensioniamo a una griglia compatibile col modello (Swin2SR-64 = input 64x64 nativo)
        const lowResSize = 64;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = lowResSize;
        tempCanvas.height = lowResSize;
        const tCtx = tempCanvas.getContext('2d');
        tCtx.fillStyle = 'white'; // Sfondo bianco invece che trasparente
        tCtx.fillRect(0, 0, lowResSize, lowResSize);
        tCtx.drawImage(inputCanvas, 0, 0, lowResSize, lowResSize);

        // Estrae l'immagine 64x64 in JPEG
        const imgDataUrl = tempCanvas.toDataURL('image/jpeg', 0.9);

        // Start Inference
        const start = performance.now();
        const rawOutput = await model(imgDataUrl);
        const end = performance.now();

        console.log(`Generazione completata in ${((end - start) / 1000).toFixed(2)} secondi.`);
        console.timeEnd('Generazione Immagine');

        // Gestisce sia array [RawImage] sia singolo RawImage
        const img = Array.isArray(rawOutput) ? rawOutput[0] : rawOutput;
        const { data, width, height, channels } = img;

        const outputCtx = outputCanvas.getContext('2d');
        outputCanvas.width = width;
        outputCanvas.height = height;

        // Converte dati RGB/RGBA in ImageData per il canvas
        const imageData = new ImageData(width, height);
        const ch = channels || 3;
        for (let i = 0; i < width * height; i++) {
            imageData.data[i * 4 + 0] = data[i * ch + 0]; // R
            imageData.data[i * 4 + 1] = data[i * ch + 1]; // G
            imageData.data[i * 4 + 2] = data[i * ch + 2]; // B
            imageData.data[i * 4 + 3] = ch === 4 ? data[i * ch + 3] : 255; // A
        }
        outputCtx.putImageData(imageData, 0, 0);

        status.textContent = "IA Pronta! Disegna ancora...";
    } catch (err) {
        status.textContent = "Errore generazione: " + err.message;
        console.error("Inference Error:", err);
    }

    isGenerating = false;
}

document.getElementById('clearBtn').onclick = () => {
    // Fill background with white instead of letting it be transparent
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, inputCanvas.width, inputCanvas.height);
    outputCanvas.getContext('2d').clearRect(0, 0, outputCanvas.width, outputCanvas.height);
};

// Inizializza sfondo bianco per il canvas di input anziché trasparente
ctx.fillStyle = 'white';
ctx.fillRect(0, 0, inputCanvas.width, inputCanvas.height);

initAI();