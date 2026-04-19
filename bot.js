require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static('public'));

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// ===========================================
// PERSISTENTE OPSLAG
// ===========================================
const databaseMap = path.join(__dirname, 'database');
const trainingenBestand = path.join(databaseMap, 'trainingen.json');

if (!fs.existsSync(databaseMap)) fs.mkdirSync(databaseMap, { recursive: true });

function laadTrainingen() {
    try {
        if (fs.existsSync(trainingenBestand)) {
            return JSON.parse(fs.readFileSync(trainingenBestand, 'utf8'));
        }
    } catch (error) {
        console.error('❌ Fout bij laden trainingen:', error);
    }
    return [];
}

function bewaarTrainingen(trainingen) {
    try {
        fs.writeFileSync(trainingenBestand, JSON.stringify(trainingen, null, 2));
        console.log(`✅ ${trainingen.length} trainingen opgeslagen`);
    } catch (error) {
        console.error('❌ Fout bij bewaren trainingen:', error);
    }
}

let trainingen = laadTrainingen();

// Kleuren voor embeds
const COLORS = {
    success: 0x00ff00,
    error: 0xff0000,
    info: 0x0099ff,
    warning: 0xffaa00,
    training: 0x5865F2
};

// ===========================================
// DIENSTEN MAPPING
// ===========================================
const DIENSTEN_MAP = {
    'lokale_politie': { label: '🚓 Lokale Politie', value: 'lokale_politie' },
    'federale_politie': { label: '⭐ Federale Politie', value: 'federale_politie' },
    'militaire_politie': { label: '⚔️ Militaire Politie', value: 'militaire_politie' },
    'ambulance': { label: '🚑 Ambulance', value: 'ambulance' },
    'brandweer': { label: '🔥 Brandweer', value: 'brandweer' }
};

// ===========================================
// WEBHOOK FUNCTIE
// ===========================================
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || '';

async function sendDiscordWebhook(gameStatus) {
    if (!DISCORD_WEBHOOK_URL) {
        console.log('⚠️ Geen DISCORD_WEBHOOK_URL gevonden in .env');
        return false;
    }

    let color = 0x00ff00;
    let statusEmoji = '✅';
    
    switch (gameStatus.state) {
        case 'operational':
            color = 0x00ff00;
            statusEmoji = '✅';
            break;
        case 'alert':
            color = 0xffaa00;
            statusEmoji = '⚠️';
            break;
        case 'maintenance':
            color = 0x0099ff;
            statusEmoji = '🔧';
            break;
        case 'outage':
            color = 0xff0000;
            statusEmoji = '❌';
            break;
    }

    const embed = {
        title: `${statusEmoji} ${gameStatus.title || 'Game Status Update'}`,
        description: gameStatus.message || 'Er is een statusupdate voor de server.',
        color: color,
        fields: [],
        timestamp: new Date().toISOString(),
        footer: { text: 'Belgium Roleplay • Training Systeem' }
    };

    if (gameStatus.serverName) {
        embed.fields.push({ name: '🖥️ Server', value: gameStatus.serverName, inline: true });
    }
    if (gameStatus.playersOnline !== undefined) {
        embed.fields.push({ name: '👥 Spelers', value: `${gameStatus.playersOnline}/${gameStatus.maxPlayers || '?'}`, inline: true });
    }
    if (gameStatus.joinCode) {
        embed.fields.push({ name: '🔑 Join Code', value: `\`${gameStatus.joinCode}\``, inline: true });
    }
    if (gameStatus.imageUrl) {
        embed.image = { url: gameStatus.imageUrl };
    }

    try {
        const response = await fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [embed], username: 'BRP Game Status' })
        });
        return response.ok;
    } catch (error) {
        console.error('❌ Webhook error:', error.message);
        return false;
    }
}

