const { Client, GatewayIntentBits } = require('discord.js');
const PythonShell = require('python-shell').PythonShell;

const token = process.env.DiscordToken; //Токен, сохраненный на 5-м шаге данного руководства 
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

client.on("ready", () =>{
    console.log("Вход в бота сделан успешно"); //Сообщение, когда бот в сети 
});

client.on("message", (message) => {
    console.log(message);
    var options = {
        mode: 'text',
        pythonOptions: ['-u'],
        args: [message.author, message.content]
      };
    summonUP = fuzz.partial_ratio('Петал', message.content) // Настройки вызова fuzzywuzzy для дискорда
    summonDOWN = fuzz.partial_ratio('петал', message.content) // Настройки вызова fuzzywuzzy для дискорда
    if (summonUP > 80 || summonDOWN > 80) {
        PythonShell.run('AI/neiro.py', options, function (answer) {
            if (answer) 
              throw answer;
            // Results is an array consisting of messages collected during execution
            // console.log('results: %j', results);
          });
            }
});

client.login(token);
