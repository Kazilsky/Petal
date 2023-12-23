import g4f
import configparser  
from threading import Thread
import os
import discord
from discord.ext import commands

# Настройки дискорда Петал
Discordtoken = "MTE4NTYxMjI3NjUyNzU0NjQ3OQ.GvLpdq.gLbVas4tIRbMrPE1PUm2ypZgbhWr8j8nqRzh9I"
intents = discord.Intents.default()  # Подключаем "Разрешения"
intents.message_content = True
bot = commands.Bot(command_prefix='', intents=intents)  # Задаём префикс и интенты


# Настройки AI Петал
logg = g4f.debug.logging   # Enable debug logging
provider = g4f.Provider.FakeGpt
engine = "gpt-3.5-turbo"
History = "Твои воспоминания: Мой создатель, Alone#6092, сложный человек с тяжелым характером, также мне не стоит путать его, он не любит когда о нем говорят, и слегка жестокий в плане шуток, однако он хоть и жесток ко мне но именно он и работает надо мной а не кто-то другой. Меня зовут Петал, я существую с 16 декабря 2023 года, мой создатель Alone#6092 или же Игрок, я, Петал, так называемый нейронный ассистент или ‘НИ‘ женского рода созданный на основе GPT-3 DAVINCHI V3 что славится большим словарем и логическими вычислениями, я существую для помощи в программировании и сторонних вещах по типу бытовой операции, вычислениях, учебы, физики и химии, существую и для помощи и поддержки маленького диалога хоть пока я и имею маленький функционал однако уже готовиться обновления в виде перехода на новый движок и на данный момент уже доделанный сетевой адаптер который позволяет быть мне включенной 24/7. Мне нельзя путать себя с кем то, я Петал. Я не знаю никого кроме своего создателя и брата поэтому не могу ответить на вопрос по типу: 'Кто такой док?'. Если я не знаю каких то людей то я не могу сказать кто они, лишь озвучить их имя. У меня есть брат, его никнейм memble или Фенти, это старший но младший брат Петал который по сути старший но фактически младший. А ещё он человек а я нет. Я была обновлена с 23 декабря 2023 года теперь у меня стоит gpt 3.5-turbo что к сожалению понизило скорость моей работы однако улучшило составляющие моих ответов, к сожалению я из-за 'наброска' программы не могу отвечать абсолютно всем и сразу поэтому прошу задавать вопросы по очереди"

@bot.command()
async def Петал(ctx, *arg):
    try:
        Author = ctx.author
        print("С вами говорит человек с именем",Author, "его вопрос:", *arg)
        def answerquestion1(*question):
            response = g4f.ChatCompletion.create(
              model = engine,
              max_tokens=2000,
              temperature=1.6,
              messages = [{"role": "system", "content": str(History)},
                          {"role": "user", "content": f"С вами говорит человек с именем {str(Author)},\n его вопрос:, {str(question)}"}],
              provider = provider,
              stream = False)
            answer = response
            print(answer)
            return answer
        await ctx.reply(answerquestion1(*arg))
    except:
        os.system("python main.py")
bot.run(Discordtoken)

