require('dotenv').config();

const express = require('express');
const authMiddleware = require('./middleware/auth');
const ordersRouter = require('./routes/orders');
const authRouter = require('./routes/auth');

const app = express();

// Middleware para parsear JSON
app.use(express.json());

/**
 * Valida las variables de entorno requeridas para OAuth
 * Retorna un array con las variables faltantes
 */
function validateEnvVars() {
  const required = [
    'SHOPIFY_API_KEY',
    'SHOPIFY_API_SECRET',
    'SCOPES',
    'HOST',
    'API_BEARER_TOKEN',
  ];

  const missing = required.filter((varName) => !process.env[varName]);
  return missing;
}

// Validar variables de entorno al iniciar
const missingVars = validateEnvVars();
if (missingVars.length > 0) {
  console.error('========================================');
  console.error('ERROR: Missing required environment variables:');
  missingVars.forEach((varName) => {
    console.error(`  - ${varName}`);
  });
  console.error('');
  console.error('Please set these variables in your .env file or environment.');
  console.error('========================================');
}

// ============================================
// ROUTES
// ============================================

/**
 * GET /health
 * Health check endpoint - no requiere autenticación
 */
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
  });
});

/**
 * OAuth routes - no requieren autenticación Bearer
 * GET /auth - Inicia flujo OAuth
 * GET /auth/callback - Callback de Shopify
 */
app.use('/auth', authRouter);

/**
 * Rutas protegidas bajo /v1
 * Todas requieren Authorization: Bearer <API_BEARER_TOKEN>
 */
app.use('/v1', authMiddleware);

// Montar router de orders
app.use('/v1/orders', ordersRouter);

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || `http://localhost:${PORT}`;

app.listen(PORT, () => {
  console.log('========================================');
  console.log(`Server running on port ${PORT}`);
  console.log(`Host: ${HOST}`);
  console.log('');
  console.log('Endpoints:');
  console.log(`  Health:    ${HOST}/health`);
  console.log(`  OAuth:     ${HOST}/auth?shop=tienda.myshopify.com`);
  console.log(`  Orders:    ${HOST}/v1/orders?shop=tienda.myshopify.com`);
  console.log('========================================');
});
