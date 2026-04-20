// netlify/functions/users.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Lees gebruikers uit database map (alleen-lezen!)
const GEBRUIKERS_BESTAND = path.join(__dirname, '..', '..', 'database', 'gebruikers.json');

function laadGebruikers() {
    try {
        if (fs.existsSync(GEBRUIKERS_BESTAND)) {
            const data = fs.readFileSync(GEBRUIKERS_BESTAND, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Fout bij laden gebruikers:', error.message);
    }
    
    // Fallback
    return {
        "admin": { wachtwoord: "admin123", rol: "admin", naam: "Hoofdbeheerder" }
    };
}

// Sessies in geheugen
const SESSIONS = new Map();

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
    
    // GET - Check token of haal gebruikers op
    if (event.httpMethod === 'GET') {
        const authHeader = event.headers.authorization;
        const token = authHeader?.replace('Bearer ', '');
        
        // Check voor validatie
        if (event.queryStringParameters?.check === 'true') {
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
        
        // Gebruikerslijst ophalen (alleen ingelogde admins)
        if (token && SESSIONS.has(token)) {
            const session = SESSIONS.get(token);
            if (session.rol === 'admin') {
                const gebruikers = laadGebruikers();
                const userList = Object.entries(gebruikers).map(([username, data]) => ({
                    username,
                    naam: data.naam,
                    rol: data.rol
                }));
                return { statusCode: 200, headers, body: JSON.stringify(userList) };
            }
        }
        
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Niet ingelogd' }) };
    }
    
    // POST - Login
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
        
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Ongeldige actie' }) };
    }
    
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
};