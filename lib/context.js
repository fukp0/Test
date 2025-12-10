// Fichier : lib/context.js

/**
 * Génère le contexte Newsletter (Channel) pour les messages
 * SANS externalAdReply (juste le tag "Transféré")
 * @param {Object} config - La configuration globale
 */
function getNewsletterContext(config) {
    return {
        isForwarded: true,
        forwardingScore: 999,
        forwardedNewsletterMessageInfo: {
            newsletterJid: config.NEWSLETTER_JID || "120363401051937059@newsletter",
            newsletterName: config.BOT_NAME || "𝙱𝙻𝙰𝙲𝙺 𝙿𝙰𝙽𝚃𝙷𝙴𝚁",
            serverMessageId: 100
        }
    };
}

module.exports = { getNewsletterContext };
