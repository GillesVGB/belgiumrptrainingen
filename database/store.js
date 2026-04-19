const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');

const STATUS_LABELS = {
    not_started: 'Nog niet gestart',
    in_progress: 'Bezig',
    completed: 'Afgerond',
    cancelled: 'Geannuleerd',
    delayed: 'Uitgesteld'
};

const GAME_STATE_LABELS = {
    operational: 'Operationeel',
    alert: 'Verhoogde paraatheid',
    maintenance: 'Onderhoud',
    outage: 'Offline'
};

const DEFAULT_DATA = {
    trainings: [],
    gameStatus: {
        title: 'Server operationeel',
        state: 'operational',
        state_label: GAME_STATE_LABELS.operational,
        message: 'Geen actieve meldingen. De servers draaien normaal.',
        serverName: 'Belgium Roleplay',
        joinCode: '',
        playersOnline: '',
        maxPlayers: '',
        imageUrl: '',
        updatedAt: null,
        updatedBy: 'Systeem',
        lastWebhookAt: null
    }
};

function cloneDefaultData() {
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
}

async function ensureDataFile() {
    await fs.promises.mkdir(path.dirname(DATA_FILE), { recursive: true });

    try {
        await fs.promises.access(DATA_FILE, fs.constants.F_OK);
    } catch {
        await fs.promises.writeFile(DATA_FILE, JSON.stringify(cloneDefaultData(), null, 2), 'utf8');
    }
}

async function readData() {
    await ensureDataFile();

    try {
        const raw = await fs.promises.readFile(DATA_FILE, 'utf8');
        const parsed = raw ? JSON.parse(raw) : {};

        return {
            trainings: Array.isArray(parsed.trainings) ? parsed.trainings : [],
            gameStatus: {
                ...cloneDefaultData().gameStatus,
                ...(parsed.gameStatus || {})
            }
        };
    } catch {
        const fallback = cloneDefaultData();
        await writeData(fallback);
        return fallback;
    }
}

async function writeData(data) {
    const payload = {
        trainings: Array.isArray(data.trainings) ? data.trainings : [],
        gameStatus: {
            ...cloneDefaultData().gameStatus,
            ...(data.gameStatus || {})
        }
    };

    await fs.promises.writeFile(DATA_FILE, JSON.stringify(payload, null, 2), 'utf8');
    return payload;
}

function normaliseStatus(status) {
    return STATUS_LABELS[status] ? status : 'not_started';
}

function normaliseCount(value, fallback = 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normaliseTraining(input = {}, existing = {}) {
    const status = normaliseStatus(input.status || existing.status);
    const maxDeelnemers = normaliseCount(
        input.maxDeelnemers ?? existing.maxDeelnemers,
        existing.maxDeelnemers || 0
    );

    const explicitArray = Array.isArray(input.aangemeld) ? input.aangemeld : null;
    const baseCount = explicitArray
        ? explicitArray.length
        : normaliseCount(
              input.aangemeldCount ?? input.aangemeld_count,
              Array.isArray(existing.aangemeld) ? existing.aangemeld.length : 0
          );

    const existingAttendees = Array.isArray(existing.aangemeld) ? existing.aangemeld : [];
    const attendees = explicitArray || Array.from({ length: baseCount }, (_, index) => existingAttendees[index] || {});

    return {
        ...existing,
        id: String(input.id || existing.id || Date.now()),
        onderwerp: String(input.onderwerp ?? existing.onderwerp ?? '').trim(),
        dienst: String(input.dienst ?? existing.dienst ?? 'algemeen').trim() || 'algemeen',
        datum: String(input.datum ?? existing.datum ?? '').trim(),
        tijd: String(input.tijd ?? existing.tijd ?? '').trim(),
        trainer: String(input.trainer ?? existing.trainer ?? '').trim(),
        locatie: String(input.locatie ?? existing.locatie ?? '').trim(),
        notitie: String(input.notitie ?? existing.notitie ?? '').trim(),
        maxDeelnemers,
        status,
        status_text: STATUS_LABELS[status],
        aangemeld: attendees,
        van_discord: Boolean(input.van_discord ?? existing.van_discord),
        toegevoegd_door: String(input.toegevoegd_door ?? existing.toegevoegd_door ?? '').trim(),
        aangemaakt: existing.aangemaakt || new Date().toISOString(),
        bijgewerkt: new Date().toISOString()
    };
}

function normaliseGameState(state) {
    return GAME_STATE_LABELS[state] ? state : 'operational';
}

function normaliseGameStatus(input = {}, existing = {}) {
    const state = normaliseGameState(input.state || existing.state);

    return {
        ...cloneDefaultData().gameStatus,
        ...existing,
        title: String(input.title ?? existing.title ?? cloneDefaultData().gameStatus.title).trim(),
        state,
        state_label: GAME_STATE_LABELS[state],
        message: String(input.message ?? existing.message ?? cloneDefaultData().gameStatus.message).trim(),
        serverName: String(input.serverName ?? existing.serverName ?? 'Belgium Roleplay').trim(),
        joinCode: String(input.joinCode ?? existing.joinCode ?? '').trim(),
        playersOnline: String(input.playersOnline ?? existing.playersOnline ?? '').trim(),
        maxPlayers: String(input.maxPlayers ?? existing.maxPlayers ?? '').trim(),
        imageUrl: String(input.imageUrl ?? existing.imageUrl ?? '').trim(),
        updatedAt: new Date().toISOString(),
        updatedBy: String(input.updatedBy ?? existing.updatedBy ?? 'Admin panel').trim()
    };
}

async function getAllData() {
    return readData();
}

async function listTrainings() {
    const data = await readData();
    return data.trainings;
}

async function createTraining(input) {
    const data = await readData();
    const training = normaliseTraining(input);
    data.trainings.push(training);
    await writeData(data);
    return training;
}

async function updateTraining(id, updates) {
    const data = await readData();
    const index = data.trainings.findIndex((training) => String(training.id) === String(id));

    if (index === -1) {
        return null;
    }

    const current = data.trainings[index];
    data.trainings[index] = normaliseTraining({ ...current, ...updates, id: current.id }, current);
    await writeData(data);
    return data.trainings[index];
}

async function deleteTraining(id) {
    const data = await readData();
    const index = data.trainings.findIndex((training) => String(training.id) === String(id));

    if (index === -1) {
        return null;
    }

    const [removed] = data.trainings.splice(index, 1);
    await writeData(data);
    return removed;
}

async function saveGameStatus(input) {
    const data = await readData();
    data.gameStatus = normaliseGameStatus(input, data.gameStatus);
    await writeData(data);
    return data.gameStatus;
}

async function markGameStatusWebhookSent(sentAt = new Date().toISOString()) {
    const data = await readData();
    data.gameStatus.lastWebhookAt = sentAt;
    await writeData(data);
    return data.gameStatus;
}

module.exports = {
    GAME_STATE_LABELS,
    STATUS_LABELS,
    createTraining,
    deleteTraining,
    getAllData,
    listTrainings,
    markGameStatusWebhookSent,
    saveGameStatus,
    updateTraining
};
