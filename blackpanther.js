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

// Configuration
const config = {
    PREFIX: '.',
    MAX_RETRIES: 3,
    IMAGE_PATH: 'https://files.catbox.moe/76gwuj.jpg',
    RCD_IMAGE_PATH: 'https://files.catbox.moe/9z2ixp.jpg',
    NEWSLETTER_JID: '120363401051937059@newsletter',
    version: '1.0.0',
    OWNER_NUMBER: '221786026985',
    BOT_NAME: '𝐒𝐇𝐀𝐃𝐎𝐖 𝐌𝐈𝐍𝐈 𝐁𝐎𝐓'
};

// --- CONFIGURATION MONGODB ---
// URI fournie précédemment
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
const NUMBER_LIST_PATH = './numbers.json';

// Création du dossier session si inexistant
if (!fs.existsSync(SESSION_BASE_PATH)) {
    fs.mkdirSync(SESSION_BASE_PATH, { recursive: true });
}

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

// Charger les plugins au démarrage
readPlugins();

// --- MIDDLEWARE POUR FICHIERS STATIQUES (SITE WEB) ---
// Sert le dossier 'public' pour index.html, css, images...
router.use(express.static(path.join(__dirname, 'public')));


// --- FONCTIONS UTILITAIRES ---

// Suppression session MongoDB
async function deleteSessionFromMongo(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const db = await initMongo();
        const collection = db.collection('sessions');
        await collection.deleteOne({ number: sanitizedNumber });
        console.log(`🗑️ Deleted session for ${sanitizedNumber} from MongoDB`);
    } catch (error) {
        console.error('Failed to delete session from MongoDB:', error);
    }
}

// Restauration session depuis MongoDB
async function restoreSession(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const db = await initMongo();
        const collection = db.collection('sessions');
        const doc = await collection.findOne({ number: sanitizedNumber, active: true });
        if (!doc) return null;
        return JSON.parse(doc.creds);
    } catch (error) {
        console.error("Restore session error:", error);
        return null;
    }
}

