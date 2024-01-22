const { Client, GatewayIntentBits, Partials } = require('discord.js');
import {PythonShell} from 'python-shell';
let pyAI = new PythonShell('AI/neiro.py', { mode: 'text'});
const fuzz = require('fuzzball');

const token = process.env.DiscordToken; //Токен, сохраненный на 5-м шаге данного руководства 
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMessageTyping, 
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel]
});

var logs = true;
client.on("ready", () =>{
    console.log("Вход в бота сделан успешно"); //Сообщение, когда бот в сети 
});

client.on("messageCreate", (message) => {
    var pythonProcess = spawn('python', ['AI/neiro.py', message.author, message.content]);
    var summonUP = fuzz.partial_ratio('Петал', message.content) // Настройки вызова fuzzywuzzy для дискорда
    var summonDOWN = fuzz.partial_ratio('петал', message.content) // Настройки вызова fuzzywuzzy для дискорда
    if (message.content == "!LogsOn") {
        logs = true 
        message.channel.reply("Логи включены!")
    }
    if (message.content == "!LogsOff") {
        logs = false
        message.channel.reply("Логи выключены!")
    }
    if (logs == true) {
        console.log("Петал, соотношение: " + summonUP);
        console.log("петал, соотношение: " + summonDOWN);
        console.log("Сообщение: " + message.author + ": " + message.content )
    }
    if (summonUP > 80 || summonDOWN > 80) {
        PythonShell.runString('import AI/neiro.py;answer(${message.author}, ${message.content})', null).then(messages=>{
            console.log('finished');
          });
    }
});

client.login(token);
