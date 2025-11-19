//encarga de recibir la petición y devolver la respuesta.
//Esa función es la que manda los mensajes del usuario a Azure OpenAI (GPT-35-Turbo) y recibe la respuesta de la IA.
// Flujo: Información del cliente → Azure OpenAI → Respuesta de la IA → Servidor.


import express from "express";
import { chatCompletion } from "../services/azureOpenAI.js"; // Función que llama a Azure OpenAI
import { requireServiceApiKey } from "../middlewares/auth.js"; // Middleware de seguridad, se manda la clave


//Esto permite organizar las rutas en archivos separados y luego montarlas en server.js
const router = express.Router();


//Cada vez que un cliente haga una petición a esa URL, se ejecuta esta función.
//Se aplica el middleware requireServiceApiKey antes de procesar la petición.
// Método remoto estilo RMI: POST /api/chat
router.post("/chat", requireServiceApiKey, async (req, res) => {
  try {
    const { sessionId, messages, params } = req.body;

    // Validación: debe haber mensajes
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages array is required" });
    }

    //Se crea un mensaje “system” que define el comportamiento de la IA.
    // Se construye el prompt final
    const sys = { role: "system", content: process.env.AI_SYSTEM_PROMPT || "Eres un asistente útil y conciso." };
    const finalMessages = [sys, ...messages];

    // Se envía a Azure OpenAI y se obtiene la respuesta
    const result = await chatCompletion(finalMessages, params);

    //El servidor responde al cliente con un JSON.
    //Incluye el sessionId (para que el cliente sepa a qué sesión pertenece la respuesta)
    //  y el content (texto generado por la IA).
    // Se devuelve al cliente por HTTP
    return res.json({ sessionId, content: result.content });
  } catch (err) {
    // Manejo de errores remotos
    const status = err.status ?? 500;
    return res.status(status).json({
      error: "RemoteInvocationError",
      message: err.message ?? "Unknown error",
      code: err.code ?? "UNEXPECTED"
    });
  }
});

//Exporta este router para que pueda ser usado en server.js.
//En server.js se monta con app.use("/api", chatRouter)

export default router;