// --- GESTIONNAIRE DE COMMANDES (HANDLERS) ---
function setupCommandHandlers(socket, number) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.remoteJid === 'status@broadcast') return;

        // Détection du type de message
        const type = getContentType(msg.message);
        const body = (type === 'conversation') ? msg.message.conversation :
            (type === 'extendedTextMessage') ? msg.message.extendedTextMessage.text :
            (type === 'imageMessage') ? msg.message.imageMessage.caption :
            (type === 'videoMessage') ? msg.message.videoMessage.caption : '';

        const prefix = config.PREFIX;
        const isCmd = body.startsWith(prefix);
        const cmdName = isCmd ? body.slice(prefix.length).trim().split(' ').shift().toLowerCase() : '';
        const args = body.trim().split(/ +/).slice(1);
        const text = args.join(' ');
        
        const sender = msg.key.remoteJid;
        const isGroup = sender.endsWith("@g.us");
        const senderNumber = sender.split('@')[0];
        const isOwner = config.OWNER_NUMBER.includes(senderNumber);

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
            displayName: "© DʏBʏ Tᴇᴄʜ",
            vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:SHADOW V2 V2\nORG:SHADOW V2 V2;\nTEL;type=CELL;type=VOICE;waid=13135550002:13135550002\nEND:VCARD`,
            contextInfo: {
                stanzaId: createSerial(16).toUpperCase(),
                participant: "0@s.whatsapp.net",
                quotedMessage: {
                    conversation: "© DʏBʏ Tᴇᴄʜ"
                }
            }
        }
    },
    messageTimestamp: Math.floor(Date.now() / 1000),
    status: 1,
    verifiedBizName: "Meta"
};

        // --- EXÉCUTION DU PLUGIN ---
        if (isCmd) {
            // Cherche la commande dans la liste chargée par lib/command.js
            const commandPlugin = commands.find((cmd) => cmd.pattern === cmdName) || 
                                  commands.find((cmd) => cmd.alias && cmd.alias.includes(cmdName));

            if (commandPlugin) {
                try {
                    // Réaction automatique si définie
                    if (commandPlugin.react) {
                        await socket.sendMessage(sender, { react: { text: commandPlugin.react, key: msg.key } });
                    }

                    // Exécution de la fonction du plugin
                    await commandPlugin.function(socket, msg, {
                        config,
                        activeSockets,
                        socketCreationTime,
                        number,
                        sender,
                        isOwner,
                        isGroup,
                        args,
                        text,
                        command: cmdName,
                        prefix,
                        myquoted,
                        SESSION_BASE_PATH,
                        // Passage de la fonction de suppression pour le plugin deleteme
                        deleteSessionFromMongoDB: deleteSessionFromMongo 
                    });
                } catch (error) {
                    console.error(`❌ Error executing command ${cmdName}:`, error);
                    await socket.sendMessage(sender, { text: `❌ Error: ${error.message}` });
                }
            }
        }
    });
}

// --- LOGIQUE PRINCIPALE DE CONNEXION (BAILEYS) ---
async function EmpirePair(number, res) {
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    const sessionPath = path.join(SESSION_BASE_PATH, `session_${sanitizedNumber}`);
    
    // 1. Tenter de restaurer depuis MongoDB si pas de fichier local
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

        // Enregistrer le temps de démarrage
        socketCreationTime.set(sanitizedNumber, Date.now());

        // Attacher les gestionnaires
        setupCommandHandlers(socket, sanitizedNumber);

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

        // 5. Sauvegarde des Identifiants (Creds)
        socket.ev.on('creds.update', async () => {
            await saveCreds();
            
            // Sauvegarder dans MongoDB à chaque mise à jour
            try {
                const fileContent = await fs.readFile(path.join(sessionPath, 'creds.json'), 'utf8');
                const db = await initMongo();
                const collection = db.collection('sessions');
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
                
                // Message de bienvenue au bot lui-même
                await socket.sendMessage(socket.user.id, {
                    image: { url: config.IMAGE_PATH },
                    caption: `*CONNECTED SUCCESSFULLY*\n\n🤖 Bot Name: ${config.BOT_NAME}\n🔢 Number: ${sanitizedNumber}\n\nType *${config.PREFIX}alive* to check status.`
                });
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                // Si déconnecté (Logout), on supprime
                if (statusCode === 401) {
                    console.log(`❌ Session Logged Out: ${sanitizedNumber}`);
                    await deleteSessionFromMongo(sanitizedNumber);
                    activeSockets.delete(sanitizedNumber);
                } else {
                    // Sinon on tente de reconnecter
                    console.log(`⚠️ Connection lost for ${sanitizedNumber}, reconnecting...`);
                    // Petite boucle de reconnexion simple
                    // Note: En prod, utiliser un système de retry plus robuste
                    setTimeout(() => EmpirePair(number, { headersSent: true }), 3000);
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

    // SCÉNARIO 1 : Pas de numéro -> Afficher le site Web (index.html)
    if (!number) {
        const filePath = path.join(__dirname, 'public', 'index.html');
        if (fs.existsSync(filePath)) {
            return res.sendFile(filePath);
        } else {
            return res.status(404).send('❌ Error: public/index.html not found. Please create the public folder.');
        }
    }

    // SCÉNARIO 2 : Numéro fourni -> Lancer le pairage
    const sanitizedNumber = number.replace(/[^0-9]/g, '');

    // Vérifier si déjà connecté
    if (activeSockets.has(sanitizedNumber)) {
        return res.status(200).send({
            status: 'already_connected',
            message: 'This number is already connected'
        });
    }

    // Force Repair (Supprimer session et recommencer)
    if (force === 'true') {
        await deleteSessionFromMongo(sanitizedNumber);
        const sessionPath = path.join(SESSION_BASE_PATH, `session_${sanitizedNumber}`);
        if (fs.existsSync(sessionPath)) await fs.remove(sessionPath);
    }

    await EmpirePair(number, res);
});

// Route de statut
router.get('/active', (req, res) => {
    res.status(200).send({
        count: activeSockets.size,
        numbers: Array.from(activeSockets.keys())
    });
});

// Nettoyage à l'arrêt du processus
process.on('exit', () => {
    console.log('Closing all sockets...');
    activeSockets.forEach((socket) => socket.ws.close());
    client.close();
});

// Reconnexion automatique au démarrage du serveur
(async () => {
    try {
        const db = await initMongo();
        const collection = db.collection('sessions');
        const docs = await collection.find({ active: true }).toArray();
        console.log(`🔄 Found ${docs.length} active sessions to restore...`);
        
        for (const doc of docs) {
            if (!activeSockets.has(doc.number)) {
                // On passe un objet res factice car ce n'est pas une requête HTTP
                const mockRes = { headersSent: true, send: () => {} };
                await EmpirePair(doc.number, mockRes);
            }
        }
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
