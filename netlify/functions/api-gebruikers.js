// netlify/functions/api-gebruikers.js
const crypto = require('crypto');

let gebruikersCache = {
    "admin": { wachtwoord: "admin123", rol: "admin", naam: "Hoofdbeheerder" }
};
const SESSIONS = new Map();

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Content-Type': 'application/json'
    };
    
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }
    
    // GET - Haal alle gebruikers op
    if (event.httpMethod === 'GET' && !event.queryStringParameters) {
        const authHeader = event.headers.authorization;
        const token = authHeader?.replace('Bearer ', '');
        
        if (!token || !SESSIONS.has(token)) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Niet ingelogd' }) };
        }
        
        const session = SESSIONS.get(token);
        if (session.rol !== 'admin') {
            return { statusCode: 403, headers, body: JSON.stringify({ error: 'Geen admin rechten' }) };
        }
        
        const lijst = Object.entries(gebruikersCache).map(([naam, data]) => ({
            gebruikersnaam: naam,
            naam: data.naam,
            rol: data.rol
        }));
        
        return { statusCode: 200, headers, body: JSON.stringify(lijst) };
    }
    
    // GET /check - Check token
    if (event.httpMethod === 'GET' && event.queryStringParameters?.check === 'true') {
        const authHeader = event.headers.authorization;
        const token = authHeader?.replace('Bearer ', '');
        
        if (token && SESSIONS.has(token)) {
            const session = SESSIONS.get(token);
            return { statusCode: 200, headers, body: JSON.stringify({ valid: true, naam: session.naam, rol: session.rol }) };
        }
        return { statusCode: 401, headers, body: JSON.stringify({ valid: false }) };
    }
    
    // POST /login - Inloggen
    if (event.httpMethod === 'POST' && event.body.includes('"action":"login"')) {
        const body = JSON.parse(event.body);
        const { gebruikersnaam, wachtwoord } = body;
        const user = gebruikersCache[gebruikersnaam];
        
        if (user && user.wachtwoord === wachtwoord) {
            const token = crypto.randomBytes(32).toString('hex');
            SESSIONS.set(token, { gebruikersnaam, rol: user.rol, naam: user.naam });
            setTimeout(() => SESSIONS.delete(token), 24 * 60 * 60 * 1000);
            
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, token, rol: user.rol, naam: user.naam }) };
        }
        
        return { statusCode: 401, headers, body: JSON.stringify({ success: false, error: 'Ongeldige gegevens' }) };
    }
    
    // POST - Nieuwe gebruiker toevoegen (via website)
    if (event.httpMethod === 'POST') {
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
        
        if (gebruikersCache[gebruikersnaam]) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Gebruiker bestaat al' }) };
        }
        
        gebruikersCache[gebruikersnaam] = { wachtwoord, rol: rol || 'staff', naam: naam || gebruikersnaam };
        console.log(`✅ Gebruiker toegevoegd: ${gebruikersnaam}`);
        
        return { statusCode: 201, headers, body: JSON.stringify({ success: true }) };
    }
    
    // DELETE - Verwijder gebruiker
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
        
        delete gebruikersCache[gebruikersnaam];
        console.log(`✅ Gebruiker verwijderd: ${gebruikersnaam}`);
        
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }
    
    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
};