// netlify/functions/api-gebruikers.js
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Verwijder oude sessies elke uur
setInterval(async () => {
    const now = Date.now();
    await supabase.from('sessies').delete().lt('vervalt_op', now);
}, 60 * 60 * 1000);

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
    
    const url = new URL(event.rawUrl);
    const pathname = url.pathname;
    const isLoginEndpoint = pathname.endsWith('/login');
    const isCheckEndpoint = pathname.endsWith('/check');
    
    // GET - Check token of gebruikers ophalen
    if (event.httpMethod === 'GET') {
        // CHECK TOKEN
        if (isCheckEndpoint) {
            const authHeader = event.headers.authorization;
            const token = authHeader?.replace('Bearer ', '');
            
            if (token) {
                const { data, error } = await supabase
                    .from('sessies')
                    .select('*')
                    .eq('token', token)
                    .single();
                
                if (data && data.vervalt_op > Date.now()) {
                    return { 
                        statusCode: 200, 
                        headers, 
                        body: JSON.stringify({ 
                            valid: true, 
                            naam: data.naam, 
                            rol: data.rol,
                            gebruikersnaam: data.gebruikersnaam
                        }) 
                    };
                }
            }
            return { statusCode: 401, headers, body: JSON.stringify({ valid: false }) };
        }
        
        // ALLE GEBRUIKERS OPHALEN
        const authHeader = event.headers.authorization;
        const token = authHeader?.replace('Bearer ', '');
        
        if (!token) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Niet ingelogd' }) };
        }
        
        const { data: session, error: sessionError } = await supabase
            .from('sessies')
            .select('rol')
            .eq('token', token)
            .single();
        
        if (!session || session.rol !== 'admin') {
            return { statusCode: 403, headers, body: JSON.stringify({ error: 'Geen admin rechten' }) };
        }
        
        const { data: gebruikers, error } = await supabase
            .from('gebruikers')
            .select('gebruikersnaam, naam, rol');
        
        if (error) throw error;
        
        return { statusCode: 200, headers, body: JSON.stringify(gebruikers || []) };
    }
    
    // POST - Login of nieuwe gebruiker
    if (event.httpMethod === 'POST') {
        const body = JSON.parse(event.body);
        
        // LOGIN
        if (isLoginEndpoint) {
            const { gebruikersnaam, wachtwoord } = body;
            
            const { data: user, error } = await supabase
                .from('gebruikers')
                .select('*')
                .eq('gebruikersnaam', gebruikersnaam)
                .single();
            
            if (user && user.wachtwoord === wachtwoord) {
                const token = crypto.randomBytes(32).toString('hex');
                const vervalt_op = Date.now() + (24 * 60 * 60 * 1000);
                
                await supabase.from('sessies').insert([{
                    token: token,
                    gebruikersnaam: gebruikersnaam,
                    rol: user.rol,
                    naam: user.naam,
                    vervalt_op: vervalt_op
                }]);
                
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
                body: JSON.stringify({ success: false, error: 'Ongeldige gegevens' }) 
            };
        }
        
        // NIEUWE GEBRUIKER
        if (body.gebruikersnaam && body.wachtwoord) {
            const { gebruikersnaam, wachtwoord, naam, rol } = body;
            
            const { error } = await supabase.from('gebruikers').insert([{
                gebruikersnaam: gebruikersnaam,
                wachtwoord: wachtwoord,
                rol: rol || 'staff',
                naam: naam || gebruikersnaam,
                aangemaakt: Date.now()
            }]);
            
            if (error) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: error.message }) };
            }
            
            return { statusCode: 201, headers, body: JSON.stringify({ success: true }) };
        }
        
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Ongeldige aanvraag' }) };
    }
    
    // DELETE - Verwijder gebruiker
    if (event.httpMethod === 'DELETE') {
        const authHeader = event.headers.authorization;
        const token = authHeader?.replace('Bearer ', '');
        
        if (!token) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Niet ingelogd' }) };
        }
        
        const { data: session } = await supabase
            .from('sessies')
            .select('rol')
            .eq('token', token)
            .single();
        
        if (!session || session.rol !== 'admin') {
            return { statusCode: 403, headers, body: JSON.stringify({ error: 'Geen admin rechten' }) };
        }
        
        const gebruikersnaam = event.queryStringParameters?.gebruikersnaam;
        if (!gebruikersnaam) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Gebruikersnaam verplicht' }) };
        }
        
        if (gebruikersnaam === 'admin') {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Admin kan niet verwijderd worden' }) };
        }
        
        await supabase.from('gebruikers').delete().eq('gebruikersnaam', gebruikersnaam);
        
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }
    
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
};