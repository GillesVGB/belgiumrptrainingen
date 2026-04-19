const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const express = require('express');
const app = express();
const fetch = require('node-fetch');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

let trainingen = [];

// Kleuren voor embeds
const COLORS = {
    success: 0x00ff00,
    error: 0xff0000,
    info: 0x0099ff,
    warning: 0xffaa00,
    training: 0x5865F2
};

// ===========================================
// FUNCTIE OM NAAR NETLIFY TE STUREN
// ===========================================
async function sendToNetlify(training) {
    try {
        console.log('📤 Verstuur naar Netlify:', training.onderwerp);
        
        const response = await fetch('https://belgium-roleplay.netlify.app/.netlify/functions/api', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Training-Source': 'discord-bot'
            },
            body: JSON.stringify(training)
        });
        
        if (response.ok) {
            console.log('✅ Training naar Netlify gestuurd!');
            return true;
        } else {
            console.log(`❌ Netlify fout ${response.status}`);
            return false;
        }
    } catch (error) {
        console.error('❌ Fout bij versturen:', error.message);
        return false;
    }
}

// ===========================================
// FUNCTIE OM STATUS UPDATE TE STUREN
// ===========================================
async function updateStatusToNetlify(id, status, status_text) {
    try {
        const response = await fetch('https://belgium-roleplay.netlify.app/.netlify/functions/api', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status, status_text })
        });
        
        return response.ok;
    } catch (error) {
        console.error('❌ Fout bij status update:', error.message);
        return false;
    }
}

