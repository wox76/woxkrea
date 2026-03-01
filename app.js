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
        model = await pipeline('image-to-image', 'Xenova/swin2SR-classical-sr-x2-64', {
            dtype: 'fp32',
            progress_callback: (info) => {
                if (info.status === 'downloading' && info.total) {
                    const pct = Math.round((info.loaded / info.total) * 100);
                    status.textContent = `Download: ${pct}%`;
                } else if (info.status === 'loading') {
                    status.textContent = 'Caricamento in memoria...';
                }
            }
        });
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
        const imgDataUrl = inputCanvas.toDataURL('image/png');

        // L'output di Swin2SR è un oggetto RawImage con .data, .width, .height, .channels
        const rawOutput = await model(imgDataUrl);

        // Disegniamo a partire dai dati RGB grezzi
        const { data, width, height, channels } = rawOutput;
        const outputCtx = outputCanvas.getContext('2d');
        outputCanvas.width = width;
        outputCanvas.height = height;

        // Converte dati RGB/RGBA in ImageData per il canvas
        const imageData = new ImageData(width, height);
        for (let i = 0; i < width * height; i++) {
            imageData.data[i * 4 + 0] = data[i * channels + 0]; // R
            imageData.data[i * 4 + 1] = data[i * channels + 1]; // G
            imageData.data[i * 4 + 2] = data[i * channels + 2]; // B
            imageData.data[i * 4 + 3] = 255;                    // A
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
    ctx.clearRect(0, 0, inputCanvas.width, inputCanvas.height);
    outputCanvas.getContext('2d').clearRect(0, 0, outputCanvas.width, outputCanvas.height);
};

initAI();