import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.1';

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
        status.textContent = "Sto scaricando il modello (circa 2GB)...";
        
        // Elenco di modelli compatibili con Transformers.js (v2) per image-to-image o text-to-image
        // - 'Xenova/stable-diffusion-v1-5'
        // - 'Xenova/stable-diffusion-2-1-base'
        // NOTA: il task image-to-image reale potrebbe richiedere modelli quantizzati specifici
        const modelName = 'Xenova/stable-diffusion-v1-5'; 
        
        // Attenzione: usare 'image-to-image' o 'text-to-image' a seconda dei modelli supportati
        model = await pipeline('image-to-image', modelName);
        
        status.textContent = "IA Pronta! Usa il modello " + modelName;
    } catch (err) {
        status.textContent = "Errore durante il caricamento del modello.";
        console.error(err);
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
    
    status.textContent = "Generazione...";
    const prompt = promptInput.value || "A high quality masterpiece";
    
    // Convertiamo il canvas in un'immagine che l'IA può leggere
    const imgData = inputCanvas.toDataURL('image/png');
    
    const output = await model(imgData, prompt, {
        strength: 0.5, // Bilanciamento tra disegno e IA (0.1 = fedele al disegno, 0.9 = libera)
        guidance_scale: 7.5,
        num_inference_steps: 4, // Pochi step = Real-time
    });

    // Disegniamo il risultato sul secondo canvas
    const outputCtx = outputCanvas.getContext('2d');
    const resultImg = new Image();
    resultImg.onload = () => outputCtx.drawImage(resultImg, 0, 0);
    resultImg.src = output.uri;
    
    status.textContent = "IA Pronta!";
}

document.getElementById('clearBtn').onclick = () => {
    ctx.clearRect(0, 0, inputCanvas.width, inputCanvas.height);
};

initAI();