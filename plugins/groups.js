const { cmd } = require('./command');

// --- TAG ALL ---
cmd({
    pattern: "tagall",
    desc: "Mentions all members",
    category: "group",
    react: "📢",
    filename: __filename
},
async(socket, m, { isGroup, isGroupAdmins, args }) => {
    if (!isGroup) return m.reply("❌ ɢʀᴏᴜᴘ ᴏɴʟʏ.");
    if (!isGroupAdmins) return m.reply("❌ ᴀᴅᴍɪɴ ᴏɴʟʏ.");

    const groupMetadata = await socket.groupMetadata(m.key.remoteJid);
    const participants = groupMetadata.participants;
    
    let text = `╭━━━〔 🚨 ɢᴇɴᴇʀᴀʟ ᴀʟᴇʀᴛ 🚨 〕\n┃\n`;
    let message = args.join(' ') || "ɢᴀᴛʜᴇʀɪɴɢ ʀᴇǫᴜᴇsᴛᴇᴅ !";
    
    text += `┃ 📝 *ᴍᴇssᴀɢᴇ :* ${message}\n┃\n`;

    for (let mem of participants) {
        text += `┃ ➥ @${mem.id.split('@')[0]}\n`;
    }
    text += `╰━━━━━━━━━━━━━━━━━━━━┈⊷`;

    await socket.sendMessage(m.key.remoteJid, { 
        text: text, 
        mentions: participants.map(a => a.id) 
    });
});

// --- KICK ---
cmd({
    pattern: "kick",
    alias: ["ban"],
    desc: "Kick a member",
    category: "group",
    react: "👢",
    filename: __filename
},
async(socket, m, { isGroup, isGroupAdmins, isBotAdmin }) => {
    if (!isGroup) return m.reply("❌ ɢʀᴏᴜᴘ ᴏɴʟʏ.");
    if (!isGroupAdmins) return m.reply("❌ ᴀᴅᴍɪɴ ᴏɴʟʏ.");
    if (!isBotAdmin) return m.reply("❌ ɪ ɴᴇᴇᴅ ᴛᴏ ʙᴇ ᴀᴅᴍɪɴ.");

    const user = m.message?.extendedTextMessage?.contextInfo?.participant || m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    if (!user) return m.reply("❌ ᴘʟᴇᴀsᴇ ᴍᴇɴᴛɪᴏɴ sᴏᴍᴇᴏɴᴇ.");

    await socket.groupParticipantsUpdate(m.key.remoteJid, [user], "remove");
    m.reply(`✅ @${user.split('@')[0]} ʜᴀs ʙᴇᴇɴ ᴇxɪʟᴇᴅ ғʀᴏᴍ ᴡᴀᴋᴀɴᴅᴀ.`, { mentions: [user] });
});

// --- PROMOTE ---
cmd({
    pattern: "promote",
    desc: "Promote to admin",
    category: "group",
    react: "⬆️",
    filename: __filename
},
async(socket, m, { isGroup, isGroupAdmins, isBotAdmin }) => {
    if (!isGroup || !isGroupAdmins || !isBotAdmin) return;
    const user = m.message?.extendedTextMessage?.contextInfo?.participant;
    if (!user) return m.reply("❌ ʀᴇᴘʟʏ ᴛᴏ ᴛʜᴇ ᴛᴀʀɢᴇᴛ's ᴍᴇssᴀɢᴇ.");
    
    await socket.groupParticipantsUpdate(m.key.remoteJid, [user], "promote");
    m.reply(`✅ @${user.split('@')[0]} ɪs ɴᴏᴡ ᴀɴ ᴀᴅᴍɪɴ.`, { mentions: [user] });
});

// --- DEMOTE ---
cmd({
    pattern: "demote",
    desc: "Demote from admin",
    category: "group",
    react: "⬇️",
    filename: __filename
},
async(socket, m, { isGroup, isGroupAdmins, isBotAdmin }) => {
    if (!isGroup || !isGroupAdmins || !isBotAdmin) return;
    const user = m.message?.extendedTextMessage?.contextInfo?.participant;
    if (!user) return m.reply("❌ ʀᴇᴘʟʏ ᴛᴏ ᴛʜᴇ ᴛᴀʀɢᴇᴛ's ᴍᴇssᴀɢᴇ.");
    
    await socket.groupParticipantsUpdate(m.key.remoteJid, [user], "demote");
    m.reply(`✅ @${user.split('@')[0]} ɪs ɴᴏ ʟᴏɴɢᴇʀ ᴀɴ ᴀᴅᴍɪɴ.`, { mentions: [user] });
});
