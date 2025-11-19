//El cliente inicia una sesión y se suscribe por socket.join(sessionId).
// El backend envía callbacks de nuevos mensajes o estados a la sala correspondiente.
//Maneja la comunicación en tiempo real entre el servidor y los clientes usando WebSocket
//Permite que el servidor envíe callbacks/eventos al cliente sin que el cliente tenga que hacer otra petición HTTP.

// Mapa para rastrear sesiones desconectadas
const disconnectedSessions = new Set();

// Configuración de WebSocket
//Cada vez que un cliente abre un canal WebSocket, se crea un objeto socket que representa esa conexión.
export function setupWebSocket(io) {
  io.on("connection", (socket) => {
    // El cliente se registra con un sessionId
    //sessionID llga desde el cliente.js este sirve para que sirve para saber a qué sesión de chat pertenece un mensaje.
    //Permite que el servidor sepa qué cliente debe recibir las respuestas por WebSocket.
    //Cliente abre el chat → genera un sessionId. cliente.js
    //Cliente se registra en WebSocket con ese sessionId.callbacks.js
    //Cliente manda mensajes al servidor con ese mismo sessionId.client.js
    //IA responde → servidor envía la respuesta a la sala con ese sessionId.azureOpenAI.js 
    socket.on("register-session", (sessionId) => {
      if (typeof sessionId === "string" && sessionId.length > 0) {
        //Si es válido, el servidor mete al cliente en una "sala" con ese nombre (socket.join(sessionId)
        //Una sala (room) en Socket.IO es como un grupo o canal privado dentro del servidor de WebSocket.
        socket.join(sessionId); // Se une a la sala de su sesión
        // Remover la sesión del conjunto de desconectadas si regresa
        disconnectedSessions.delete(sessionId);
        //el servidor responde con "registered" confirmando que la sesión está registrada.
        socket.emit("registered", { ok: true, sessionId });
      } else {
        socket.emit("registered", { ok: false, error: "Invalid sessionId" });
      }
    });

    // Evento opcional: cliente está escribiendo
    //el servidor reenvía un evento "server-event" a todos los sockets en esa sala para indicar que el cliente está escribiendo.
    //sirve para mejorar la experiencia del usuario, por si hay varios usuarion en la misma sala
    socket.on("typing", ({ sessionId }) => {
      io.to(sessionId).emit("server-event", { type: "client-typing" });
    });

    // Cuando el cliente se desconecta
    socket.on("disconnect", () => {
      // Buscar todas las salas a las que pertenecía este socket
      const rooms = Array.from(socket.rooms);
      rooms.forEach((room) => {
        if (room !== socket.id) {
          // Marcar la sesión como desconectada
          disconnectedSessions.add(room);
          // Enviar mensaje de despedida
          io.to(room).emit("chat-callback", {
            type: "answer",
            content: "Adiós"
          });
        }
      });
    });
  });
}

// Helper para enviar callbacks a un cliente específico
//función se usa en otras partes del servidor server.js
//Servidor → Cliente(s): envía un evento "chat-callback" a todos los sockets que estén en la sala sessionId
//se manda "chat-callback" para que se escuche el evento
export function emitChatCallback(io, sessionId, payload) {
  io.to(sessionId).emit("chat-callback", payload);
}

// Exportar función para verificar si una sesión está desconectada
export function isSessionDisconnected(sessionId) {
  return disconnectedSessions.has(sessionId);
}