// ===========================================
// DISCORD COMMANDS MET MOOIE EMBEDS
// ===========================================
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    // ===========================================
    // COMMAND 1: TRAINING AANMAKEN
    // ===========================================
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
        await sendToNetlify(training);

        // Mooie embed
        const embed = new EmbedBuilder()
            .setTitle('✅ Training Aangemaakt!')
            .setColor(COLORS.success)
            .setDescription(`**${onderwerp}** is succesvol toegevoegd aan het systeem.`)
            .addFields(
                { name: '📌 Dienst', value: `\`${dienst}\``, inline: true },
                { name: '👤 Trainer', value: trainer, inline: true },
                { name: '📅 Datum/Tijd', value: `${datum} om ${tijd}`, inline: true },
                { name: '👥 Max deelnemers', value: `${maxDeelnemers}`, inline: true },
                { name: '🆔 Training ID', value: `\`${training.id}\``, inline: true },
                { name: '🎯 Status', value: '🟦 Nog niet gestart', inline: true }
            )
            .setFooter({ text: `Toegevoegd door ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }

    // ===========================================
    // COMMAND 2: ALLE TRAININGEN BEKIJKEN
    // ===========================================
    else if (interaction.commandName === 'trainingen') {
        if (trainingen.length === 0) {
            const embed = new EmbedBuilder()
                .setTitle('📭 Geen Trainingen')
                .setColor(COLORS.warning)
                .setDescription('Er zijn nog geen trainingen aangemaakt.')
                .addFields({ name: '💡 Tip', value: 'Gebruik `/training` om een training toe te voegen!' })
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed] });
            return;
        }
        
        const statusIcons = {
            'not_started': '🟦',
            'in_progress': '🟨',
            'completed': '🟩',
            'cancelled': '🟥',
            'delayed': '🟪'
        };
        
        let beschrijving = '';
        trainingen.slice(-8).reverse().forEach((t, i) => {
            beschrijving += `${statusIcons[t.status] || '📌'} **${t.onderwerp}**\n`;
            beschrijving += `└ 🆔 \`${t.id}\` | 📅 ${t.datum} om ${t.tijd} | 👤 ${t.trainer}\n\n`;
        });
        
        const embed = new EmbedBuilder()
            .setTitle('📋 Trainingen Overzicht')
            .setColor(COLORS.training)
            .setDescription(beschrijving || 'Geen trainingen gevonden')
            .addFields({ name: '📊 Totaal', value: `${trainingen.length} trainingen`, inline: true })
            .addFields({ name: '💡 Tip', value: 'Gebruik `/veranderstatus` om status te wijzigen', inline: true })
            .setFooter({ text: 'Laatste 8 trainingen worden getoond' })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    }

    // ===========================================
    // COMMAND 3: STATUS VERANDEREN
    // ===========================================
    else if (interaction.commandName === 'veranderstatus') {
        const id = interaction.options.getString('id');
        const nieuweStatus = interaction.options.getString('status');
        
        const training = trainingen.find(t => t.id === id);
        
        if (!training) {
            const embed = new EmbedBuilder()
                .setTitle('❌ Training niet gevonden')
                .setColor(COLORS.error)
                .setDescription(`Geen training gevonden met ID: \`${id}\``)
                .addFields({ name: '💡 Tip', value: 'Gebruik `/trainingen` om alle ID\'s te zien' })
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed] });
            return;
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
        
        await updateStatusToNetlify(id, nieuweStatus, training.status_text);
        
        const embed = new EmbedBuilder()
            .setTitle('✅ Status Gewijzigd!')
            .setColor(COLORS.success)
            .setDescription(`Status van **${training.onderwerp}** is bijgewerkt.`)
            .addFields(
                { name: '📌 Training', value: training.onderwerp, inline: true },
                { name: '🆔 ID', value: `\`${training.id}\``, inline: true },
                { name: '📊 Oude status', value: `${statusIcons[training.status]} ${oudeStatus}`, inline: true },
                { name: '🎯 Nieuwe status', value: `${statusIcons[nieuweStatus]} ${training.status_text}`, inline: true }
            )
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    }

    // ===========================================
    // COMMAND 4: TRAINING VERWIJDEREN
    // ===========================================
    else if (interaction.commandName === 'verwijdertraining') {
        const id = interaction.options.getString('id');
        
        const index = trainingen.findIndex(t => t.id === id);
        
        if (index === -1) {
            const embed = new EmbedBuilder()
                .setTitle('❌ Training niet gevonden')
                .setColor(COLORS.error)
                .setDescription(`Geen training gevonden met ID: \`${id}\``)
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed] });
            return;
        }
        
        const verwijderde = trainingen[index];
        trainingen.splice(index, 1);
        
        try {
            await fetch(`https://belgium-roleplay.netlify.app/.netlify/functions/api?id=${id}`, {
                method: 'DELETE'
            });
        } catch (error) {}
        
        const embed = new EmbedBuilder()
            .setTitle('🗑️ Training Verwijderd')
            .setColor(COLORS.error)
            .setDescription(`**${verwijderde.onderwerp}** is verwijderd uit het systeem.`)
            .addFields(
                { name: '📌 Dienst', value: verwijderde.dienst, inline: true },
                { name: '👤 Trainer', value: verwijderde.trainer, inline: true },
                { name: '📅 Datum', value: `${verwijderde.datum} om ${verwijderde.tijd}`, inline: true }
            )
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    }

    // ===========================================
    // COMMAND 5: HELP
    // ===========================================
    else if (interaction.commandName === 'help') {
        const embed = new EmbedBuilder()
            .setTitle('🤖 Bot Commando\'s')
            .setColor(COLORS.training)
            .setDescription('Hier zijn alle beschikbare commando\'s voor het training systeem.')
            .addFields(
                { name: '📝 Trainingen', value: '`/training` - Nieuwe training maken\n`/trainingen` - Alle trainingen bekijken', inline: false },
                { name: '🎯 Status', value: '`/veranderstatus` - Status wijzigen\n`/verwijdertraining` - Training verwijderen', inline: false },
                { name: '📊 Informatie', value: '`/stats` - Bot statistieken\n`/help` - Dit overzicht', inline: false },
                { name: '🎨 Status Opties', value: '🟦 Nog niet gestart\n🟨 Bezig\n🟩 Afgerond\n🟥 Geannuleerd\n🟪 Uitgesteld', inline: false }
            )
            .setFooter({ text: 'Belgium Roleplay Training Systeem' })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    }

    // ===========================================
    // COMMAND 6: STATISTIEKEN
    // ===========================================
    else if (interaction.commandName === 'stats') {
        const total = trainingen.length;
        const notStarted = trainingen.filter(t => t.status === 'not_started').length;
        const inProgress = trainingen.filter(t => t.status === 'in_progress').length;
        const completed = trainingen.filter(t => t.status === 'completed').length;
        const cancelled = trainingen.filter(t => t.status === 'cancelled').length;
        const discordCount = trainingen.filter(t => t.van_discord).length;
        
        const embed = new EmbedBuilder()
            .setTitle('📊 Bot Statistieken')
            .setColor(COLORS.info)
            .setDescription('Huidige status van het training systeem.')
            .addFields(
                { name: '📋 Trainingen', value: `Totaal: **${total}**`, inline: false },
                { name: '🟦 Nog niet gestart', value: `${notStarted}`, inline: true },
                { name: '🟨 Bezig', value: `${inProgress}`, inline: true },
                { name: '🟩 Afgerond', value: `${completed}`, inline: true },
                { name: '🟥 Geannuleerd', value: `${cancelled}`, inline: true },
                { name: '🤖 Discord', value: `Via Discord: **${discordCount}**`, inline: true },
                { name: '💻 Handmatig', value: `${total - discordCount}`, inline: true }
            )
            .setFooter({ text: `Laatste update • ${new Date().toLocaleString('nl-NL')}` })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    }
});

// ===========================================
// COMMAND REGISTRATIE
// ===========================================
client.once('ready', async () => {
    console.log(`✅ Bot is online als ${client.user.tag}`);
    
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
    console.log('📋 /training, /trainingen, /veranderstatus, /verwijdertraining, /help, /stats');
});

// ===========================================
// LOKALE API
// ===========================================
app.get('/api/trainingen', (req, res) => {
    res.json(trainingen);
});

app.use(express.static('public'));

app.listen(3000, () => {
    console.log('🌐 Lokale website: http://localhost:3000');
});

// ===========================================
// START BOT (VERVANG MET JE TOKEN!)
// ===========================================
client.login(process.env.DISCORD_TOKEN);
