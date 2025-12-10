const { MongoClient } = require('mongodb');
const moment = require('moment-timezone');
const { getNewsletterContext } = require('./context');

// Configuration MongoDB
const mongoUri = 'mongodb+srv://dinuxx95_db:ipSgSOqHdNg1HuG0@cluster00.gohclgg.mongodb.net/dinu?retryWrites=true&w=majority&appName=Cluster00';
const client = new MongoClient(mongoUri);
let db;

// Citations Black Panther & Sagesse Africaine
const quotes = [
    "Yibambe! (Tiens bon!)",
    "Wakanda Forever.",
    "La mort n'est pas la fin, c'est plutôt un point de départ.",
    "Montre-leur qui nous sommes.",
    "Un enfant qui n'est pas embrassé par son village le brûlera pour sentir sa chaleur.",
    "La sagesse est comme un baobab ; une seule personne ne peut l'embrasser.",
    "Nous devons trouver un moyen de nous protéger les uns les autres."
];

async function getGroupConfig(jid) {
    if (!db) {
        await client.connect();
        db = client.db('dinu');
    }
    const config = await db.collection('group_config').findOne({ jid: jid });
    return config || { welcome: false, goodbye: false };
}

async function setupGroupEvents(socket, config) {
    socket.ev.on('group-participants.update', async (update) => {
        try {
            const { id, participants, action } = update;
            
            // 1. Vérification Configuration
            const groupSettings = await getGroupConfig(id);
            if (!groupSettings.welcome && !groupSettings.goodbye) return;

            // 2. Infos Groupe
            let groupName = "Unknown Territory";
            let memberCount = "N/A";
            let desc = "";
            
            try {
                const metadata = await socket.groupMetadata(id);
                groupName = metadata.subject;
                memberCount = metadata.participants.length;
                desc = metadata.desc?.toString() || "";
            } catch (e) {}
            
            // 3. Variables de temps et contexte
            const date = moment().tz("Africa/Nairobi").format('DD/MM/YYYY');
            const time = moment().tz("Africa/Nairobi").format('HH:mm');
            const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
            const msgContext = getNewsletterContext(config); 

            for (const participant of participants) {
                let profilePic;
                try {
                    profilePic = await socket.profilePictureUrl(participant, 'image');
                } catch (e) {
                    profilePic = config.IMAGE_PATH; 
                }

                const userName = participant.split('@')[0];

                // --- WELCOME (Design Holographique) ---
                if (action === 'add' && groupSettings.welcome === true) {
                    const welcomeText = `
█▓▒░ ⚡ 𝐀𝐂𝐂𝐄𝐒𝐒 𝐆𝐑𝐀𝐍𝐓𝐄𝐃 ⚡ ░▒▓█

👤 *ɴᴇᴡ ᴀɢᴇɴᴛ* :: @${userName}
🛡️ *ʀᴀɴᴋ* :: 𝙼𝚎𝚖𝚋𝚎𝚛 𝙽𝚘. ${memberCount}

🏰 *ʙᴀsᴇ* :: ${groupName}
🕰️ *ᴛɪᴍᴇ* :: ${time} 〡 📅 *ᴅᴀᴛᴇ* :: ${date}

──────────────────────
🧬 *ᴅᴀᴛᴀ ʟᴏɢ:*
> "${randomQuote}"
──────────────────────

${config.BOT_FOOTER}
`;
                    await socket.sendMessage(id, {
                        image: { url: profilePic },
                        caption: welcomeText,
                        mentions: [participant],
                        contextInfo: {
                            ...msgContext,
                            mentionedJid: [participant]
                        }
                    });
                }

                // --- GOODBYE (Design Système Déconnecté) ---
                else if (action === 'remove' && groupSettings.goodbye === true) {
                    const goodbyeText = `
█▓▒░ 🚫 𝐀𝐂𝐂𝐄𝐒𝐒 𝐑𝐄𝐕𝐎𝐊𝐄𝐃 🚫 ░▒▓█

👤 *ᴛᴀʀɢᴇᴛ* :: @${userName}
🥀 *sᴛᴀᴛᴜs* :: 🔴 𝙾𝙵𝙵𝙻𝙸𝙽𝙴

📉 *sʏsᴛᴇᴍ ᴜᴘᴅᴀᴛᴇ:*
↳ ${memberCount - 1} ᴡᴀʀʀɪᴏʀs ʀᴇᴍᴀɪɴɪɴɢ.

──────────────────────
💀 *ғɪɴᴀʟ ᴍᴇssᴀɢᴇ:*
> "Tu as quitté le Wakanda. Que Bast veille sur ton âme."
──────────────────────

${config.BOT_FOOTER}
`;
                    await socket.sendMessage(id, {
                        image: { url: profilePic },
                        caption: goodbyeText,
                        mentions: [participant],
                        contextInfo: {
                            ...msgContext,
                            mentionedJid: [participant]
                        }
                    });
                }
            }
        } catch (err) {
            console.error('Error in group event handler:', err);
        }
    });
}

module.exports = { setupGroupEvents };
