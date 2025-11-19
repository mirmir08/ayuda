//servidor principal
//El punto de entrada principal de tu backend. Aquí se arma todo: 
// Express, rutas HTTP, WebSocket, middlewares y la conexión con Azure. (que ya hicimos antes pero se manda a llamar)

import { decryptMessage } from "./utils/crypto.js"; // Importamos la función que descifra mensajes

import "dotenv/config"; // Carga las variables de entorno desde .env
import express from "express"; // Framework para crear el servidor HTTP
import http from "http"; // Módulo nativo para servidor HTTP
import { Server as SocketIOServer } from "socket.io"; // WebSocket para callbacks en tiempo real
import cors from "cors"; // Permite llamadas desde otros dominios
import path from "path";
import { fileURLToPath } from "url";

import chatRouter from "./routes/chat.js"; // Rutas HTTP (invocaciones remotas estilo RMI)
import { setupWebSocket, emitChatCallback, isSessionDisconnected } from "./ws/callbacks.js"; // Configuración de WebSocket
import { chatCompletion } from "./services/azureOpenAI.js"; // Función que llama a Azure OpenAI


// Función para validar si el mensaje está relacionado con incendios forestales
function isForestFireRelated(message) {
  const lowerMessage = message.toLowerCase();
  
  // Palabras clave relacionadas con incendios forestales
  const keywords = [
    "incendio", "fuego", "llama", "quema", "bosque", "forestal", "prevención",
    "extinción", "bombero", "evacuación", "seguridad", "riesgo", "peligro",
    "propagación", "control", "respuesta", "emergencia", "protección", "defensas",
    "focos", "frente de fuego", "zona roja", "alerta", "desastre", "catástrofe",
    "humo", "ceniza", "combustible", "vegetación", "sequía", "clima", "temperatura",
    "viento", "humedad", "terreno", "topografía", "recursos", "equipos", "personal",
    "estrategia", "tácticas", "coordinación", "instituciones", "gobernanza", "leyes",
    "normativas", "capacitación", "educación", "conciencia", "preparación"
  ];
  
  // Comprobar si al menos una palabra clave está en el mensaje
  const isRelated = keywords.some(keyword => lowerMessage.includes(keyword));
  
  return isRelated;
}


//Así el servidor sabe dónde están las carpetas views y public, sin importar desde qué lugar se ejecute el proyecto.
// Configuración de paths
const __filename = fileURLToPath(import.meta.url);//Contiene la URL del archivo actual, Convierte esa URL en una ruta de archivo normal del sistema operativo
const __dirname = path.dirname(__filename);//devuelve solo el directorio donde está el archivo.
const sys = { role: "system", content: process.env.AI_SYSTEM_PROMPT || "Eres un asistente útil y conciso." };

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, { cors: { origin: "*" } });


//Llama a la función que configura los eventos de WebSocket (register-session, typing, chat-callback)
// Inicializa WebSocket: aquí se registran clientes y sesiones
setupWebSocket(io);

// Middlewares globales
app.use(cors());
app.use(express.json()); // Permite recibir JSON en requests convierte el cuerpo JSON en objeto JS
app.use(express.urlencoded({ extended: true })); // Permite recibir formularios permite recibir datos de formularios HTML.

// Configuración de vistas (EJS)
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views"));
app.use(express.static(path.join(__dirname, "../public"))); // Archivos estáticos (CSS, JS)

// Ruta principal: renderiza la interfaz del chat
//Renderiza la interfaz del chat
app.get("/", (req, res) => {
  res.render("chat", {
    serviceKey: process.env.SERVICE_API_KEY //inyecta la SERVICE_API_KEY en la vista para que el cliente pueda autenticarse.
  });
});

// Rutas HTTP estilo RMI
//Monta las rutas de chat
//A dónde se manda: a routes/chat.js, que llama a Azure OpenAI.
app.use("/api", chatRouter);

// Endpoint que usa callbacks por WebSocket
//El cliente (frontend) manda estos datos en el cuerpo de la petición HTTP POST /api/chat-with-callback
//A dónde se manda: se guardan en variables locales para usarlas en el resto del flujo.
app.post("/api/chat-with-callback", async (req, res) => {
  // Acepta dos formatos:
  //  - { sessionId, encrypted: { iv, data, tag } }
  //  - { sessionId, messages: [...] } (plaintext, convenient for browser/dev)
  const { sessionId, encrypted, messages: incomingMessages, params } = req.body;
  if (!sessionId) return res.status(400).json({ error: "sessionId required" });

  try {
    let messages;

    if (encrypted) {
      // Descifrar como antes
      const plaintext = decryptMessage(
        encrypted.iv,
        encrypted.data,
        encrypted.tag,
        Buffer.from(process.env.SECRET_KEY || "", "hex") // may throw if SECRET_KEY missing
      );
      messages = [{ role: "user", content: plaintext }];
    } else if (Array.isArray(incomingMessages) && incomingMessages.length > 0) {
      messages = incomingMessages;
    } else {
      return res.status(400).json({ error: "encrypted or messages required" });
    }

    // Notifica al cliente que se recibió el mensaje
    emitChatCallback(io, sessionId, { type: "received", messages });

    // Validar si la sesión está desconectada
    if (isSessionDisconnected(sessionId)) {
      // La IA está dormida, responder con "Zzzzz"
      emitChatCallback(io, sessionId, { 
        type: "answer", 
        content: "Zzzzz..." 
      });
      return res.json({ ok: true });
    }

    // Validar si el mensaje está relacionado con incendios forestales
    const userMessage = messages[0]?.content || "";
    const isRelevantTopic = isForestFireRelated(userMessage);

    if (!isRelevantTopic) {
      // Si no es sobre incendios forestales, rechazar la pregunta
      emitChatCallback(io, sessionId, { 
        type: "answer", 
        content: "Lo siento, solo puedo responder preguntas relacionadas con incendios forestales. Por favor, haz una pregunta sobre ese tema." 
      });
      return res.json({ ok: true });
    }

    const sys = { role: "system", content: process.env.AI_SYSTEM_PROMPT || "Eres un asistente útil y conciso." };
    const finalMessages = [sys, ...messages];

    const result = await chatCompletion(finalMessages, params);

    emitChatCallback(io, sessionId, { type: "answer", content: result.content });

    return res.json({ ok: true });
  } catch (err) {
    emitChatCallback(io, sessionId, {
      type: "error",
      error: "Lo lamento ocurrio un error, intentalo mas tarde"
    });
    return res.status(500).json({ error: "RemoteInvocationError", message: err.message });
  }
});


// Arranca el servidor
const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Servidor en http://localhost:${port}`);
});
