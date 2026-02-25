const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffmpegPath = ffmpegInstaller.path;
process.env.FFMPEG_PATH = ffmpegPath;

const ffmpeg = require('fluent-ffmpeg');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');
const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const router = express.Router();
const pino = require('pino');
const axios = require('axios');
const FormData = require('form-data');
const os = require('os');
const cheerio = require('cheerio');
const moment = require('moment-timezone');
const Jimp = require('jimp');
const crypto = require('crypto');
const FileType = require('file-type');
const yts = require('yt-search');
const { sms, downloadMediaMessage } = require("./lib/msg");
const TelegramBot = require('node-telegram-bot-api');
const https = require("https");
const fetch = require("node-fetch");
const { MongoClient } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const { commands, cmd } = require('./command'); // Import du gestionnaire de commandes

const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    getContentType,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser,
    downloadContentFromMessage
} = require('@whiskeysockets/baileys');

// --- CONFIGURATION ---
const config = {
    PREFIX: '.',
    MAX_RETRIES: 3,
    IMAGE_PATH: 'https://files.catbox.moe/76gwuj.jpg',
    RCD_IMAGE_PATH: 'https://files.catbox.moe/9z2ixp.jpg',
    NEWSLETTER_JID: '120363401051937059@newsletter',
    version: '1.0.0',
    OWNER_NUMBER: '221786026985',
    BOT_NAME: '𝐒𝐇𝐀𝐃𝐎𝐖 𝐌𝐈𝐍𝐈 𝐁𝐎𝐓',
    // --- NOUVEAUX PARAMÈTRES ANTILINK ---
    ANTILINK_ACTION: 'warn', // Options: 'delete', 'warn', 'kick'
    MAX_WARNS: 3 // Nombre d'avertissements avant expulsion (si mode 'warn')
};

// --- CONFIGURATION MONGODB ---
const mongoUri = 'mongodb+srv://dinuxx95_db:ipSgSOqHdNg1HuG0@cluster00.gohclgg.mongodb.net/dinu?retryWrites=true&w=majority&appName=Cluster00';
const client = new MongoClient(mongoUri);
let db;

async function initMongo() {
    if (!db) {
        try {
            await client.connect();
            db = client.db('dinu');
            await db.collection('sessions').createIndex({ number: 1 });
            console.log("✅ Connected to MongoDB");
        } catch (err) {
            console.error("❌ MongoDB Connection Error:", err);
        }
    }
    return db;
}

// Variables Globales
const activeSockets = new Map();
const socketCreationTime = new Map();
const SESSION_BASE_PATH = './session';

// Map pour stocker les messages pour l'Antidelete et les Warns de l'Antilink
const messageCache = new Map();
const userWarns = new Map(); // Stocke le nombre de warns: key = `${groupId}_${senderId}`

// Création du dossier session si inexistant
if (!fs.existsSync(SESSION_BASE_PATH)) {
    fs.mkdirSync(SESSION_BASE_PATH, { recursive: true });
}

// --- FONCTIONS UTILITAIRES ---
const createSerial = (size) => {
    return crypto.randomBytes(Math.ceil(size / 2)).toString('hex').slice(0, size);
};

