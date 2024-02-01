import discord
from discord.ext import commands
#from autoflask import index
import os
import configparser  
import os
#from dotenv import load_dotenv
#from autoflask import keep_alive
#import youtube_dl
import time

from neiro import answer
# from AI import notspeakchannel
# from AI import answerquestion
# from AI import chessplay
# from AI import checkanswer

from fuzzywuzzy import fuzz
from fuzzywuzzy import process

# Все функции заранее использованные
#load_dotenv()
#keep_alive()
# Настройки дискорда Петал
#youtube_dl.utils.bug_reports_message = lambda: ''
Discordtoken = ""
intents = discord.Intents.default()  # Подключаем "Разрешения"
intents.message_content = True

# Настройки переменных

ytdl_format_options = {
    'format': 'bestaudio/best',
    'outtmpl': '%(extractor)s-%(id)s-%(title)s.%(ext)s',
    'restrictfilenames': True,
    'noplaylist': True,
    'nocheckcertificate': True,
    'ignoreerrors': False,
    'logtostderr': False,
    'quiet': True,
    'no_warnings': True,
    'default_search': 'auto',
    'source_address': '0.0.0.0', # Выставляем локальный айпи
}
ffmpeg_options = {
    'options': '-vn',
}
# ytdl = youtube_dl.YoutubeDL(ytdl_format_options)
bot = commands.Bot(command_prefix='', intents=intents)

async def ПеталГС(ctx):
    """Connect to yours voice channel"""
    if (voice := ctx.author.voice) and (voice_channel := voice.channel):
        await voice_channel.connect()
        await ctx.send(channel.id)
    else:
        await ctx.send('Ты не в голосовом канале!')

@bot.event
async def on_ready():
    print('Logged on bot')

@bot.event
async def on_message(message):
    summonUP = fuzz.partial_ratio('Петал', message.content) # Настройки вызова fuzzywuzzy для дискорда
    summonDOWN = fuzz.partial_ratio('петал', message.content) # Настройки вызова fuzzywuzzy для дискорда
    summonVTS1 = fuzz.token_sort_ratio('Петал пойдём в гс', message.content)
    summonVTS2 = fuzz.token_sort_ratio('Петал пойдём в голосовой канал', message.content)
    Author = message.author
    # don't respond to ourselves

    if message.author == bot.user:
        print(summonVTS1, summonVTS2)
        return
    try:
        try:
            if summonVTS1 > 55 or summonVTS2 > 55:
                if (voice := message.author.voice) and (voice_channel := voice.channel):
                    await voice_channel.connect()
                    await message.send(message.channel.id)
                else:
                    await message.send('Ты не в голосовом канале!')
        except Exception:
            print("Ошибка, протокол #131, перезагрузка.")

        try:
            if summonUP == 100 or summonDOWN == 100:
                await message.channel.send(answer(message.author.name, message.content))
        except Exception:
            print("Ошибка, протокол #131, перезагрузка.")
    finally:
        os.system("python3 main.py")    
bot.run(Discordtoken)
