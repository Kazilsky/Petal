import 'dotenv/config';

async function generateAIResponse(message) {
  // 1. Формирование промпта
  const messages = [
    { role: 'user', content: message }
  ];

  console.log(process.env.OPENROUTER_API_KEY)

  // 2. Запрос к OpenRouter
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'deepseek/deepseek-chat-v3-0324:free',
      messages,
      temperature: 0.7,
      stream: false,
    })
  });

  // if (!response.ok) throw new Error(`API Error: ${response.statusText}`);

  const data = await response.json();
  const ret = data.choices[0].message.content;
  return ret;
}

const test = await generateAIResponse('Привет')

console.log(test);