// --- GÉNÉRATEUR SMALL CAPS ---
const smallCapsMap = {
    'a': 'ᴀ', 'b': 'ʙ', 'c': 'ᴄ', 'd': 'ᴅ', 'e': 'ᴇ', 'f': 'ғ', 'g': 'ɢ', 'h': 'ʜ', 'i': 'ɪ',
    'j': 'ᴊ', 'k': 'ᴋ', 'l': 'ʟ', 'm': 'ᴍ', 'n': 'ɴ', 'o': 'ᴏ', 'p': 'ᴘ', 'q': 'ǫ', 'r': 'ʀ',
    's': 'ꜱ', 't': 'ᴛ', 'u': 'ᴜ', 'v': 'ᴠ', 'w': 'ᴡ', 'x': 'x', 'y': 'ʏ', 'z': 'ᴢ',
    'A': 'ᴀ', 'B': 'ʙ', 'C': 'ᴄ', 'D': 'ᴅ', 'E': 'ᴇ', 'F': 'ғ', 'G': 'ɢ', 'H': 'ʜ', 'I': 'ɪ',
    'J': 'ᴊ', 'K': 'ᴋ', 'L': 'ʟ', 'M': 'ᴍ', 'N': 'ɴ', 'O': 'ᴏ', 'P': 'ᴘ', 'Q': 'ǫ', 'R': 'ʀ',
    'S': 'ꜱ', 'T': 'ᴛ', 'U': 'ᴜ', 'V': 'ᴠ', 'W': 'ᴡ', 'X': 'x', 'Y': 'ʏ', 'Z': 'ᴢ'
};
const toSmallCaps = (text) => text.replace(/[a-zA-Z]/g, char => smallCapsMap[char] || char);

// --- CHARGEMENT DES PLUGINS ---
function readPlugins() {
    console.log('🔄 Loading plugins...');
    const pluginsDir = path.join(__dirname, 'plugins');
    
    if (!fs.existsSync(pluginsDir)) {
        fs.mkdirSync(pluginsDir);
        console.log('📂 Created plugins directory.');
        return;
    }

    const files = fs.readdirSync(pluginsDir);
    files.forEach(file => {
        if (path.extname(file).toLowerCase() === '.js') {
            try {
                require(path.join(pluginsDir, file));
                console.log(`✅ Plugin loaded: ${file}`);
            } catch (e) {
                console.error(`❌ Error loading plugin ${file}:`, e);
            }
        }
    });
    console.log(`🚀 Total commands loaded: ${commands.length}`);
}

readPlugins();

// --- MIDDLEWARE POUR FICHIERS STATIQUES (SITE WEB) ---
router.use(express.static(path.join(__dirname, 'public')));

// Suppression session MongoDB
async function deleteSessionFromMongo(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const database = await initMongo();
        if (database) {
            await database.collection('sessions').deleteOne({ number: sanitizedNumber });
            console.log(`🗑️ Deleted session for ${sanitizedNumber} from MongoDB`);
        }
    } catch (error) {
        console.error('Failed to delete session from MongoDB:', error);
    }
}

// Restauration session depuis MongoDB
async function restoreSession(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const database = await initMongo();
        if (!database) return null;
        
        const collection = database.collection('sessions');
        const doc = await collection.findOne({ number: sanitizedNumber, active: true });
        if (!doc) return null;
        return JSON.parse(doc.creds);
    } catch (error) {
        console.error("Restore session error:", error);
        return null;
    }
}

