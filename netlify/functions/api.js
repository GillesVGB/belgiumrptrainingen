// netlify/functions/api.js
let trainingen = []; // Tijdelijke opslag in geheugen

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Content-Type': 'application/json'
    };

    // OPTIONS request (voor CORS)
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    // POST /api - Nieuwe training van Discord
    if (event.httpMethod === 'POST') {
        try {
            const nieuweTraining = JSON.parse(event.body);
            
            // Voeg ID toe als die er niet is
            if (!nieuweTraining.id) {
                nieuweTraining.id = Date.now().toString();
            }
            
            // Zorg dat status_text bestaat
            if (!nieuweTraining.status_text) {
                const statusTeksten = {
                    'not_started': 'Nog niet gestart',
                    'in_progress': 'Bezig',
                    'completed': 'Afgerond',
                    'cancelled': 'Geannuleerd',
                    'delayed': 'Uitgesteld'
                };
                nieuweTraining.status_text = statusTeksten[nieuweTraining.status] || 'Onbekend';
            }
            
            // Opslaan
            trainingen.push(nieuweTraining);
            
            console.log('✅ Training ontvangen:', nieuweTraining.onderwerp);
            
            return {
                statusCode: 201,
                headers,
                body: JSON.stringify({ 
                    success: true, 
                    message: 'Training opgeslagen',
                    training: nieuweTraining 
                })
            };
        } catch (error) {
            console.error('❌ Fout bij verwerken POST:', error);
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    error: 'Ongeldige data',
                    details: error.message 
                })
            };
        }
    }

    // GET /api - Alle trainingen ophalen
    if (event.httpMethod === 'GET') {
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(trainingen)
        };
    }

    // DELETE /api?id=... - Training verwijderen
    if (event.httpMethod === 'DELETE') {
        const id = event.queryStringParameters?.id;
        if (!id) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Geen ID opgegeven' })
            };
        }
        
        const index = trainingen.findIndex(t => t.id === id);
        if (index !== -1) {
            trainingen.splice(index, 1);
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true })
            };
        } else {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'Training niet gevonden' })
            };
        }
    }

    // 404 voor andere methodes
    return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Not found' })
    };
};