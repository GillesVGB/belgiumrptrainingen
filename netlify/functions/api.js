// netlify/functions/api.js
let trainingen = [];
let gameStatus = {
    state: 'operational',
    state_label: 'Operationeel',
    title: 'Server Operationeel',
    message: 'De server draait normaal.',
    lastUpdated: new Date().toISOString()
};

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Content-Type': 'application/json'
    };
    
    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }
    
    // GET: Haal alle trainingen en status op
    if (event.httpMethod === 'GET') {
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                trainings: trainingen,
                gameStatus: gameStatus
            })
        };
    }
    
    // POST: Nieuwe training of game status
    if (event.httpMethod === 'POST') {
        const body = JSON.parse(event.body);
        
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
                body: JSON.stringify({ 
                    success: true, 
                    gameStatus: gameStatus,
                    webhookSent: false 
                })
            };
        }
        
        // Nieuwe training
        if (!body.id) {
            body.id = Date.now().toString();
        }
        trainingen.push(body);
        
        return {
            statusCode: 201,
            headers,
            body: JSON.stringify({ success: true, training: body })
        };
    }
    
    // PUT: Update training
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
    
    // DELETE: Verwijder training
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