require('dotenv').config();

const express = require('express');
const authMiddleware = require('./middleware/auth');
const ordersRouter = require('./routes/orders');
const authRouter = require('./routes/auth');

const app = express();

// Trust proxy (necesario para Render y otros PaaS)
app.set('trust proxy', 1);

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

// Validar variables de entorno al iniciar (log una sola vez)
const missingVars = validateEnvVars();
if (missingVars.length > 0) {
  console.error('========================================');
  console.error('ERROR: Missing required environment variables:');
  missingVars.forEach((varName) => {
    console.error(`  - ${varName}`);
  });
  console.error('');
  console.error('Please set these variables in Render Dashboard or .env file.');
  console.error('========================================');
}

// ============================================
// ROUTES
// ============================================

/**
 * GET /
 * Root endpoint - Página principal para iframe de Shopify
 */
app.get('/', (req, res) => {
  const host = process.env.HOST || 'http://localhost:3000';
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Shopify Orders API</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 600px;
      margin: 50px auto;
      padding: 20px;
      background: #f6f6f7;
    }
    .container {
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    h1 { color: #202223; margin-bottom: 10px; }
    .status { color: #008060; font-weight: 500; }
    .links { margin-top: 20px; }
    .links a {
      display: block;
      color: #006fbb;
      text-decoration: none;
      padding: 8px 0;
      border-bottom: 1px solid #e1e3e5;
    }
    .links a:hover { text-decoration: underline; }
    code {
      background: #f4f6f8;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Shopify Orders API</h1>
    <p class="status">✓ Server running</p>
    
    <div class="links">
      <h3>Endpoints</h3>
      <a href="${host}/health">/health - Health check</a>
      <a href="${host}/auth?shop=tu-tienda.myshopify.com">/auth?shop=... - Iniciar OAuth</a>
      <p style="color:#6d7175; font-size:14px; margin-top:10px;">
        <strong>GET /v1/orders?shop=...</strong><br>
        Requiere header: <code>Authorization: Bearer &lt;token&gt;</code>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();

  res.status(200).type('html').send(html);
});

/**
 * GET /health
 * Health check endpoint - no requiere autenticación
 */
app.get('/health', (req, res) => {
  res.status(200).json({
    ok: true,
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
  console.log(`  Root:      ${HOST}/`);
  console.log(`  Health:    ${HOST}/health`);
  console.log(`  OAuth:     ${HOST}/auth?shop=tienda.myshopify.com`);
  console.log(`  Orders:    ${HOST}/v1/orders?shop=tienda.myshopify.com`);
  console.log('========================================');
});
