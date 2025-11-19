//Este archivo corre en el navegador del usuario.
//Recibe datos del usuario (lo que escribe en el formulario).
//Manda datos al servidor (src/server.js) por WebSocket y por HTTP.
//Recibe respuestas del servidor (que a su vez vienen de Azure OpenAI) y las muestra en el HTML (index.ejs).


// Qué hace: abre una conexión WebSocket con el servidor (src/server.js).
// A dónde manda: al servidor WebSocket (src/ws/callbacks.js).
// De dónde recibe: eventos que el servidor emita (ej. "registered", "chat-callback")
const socket = io();
//genera el identificador de secion
const sessionId = `sess_${Math.random().toString(36).slice(2)}`;

//al servidor (src/ws/callbacks.js), que lo usa en socket.on("register-session") para meter al cliente en la sala correcta.
socket.emit("register-session", sessionId);


//escucha la confirmación del servidor de que la sesión fue registrada.
//De dónde recibe: del servidor (src/ws/callbacks.js → socket.emit("registered", {...})).
socket.on("registered", (data) => {
  if (!data.ok) console.error("WS register failed:", data.error);
});


// escucha respuestas del servidor por WebSocket.
// De dónde recibe: del servidor (src/server.js llama a emitChatCallback en src/ws/callbacks.js).
// A dónde manda: al DOM (index.ejs) para mostrar mensajes en pantalla.
socket.on("chat-callback", (payload) => {
  if (payload.type === "received") {
    // Opcional: estado
  } else if (payload.type === "answer") {
    appendMessage(payload.content, "left"); // IA
  } else if (payload.type === "error") {
    appendMessage(`Error: ${payload.error}`, "left");
  }
});


//inserta un mensaje en el HTML del chat.
// De dónde recibe: texto del usuario o de la IA.
// A dónde manda: al DOM (index.ejs → <div id="messages">).
function appendMessage(text, side) {
  const container = document.getElementById("messages");
  const box = document.createElement("div");
  box.className = `message-box ${side}`;
  box.innerHTML = `<p>${escapeHtml(text)}</p>`;
  container.appendChild(box);
  container.scrollTop = container.scrollHeight;
}


//evita que se inyecte HTML malicioso en los mensajes.
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

//captura el mensaje escrito por el usuario en el formulario.
//De dónde recibe: del HTML (index.ejs → <form id="chat-form">).
//A dónde manda: al DOM (muestra el mensaje del cliente en el chat).
document.getElementById("chat-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = document.getElementById("message").value.trim();
  if (!text) return;

  appendMessage(text, "right"); // Cliente
  // Clear input immediately so it's ready for the next message
  const inputEl = document.getElementById("message");
  inputEl.value = "";
  inputEl.focus();

  // Enviar a backend vía HTTP (RMI) con mensaje en texto plano
  // Usamos un esquema simple: enviamos `messages` para que el servidor pueda procesarlo
  const res = await fetch("/api/chat-with-callback", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-service-key": window.__SERVICE_KEY__
    },
    body: JSON.stringify({
      sessionId,
      messages: [{ role: "user", content: text }]
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    appendMessage(`Error: ${err.message || res.statusText}`, "left");
  }
  // input already cleared above
});


  

