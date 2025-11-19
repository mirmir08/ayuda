// src/utils/crypto.js
import crypto from "crypto";


// Esta función recibe los fragmentos del mensaje cifrado que el cliente envió:
// ivArr: vector de inicialización (IV), necesario para descifrar.
// dataArr: el texto cifrado (ciphertext).
// tagArr: etiqueta de autenticación (auth tag), usada para verificar integridad.
// secretKeyBuffer: la clave secreta de 32 bytes (AES-256).
/**
 * Descifra un mensaje cifrado con AES-256-GCM
 * @param {Array<number>} ivArr - Vector de inicialización (12 bytes)
 * @param {Array<number>} dataArr - Ciphertext (sin el auth tag)
 * @param {Array<number>} tagArr - Auth tag (16 bytes)
 * @param {Buffer} secretKeyBuffer - Clave secreta de 32 bytes
 * @returns {string} - Texto plano descifrado
 */
export function decryptMessage(ivArr, dataArr, tagArr, secretKeyBuffer) {
//     Convierte los arrays de números (ivArr, dataArr, tagArr) en Buffers de Node.js..

// Los Buffers son necesarios porque las funciones de crypto trabajan con datos binarios
  const iv = Buffer.from(ivArr);

  const ciphertext = Buffer.from(dataArr);
  const tag = Buffer.from(tagArr);


  //Crea un objeto decipher configurado para usar AES-256-GCM.

// Parámetros:

// "aes-256-gcm" → algoritmo.

// secretKeyBuffer → clave secreta.

// iv → vector de inicialización.
  const decipher = crypto.createDecipheriv("aes-256-gcm", secretKeyBuffer, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}

//cifra un texto plano en el servidor.
/**
 * (Opcional) Cifra un mensaje en el servidor con AES-256-GCM
 * @param {string} plaintext - Texto plano
 * @param {Buffer} secretKeyBuffer - Clave secreta de 32 bytes
 * @returns {{iv:number[], data:number[], tag:number[]}}
 */
export function encryptMessage(plaintext, secretKeyBuffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", secretKeyBuffer, iv);

  const enc = Buffer.from(plaintext, "utf8");
  const ciphertext = Buffer.concat([cipher.update(enc), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    iv: Array.from(iv),
    data: Array.from(ciphertext),
    tag: Array.from(tag)
  };
}
