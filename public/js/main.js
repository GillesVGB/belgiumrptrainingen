// API basis URL
const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000/api'
    : 'https://JOUW-NETLIFY-URL.netlify.app/api'; // Verander dit later

// Laad trainingen
async function loadTrainings() {
    try {
        const response = await fetch('/api/trainingen');
        const trainingen = await response.json();
        return trainingen;
    } catch (error) {
        console.error('Fout bij laden:', error);
        return [];
    }
}

// Toon notificatie
function showNotification(message, type = 'info') {
    // Implementeer notificaties
    console.log(`[${type}] ${message}`);
}

// Format datum
function formatDate(dateString) {
    return dateString || 'Onbekend';
}

// Exporteer functies
window.trainingApp = {
    loadTrainings,
    showNotification,
    formatDate
};