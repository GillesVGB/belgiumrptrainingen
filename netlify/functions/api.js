// netlify/functions/api.js
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Content-Type': 'application/json'
    };
    
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }
    
    // GET - Alle trainingen ophalen
    if (event.httpMethod === 'GET') {
        const { data, error } = await supabase
            .from('trainingen')
            .select('*')
            .order('aangemaakt', { ascending: false });
        
        if (error) {
            return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
        }
        
        return { statusCode: 200, headers, body: JSON.stringify(data || []) };
    }
    
    // POST - Nieuwe training
    if (event.httpMethod === 'POST') {
        try {
            const body = JSON.parse(event.body);
            
            // Sync van Discord bot (volledige lijst)
            if (body.action === 'sync' && body.trainingen) {
                // Verwijder alle bestaande trainingen en voeg nieuwe toe
                await supabase.from('trainingen').delete().neq('id', '0');
                
                for (const t of body.trainingen) {
                    await supabase.from('trainingen').insert([{
                        id: t.id,
                        dienst: t.dienst,
                        dienst_naam: t.dienst_naam,
                        datum: t.datum,
                        tijd: t.tijd,
                        onderwerp: t.onderwerp,
                        trainer: t.trainer,
                        locatie: t.locatie || '',
                        max_deelnemers: t.maxDeelnemers,
                        aangemeld: t.aangemeld || [],
                        status: t.status,
                        status_text: t.status_text,
                        notitie: t.notitie || '',
                        van_discord: t.van_discord || true,
                        toegevoegd_door: t.toegevoegd_door,
                        aangemaakt: t.aangemaakt || Date.now(),
                        bericht_id: t.messageId || null
                    }]);
                }
                
                return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
            }
            
            // Nieuwe training
            if (!body.id) body.id = Date.now().toString();
            if (!body.aangemaakt) body.aangemaakt = Date.now();
            
            const { error } = await supabase.from('trainingen').insert([{
                id: body.id,
                dienst: body.dienst,
                datum: body.datum,
                tijd: body.tijd,
                onderwerp: body.onderwerp,
                trainer: body.trainer,
                max_deelnemers: body.maxDeelnemers,
                aangemeld: body.aangemeld || [],
                status: body.status || 'aangekondigd',
                status_text: body.status_text || '📢 Aangekondigd',
                notitie: body.notitie || '',
                van_discord: true,
                toegevoegd_door: body.toegevoegd_door,
                aangemaakt: body.aangemaakt
            }]);
            
            if (error) throw error;
            
            return { statusCode: 201, headers, body: JSON.stringify({ success: true, id: body.id }) };
            
        } catch (error) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: error.message }) };
        }
    }
    
    // PUT - Update training
    if (event.httpMethod === 'PUT') {
        try {
            const body = JSON.parse(event.body);
            
            const { error } = await supabase
                .from('trainingen')
                .update({
                    status: body.status,
                    status_text: body.status_text,
                    aangemeld: body.aangemeld
                })
                .eq('id', body.id);
            
            if (error) throw error;
            
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
            
        } catch (error) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: error.message }) };
        }
    }
    
    // DELETE - Verwijder training
    if (event.httpMethod === 'DELETE') {
        try {
            const id = event.queryStringParameters?.id;
            if (!id) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'ID required' }) };
            }
            
            const { error } = await supabase.from('trainingen').delete().eq('id', id);
            if (error) throw error;
            
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
            
        } catch (error) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: error.message }) };
        }
    }
    
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
};