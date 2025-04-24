import { InferenceClient } from "@huggingface/inference";

const client = new InferenceClient("");

const chatCompletion = await client.chatCompletion({
    provider: "nebius",
    model: "deepseek-ai/DeepSeek-V3-0324",
    messages: [
        {
            role: "user",
            content: "What is the capital of France?",
        },
    ],
    max_tokens: 512,
});

console.log(chatCompletion.choices[0].message);