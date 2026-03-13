const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const app = express();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

let trainingen = []; // Lokale opslag

// ===========================================
// FUNCTIE OM NAAR NETLIFY TE STUREN
// ===========================================
const fetch = require('node-fetch');

async function sendToNetlify(training) {
    try {
        console.log('📤 Verstuur naar Netlify:', training.onderwerp);
        
        const response = await fetch('https://belgiumrptrainingen.netlify.app/.netlify/functions/api', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Training-Source': 'discord-bot'
            },
            body: JSON.stringify(training)
        });
        
        const responseText = await response.text();
        
        if (response.ok) {
            console.log('✅ Training naar Netlify gestuurd!');
        } else {
            console.log(`❌ Netlify fout ${response.status}:`, responseText);
        }
    } catch (error) {
        console.error('❌ Fout bij versturen:', error.message);
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

        // Opslaan in lokaal geheugen
        trainingen.push(training);
        console.log('✅ Nieuwe training:', training);
        
        // 🔥 VERSTUREN NAAR NETLIFY 🔥
        await sendToNetlify(training);

        await interaction.reply({
            content: `✅ **Training aangemaakt!**\n` +
                    `📌 **Onderwerp:** ${onderwerp}\n` +
                    `📅 **Datum:** ${datum} om ${tijd}\n` +
                    `👤 **Trainer:** ${trainer}\n` +
                    `🆔 **ID:** \`${training.id}\``
        });
    }
});

// ===========================================
// COMMAND REGISTRATIE
// ===========================================
client.once('ready', async () => {
    console.log('✅ Bot is online!');
    
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
                        { name: '🚒 Brandweer', value: 'brandweer' }
                    ]
                },
                {
                    name: 'datum',
                    description: 'Datum (DD/MM/YYYY)',
                    type: 3,
                    required: true
                },
                {
                    name: 'tijd',
                    description: 'Tijd (HH:MM)',
                    type: 3,
                    required: true
                },
                {
                    name: 'onderwerp',
                    description: 'Onderwerp training',
                    type: 3,
                    required: true
                },
                {
                    name: 'trainer',
                    description: 'Naam trainer',
                    type: 3,
                    required: true
                },
                {
                    name: 'max_deelnemers',
                    description: 'Max aantal deelnemers',
                    type: 4,
                    required: true,
                    min_value: 1,
                    max_value: 50
                }
            ]
        },
        {
            name: 'trainingen',
            description: 'Bekijk alle trainingen'
        },
        {
            name: 'help',
            description: 'Bekijk alle commands'
        }
    ];
    
    await client.application.commands.set(commands);
    console.log('✅ Commands geregistreerd!');
});

// ===========================================
// LOKALE API (voor testen)
// ===========================================
app.get('/api/trainingen', (req, res) => {
    res.json(trainingen);
});

app.use(express.static('public'));

app.listen(3000, () => {
    console.log('🌐 Lokale website: http://localhost:3000');
});

// ===========================================
// START BOT (VERVANG TOKEN)
// ===========================================
client.login("MTIxMjE0NDE4MTE5MjA0MDUyOA.Go-XLu.B4_-b49tBM0Upe-JT9ZXk78kSrRJnpoEpDsh0w");
