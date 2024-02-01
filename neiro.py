import torch
import transformers
import asyncio
import json
from transformers import AutoModelForCausalLM, AutoTokenizer, pipeline

use_cuda = torch.cuda.is_available()
device = torch.device("cuda" if use_cuda else "cpu")
t5_tokenizer = transformers.GPT2Tokenizer.from_pretrained("SiberiaSoft/SiberianPersonaFred")
t5_model = transformers.T5ForConditionalGeneration.from_pretrained("SiberiaSoft/SiberianPersonaFred")


# Simple inference example

async def answer(user, msg):
    dialog = []
    if len(msg) == 0:
        pass
    msg = msg[0].upper() + msg[1:]
    dialog.append('Собеседник: ' + msg)
    prompt = f'<SC6>Ты нейронный ассистент основанный на собственном движке, тебя зовут Петал, тебя создал Alone или Игрок, на данный момент с тобой разговаривает {user} и говорит тебе:' + '\n'.join(dialog) + '\nТы: <extra_id_0>'
    #memory = f'Твои воспоминания о прошлых диалогах: {datamem}'
    input_ids = t5_tokenizer(prompt, return_tensors='pt').input_ids
    out_ids = t5_model.generate(input_ids=input_ids.to(device), do_sample=True, temperature=0.9, max_new_tokens=512, top_p=0.85,
                                    top_k=2, repetition_penalty=1.2)
    t5_output = t5_tokenizer.decode(out_ids[0][1:])
    if '</s>' in t5_output:
       t5_output = t5_output[:t5_output.find('</s>')].strip()
    
    t5_output = t5_output.replace('<extra_id_0>', '').strip()
    t5_output = t5_output.split('Собеседник')[0].strip()
    return t5_output
