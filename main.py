import discord
from discord.ext import commands
#from autoflask import index
#from AI import notspeakchannel
#from AI import answerquestion
#from AI import chessplay
import os
import configparser  
import os
#from dotenv import load_dotenv
#from autoflask import keep_alive
#import youtube_dl
import time
from neiro import answer 

from fuzzywuzzy import fuzz
from fuzzywuzzy import process

# Все функции заранее использованные
#load_dotenv()
#keep_alive()
# Настройки дискорда Петал
#youtube_dl.utils.bug_reports_message = lambda: '' 
Discordtoken = ${{ secrets.DISCORDTOKEN }}
intents = discord.Intents.default()  # Подключаем "Разрешения"
intents.message_content = True
description = '''An example bot to showcase the discord.ext.commands extension
module.

There are a number of utility commands being showcased here.'''

# Настройки переменных

ytdl_format_option = { 
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
#ytdl = youtube_dl.YoutubeDL(ytdl_format_options)
bot = commands.Bot(command_prefix='', description=description, intents=intents)
def init_bot():
    bot = commands.Bot(command_prefix='', description=description, intents=intents)
@bot.event
async def on_ready():
    print(f'Logged in as {bot.user} (ID: {bot.user.id})')
    print('------')

@bot.event
async def on_message(message):
    summonUP = fuzz.partial_ratio('Петал', message.content) # Настройки вызова fuzzywuzzy для дискорда
    summonDOWN = fuzz.partial_ratio('петал', message.content) # Настройки вызова fuzzywuzzy для дискорда
    Author = message.author
    # don't respond to ourselves
    if message.author == bot.user:
        return
    if summonUP == 100 or summonDOWN == 100:
        await message.channel.send(await answer(message.author.name, message.content))
        init_bot()
bot.run(Discordtoken)
