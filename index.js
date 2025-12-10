const express = require('express');
const app = express();
const mainRouter = require('./pair'); // Importe ton fichier pair.js
const PORT = process.env.PORT || 8000;

// Utiliser le routeur principal
app.use('/', mainRouter);

// Lancer le serveur
app.listen(PORT, () => {
    console.log(`
█▓▒░ ⚡ 𝐖𝐀𝐊𝐀𝐍𝐃𝐀 𝐒𝐄𝐑𝐕𝐄𝐑 ⚡ ░▒▓█
🛡️ Server running on port: ${PORT}
🔗 Access via: http://YOUR-VPS-IP:${PORT}
    `);
});