// ===========================================
// SYNC NAAR NETLIFY
// ===========================================
async function syncToNetlify() {
    try {
        await fetch('https://belgium-roleplay.netlify.app/.netlify/functions/api', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'sync', trainingen: trainingen })
        });
        console.log('✅ Gesynchroniseerd met Netlify');
    } catch (error) {
        console.error('❌ Netlify sync error:', error.message);
    }
}

// ===========================================
// DISCORD COMMANDS
// ===========================================
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    // TRAINING AANMAKEN
    if (interaction.commandName === 'training-create') {
        const dienst = interaction.options.getString('dienst');
        const datum = interaction.options.getString('datum');
        const tijd = interaction.options.getString('tijd');
        const onderwerp = interaction.options.getString('onderwerp');
        const trainer = interaction.options.getString('trainer');
        const maxDeelnemers = interaction.options.getInteger('max');
        
        const training = {
            id: Date.now().toString(),
            dienst: dienst,
            dienst_label: DIENSTEN_MAP[dienst]?.label || dienst,
            datum: datum,
            tijd: tijd,
            onderwerp: onderwerp,
            trainer: trainer,
            host: interaction.user.username,
            hostId: interaction.user.id,
            maxDeelnemers: maxDeelnemers,
            status: 'aangekondigd',
            status_text: '📢 Aangekondigd',
            aangemeld: [],
            van_discord: true,
            toegevoegd_door: interaction.user.username,
            aangemaakt: new Date().toISOString()
        };

        trainingen.push(training);
        bewaarTrainingen(trainingen);
        await syncToNetlify();

        const embed = new EmbedBuilder()
            .setTitle('✅ Training Aangemaakt!')
            .setColor(COLORS.success)
            .setDescription(`**${onderwerp}** is succesvol toegevoegd.`)
            .addFields(
                { name: '📌 Dienst', value: DIENSTEN_MAP[dienst]?.label || dienst, inline: true },
                { name: '👤 Trainer', value: trainer, inline: true },
                { name: '📅 Datum/Tijd', value: `${datum} om ${tijd}`, inline: true },
                { name: '👥 Max deelnemers', value: `${maxDeelnemers}`, inline: true },
                { name: '🆔 ID', value: `\`${training.id}\``, inline: true },
                { name: '📊 Status', value: '📢 Aangekondigd', inline: true }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }

    // STATUS VERANDEREN
    else if (interaction.commandName === 'training-status') {
        const id = interaction.options.getString('id');
        const nieuweStatus = interaction.options.getString('status');
        
        const training = trainingen.find(t => t.id === id);
        
        if (!training) {
            return interaction.reply(`❌ Training met ID \`${id}\` niet gevonden.`);
        }
        
        const statusTeksten = {
            'aangekondigd': '📢 Aangekondigd',
            'inloop': '🚪 Inloop',
            'bezig': '🔄 Bezig',
            'afgerond': '✅ Afgerond',
            'geannuleerd': '❌ Geannuleerd',
            'uitgesteld': '⏰ Uitgesteld'
        };
        
        training.status = nieuweStatus;
        training.status_text = statusTeksten[nieuweStatus];
        
        bewaarTrainingen(trainingen);
        await syncToNetlify();
        
        const embed = new EmbedBuilder()
            .setTitle('✅ Status Gewijzigd!')
            .setColor(COLORS.success)
            .setDescription(`Status van **${training.onderwerp}** is bijgewerkt.`)
            .addFields(
                { name: '📌 Training', value: training.onderwerp, inline: true },
                { name: '🎯 Nieuwe status', value: statusTeksten[nieuweStatus], inline: true }
            )
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    }

    // ALLE TRAININGEN BEKIJKEN
    else if (interaction.commandName === 'training-list') {
        if (trainingen.length === 0) {
            return interaction.reply('📭 Geen trainingen gevonden.');
        }
        
        let beschrijving = '';
        trainingen.slice(-8).reverse().forEach((t) => {
            beschrijving += `${t.status_text || '📌'} **${t.onderwerp}**\n`;
            beschrijving += `└ 🆔 \`${t.id}\` | 📅 ${t.datum} om ${t.tijd} | 👤 ${t.trainer}\n\n`;
        });
        
        const embed = new EmbedBuilder()
            .setTitle('📋 Trainingen Overzicht')
            .setColor(COLORS.training)
            .setDescription(beschrijving)
            .addFields({ name: '📊 Totaal', value: `${trainingen.length} trainingen`, inline: true })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    }

    // TRAINING VERWIJDEREN
    else if (interaction.commandName === 'training-delete') {
        const id = interaction.options.getString('id');
        
        const index = trainingen.findIndex(t => t.id === id);
        
        if (index === -1) {
            return interaction.reply(`❌ Training met ID \`${id}\` niet gevonden.`);
        }
        
        const verwijderde = trainingen[index];
        trainingen.splice(index, 1);
        bewaarTrainingen(trainingen);
        await syncToNetlify();
        
        const embed = new EmbedBuilder()
            .setTitle('🗑️ Training Verwijderd')
            .setColor(COLORS.error)
            .setDescription(`**${verwijderde.onderwerp}** is verwijderd.`)
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    }

    // HELP
    else if (interaction.commandName === 'help') {
        const embed = new EmbedBuilder()
            .setTitle('🤖 Bot Commando\'s')
            .setColor(COLORS.training)
            .setDescription('Beschikbare commando\'s:')
            .addFields(
                { name: '📝 Trainingen', value: '`/training-create` - Nieuwe training maken\n`/training-list` - Alle trainingen bekijken', inline: false },
                { name: '🎯 Status', value: '`/training-status` - Status wijzigen\n`/training-delete` - Training verwijderen', inline: false },
                { name: '📊 Informatie', value: '`/stats` - Bot statistieken\n`/help` - Dit overzicht', inline: false }
            )
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    }

    // STATISTIEKEN
    else if (interaction.commandName === 'stats') {
        const total = trainingen.length;
        const aangekondigd = trainingen.filter(t => t.status === 'aangekondigd').length;
        const inloop = trainingen.filter(t => t.status === 'inloop').length;
        const bezig = trainingen.filter(t => t.status === 'bezig').length;
        const afgerond = trainingen.filter(t => t.status === 'afgerond').length;
        
        const embed = new EmbedBuilder()
            .setTitle('📊 Bot Statistieken')
            .setColor(COLORS.info)
            .addFields(
                { name: '📋 Totaal trainingen', value: `${total}`, inline: true },
                { name: '📢 Aangekondigd', value: `${aangekondigd}`, inline: true },
                { name: '🚪 Inloop', value: `${inloop}`, inline: true },
                { name: '🔄 Bezig', value: `${bezig}`, inline: true },
                { name: '✅ Afgerond', value: `${afgerond}`, inline: true }
            )
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    }
});

