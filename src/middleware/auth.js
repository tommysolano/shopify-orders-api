/**
 * Middleware de autenticación Bearer Token
 * Valida que el header Authorization contenga el token correcto
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const expectedToken = process.env.API_BEARER_TOKEN;

  // Si no hay token configurado, rechazar todas las requests
  if (!expectedToken) {
    console.error('[Auth] API_BEARER_TOKEN no está configurado');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Verificar formato del header
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Extraer y validar el token
  const token = authHeader.slice(7); // Quitar "Bearer "
  
  if (token !== expectedToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

module.exports = authMiddleware;
