// netlify/functions/api.js
let trainingen = [];

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Content-Type': 'application/json'
    };
    
    // OPTIONS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }
    
    // GET - Haal alle trainingen op
    if (event.httpMethod === 'GET') {
        // Filter alleen geldige trainingen
        const geldigeTrainingen = trainingen.filter(t => t && t.id && t.onderwerp);
        
        console.log(`GET: ${geldigeTrainingen.length} trainingen teruggeven`);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(geldigeTrainingen)
        };
    }
    
    // POST - Nieuwe training of sync
    if (event.httpMethod === 'POST') {
        try {
            const body = JSON.parse(event.body);
            console.log('POST ontvangen:', body);
            
            // Sync van Discord bot
            if (body.action === 'sync' && body.trainingen) {
                trainingen = body.trainingen.filter(t => t && t.id && t.onderwerp);
                console.log(`✅ Synced ${trainingen.length} trainingen`);
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ success: true, count: trainingen.length })
                };
            }
            
            // Nieuwe training
            if (body.onderwerp) {
                if (!body.id) body.id = Date.now().toString();
                trainingen.push(body);
                console.log(`✅ Training toegevoegd: ${body.onderwerp}`);
                return {
                    statusCode: 201,
                    headers,
                    body: JSON.stringify(body)
                };
            }
            
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid data' })
            };
        } catch (error) {
            console.error('POST error:', error);
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: error.message })
            };
        }
    }
    
    // PUT - Update training
    if (event.httpMethod === 'PUT') {
        try {
            const body = JSON.parse(event.body);
            const index = trainingen.findIndex(t => t.id === body.id);
            
            if (index !== -1) {
                trainingen[index] = { ...trainingen[index], ...body };
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ success: true, training: trainingen[index] })
                };
            }
            
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'Training not found' })
            };
        } catch (error) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: error.message })
            };
        }
    }
    
    // DELETE - Verwijder training
    if (event.httpMethod === 'DELETE') {
        const id = event.queryStringParameters?.id;
        if (id) {
            trainingen = trainingen.filter(t => t.id !== id);
            console.log(`✅ Training verwijderd: ${id}`);
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true })
            };
        }
        
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'ID required' })
        };
    }
    
    return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' })
    };
};