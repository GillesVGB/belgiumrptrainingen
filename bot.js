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
    if (interaction.commandName === 'training') {
        const dienst = interaction.options.getString('dienst');
        const datum = interaction.options.getString('datum');
        const tijd = interaction.options.getString('tijd');
        const onderwerp = interaction.options.getString('onderwerp');
        const trainer = interaction.options.getString('trainer');
        const maxDeelnemers = interaction.options.getInteger('max_deelnemers');
        
        const training = {
            id: Date.now().toString(),
            dienst: dienst,
            datum: datum,
            tijd: tijd,
            onderwerp: onderwerp,
            trainer: trainer,
            host: interaction.user.username,
            hostId: interaction.user.id,
            maxDeelnemers: maxDeelnemers,
            status: 'not_started',
            status_text: 'Nog niet gestart',
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
                { name: '📌 Dienst', value: `\`${dienst}\``, inline: true },
                { name: '👤 Trainer', value: trainer, inline: true },
                { name: '📅 Datum/Tijd', value: `${datum} om ${tijd}`, inline: true },
                { name: '👥 Max deelnemers', value: `${maxDeelnemers}`, inline: true },
                { name: '🆔 ID', value: `\`${training.id}\``, inline: true }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }

    // ALLE TRAININGEN BEKIJKEN
    else if (interaction.commandName === 'trainingen') {
        if (trainingen.length === 0) {
            return interaction.reply('📭 Geen trainingen gevonden.');
        }
        
        const statusIcons = {
            'not_started': '🟦',
            'in_progress': '🟨',
            'completed': '🟩',
            'cancelled': '🟥',
            'delayed': '🟪'
        };
        
        let beschrijving = '';
        trainingen.slice(-8).reverse().forEach((t) => {
            beschrijving += `${statusIcons[t.status] || '📌'} **${t.onderwerp}**\n`;
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

    // STATUS VERANDEREN
    else if (interaction.commandName === 'veranderstatus') {
        const id = interaction.options.getString('id');
        const nieuweStatus = interaction.options.getString('status');
        
        const training = trainingen.find(t => t.id === id);
        
        if (!training) {
            return interaction.reply(`❌ Training met ID \`${id}\` niet gevonden.`);
        }
        
        const statusTeksten = {
            'not_started': 'Nog niet gestart',
            'in_progress': 'Bezig',
            'completed': 'Afgerond',
            'cancelled': 'Geannuleerd',
            'delayed': 'Uitgesteld'
        };
        
        const statusIcons = {
            'not_started': '🟦',
            'in_progress': '🟨',
            'completed': '🟩',
            'cancelled': '🟥',
            'delayed': '🟪'
        };
        
        const oudeStatus = training.status_text;
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
                { name: '📊 Oude status', value: `${statusIcons[training.status]} ${oudeStatus}`, inline: true },
                { name: '🎯 Nieuwe status', value: `${statusIcons[nieuweStatus]} ${training.status_text}`, inline: true }
            )
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    }

    // TRAINING VERWIJDEREN
    else if (interaction.commandName === 'verwijdertraining') {
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
                { name: '📝 Trainingen', value: '`/training` - Nieuwe training maken\n`/trainingen` - Alle trainingen bekijken', inline: false },
                { name: '🎯 Status', value: '`/veranderstatus` - Status wijzigen\n`/verwijdertraining` - Training verwijderen', inline: false },
                { name: '📊 Informatie', value: '`/stats` - Bot statistieken\n`/help` - Dit overzicht', inline: false }
            )
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    }

    // STATISTIEKEN
    else if (interaction.commandName === 'stats') {
        const total = trainingen.length;
        const notStarted = trainingen.filter(t => t.status === 'not_started').length;
        const inProgress = trainingen.filter(t => t.status === 'in_progress').length;
        const completed = trainingen.filter(t => t.status === 'completed').length;
        const cancelled = trainingen.filter(t => t.status === 'cancelled').length;
        
        const embed = new EmbedBuilder()
            .setTitle('📊 Bot Statistieken')
            .setColor(COLORS.info)
            .addFields(
                { name: '📋 Totaal trainingen', value: `${total}`, inline: true },
                { name: '🟦 Nog niet gestart', value: `${notStarted}`, inline: true },
                { name: '🟨 Bezig', value: `${inProgress}`, inline: true },
                { name: '🟩 Afgerond', value: `${completed}`, inline: true },
                { name: '🟥 Geannuleerd', value: `${cancelled}`, inline: true }
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
            name: 'training',
            description: 'Maak een nieuwe training aan',
            options: [
                {
                    name: 'dienst',
                    description: 'Welke dienst?',
                    type: 3,
                    required: true,
                    choices: [
                        { name: '🚔 Politie', value: 'politie' },
                        { name: '🚑 Ambulance', value: 'ambulance' },
                        { name: '🚒 Brandweer', value: 'brandweer' },
                        { name: '🔧 Handhaving', value: 'handhaving' },
                        { name: '👮 Algemeen', value: 'algemeen' }
                    ]
                },
                { name: 'datum', description: 'Datum (DD/MM/YYYY)', type: 3, required: true },
                { name: 'tijd', description: 'Tijd (HH:MM)', type: 3, required: true },
                { name: 'onderwerp', description: 'Onderwerp training', type: 3, required: true },
                { name: 'trainer', description: 'Naam trainer', type: 3, required: true },
                { name: 'max_deelnemers', description: 'Max aantal deelnemers', type: 4, required: true, min_value: 1, max_value: 50 }
            ]
        },
        { name: 'trainingen', description: 'Bekijk alle trainingen' },
        {
            name: 'veranderstatus',
            description: 'Verander status van training',
            options: [
                { name: 'id', description: 'ID van training', type: 3, required: true },
                {
                    name: 'status',
                    description: 'Nieuwe status',
                    type: 3,
                    required: true,
                    choices: [
                        { name: '🟦 Nog niet gestart', value: 'not_started' },
                        { name: '🟨 Bezig', value: 'in_progress' },
                        { name: '🟩 Afgerond', value: 'completed' },
                        { name: '🟥 Geannuleerd', value: 'cancelled' },
                        { name: '🟪 Uitgesteld', value: 'delayed' }
                    ]
                }
            ]
        },
        { name: 'verwijdertraining', description: 'Verwijder een training', options: [{ name: 'id', description: 'ID van training', type: 3, required: true }] },
        { name: 'help', description: 'Bekijk alle commands' },
        { name: 'stats', description: 'Bekijk bot statistieken' }
    ];
    
    await client.application.commands.set(commands);
    console.log('✅ Commands geregistreerd!');
});

// ===========================================
// API VOOR WEBSITE (Lokale bot)
// ===========================================
// GET - Haal alle trainingen op
app.get('/api/trainingen', (req, res) => {
    res.json(trainingen);
});

// GET - Haal specifieke training op
app.get('/api/training/:id', (req, res) => {
    const training = trainingen.find(t => t.id === req.params.id);
    if (training) {
        res.json(training);
    } else {
        res.status(404).json({ error: 'Training niet gevonden' });
    }
});

// POST - Nieuwe training
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

// Start server
app.listen(3000, () => {
    console.log('🌐 Website: http://localhost:3000');
    console.log('📡 API: http://localhost:3000/api/trainingen');
    console.log('🗑️ DELETE: http://localhost:3000/api/training?id=ID');
});

// ===========================================
// START BOT
// ===========================================
client.login(process.env.DISCORD_TOKEN);