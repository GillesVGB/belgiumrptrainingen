const {
    GAME_STATE_LABELS,
    STATUS_LABELS,
    createTraining,
    deleteTraining,
    getAllData,
    markGameStatusWebhookSent,
    saveGameStatus,
    updateTraining
} = require('../database/store');

const GAME_STATE_COLORS = {
    operational: 0x1f7aec,
    alert: 0xf5c542,
    maintenance: 0xef4444,
    outage: 0xb91c1c
};

function buildHeaders(extra = {}) {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Training-Source',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Content-Type': 'application/json',
        ...extra
    };
}

function jsonResponse(statusCode, body, extraHeaders = {}) {
    return {
        statusCode,
        headers: buildHeaders(extraHeaders),
        body
    };
}

function parseBody(body) {
    if (!body) {
        return {};
    }

    if (typeof body === 'object') {
        return body;
    }

    try {
        return JSON.parse(body);
    } catch {
        return {};
    }
}

function getHeader(headers = {}, name) {
    const lookup = name.toLowerCase();
    const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === lookup);
    return entry ? entry[1] : undefined;
}

function isLocalRequest(headers = {}) {
    const host = String(getHeader(headers, 'host') || '');
    return host.includes('localhost') || host.includes('127.0.0.1');
}

function isBotRequest(headers = {}) {
    return String(getHeader(headers, 'x-training-source') || '').toLowerCase() === 'discord-bot';
}

function isAuthorised(method, headers = {}, user) {
    if (method === 'GET' || method === 'OPTIONS') {
        return true;
    }

    return true;
}

async function sendDiscordWebhook(gameStatus, webhookUrl) {
    if (!webhookUrl) {
        return { sent: false, reason: 'missing_webhook' };
    }

    const payload = {
        username: 'Belgium RP Operations',
        embeds: [
            {
                title: gameStatus.title,
                description: gameStatus.message,
                color: GAME_STATE_COLORS[gameStatus.state] || GAME_STATE_COLORS.operational,
                fields: [
                    {
                        name: 'Status',
                        value: gameStatus.state_label,
                        inline: true
                    },
                    {
                        name: 'Server',
                        value: gameStatus.serverName || 'Belgium Roleplay',
                        inline: true
                    },
                    {
                        name: 'Spelers',
                        value: gameStatus.playersOnline
                            ? `${gameStatus.playersOnline}/${gameStatus.maxPlayers || '?'}`
                            : 'Niet opgegeven',
                        inline: true
                    },
                    {
                        name: 'Join code',
                        value: gameStatus.joinCode || 'Niet opgegeven',
                        inline: true
                    },
                    {
                        name: 'Bijgewerkt door',
                        value: gameStatus.updatedBy || 'Admin panel',
                        inline: true
                    }
                ],
                timestamp: gameStatus.updatedAt,
                footer: {
                    text: 'Belgium Roleplay • Game status'
                }
            }
        ]
    };

    if (gameStatus.imageUrl) {
        payload.embeds[0].image = {
            url: gameStatus.imageUrl
        };
    }

    const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(`Webhook fout ${response.status}`);
    }

    return { sent: true };
}

async function handleRequest({ method, query = {}, body, headers = {}, user = null }) {
    if (method === 'OPTIONS') {
        return jsonResponse(200, '');
    }

    if (!isAuthorised(method, headers, user)) {
        return jsonResponse(401, JSON.stringify({ error: 'Niet geautoriseerd' }));
    }

    const payload = parseBody(body);

    if (method === 'GET') {
        const data = await getAllData();
        const resource = query.resource || '';

        if (resource === 'dashboard') {
            return jsonResponse(
                200,
                JSON.stringify({
                    trainings: data.trainings,
                    gameStatus: data.gameStatus,
                    statusLabels: STATUS_LABELS,
                    gameStateLabels: GAME_STATE_LABELS
                })
            );
        }

        if (resource === 'game-status') {
            return jsonResponse(200, JSON.stringify(data.gameStatus));
        }

        return jsonResponse(200, JSON.stringify(data.trainings));
    }

    if (method === 'POST') {
        if (payload.action === 'publish_game_status') {
            const gameStatus = await saveGameStatus(payload);
            const webhookUrl = payload.webhookUrl || process.env.DISCORD_WEBHOOK_URL || '';

            try {
                const webhookResult = await sendDiscordWebhook(gameStatus, webhookUrl);

                if (webhookResult.sent) {
                    await markGameStatusWebhookSent();
                }

                return jsonResponse(
                    200,
                    JSON.stringify({
                        success: true,
                        gameStatus,
                        webhookSent: webhookResult.sent,
                        webhookConfigured: Boolean(webhookUrl)
                    })
                );
            } catch (error) {
                return jsonResponse(
                    502,
                    JSON.stringify({
                        success: false,
                        gameStatus,
                        error: error.message
                    })
                );
            }
        }

        const training = await createTraining(payload);
        return jsonResponse(201, JSON.stringify({ success: true, training }));
    }

    if (method === 'PUT') {
        if (!payload.id) {
            return jsonResponse(400, JSON.stringify({ error: 'Training ID ontbreekt' }));
        }

        let updates = payload;

        if (payload.action === 'update_count') {
            updates = {
                aangemeldCount: payload.aangemeld_count
            };
        }

        if (payload.action === 'update_status') {
            const status = payload.status && STATUS_LABELS[payload.status] ? payload.status : 'not_started';
            updates = {
                status,
                status_text: STATUS_LABELS[status]
            };
        }

        const training = await updateTraining(payload.id, updates);

        if (!training) {
            return jsonResponse(404, JSON.stringify({ error: 'Training niet gevonden' }));
        }

        return jsonResponse(200, JSON.stringify({ success: true, training }));
    }

    if (method === 'DELETE') {
        const id = query.id || payload.id;

        if (!id) {
            return jsonResponse(400, JSON.stringify({ error: 'Training ID ontbreekt' }));
        }

        const removed = await deleteTraining(id);

        if (!removed) {
            return jsonResponse(404, JSON.stringify({ error: 'Training niet gevonden' }));
        }

        return jsonResponse(200, JSON.stringify({ success: true, training: removed }));
    }

    return jsonResponse(405, JSON.stringify({ error: 'Methode niet ondersteund' }));
}

module.exports = {
    handleRequest
};
