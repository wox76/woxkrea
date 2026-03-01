import { pipeline } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';

// Elementi DOM
const inputCanvas = document.getElementById('inputCanvas');
const outputCanvas = document.getElementById('outputCanvas');
const ctx = inputCanvas.getContext('2d');
const promptInput = document.getElementById('prompt');
const status = document.getElementById('status');

// Stato Pennello
let drawing = false;
let model;

// --- 1. INIZIALIZZAZIONE IA ---
async function initAI() {
    try {
        status.textContent = "Inizializzazione WebGPU...";
        const modelName = 'Xenova/swin2SR-classical-sr-x2-64';

        status.textContent = "Download modello in corso...";

        model = await pipeline('image-to-image', modelName, {
            device: 'webgpu', // Sfrutta la tua RTX 4090!
            progress_callback: (info) => {
                if (info.status === 'downloading' && info.total) {
                    const pct = Math.round((info.loaded / info.total) * 100);
                    status.textContent = `Download: ${pct}%`;
                }
            }
        });

        status.textContent = "IA Pronta! (WebGPU attiva)";
    } catch (err) {
        status.textContent = "WebGPU non disponibile. Uso CPU...";
        console.warn("WebGPU Error:", err);
        model = await pipeline('image-to-image', 'Xenova/swin2SR-classical-sr-x2-64');
        status.textContent = "IA Pronta! (CPU)";
    }
}

// --- 2. LOGICA DISEGNO ---
inputCanvas.addEventListener('mousedown', () => drawing = true);
inputCanvas.addEventListener('mouseup', () => {
    drawing = false;
    ctx.beginPath();
    generateImage(); // Genera quando l'utente alza il pennello
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
    if (!model) return;

    try {
        status.textContent = "Generazione in corso...";

        // Swin2SR è un modello di Upscaling
        const output = await model(inputCanvas.toDataURL('image/png'));

        // Disegniamo il risultato sul secondo canvas
        const outputCtx = outputCanvas.getContext('2d');

        // In Transformers.js v3, l'output di image-to-image può essere convertito in canvas
        const img = await output.toCanvas();
        outputCtx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
        outputCtx.drawImage(img, 0, 0, outputCanvas.width, outputCanvas.height);

        status.textContent = "IA Pronta!";
    } catch (err) {
        status.textContent = "Errore generazione.";
        console.error("Inference Error:", err);
    }
}

document.getElementById('clearBtn').onclick = () => {
    ctx.clearRect(0, 0, inputCanvas.width, inputCanvas.height);
    const outputCtx = outputCanvas.getContext('2d');
    outputCtx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
};

initAI();