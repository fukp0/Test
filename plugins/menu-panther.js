const { cmd, commands } = require('./command');
const os = require('os');

// Fonction pour convertir les titres de catégories (Small Caps)
const toFancyCategory = (text) => {
    const map = {
        'a': 'ᴀ', 'b': 'ʙ', 'c': 'ᴄ', 'd': 'ᴅ', 'e': 'ᴇ', 'f': 'ғ', 'g': 'ɢ', 'h': 'ʜ', 'i': 'ɪ', 'j': 'ᴊ', 'k': 'ᴋ', 'l': 'ʟ', 'm': 'ᴍ', 'n': 'ɴ', 'o': 'ᴏ', 'p': 'ᴘ', 'q': 'ǫ', 'r': 'ʀ', 's': 's', 't': 'ᴛ', 'u': 'ᴜ', 'v': 'ᴠ', 'w': 'ᴡ', 'x': 'x', 'y': 'ʏ', 'z': 'ᴢ'
    };
    return text.toLowerCase().split('').map(c => map[c] || c).join('');
};

// Fonction pour convertir les commandes en Monospace (ex: ping -> 𝙿𝙸𝙽𝙶)
const toMono = (text) => {
    const map = {
        'a': '𝙰', 'b': '𝙱', 'c': '𝙲', 'd': '𝙳', 'e': '𝙴', 'f': '𝙵', 'g': '𝙶', 'h': '𝙷', 'i': '𝙸', 'j': '𝙹', 'k': '𝙺', 'l': '𝙻', 'm': '𝙼', 'n': '𝙽', 'o': '𝙾', 'p': '𝙿', 'q': '𝚀', 'r': '𝚁', 's': '𝚂', 't': '𝚃', 'u': '𝚄', 'v': '𝚅', 'w': '𝚆', 'x': '𝚇', 'y': '𝚈', 'z': '𝚉',
        '0': '𝟶', '1': '𝟷', '2': '𝟸', '3': '𝟹', '4': '𝟺', '5': '𝟻', '6': '𝟼', '7': '𝟽', '8': '𝟾', '9': '𝟿'
    };
    return text.toLowerCase().split('').map(c => map[c] || c).join('');
};

cmd({
    pattern: "menu",
    desc: "Displays the command list",
    category: "general",
    react: "🐆",
    filename: __filename
},
async(socket, m, { config, activeSockets, number, prefix }) => {
    try {
        // Header
        let menu = `
╭──────────────────⧉
│▢👤 *ᴜsᴇʀ* : @${m.sender.split('@')[0]}
│▢🤖 *ʙᴏᴛ* : ${config.BOT_NAME}
│▢👑 *ᴏᴡɴᴇʀ* : ${config.OWNER_NUMBER}
│▢🕰️ *ᴜᴘᴛɪᴍᴇ* : ${process.uptime().toFixed(2)}s
│▢🧠 *ʀᴀᴍ* : ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} ɢʙ
│▢ ᴅᴇᴠ : ᴅʏʙʏ x ɪɴᴄᴏɴɴᴜ
╰──────────────────⧉
`;

        const categoryMap = {};
        
        // Tri des commandes
        commands.forEach((command) => {
            if (!command.dontAddCommandList && command.pattern) {
                const category = command.category.toUpperCase();
                if (!categoryMap[category]) {
                    categoryMap[category] = [];
                }
                categoryMap[category].push(command.pattern);
            }
        });

        // Génération du menu
        for (const [category, cmdList] of Object.entries(categoryMap)) {
            // Titre de catégorie
            menu += `\n\n*${toFancyCategory(category)} ᴍᴇɴᴜ*`;
            
            // Bloc des commandes avec style Monospace
            menu += `\n> ╭─────────────────⊷`;
            cmdList.forEach(c => {
               
                menu += `\n> │ ${prefix}${toMono(c)}`;
            });
            menu += `\n> ╰─────────────────⊷`;
        }

        menu += `\n\n${config.BOT_FOOTER}`;

        // Envoi du message
        await socket.sendMessage(m.key.remoteJid, {
            image: { url: config.IMAGE_PATH },
            caption: menu,
            contextInfo: {
                mentionedJid: [m.sender],
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363401658098220@newsletter',
                    newsletterName: "ᴅʏʙʏ x ɪɴᴄᴏɴɴᴜ",
                    serverMessageId: 143
                }
            }
        });

    } catch (e) {
        console.log(e);
        m.reply("❌ ᴍᴇɴᴜ ᴇʀʀᴏʀ");
    }
});
