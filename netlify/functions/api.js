// netlify/functions/api.js
const { createClient } = require('@supabase/supabase-js');

// 🔴 HAAL DIT WEG - gebruik environment variables!
// const SUPABASE_URL = 'https://tcixgcyxubtemkmbocwi.supabase.co';
// const SUPABASE_KEY = 'sb_publishable_81B5-BEerJmUz7N49bSm4A_WbObTAX_';

// ✅ Gebruik environment variables (die je in Netlify hebt ingesteld)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Supabase credentials missing! Set SUPABASE_URL and SUPABASE_ANON_KEY in Netlify environment variables.');
}

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
    
    // GET - Haal alle trainingen op uit Supabase
    if (event.httpMethod === 'GET') {
        const { data, error } = await supabase
            .from('trainingen')
            .select('*')
            .order('aangemaakt', { ascending: false });
        
        if (error) {
            console.error('Supabase error:', error);
            return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
        }
        
        return { statusCode: 200, headers, body: JSON.stringify(data || []) };
    }
    
    // POST - Nieuwe training (via website)
    if (event.httpMethod === 'POST') {
        try {
            const body = JSON.parse(event.body);
            
            if (!body.id) body.id = Date.now().toString();
            if (!body.aangemaakt) body.aangemaakt = Date.now();
            
            const { error } = await supabase.from('trainingen').insert([{
                id: body.id,
                dienst: body.dienst,
                datum: body.datum,
                tijd: body.tijd,
                onderwerp: body.onderwerp,
                trainer: body.trainer,
                max_deelnemers: body.maxDeelnemers || body.max_deelnemers || 10,
                locatie: body.locatie || '',
                aangemeld: body.aangemeld || [],
                status: body.status || 'aangekondigd',
                status_text: body.status_text || 'Aangekondigd',
                notitie: body.notitie || '',
                van_discord: body.van_discord || false,
                toegevoegd_door: body.toegevoegd_door || 'website',
                aangemaakt: body.aangemaakt,
                bericht_id: body.bericht_id || null
            }]);
            
            if (error) throw error;
            
            return { statusCode: 201, headers, body: JSON.stringify({ success: true, id: body.id }) };
            
        } catch (error) {
            console.error('POST error:', error);
            return { statusCode: 400, headers, body: JSON.stringify({ error: error.message }) };
        }
    }
    
    // PUT - Update training (via website)
    if (event.httpMethod === 'PUT') {
        try {
            const body = JSON.parse(event.body);
            
            const { error } = await supabase
                .from('trainingen')
                .update({
                    status: body.status,
                    status_text: body.status_text,
                    aangemeld: body.aangemeld,
                    max_deelnemers: body.maxDeelnemers || body.max_deelnemers,
                    locatie: body.locatie,
                    notitie: body.notitie,
                    trainer: body.trainer,
                    datum: body.datum,
                    tijd: body.tijd,
                    onderwerp: body.onderwerp
                })
                .eq('id', body.id);
            
            if (error) throw error;
            
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
            
        } catch (error) {
            console.error('PUT error:', error);
            return { statusCode: 400, headers, body: JSON.stringify({ error: error.message }) };
        }
    }
    
    // DELETE - Verwijder training (via website)
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
            console.error('DELETE error:', error);
            return { statusCode: 400, headers, body: JSON.stringify({ error: error.message }) };
        }
    }
    
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
};