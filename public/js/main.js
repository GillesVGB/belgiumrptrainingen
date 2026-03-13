// API basis URL
const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000/api'
    : 'https://belgium-roleplay.netlify.app/.netlify/functions/api';

// Laad trainingen
async function loadTrainings() {
    try {
        // GEBRUIK API_URL hier!
        const response = await fetch(`${API_URL}/trainingen`);
        const trainingen = await response.json();
        return trainingen;
    } catch (error) {
        console.error('Fout bij laden:', error);
        return [];
    }
}

// Toon notificatie
function showNotification(message, type = 'info') {
    console.log(`[${type}] ${message}`);
    // Je kunt hier later een mooie popup maken
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

// Automatisch trainingen laden bij start
document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ Training app geladen, API URL:', API_URL);
});