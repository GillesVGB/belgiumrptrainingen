// netlify/functions/api-gebruikers.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const GEBRUIKERS_BESTAND = path.join(__dirname, '..', '..', 'database', 'gebruikers.json');
const SESSIONS = new Map();

function laadGebruikers() {
    try {
        if (fs.existsSync(GEBRUIKERS_BESTAND)) {
            return JSON.parse(fs.readFileSync(GEBRUIKERS_BESTAND, 'utf8'));
        }
    } catch (error) {}
    return {
        "admin": { wachtwoord: "admin123", rol: "admin", naam: "Hoofdbeheerder" }
    };
}

function bewaarGebruikers(gebruikers) {
    try {
        fs.writeFileSync(GEBRUIKERS_BESTAND, JSON.stringify(gebruikers, null, 2));
    } catch (error) {}
}

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Content-Type': 'application/json'
    };
    
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }
    
    const url = new URL(event.rawUrl);
    const pad = url.pathname.replace('/.netlify/functions/api-gebruikers', '');
    
    // GET /api/gebruikers - Haal alle gebruikers op
    if (event.httpMethod === 'GET' && pad === '') {
        const authHeader = event.headers.authorization;
        const token = authHeader?.replace('Bearer ', '');
        
        if (!token || !SESSIONS.has(token)) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Niet ingelogd' }) };
        }
        
        const session = SESSIONS.get(token);
        if (session.rol !== 'admin') {
            return { statusCode: 403, headers, body: JSON.stringify({ error: 'Geen admin rechten' }) };
        }
        
        const gebruikers = laadGebruikers();
        const lijst = Object.entries(gebruikers).map(([naam, data]) => ({
            gebruikersnaam: naam,
            naam: data.naam,
            rol: data.rol
        }));
        
        return { statusCode: 200, headers, body: JSON.stringify(lijst) };
    }
    
    // POST /api/gebruikers/login - Inloggen
    if (event.httpMethod === 'POST' && pad === '/login') {
        const body = JSON.parse(event.body);
        const { gebruikersnaam, wachtwoord } = body;
        const gebruikers = laadGebruikers();
        const user = gebruikers[gebruikersnaam];
        
        if (user && user.wachtwoord === wachtwoord) {
            const token = crypto.randomBytes(32).toString('hex');
            SESSIONS.set(token, { gebruikersnaam, rol: user.rol, naam: user.naam });
            setTimeout(() => SESSIONS.delete(token), 24 * 60 * 60 * 1000);
            
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, token, rol: user.rol, naam: user.naam }) };
        }
        
        return { statusCode: 401, headers, body: JSON.stringify({ success: false, error: 'Ongeldige gegevens' }) };
    }
    
    // POST /api/gebruikers - Nieuwe gebruiker toevoegen
    if (event.httpMethod === 'POST' && pad === '') {
        const authHeader = event.headers.authorization;
        const token = authHeader?.replace('Bearer ', '');
        
        if (!token || !SESSIONS.has(token)) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Niet ingelogd' }) };
        }
        
        const session = SESSIONS.get(token);
        if (session.rol !== 'admin') {
            return { statusCode: 403, headers, body: JSON.stringify({ error: 'Geen admin rechten' }) };
        }
        
        const body = JSON.parse(event.body);
        const { gebruikersnaam, wachtwoord, naam, rol } = body;
        const gebruikers = laadGebruikers();
        
        if (gebruikers[gebruikersnaam]) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Gebruiker bestaat al' }) };
        }
        
        gebruikers[gebruikersnaam] = { wachtwoord, rol: rol || 'staff', naam: naam || gebruikersnaam };
        bewaarGebruikers(gebruikers);
        
        return { statusCode: 201, headers, body: JSON.stringify({ success: true }) };
    }
    
    // DELETE /api/gebruikers?gebruikersnaam=xxx - Verwijder gebruiker
    if (event.httpMethod === 'DELETE') {
        const authHeader = event.headers.authorization;
        const token = authHeader?.replace('Bearer ', '');
        
        if (!token || !SESSIONS.has(token)) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Niet ingelogd' }) };
        }
        
        const session = SESSIONS.get(token);
        if (session.rol !== 'admin') {
            return { statusCode: 403, headers, body: JSON.stringify({ error: 'Geen admin rechten' }) };
        }
        
        const gebruikersnaam = event.queryStringParameters?.gebruikersnaam;
        if (!gebruikersnaam) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Gebruikersnaam verplicht' }) };
        }
        
        if (gebruikersnaam === 'admin') {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Admin kan niet verwijderd worden' }) };
        }
        
        const gebruikers = laadGebruikers();
        delete gebruikers[gebruikersnaam];
        bewaarGebruikers(gebruikers);
        
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }
    
    // GET /api/gebruikers/check - Check token
    if (event.httpMethod === 'GET' && pad === '/check') {
        const authHeader = event.headers.authorization;
        const token = authHeader?.replace('Bearer ', '');
        
        if (token && SESSIONS.has(token)) {
            const session = SESSIONS.get(token);
            return { statusCode: 200, headers, body: JSON.stringify({ valid: true, naam: session.naam, rol: session.rol }) };
        }
        
        return { statusCode: 401, headers, body: JSON.stringify({ valid: false }) };
    }
    
    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
};