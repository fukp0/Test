// File: lib/command.js
var commands = [];

function cmd(info, func) {
    var data = info;
    data.function = func;
    // Définit le motif (pattern) sans le préfixe (géré dans le main)
    if (!data.dontAddCommandList) data.dontAddCommandList = false;
    if (!info.desc) info.desc = '';
    if (!data.fromMe) data.fromMe = false;
    if (!info.category) data.category = 'misc';
    if (!info.filename) data.filename = "Not Provided";
    commands.push(data);
    return data;
}

module.exports = {
    cmd,
    commands,
    AddCommand: cmd,
    Function: cmd,
    Module: cmd
};