// --- GESTIONNAIRE DE COMMANDES ET EVENEMENTS (HANDLERS) ---
function setupCommandHandlers(socket, number) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.remoteJid === 'status@broadcast') return;

        const groupId = msg.key.remoteJid;
        const isGroup = groupId.endsWith("@g.us");
        const senderId = isGroup ? (msg.key.participant || groupId) : groupId;
        const senderNumber = senderId.split('@')[0];
        const isOwner = config.OWNER_NUMBER.includes(senderNumber);

        // --- 🟢 ANTIDELETE SYSTEM (Stockage) ---
        messageCache.set(msg.key.id, msg);
        if (messageCache.size > 5000) {
            messageCache.delete(messageCache.keys().next().value); // Libérer la RAM
        }

        // --- 🟢 ANTIDELETE SYSTEM (Détection de suppression) ---
        if (msg.message?.protocolMessage?.type === 0 || msg.message?.protocolMessage?.type === 'REVOKE') {
            const deletedKey = msg.message.protocolMessage.key;
            const originalMsg = messageCache.get(deletedKey.id);
            if (originalMsg && isGroup) {
                const senderOfDeleted = deletedKey.participant || deletedKey.remoteJid;
                await socket.sendMessage(groupId, { 
                    text: toSmallCaps(`🚫 *Antidelete System* 🚫\nMessage de @${senderOfDeleted.split('@')[0]} supprimé. Récupération en cours...`),
                    mentions: [senderOfDeleted]
                });
                await socket.sendMessage(groupId, { forward: originalMsg }); // Renvoie le message d'origine
            }
        }

        // Détection du type de message
        const type = getContentType(msg.message);
        const body = (type === 'conversation') ? msg.message.conversation :
            (type === 'extendedTextMessage') ? msg.message.extendedTextMessage.text :
            (type === 'imageMessage') ? msg.message.imageMessage.caption :
            (type === 'videoMessage') ? msg.message.videoMessage.caption : '';

        // --- 🟢 ANTILINK SYSTEM MULTI-MODES ---
        const groupLinkRegex = /chat\.whatsapp\.com\/(?:invite\/)?([a-zA-Z0-9_-]{22})/i;
        if (isGroup && body && groupLinkRegex.test(body) && !isOwner) {
            try {
                const groupMetadata = await socket.groupMetadata(groupId);
                const participants = groupMetadata.participants;
                const senderParticipant = participants.find(p => p.id === senderId);
                const botJid = jidNormalizedUser(socket.user.id);
                const botParticipant = participants.find(p => p.id === botJid);
                
                const isSenderAdmin = senderParticipant?.admin === 'admin' || senderParticipant?.admin === 'superadmin';
                const isBotAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';

                if (!isSenderAdmin && isBotAdmin) {
                    await socket.sendMessage(groupId, { delete: msg.key }); // Toujours supprimer le lien

                    if (config.ANTILINK_ACTION === 'delete') {
                        await socket.sendMessage(groupId, { 
                            text: toSmallCaps(`🚫 *Antilink System* 🚫\n@${senderNumber}, l'envoi de liens n'est pas autorisé ici !`), 
                            mentions: [senderId] 
                        });
                    } 
                    else if (config.ANTILINK_ACTION === 'warn') {
                        const warnKey = `${groupId}_${senderId}`;
                        const currentWarns = (userWarns.get(warnKey) || 0) + 1;
                        userWarns.set(warnKey, currentWarns);

                        if (currentWarns >= config.MAX_WARNS) {
                            await socket.groupParticipantsUpdate(groupId, [senderId], 'remove');
                            await socket.sendMessage(groupId, { 
                                text: toSmallCaps(`🚫 *Antilink System* 🚫\n@${senderNumber} a été expulsé après avoir atteint la limite de ${config.MAX_WARNS} avertissements pour envoi de liens.`), 
                                mentions: [senderId] 
                            });
                            userWarns.delete(warnKey); // Reset
                        } else {
                            await socket.sendMessage(groupId, { 
                                text: toSmallCaps(`🚫 *Antilink Warn (${currentWarns}/${config.MAX_WARNS})* 🚫\n@${senderNumber}, l'envoi de liens est interdit ! Au bout de ${config.MAX_WARNS} avertissements, vous serez expulsé.`), 
                                mentions: [senderId] 
                            });
                        }
                    } 
                    else if (config.ANTILINK_ACTION === 'kick') {
                        await socket.groupParticipantsUpdate(groupId, [senderId], 'remove');
                        await socket.sendMessage(groupId, { 
                            text: toSmallCaps(`🚫 *Antilink System* 🚫\n@${senderNumber} a été expulsé pour avoir envoyé un lien de groupe.`), 
                            mentions: [senderId] 
                        });
                    }
                    return; // Stoppe l'exécution (pas de commande traitée)
                }
            } catch (e) {
                console.error("Antilink Error:", e);
            }
        }

        // --- GESTION DES COMMANDES PLUGINS ---
        const prefix = config.PREFIX;
        const isCmd = body && body.startsWith(prefix);
        const cmdName = isCmd ? body.slice(prefix.length).trim().split(' ').shift().toLowerCase() : '';
        const args = body ? body.trim().split(/ +/).slice(1) : [];
        const text = args.join(' ');

        // Fake vCard pour les citations
        const myquoted = {
            key: {
                remoteJid: 'status@broadcast',
                participant: '13135550002@s.whatsapp.net',
                fromMe: false,
                id: createSerial(16).toUpperCase()
            },
            message: {
                contactMessage: {
                    displayName: toSmallCaps("© DʏBʏ Tᴇᴄʜ"),
                    vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${toSmallCaps("SHADOW V2")}\nORG:${toSmallCaps("SHADOW V2")};\nTEL;type=CELL;type=VOICE;waid=13135550002:13135550002\nEND:VCARD`,
                    contextInfo: {
                        stanzaId: createSerial(16).toUpperCase(),
                        participant: "0@s.whatsapp.net",
                        quotedMessage: { conversation: toSmallCaps("© DʏBʏ Tᴇᴄʜ") }
                    }
                }
            }
        };

        if (isCmd) {
            const commandPlugin = commands.find((cmd) => cmd.pattern === cmdName) || 
                                  commands.find((cmd) => cmd.alias && cmd.alias.includes(cmdName));

            if (commandPlugin) {
                try {
                    if (commandPlugin.react) {
                        await socket.sendMessage(senderId, { react: { text: commandPlugin.react, key: msg.key } });
                    }

                    await commandPlugin.function(socket, msg, {
                        config,
                        activeSockets,
                        socketCreationTime,
                        number,
                        sender: senderId,
                        isOwner,
                        isGroup,
                        args,
                        text,
                        command: cmdName,
                        prefix,
                        myquoted,
                        SESSION_BASE_PATH,
                        deleteSessionFromMongoDB: deleteSessionFromMongo 
                    });
                } catch (error) {
                    console.error(`❌ Error executing command ${cmdName}:`, error);
                    await socket.sendMessage(senderId, { text: toSmallCaps(`❌ Error: ${error.message}`) });
                }
            }
        }
    });
}

// --- LOGIQUE PRINCIPALE DE CONNEXION (BAILEYS) ---
async function EmpirePair(number, res) {
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    const sessionPath = path.join(SESSION_BASE_PATH, `session_${sanitizedNumber}`);
    
    // 1. Tenter de restaurer depuis MongoDB
    const restoredCreds = await restoreSession(sanitizedNumber);
    if (restoredCreds) {
        await fs.ensureDir(sessionPath);
        await fs.writeFile(path.join(sessionPath, 'creds.json'), JSON.stringify(restoredCreds, null, 2));
        console.log(`♻️ Session restored from MongoDB for ${sanitizedNumber}`);
    }

    // 2. Initialiser Auth State
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const logger = pino({ level: 'fatal' });

    try {
        // 3. Créer le Socket
        const socket = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger),
            },
            printQRInTerminal: false,
            logger,
            browser: Browsers.macOS('Safari')
        });

        socketCreationTime.set(sanitizedNumber, Date.now());
        setupCommandHandlers(socket, sanitizedNumber);

        // --- 🟢 ANTIPROMOTE ET ANTIDEMOTE SYSTEM ---
        socket.ev.on('group-participants.update', async (update) => {
            const { id, participants, action, author } = update;
            if (!id.endsWith('@g.us') || !author) return;

            try {
                const botJid = jidNormalizedUser(socket.user.id);
                // Ignorer si c'est le bot lui-même ou le propriétaire
                if (author === botJid || config.OWNER_NUMBER.includes(author.split('@')[0])) return;

                const groupMetadata = await socket.groupMetadata(id);
                const botParticipant = groupMetadata.participants.find(p => p.id === botJid);
                const isBotAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';

                // Si le bot n'est pas admin, il ne peut pas agir
                if (!isBotAdmin) return;

                if (action === 'promote') {
                    await socket.sendMessage(id, { 
                        text: toSmallCaps(`🚫 *AntiPromote System* 🚫\nPromotion non autorisée par @${author.split('@')[0]}. Annulation en cours...`),
                        mentions: [author, ...participants]
                    });
                    await socket.groupParticipantsUpdate(id, participants, 'demote'); // Rétrograde
                } else if (action === 'demote') {
                    await socket.sendMessage(id, { 
                        text: toSmallCaps(`🚫 *AntiDemote System* 🚫\nRétrogradation non autorisée par @${author.split('@')[0]}. Annulation en cours...`),
                        mentions: [author, ...participants]
                    });
                    await socket.groupParticipantsUpdate(id, participants, 'promote'); // Promeut
                }
            } catch (err) {
                console.error("AntiPromote/AntiDemote Error:", err);
            }
        });

        // 4. Gestion du Pairage (Code)
        if (!socket.authState.creds.registered) {
            await delay(1500);
            try {
                const code = await socket.requestPairingCode(sanitizedNumber);
                if (!res.headersSent) {
                    res.send({ code });
                }
            } catch (err) {
                console.error("Pairing Code Error:", err);
                if (!res.headersSent) res.status(500).send({ error: "Failed to request code" });
            }
        } else {
            if (!res.headersSent) {
                res.send({ status: 'already_paired', message: 'Session restored and connecting' });
            }
        }

        // 5. Sauvegarde des Identifiants
        socket.ev.on('creds.update', async () => {
            await saveCreds();
            
            try {
                const fileContent = await fs.readFile(path.join(sessionPath, 'creds.json'), 'utf8');
                const database = await initMongo();
                if (database) {
                    const collection = database.collection('sessions');
                    await collection.updateOne(
                        { number: sanitizedNumber },
                        {
                            $set: {
                                number: sanitizedNumber,
                                creds: fileContent,
                                active: true,
                                updatedAt: new Date()
                            }
                        },
                        { upsert: true }
                    );
                }
            } catch (err) {
                console.error("Error saving creds to Mongo:", err);
            }
        });

        // 6. Gestion de la Connexion
        socket.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'open') {
                console.log(`✅ Connected: ${sanitizedNumber}`);
                activeSockets.set(sanitizedNumber, socket);
                
                await socket.sendMessage(socket.user.id, {
                    image: { url: config.IMAGE_PATH },
                    caption: toSmallCaps(`*CONNECTED SUCCESSFULLY*\n\n🤖 Bot Name: ${config.BOT_NAME}\n🔢 Number: ${sanitizedNumber}\n\nType *${config.PREFIX}alive* to check status.`)
                });
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                if (statusCode === 401) { 
                    console.log(`❌ Session Logged Out: ${sanitizedNumber}`);
                    await deleteSessionFromMongo(sanitizedNumber);
                    activeSockets.delete(sanitizedNumber);
                    if (fs.existsSync(sessionPath)) await fs.remove(sessionPath);
                } else {
                    console.log(`⚠️ Connection lost for ${sanitizedNumber}, reconnecting...`);
                    const mockRes = { headersSent: true, status: function() { return this; }, send: function() {} };
                    setTimeout(() => EmpirePair(number, mockRes), 3000);
                }
            }
        });

    } catch (error) {
        console.error('EmpirePair Error:', error);
        if (!res.headersSent) res.status(503).send({ error: 'Service Unavailable' });
    }
}

// --- ROUTES EXPRESS ---
router.get('/', async (req, res) => {
    const { number, force } = req.query;

    if (!number) {
        const filePath = path.join(__dirname, 'public', 'index.html');
        if (fs.existsSync(filePath)) {
            return res.sendFile(filePath);
        } else {
            return res.status(404).send('❌ Error: public/index.html not found. Please create the public folder.');
        }
    }

    const sanitizedNumber = number.replace(/[^0-9]/g, '');

    if (activeSockets.has(sanitizedNumber)) {
        return res.status(200).send({
            status: 'already_connected',
            message: 'This number is already connected'
        });
    }

    if (force === 'true') {
        await deleteSessionFromMongo(sanitizedNumber);
        const sessionPath = path.join(SESSION_BASE_PATH, `session_${sanitizedNumber}`);
        if (fs.existsSync(sessionPath)) await fs.remove(sessionPath);
    }

    await EmpirePair(number, res);
});

router.get('/active', (req, res) => {
    res.status(200).send({
        count: activeSockets.size,
        numbers: Array.from(activeSockets.keys())
    });
});

process.on('exit', () => {
    console.log('Closing all sockets...');
    activeSockets.forEach((socket) => socket.ws.close());
    client.close();
});

// --- 🟢 AUTODELETE INACTIVE SESSIONS (Nettoyage automatique) ---
const SESSION_TIMEOUT_DAYS = 14; 

async function autoCleanInactiveSessions() {
    console.log('🧹 Running Auto-cleanup for inactive sessions...');
    try {
        const database = await initMongo();
        if (!database) return;
        const collection = database.collection('sessions');
        
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - SESSION_TIMEOUT_DAYS);
        
        const inactiveDocs = await collection.find({ updatedAt: { $lt: cutoffDate } }).toArray();
        for (const doc of inactiveDocs) {
            console.log(`🗑️ Auto-deleting expired DB session: ${doc.number}`);
            await deleteSessionFromMongo(doc.number);
            
            const sessionPath = path.join(SESSION_BASE_PATH, `session_${doc.number}`);
            if (fs.existsSync(sessionPath)) await fs.remove(sessionPath);
            
            if (activeSockets.has(doc.number)) {
                activeSockets.get(doc.number).ws.close();
                activeSockets.delete(doc.number);
            }
        }

        if (fs.existsSync(SESSION_BASE_PATH)) {
            const folders = fs.readdirSync(SESSION_BASE_PATH);
            for (const folder of folders) {
                if (folder.startsWith('session_')) {
                    const folderPath = path.join(SESSION_BASE_PATH, folder);
                    const stats = fs.statSync(folderPath);
                    const now = Date.now();
                    
                    if (now - stats.mtimeMs > 2 * 60 * 60 * 1000) {
                        const number = folder.replace('session_', '');
                        if (!activeSockets.has(number)) {
                            const inDb = await collection.findOne({ number });
                            if (!inDb) {
                                console.log(`🗑️ Auto-deleting abandoned local session folder: ${folder}`);
                                await fs.remove(folderPath);
                            }
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error('❌ Auto-cleanup Error:', error);
    }
}

setInterval(autoCleanInactiveSessions, 24 * 60 * 60 * 1000);

// --- RECONNEXION AU DÉMARRAGE ---
(async () => {
    try {
        const database = await initMongo();
        if (!database) return;
        
        const collection = database.collection('sessions');
        const docs = await collection.find({ active: true }).toArray();
        console.log(`🔄 Found ${docs.length} active sessions to restore...`);
        
        for (const doc of docs) {
            if (!activeSockets.has(doc.number)) {
                const mockRes = { 
                    headersSent: true, 
                    status: function() { return this; }, 
                    send: function() {} 
                };
                await EmpirePair(doc.number, mockRes);
            }
        }

        setTimeout(autoCleanInactiveSessions, 5 * 60 * 1000);

    } catch (e) {
        console.error('Startup Reconnect Error:', e);
    }
})();

async function loadNewsletterJIDsFromRaw() {
    try {
        const res = await axios.get('https://raw.githubusercontent.com/townen2/database/refs/heads/main/newsletter_list.json');
        return Array.isArray(res.data) ? res.data : [];
    } catch (err) {
        console.error('❌ Failed to load newsletter list from GitHub:', err.message);
        return [];
    }
}         

module.exports = router;
