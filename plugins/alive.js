const { cmd } = require('./command');

// Fonction runtime
const runtime = function(seconds) {
    seconds = Number(seconds);
    var d = Math.floor(seconds / (3600 * 24));
    var h = Math.floor(seconds % (3600 * 24) / 3600);
    var m = Math.floor(seconds % 3600 / 60);
    var s = Math.floor(seconds % 60);
    var dDisplay = d > 0 ? d + (d == 1 ? " day, " : " days, ") : "";
    var hDisplay = h > 0 ? h + (h == 1 ? " hour, " : " hours, ") : "";
    var mDisplay = m > 0 ? m + (m == 1 ? " minute, " : " minutes, ") : "";
    var sDisplay = s > 0 ? s + (s == 1 ? " second" : " seconds") : "";
    return dDisplay + hDisplay + mDisplay + sDisplay;
}

cmd({
    pattern: "alive",
    desc: "Check if bot is active",
    category: "general",
    react: "🔮",
    filename: __filename
},
async(socket, m, { config, activeSockets, socketCreationTime, number, fakevCard, prefix }) => {
    try {
        const startTime = socketCreationTime.get(number) || Date.now();
        const uptime = runtime(Math.floor((Date.now() - startTime) / 1000));

        const captionText = `
   \`𝐒𝐇𝐀𝐃𝐎𝐖 𝐌𝐈𝐍𝐈 𝐁𝐎𝐓\`                  
*╭─────────────────⊷*
*│* ʙᴏᴛ ᴜᴘᴛɪᴍᴇ: ${uptime}
*│* ᴀᴄᴛɪᴠᴇ ʙᴏᴛs: ${activeSockets.size}
*│* ʏᴏᴜʀ ɴᴜᴍʙᴇʀ: ${number}
*│* ᴠᴇʀsɪᴏɴ: ${config.version}
*│* ᴍᴇᴍᴏʀʏ ᴜsᴀɢᴇ: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}ᴍʙ
*╰───────────────┈⊷*

> *▫️sʜᴀᴅᴏᴡ ᴍɪɴɪ ᴍᴀɪɴ*
> ʀᴇsᴘᴏɴᴅ ᴛɪᴍᴇ: ${Date.now() - m.messageTimestamp * 1000}ms`;

        const aliveMessage = {
            image: { url: config.IMAGE_PATH || 'https://files.catbox.moe/76gwuj.jpg' },
            caption: `> ᴀᴍ ᴀʟɪᴠᴇ ɴn ᴋɪᴄᴋɪɴɢ 👾\n\n${captionText}`,
            buttons: [
                {
                    buttonId: `${prefix}menu`,
                    buttonText: { displayText: '📂 ᴍᴇɴᴜ ᴏᴘᴛɪᴏɴ' },
                    type: 1
                },
                { buttonId: `${prefix}ping`, buttonText: { displayText: '💫 ᴘɪɴɢ' }, type: 1 }
            ],
            headerType: 1,
            viewOnce: true
        };

        await socket.sendMessage(m.key.remoteJid, aliveMessage, { quoted: fakevCard });

    } catch (e) {
        console.error(e);
        await socket.sendMessage(m.key.remoteJid, { text: '❌ Error in alive command' });
    }
});
