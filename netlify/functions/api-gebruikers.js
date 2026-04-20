// netlify/functions/api-gebruikers.js
const crypto = require('crypto');

// Gebruikers in geheugen (bij koude start wordt dit gereset)
let gebruikersCache = {
    "admin": { 
        wachtwoord: "admin123", 
        rol: "admin", 
        naam: "Hoofdbeheerder" 
    }
};

// Actieve sessies (tijdelijke tokens)
const SESSIONS = new Map();

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Content-Type': 'application/json'
    };
    
    // OPTIONS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }
    
    // Bepaal het pad (voor /login en /check)
    const url = new URL(event.rawUrl);
    const pathname = url.pathname;
    const isLoginEndpoint = pathname.endsWith('/login');
    const isCheckEndpoint = pathname.endsWith('/check');
    
    // ============================================
    // GET - Gebruikers ophalen of token checken
    // ============================================
    if (event.httpMethod === 'GET') {
        // CHECK ENDPOINT - Token validatie
        if (isCheckEndpoint) {
            const authHeader = event.headers.authorization;
            const token = authHeader?.replace('Bearer ', '');
            
            if (token && SESSIONS.has(token)) {
                const session = SESSIONS.get(token);
                return { 
                    statusCode: 200, 
                    headers, 
                    body: JSON.stringify({ 
                        valid: true, 
                        naam: session.naam, 
                        rol: session.rol,
                        gebruikersnaam: session.gebruikersnaam
                    }) 
                };
            }
            return { statusCode: 401, headers, body: JSON.stringify({ valid: false }) };
        }
        
        // GET ALLE GEBRUIKERS - Alleen voor ingelogde admins
        const authHeader = event.headers.authorization;
        const token = authHeader?.replace('Bearer ', '');
        
        if (!token || !SESSIONS.has(token)) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Niet ingelogd' }) };
        }
        
        const session = SESSIONS.get(token);
        if (session.rol !== 'admin') {
            return { statusCode: 403, headers, body: JSON.stringify({ error: 'Geen admin rechten' }) };
        }
        
        const gebruikersLijst = Object.entries(gebruikersCache).map(([naam, data]) => ({
            gebruikersnaam: naam,
            naam: data.naam,
            rol: data.rol
        }));
        
        return { statusCode: 200, headers, body: JSON.stringify(gebruikersLijst) };
    }
    
    // ============================================
    // POST - Login of nieuwe gebruiker toevoegen
    // ============================================
    if (event.httpMethod === 'POST') {
        const body = JSON.parse(event.body);
        
        // LOGIN ENDPOINT
        if (isLoginEndpoint || body.action === 'login') {
            const { gebruikersnaam, wachtwoord } = body;
            const user = gebruikersCache[gebruikersnaam];
            
            if (user && user.wachtwoord === wachtwoord) {
                const token = crypto.randomBytes(32).toString('hex');
                SESSIONS.set(token, { 
                    gebruikersnaam: gebruikersnaam, 
                    rol: user.rol, 
                    naam: user.naam 
                });
                
                // Token vervalt na 24 uur
                setTimeout(() => SESSIONS.delete(token), 24 * 60 * 60 * 1000);
                
                return { 
                    statusCode: 200, 
                    headers, 
                    body: JSON.stringify({ 
                        success: true, 
                        token: token, 
                        rol: user.rol, 
                        naam: user.naam,
                        gebruikersnaam: gebruikersnaam
                    }) 
                };
            }
            
            return { 
                statusCode: 401, 
                headers, 
                body: JSON.stringify({ 
                    success: false, 
                    error: 'Ongeldige gebruikersnaam of wachtwoord' 
                }) 
            };
        }
        
        // SYNC VAN DISCORD BOT (volledige lijst overschrijven)
        if (body.action === 'sync' && body.gebruikers) {
            gebruikersCache = body.gebruikers;
            console.log(`✅ Synced ${Object.keys(gebruikersCache).length} gebruikers van Discord`);
            return { 
                statusCode: 200, 
                headers, 
                body: JSON.stringify({ success: true, count: Object.keys(gebruikersCache).length }) 
            };
        }
        
        // NIEUWE GEBRUIKER TOEVOEGEN (via Discord command)
        if (body.gebruikersnaam && body.wachtwoord) {
            const { gebruikersnaam, wachtwoord, naam, rol } = body;
            
            if (gebruikersCache[gebruikersnaam]) {
                return { 
                    statusCode: 400, 
                    headers, 
                    body: JSON.stringify({ error: 'Gebruiker bestaat al' }) 
                };
            }
            
            gebruikersCache[gebruikersnaam] = { 
                wachtwoord: wachtwoord, 
                rol: rol || 'staff', 
                naam: naam || gebruikersnaam 
            };
            
            console.log(`✅ Nieuwe gebruiker toegevoegd: ${gebruikersnaam} (${rol || 'staff'})`);
            
            return { 
                statusCode: 201, 
                headers, 
                body: JSON.stringify({ success: true }) 
            };
        }
        
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Ongeldige aanvraag' }) };
    }
    
    // ============================================
    // PUT - Gebruiker bijwerken
    // ============================================
    if (event.httpMethod === 'PUT') {
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
        const { gebruikersnaam, naam, rol } = body;
        
        if (!gebruikersCache[gebruikersnaam]) {
            return { statusCode: 404, headers, body: JSON.stringify({ error: 'Gebruiker niet gevonden' }) };
        }
        
        if (naam) gebruikersCache[gebruikersnaam].naam = naam;
        if (rol) gebruikersCache[gebruikersnaam].rol = rol;
        
        console.log(`✅ Gebruiker bijgewerkt: ${gebruikersnaam}`);
        
        return { 
            statusCode: 200, 
            headers, 
            body: JSON.stringify({ success: true }) 
        };
    }
    
    // ============================================
    // DELETE - Gebruiker verwijderen
    // ============================================
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
        
        if (!gebruikersCache[gebruikersnaam]) {
            return { statusCode: 404, headers, body: JSON.stringify({ error: 'Gebruiker niet gevonden' }) };
        }
        
        delete gebruikersCache[gebruikersnaam];
        console.log(`✅ Gebruiker verwijderd: ${gebruikersnaam}`);
        
        return { 
            statusCode: 200, 
            headers, 
            body: JSON.stringify({ success: true }) 
        };
    }
    
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
};