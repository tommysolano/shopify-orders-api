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
    return res.status(500).json({
      error: 'Server configuration error',
      message: 'API_BEARER_TOKEN is not configured',
    });
  }

  // Verificar que existe el header Authorization
  if (!authHeader) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing Authorization header',
    });
  }

  // Verificar formato del header (Bearer token)
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid Authorization header format. Expected: Bearer <token>',
    });
  }

  // Extraer y validar el token
  const token = authHeader.slice(7); // Quitar "Bearer "

  if (token !== expectedToken) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid token',
    });
  }

  next();
}

module.exports = authMiddleware;
