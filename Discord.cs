using System;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Diagnostics;
using System.Diagnostics.Tracing;
using System.IO;

using Discord;
using Discord.WebSocket;
using FuzzySharp;
using Python.Runtime;

using System.Security.Cryptography.X509Certificates;
using Discord.Audio.Streams;
using System.Data.SqlTypes;

namespace Discord_Petal
{
    
    class Program
    {   
        string token = "";
        DiscordSocketClient client;
        static void Main(string[] args) => new Program().MainAsync().GetAwaiter().GetResult();
        DiscordSocketConfig config = new DiscordSocketConfig();
        
        public async Task MainAsync()
        {
        using (Py.GIL())
        {
            dynamic test = Py.Import("neiroPetal");
        }
            config.GatewayIntents = GatewayIntents.AllUnprivileged | GatewayIntents.MessageContent;
            client = new DiscordSocketClient(config);
            client.MessageReceived += CommandsHandler;
            client.Log += Log;

            await client.LoginAsync(TokenType.Bot, token);
            await client.StartAsync(); 
            Console.ReadLine();

            await Task.Delay(-1);
        }
        private Task Log(LogMessage msg)
        {
            Console.WriteLine(msg.ToString());
            return Task.CompletedTask;
        }
        string Answer(string user, string message)
    {
        using (Py.GIL())
        {
            dynamic Petal = Py.Import("neiroPetal");
            dynamic r1 = Petal.answer(user, message); //OK
            Console.WriteLine(r1);
            return r1;     
        }
    }

        private Task CommandsHandler(SocketMessage msg)
        {
            int checksummon = Fuzz.PartialRatio("Петал", msg.Content);
            if (!msg.Author.IsBot) {
                Console.WriteLine(checksummon);
                if (checksummon > 95) {
                    msg.Channel.SendMessageAsync("dsa");

                    Console.WriteLine("test1");
                    msg.Channel.SendMessageAsync(Answer(msg.Author.Username, msg.Content));
                    Console.WriteLine("test2");
                }
            }
            return Task.CompletedTask;
        }
    }
}
// 