// netlify/functions/users.js
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
    
    const defaultUsers = {
        "admin": { wachtwoord: "admin123", rol: "admin", naam: "Hoofdbeheerder" }
    };
    fs.writeFileSync(GEBRUIKERS_BESTAND, JSON.stringify(defaultUsers, null, 2));
    return defaultUsers;
}

function bewaarGebruikers(gebruikers) {
    fs.writeFileSync(GEBRUIKERS_BESTAND, JSON.stringify(gebruikers, null, 2));
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
    
    // GET - Haal gebruikers op
    if (event.httpMethod === 'GET') {
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
        const userList = Object.entries(gebruikers).map(([username, data]) => ({
            username,
            naam: data.naam,
            rol: data.rol
        }));
        
        return { statusCode: 200, headers, body: JSON.stringify(userList) };
    }
    
    // POST - Login of nieuwe gebruiker
    if (event.httpMethod === 'POST') {
        const body = JSON.parse(event.body);
        
        // LOGIN
        if (body.action === 'login') {
            const { username, password } = body;
            const gebruikers = laadGebruikers();
            const user = gebruikers[username];
            
            if (user && user.wachtwoord === password) {
                const token = crypto.randomBytes(32).toString('hex');
                SESSIONS.set(token, { username, rol: user.rol, naam: user.naam });
                setTimeout(() => SESSIONS.delete(token), 24 * 60 * 60 * 1000);
                
                return { statusCode: 200, headers, body: JSON.stringify({ success: true, token, rol: user.rol }) };
            }
            
            return { statusCode: 401, headers, body: JSON.stringify({ success: false, error: 'Ongeldige inloggegevens' }) };
        }
        
        // NIEUWE GEBRUIKER
        if (body.action === 'add') {
            const authHeader = event.headers.authorization;
            const token = authHeader?.replace('Bearer ', '');
            
            if (!token || !SESSIONS.has(token)) {
                return { statusCode: 401, headers, body: JSON.stringify({ error: 'Niet ingelogd' }) };
            }
            
            const session = SESSIONS.get(token);
            if (session.rol !== 'admin') {
                return { statusCode: 403, headers, body: JSON.stringify({ error: 'Geen admin rechten' }) };
            }
            
            const { username, password, naam, rol } = body;
            const gebruikers = laadGebruikers();
            
            if (gebruikers[username]) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Gebruiker bestaat al' }) };
            }
            
            gebruikers[username] = { wachtwoord: password, rol: rol || 'staff', naam: naam || username };
            bewaarGebruikers(gebruikers);
            
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }
        
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Ongeldige actie' }) };
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
        
        const { username } = JSON.parse(event.body);
        const gebruikers = laadGebruikers();
        
        if (username === 'admin') {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Admin kan niet verwijderd worden' }) };
        }
        
        delete gebruikers[username];
        bewaarGebruikers(gebruikers);
        
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }
    
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
};