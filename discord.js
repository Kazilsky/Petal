const { Client, GatewayIntentBits } = require('discord.js');
const spawn = require("child_process").spawn;

const token = process.env.DiscordToken; //Токен, сохраненный на 5-м шаге данного руководства 
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: ["MESSAGE", "CHANNEL"]
});

var logs = true;
client.on("ready", () =>{
    console.log("Вход в бота сделан успешно"); //Сообщение, когда бот в сети 
});

client.on("messageCreate", (message) => {
    console.log(message.author);
    console.log(message.author.user);
    console.log(message.author.user.username);
    var options = {
        mode: 'text',
        pythonOptions: ['-u'],
        args: [message.author, message.content]
      };
    var pythonProcess = spawn('python', ['AI/neiro.py', message.author, message.content]);
    summonUP = fuzz.partial_ratio('Петал', message.content) // Настройки вызова fuzzywuzzy для дискорда
    summonDOWN = fuzz.partial_ratio('петал', message.content) // Настройки вызова fuzzywuzzy для дискорда
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
        console.log("Сообщение: " + user + ": " + message.content )
    }
    if (summonUP > 80 || summonDOWN > 80) {
      message.channel.send("Hello from AI bot")
      pythonProcess.stdout.on('data', (data) => {
        console.log(`stdout: ${data}`);
      });
    }
});

client.login(token);