// ===========================================
// COMMAND REGISTRATIE
// ===========================================
client.once('ready', async () => {
    console.log(`✅ Bot is online als ${client.user.tag}`);
    console.log(`📊 ${trainingen.length} trainingen geladen uit database`);
    
    const commands = [
        {
            name: 'training-create',
            description: 'Maak een nieuwe training aan',
            options: [
                {
                    name: 'dienst',
                    description: 'Hulpdienst',
                    type: 3,
                    required: true,
                    choices: [
                        { name: '🚓 Lokale Politie', value: 'lokale_politie' },
                        { name: '⭐ Federale Politie', value: 'federale_politie' },
                        { name: '⚔️ Militaire Politie', value: 'militaire_politie' },
                        { name: '🚑 Ambulance', value: 'ambulance' },
                        { name: '🔥 Brandweer', value: 'brandweer' }
                    ]
                },
                { name: 'datum', description: 'Datum (DD-MM-YYYY)', type: 3, required: true },
                { name: 'tijd', description: 'Tijd (HH:MM)', type: 3, required: true },
                { name: 'onderwerp', description: 'Onderwerp training', type: 3, required: true },
                { name: 'trainer', description: 'Naam trainer', type: 3, required: true },
                { name: 'max', description: 'Max aantal deelnemers', type: 4, required: true, min_value: 1, max_value: 50 }
            ]
        },
        {
            name: 'training-status',
            description: 'Verander status van training',
            options: [
                { name: 'id', description: 'ID van training', type: 3, required: true },
                {
                    name: 'status',
                    description: 'Nieuwe status',
                    type: 3,
                    required: true,
                    choices: [
                        { name: '📢 Aangekondigd', value: 'aangekondigd' },
                        { name: '🚪 Inloop', value: 'inloop' },
                        { name: '🔄 Bezig', value: 'bezig' },
                        { name: '✅ Afgerond', value: 'afgerond' },
                        { name: '❌ Geannuleerd', value: 'geannuleerd' },
                        { name: '⏰ Uitgesteld', value: 'uitgesteld' }
                    ]
                }
            ]
        },
        { name: 'training-list', description: 'Bekijk alle trainingen' },
        { name: 'training-delete', description: 'Verwijder een training', options: [{ name: 'id', description: 'ID van training', type: 3, required: true }] },
        { name: 'help', description: 'Bekijk alle commands' },
        { name: 'stats', description: 'Bekijk bot statistieken' }
    ];
    
    await client.application.commands.set(commands);
    console.log('✅ Commands geregistreerd!');
    console.log('📋 /training-create, /training-status, /training-list, /training-delete, /help, /stats');
});

