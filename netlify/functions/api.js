// netlify/functions/api.js
exports.handler = async (event) => {
    console.log('🔥 API functie wordt aangeroepen!');
    console.log('Method:', event.httpMethod);
    console.log('Path:', event.path);
    
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    // Simpele test - altijd OK teruggeven
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
            message: 'API werkt!', 
            method: event.httpMethod,
            timestamp: new Date().toISOString()
        })
    };
};