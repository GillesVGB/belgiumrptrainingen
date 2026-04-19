// netlify/functions/api.js
let trainingen = [];
let gameStatus = {
    state: 'operational',
    state_label: 'Operationeel',
    title: 'Server Operationeel',
    message: 'De server draait normaal.',
    lastUpdated: new Date().toISOString()
};

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
    
    // GET - Haal ALLEEN trainingen op als DIRECTE ARRAY
    if (event.httpMethod === 'GET') {
        // Filter alleen echte trainingen (geen sync objecten)
        const echteTrainingen = trainingen.filter(t => t && !t.action && t.onderwerp && t.id);
        
        // 🔴 DIRECTE ARRAY, geen object!
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(echteTrainingen)
        };
    }
    
    // POST - Nieuwe training of sync
    if (event.httpMethod === 'POST') {
        const body = JSON.parse(event.body);
        
        // Sync van Discord bot
        if (body.action === 'sync' && body.trainingen) {
            // Alleen echte trainingen opslaan
            trainingen = body.trainingen.filter(t => t && !t.action && t.onderwerp && t.id);
            console.log(`✅ Synced ${trainingen.length} trainingen`);
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(trainingen)  // ← Ook array terug
            };
        }
        
        // Nieuwe training
        if (body.onderwerp && !body.action) {
            if (!body.id) body.id = Date.now().toString();
            trainingen.push(body);
            console.log(`✅ Training toegevoegd: ${body.onderwerp}`);
            return {
                statusCode: 201,
                headers,
                body: JSON.stringify(body)
            };
        }
        
        // Game status update
        if (body.action === 'publish_game_status') {
            gameStatus = {
                state: body.state,
                state_label: body.state === 'operational' ? 'Operationeel' : 
                            body.state === 'alert' ? 'Verhoogde paraatheid' :
                            body.state === 'maintenance' ? 'Onderhoud' : 'Offline',
                title: body.title,
                message: body.message,
                serverName: body.serverName,
                playersOnline: body.playersOnline,
                maxPlayers: body.maxPlayers,
                joinCode: body.joinCode,
                imageUrl: body.imageUrl,
                lastUpdated: new Date().toISOString(),
                updatedBy: body.updatedBy
            };
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, gameStatus })
            };
        }
        
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid training data' })
        };
    }
    
    // PUT - Update training
    if (event.httpMethod === 'PUT') {
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
    }
    
    // DELETE - Verwijder training
    if (event.httpMethod === 'DELETE') {
        const id = event.queryStringParameters?.id;
        if (id) {
            trainingen = trainingen.filter(t => t.id !== id);
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