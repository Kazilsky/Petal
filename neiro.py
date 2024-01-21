import torch
import transformers
import asyncio
import json
from transformers import AutoModelForCausalLM, AutoTokenizer, pipeline
from llama_cpp import Llama

use_cuda = torch.cuda.is_available()
device = torch.device("cuda" if use_cuda else "cpu")
# Set gpu_layers to the number of layers to offload to GPU. Set to 0 if no GPU acceleration is available on your system.
llm = Llama(
  model_path="./open_gpt4_8x7b.Q4_K_M.gguf",  # Download the model file first
  n_ctx=32768,  # The max sequence length to use - note that longer sequence lengths require much more resources
  n_threads=8,            # The number of CPU threads to use, tailor to your system and the resulting performance
  n_gpu_layers=35         # The number of layers to offload to GPU, if you have GPU acceleration available
)

# Simple inference example

async def answer(user, msg):
  '''output = llm(
  "Below is an instruction that describes a task. Write a response that appropriately completes the request.\n\n### Instruction:\n{prompt}\n\n### Response:", # Prompt
  max_tokens=512,  # Generate up to 512 tokens
  stop=["</s>"],   # Example stop token - not necessarily correct for this specific model! Please check before using.
  echo=True        # Whether to echo the prompt
)

# Chat Completion API

  llm = Llama(model_path="./open_gpt4_8x7b.Q4_K_M.gguf", chat_format="llama-2")  # Set chat_format according to the model you are using
  llm.create_chat_completion(
      messages = [
          {"role": "system", "content": "You are a story writing assistant."},
          {
              "role": "user",
              "content": f"Имя: {user}: {msg}"
          }
      ]
  )'''

 #with open('memory.json') as f:
 #datamem = json.load(f)
 #messageint = messageint + 1
 print('-'*80)
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
'''with open('memory.json') as f:
    datamem = json.load(f)
datamem['Log'+messageint] = f'{user}: {msg} Твой ответ: {t5_output}'
with open('myfile.json', 'w') as f:
    json.dump(datamem, f, ensure_ascii=False, indent=4)
return t5_output'''

'''while True:
    print('-'*80)
    dialog = []
    while True:
        msg = input('H:> ').strip()
        if len(msg) == 0:
            break
        msg = msg[0].upper() + msg[1:]
        dialog.append('Собеседник: ' + msg)
        # В начале ставится промпт персонажа.
        prompt = '<SC6>Ты нейронный ассистент основанный на собственном движке' + '\n'.join(dialog) + '\nТы: <extra_id_0>'

        input_ids = t5_tokenizer(prompt, return_tensors='pt').input_ids
        out_ids = t5_model.generate(input_ids=input_ids.to(device), do_sample=True, temperature=0.9, max_new_tokens=512, top_p=0.85,
                                      top_k=2, repetition_penalty=1.2)
        t5_output = t5_tokenizer.decode(out_ids[0][1:])
        if '</s>' in t5_output:
            t5_output = t5_output[:t5_output.find('</s>')].strip()

        t5_output = t5_output.replace('<extra_id_0>', '').strip()
        t5_output = t5_output.split('Собеседник')[0].strip()
        print('B:> {}'.format(t5_output))
        dialog.append('Ты: ' + t5_output)''' 
