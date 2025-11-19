// es el módulo de integración con Azure OpenAI
//Encapsular toda la lógica necesaria para conectarse con el servicio GPT-35-Turbo en Azure OpenAI.
//Reutilización: cualquier ruta o WebSocket que necesite hablar con la IA solo importa estto

import { AzureOpenAI } from "openai";


// Se obtienen las credenciales desde .env
const {
  AZURE_OPENAI_ENDPOINT: endpoint,
  AZURE_OPENAI_API_KEY: apiKey,
  AZURE_OPENAI_API_VERSION: apiVersion,
  AZURE_OPENAI_DEPLOYMENT: deployment
} = process.env;

// Cliente de Azure OpenAI
const options = { endpoint, apiKey, deployment, apiVersion }

export const client = new AzureOpenAI(options);



// Función que envía mensajes a Azure OpenAI y devuelve la respuesta
export async function chatCompletion(messages, opts = {}) {
  const {
    max_tokens = 256,
    temperature = 0.7,
    top_p = 1,
    model = deployment
  } = opts;

  // Se manda la información (mensajes) al modelo GPT-35-Turbo en Azure
  const response = await client.chat.completions.create({
    messages,
    max_tokens,
    temperature,
    top_p,
    model
  });

  // Se obtiene la respuesta del modelo
  const content = response?.choices?.[0]?.message?.content ?? "";
  return { content, raw: response };
}
