const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const app = express();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

let trainingen = [];

// ===========================================
// BOT START
// ===========================================
client.once('ready', () => {
    console.log('✅ Bot is online als', client.user.tag);
    console.log('🌐 In server:', client.guilds.cache.map(g => g.name).join(', '));
    
    // Commands registreren
    const commands = [
        {
            name: 'ping',
            description: 'Test of de bot werkt'
        },
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
            name: 'veranderstatus',
            description: 'Verander status van training',
            options: [
                {
                    name: 'id',
                    description: 'ID van de training',
                    type: 3,
                    required: true
                },
                {
                    name: 'status',
                    description: 'Nieuwe status',
                    type: 3,
                    required: true,
                    choices: [
                        { name: '🟦 Nog niet gestart', value: 'not_started' },
                        { name: '🟨 Bezig', value: 'in_progress' },
                        { name: '🟩 Afgerond', value: 'completed' },
                        { name: '🟥 Geannuleerd', value: 'cancelled' }
                    ]
                }
            ]
        },
        {
            name: 'help',
            description: 'Bekijk alle commands'
        }
    ];
    
    client.application.commands.set(commands)
        .then(() => {
            console.log('✅ Commands geregistreerd!');
            console.log('📋 Typ / in Discord om de commands te zien');
        })
        .catch(console.error);
});

// ===========================================
// COMMANDS AFHANDELEN
// ===========================================
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    // PING COMMAND
    if (interaction.commandName === 'ping') {
        await interaction.reply('Pong! 🏓');
        console.log('📌 Ping command gebruikt');
    }

    // TRAINING AANMAKEN
    else if (interaction.commandName === 'training') {
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
            maxDeelnemers: maxDeelnemers,
            status: 'not_started',
            status_text: 'Nog niet gestart',
            aangemeld: []
        };

        trainingen.push(training);
        
        await interaction.reply({
            content: `✅ **Training aangemaakt!**\n` +
                    `📌 **Onderwerp:** ${onderwerp}\n` +
                    `📅 **Datum:** ${datum} om ${tijd}\n` +
                    `👤 **Trainer:** ${trainer}\n` +
                    `🆔 **ID:** \`${training.id}\``
        });
        
        console.log('✅ Nieuwe training:', training);
    }

    // ALLE TRAININGEN BEKIJKEN
    else if (interaction.commandName === 'trainingen') {
        if (trainingen.length === 0) {
            await interaction.reply('📭 Nog geen trainingen. Gebruik `/training` om er een te maken!');
            return;
        }
        
        let bericht = '**📋 TRAININGEN**\n\n';
        trainingen.slice(-5).reverse().forEach((t, i) => {
            const icons = {
                'not_started': '🟦',
                'in_progress': '🟨',
                'completed': '🟩',
                'cancelled': '🟥'
            };
            bericht += `${icons[t.status] || '📌'} **${t.onderwerp}**\n`;
            bericht += `🆔 \`${t.id}\`\n`;
            bericht += `📅 ${t.datum} om ${t.tijd}\n`;
            bericht += `👤 ${t.trainer}\n\n`;
        });
        
        await interaction.reply(bericht);
    }

    // STATUS VERANDEREN
    else if (interaction.commandName === 'veranderstatus') {
        const id = interaction.options.getString('id');
        const nieuweStatus = interaction.options.getString('status');
        
        const training = trainingen.find(t => t.id === id);
        
        if (!training) {
            await interaction.reply({
                content: `❌ Geen training met ID: \`${id}\``,
                ephemeral: true
            });
            return;
        }
        
        const statussen = {
            'not_started': 'Nog niet gestart',
            'in_progress': 'Bezig',
            'completed': 'Afgerond',
            'cancelled': 'Geannuleerd'
        };
        
        training.status = nieuweStatus;
        training.status_text = statussen[nieuweStatus];
        
        await interaction.reply(`✅ Status van **${training.onderwerp}** gewijzigd naar **${training.status_text}**`);
    }

    // HELP
    else if (interaction.commandName === 'help') {
        await interaction.reply({
            content: `**🤖 BOT COMMANDS**\n\n` +
                    `\`/ping\` - Test of bot werkt\n` +
                    `\`/training\` - Nieuwe training\n` +
                    `\`/trainingen\` - Alle trainingen\n` +
                    `\`/veranderstatus\` - Status wijzigen\n` +
                    `\`/help\` - Dit menu`,
            ephemeral: true
        });
    }
});

// ===========================================
// WEBSITE
// ===========================================
app.get('/api/trainingen', (req, res) => {
    res.json(trainingen);
});

app.use(express.static('public'));

app.listen(3000, () => {
    console.log('🌐 Website: http://localhost:3000');
});

// ===========================================
// TOKEN - VERVANG DIT!
// ===========================================
client.login('MTIxMjE0NDE4MTE5MjA0MDUyOA.GUZqFB.QRp20QaOkySjngPSQ4DRDkWngEJYGmHRIptwTs');