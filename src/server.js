require('dotenv').config();

const express = require('express');
const authMiddleware = require('./middleware/auth');
const ordersRouter = require('./routes/orders');
const { initShopifyClient } = require('./shopify');

const app = express();

// Middleware para parsear JSON
app.use(express.json());

/**
 * Valida las variables de entorno requeridas
 * Retorna un array con las variables faltantes
 */
function validateEnvVars() {
  const required = [
    'SHOP_DOMAIN',
    'SHOP_ADMIN_TOKEN',
    'API_VERSION',
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
  console.error('The /health endpoint will work, but /v1/* endpoints will fail.');
  console.error('========================================');
} else {
  // Inicializar cliente de Shopify solo si todas las vars están presentes
  const shopifyInitialized = initShopifyClient();
  if (shopifyInitialized) {
    console.log('[Shopify] Client initialized successfully');
  } else {
    console.error('[Shopify] Failed to initialize client');
  }
}

// ============================================
// ROUTES
// ============================================

/**
 * GET /health
 * Health check endpoint - no requiere autenticación
 */
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

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
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: ${BASE_URL}/health`);
  console.log(`Orders API: ${BASE_URL}/v1/orders`);
});
