//manejar la autenticación simple de los clientes que consumen el servicio.
//Validación de clientes: solo los clientes que envíen la clave correcta en el header podrán usar el servicio.
//Separación de responsabilidades: en lugar de mezclar la lógica de seguridad dentro de cada ruta, se centraliza en un middleware.
//Se manda en el header de la petición HTTP.


// Middleware de autenticación simple
export function requireServiceApiKey(req, res, next) {
  const clientKey = req.header("x-service-key"); // El cliente manda su API Key en el header, 
  const expected = process.env.SERVICE_API_KEY; // La clave válida está en .env
  if (!expected || clientKey !== expected) {
    return res.status(401).json({ error: "Unauthorized" }); // Si no coincide, se rechaza
  }
  next(); // Si coincide, se permite continuar
}
