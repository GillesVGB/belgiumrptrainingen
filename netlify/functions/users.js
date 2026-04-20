// netlify/functions/users.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Gebruik /tmp voor schrijven (Netlify toestemming)
const GEBRUIKERS_BESTAND = '/tmp/gebruikers.json';
const SESSIONS = new Map();

// Standaard gebruikers
const DEFAULT_USERS = {
    "admin": { wachtwoord: "admin123", rol: "admin", naam: "Hoofdbeheerder" }
};

function laadGebruikers() {
    try {
        if (fs.existsSync(GEBRUIKERS_BESTAND)) {
            const data = fs.readFileSync(GEBRUIKERS_BESTAND, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Fout bij laden gebruikers:', error.message);
    }
    
    // Default gebruikers als bestand niet bestaat
    try {
        fs.writeFileSync(GEBRUIKERS_BESTAND, JSON.stringify(DEFAULT_USERS, null, 2));
    } catch (error) {
        console.error('Fout bij aanmaken gebruikersbestand:', error.message);
    }
    
    return DEFAULT_USERS;
}

function bewaarGebruikers(gebruikers) {
    try {
        fs.writeFileSync(GEBRUIKERS_BESTAND, JSON.stringify(gebruikers, null, 2));
    } catch (error) {
        console.error('Fout bij bewaren gebruikers:', error.message);
    }
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
    
    // GET - Check token
    if (event.httpMethod === 'GET') {
        const authHeader = event.headers.authorization;
        const token = authHeader?.replace('Bearer ', '');
        
        if (token && SESSIONS.has(token)) {
            const session = SESSIONS.get(token);
            return { 
                statusCode: 200, 
                headers, 
                body: JSON.stringify({ valid: true, naam: session.naam, rol: session.rol }) 
            };
        }
        
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Niet ingelogd' }) };
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
                
                return { 
                    statusCode: 200, 
                    headers, 
                    body: JSON.stringify({ success: true, token, rol: user.rol, naam: user.naam }) 
                };
            }
            
            return { 
                statusCode: 401, 
                headers, 
                body: JSON.stringify({ success: false, error: 'Ongeldige gebruikersnaam of wachtwoord' }) 
            };
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