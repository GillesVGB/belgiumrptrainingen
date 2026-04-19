// utils/netlifySync.js - ZONDER node-fetch (gebruik ingebouwde fetch)
const NETLIFY_API_URL = 'https://belgium-roleplay.netlify.app/.netlify/functions/api';

async function syncToNetlify(training, action = 'create') {
    try {
        console.log(`📤 Syncing training ${action} to Netlify:`, training.onderwerp);
        
        let response;
        
        if (action === 'create') {
            response = await fetch(NETLIFY_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(training)
            });
        } else if (action === 'update') {
            response = await fetch(NETLIFY_API_URL, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: training.id,
                    status: training.status,
                    status_text: training.status_text,
                    aangemeld: training.aangemeld
                })
            });
        } else if (action === 'delete') {
            response = await fetch(`${NETLIFY_API_URL}?id=${training.id}`, {
                method: 'DELETE'
            });
        } else if (action === 'sync') {
            response = await fetch(NETLIFY_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'sync', trainingen: training })
            });
        }
        
        if (response && response.ok) {
            console.log('✅ Synced to Netlify!');
            return true;
        } else {
            console.log(`❌ Netlify response: ${response?.status}`);
            return false;
        }
    } catch (error) {
        console.error('❌ Netlify sync error:', error.message);
        return false;
    }
}

module.exports = { syncToNetlify };