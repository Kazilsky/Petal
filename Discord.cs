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

namespace Discord_Petal
{
    class Program
    {   
        string token = "MTE4NTYxMjI3NjUyNzU0NjQ3OQ.Gi1vJI.lgI0l_BBlqURdpsnYDVfYjhbxkhEkfcTjxzpNo";
        DiscordSocketClient client;
        static void Main(string[] args) => new Program().MainAsync().GetAwaiter().GetResult();
        DiscordSocketConfig config = new DiscordSocketConfig();
        public async Task MainAsync()
        {
            config.GatewayIntents = GatewayIntents.AllUnprivileged | GatewayIntents.MessageContent;
            client = new DiscordSocketClient(config);
            client.MessageReceived += CommandsHandler;
            client.Log += Log;

            await client.LoginAsync(TokenType.Bot, token);
            await client.StartAsync(); 

            Console.ReadLine();
        }
        private Task Log(LogMessage msg)
        {
            Console.WriteLine(msg.ToString());
            return Task.CompletedTask;
        }
        private Task CommandsHandler(SocketMessage msg)
        {
            int checksummon = Fuzz.PartialRatio("Петал", msg.Content);
            if (!msg.Author.IsBot) {
                Console.WriteLine(checksummon);
                if (checksummon > 95) {
                    Console.WriteLine("test");
                    using (Py.GIL())
                    { 
                        dynamic neiro = Py.Import($"neiroPetal");
                        // dynamic r1 = neiro.main(); //OK 
                        dynamic r2 = neiro.answer(msg.Author, msg.Content); //<--- Exception thrown: 'Microsoft.CSharp.RuntimeBinder.RuntimeBinderException' in System.Core.dll
                        msg.Channel.SendMessageAsync(r2.ToString());
                    }
                } 
            }
            return Task.CompletedTask;
        }
    }
}
// MTE4NTYxMjI3NjUyNzU0NjQ3OQ.Gi1vJI.lgI0l_BBlqURdpsnYDVfYjhbxkhEkfcTjxzpNo