// ===========================================
// API VOOR WEBSITE
// ===========================================
// GET - Haal alle trainingen op
app.get('/api/trainingen', (req, res) => {
    res.json(trainingen);
});

// POST - Nieuwe training via website
app.post('/api/training', (req, res) => {
    const training = req.body;
    if (!training.id) training.id = Date.now().toString();
    trainingen.push(training);
    bewaarTrainingen(trainingen);
    syncToNetlify();
    res.json({ success: true, training });
});

// PUT - Update training
app.put('/api/training', (req, res) => {
    const updated = req.body;
    const index = trainingen.findIndex(t => t.id === updated.id);
    if (index !== -1) {
        trainingen[index] = { ...trainingen[index], ...updated };
        bewaarTrainingen(trainingen);
        syncToNetlify();
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Training not found' });
    }
});

// DELETE - Verwijder training
app.delete('/api/training', (req, res) => {
    const { id } = req.query;
    if (!id) {
        return res.status(400).json({ error: 'ID required' });
    }
    const index = trainingen.findIndex(t => t.id === id);
    if (index !== -1) {
        trainingen.splice(index, 1);
        bewaarTrainingen(trainingen);
        syncToNetlify();
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Training not found' });
    }
});

// POST - Game status met webhook
app.post('/api/game-status', async (req, res) => {
    try {
        const gameStatus = req.body;
        gameStatus.updatedAt = new Date().toISOString();
        
        const webhookSent = await sendDiscordWebhook(gameStatus);
        
        res.json({ 
            success: true, 
            gameStatus: gameStatus,
            webhookSent: webhookSent 
        });
    } catch (error) {
        console.error('❌ Fout bij game status:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET - Huidige game status
app.get('/api/game-status', (req, res) => {
    res.json({
        state: 'operational',
        state_label: 'Operationeel',
        title: 'Server Operationeel',
        message: 'Alles werkt normaal.',
        lastUpdated: new Date().toISOString()
    });
});

// Start server
app.listen(3000, () => {
    console.log('🌐 Website: http://localhost:3000');
    console.log('📡 API: http://localhost:3000/api/trainingen');
});

// ===========================================
// START BOT
// ===========================================
client.login(process.env.DISCORD_TOKEN);