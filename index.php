<?php
/**
 * Shopify Orders API - PHP Version
 * Router principal - Equivalente a server.js de Express
 * 
 * Todas las peticiones se redirigen aquí mediante .htaccess
 */

// Evitar acceso directo a archivos PHP internos
// Solo index.php debe ser el punto de entrada

// Cargar configuración
require_once __DIR__ . '/php/config.php';
require_once __DIR__ . '/php/utils/shopValidator.php';
require_once __DIR__ . '/php/middleware/auth.php';
require_once __DIR__ . '/php/routes/auth.php';
require_once __DIR__ . '/php/routes/orders.php';

// ============================================
// ROUTER
// ============================================

// Obtener la URI y el método HTTP
$requestUri = $_SERVER['REQUEST_URI'];
$method = $_SERVER['REQUEST_METHOD'];

// Remover query string para el routing
$path = parse_url($requestUri, PHP_URL_PATH);

// Remover trailing slash (excepto para /)
if ($path !== '/' && substr($path, -1) === '/') {
    $path = rtrim($path, '/');
}

// Validar variables de entorno al iniciar (log una sola vez por request)
$missingVars = validateEnvVars();
if (!empty($missingVars)) {
    error_log('========================================');
    error_log('ERROR: Missing required environment variables:');
    foreach ($missingVars as $varName) {
        error_log("  - $varName");
    }
    error_log('Please set these variables in cPanel or .env file.');
    error_log('========================================');
}

// ============================================
// ROUTES
// ============================================

// GET / - Página principal
if ($path === '/' && $method === 'GET') {
    $host = env('HOST', 'http://localhost');
    $shop = normalizeShopDomain(env('SHOP')) ?: 'tu-tienda.myshopify.com';
    
    $html = <<<HTML
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
    <p class="status">✓ Server running (PHP)</p>
    
    <div class="links">
      <h3>Endpoints</h3>
      <a href="$host/health">/health - Health check</a>
      <a href="$host/auth?shop=$shop">/auth?shop=... - Iniciar OAuth</a>
      <p style="color:#6d7175; font-size:14px; margin-top:10px;">
        <strong>GET /v1/orders?shop=...</strong><br>
        Requiere header: <code>Authorization: Bearer &lt;token&gt;</code>
      </p>
    </div>
  </div>
</body>
</html>
HTML;

    htmlResponse(200, $html);
}

// GET /health - Health check
if ($path === '/health' && $method === 'GET') {
    jsonResponse(200, [
        'ok' => true,
        'timestamp' => date('c'),
    ]);
}

// GET /auth - Iniciar OAuth
if ($path === '/auth' && $method === 'GET') {
    handleAuthStart();
    exit;
}

// GET /auth/callback - Callback OAuth
if ($path === '/auth/callback' && $method === 'GET') {
    handleAuthCallback();
    exit;
}

// GET /v1/orders - Listar órdenes (con autenticación Bearer)
if ($path === '/v1/orders' && $method === 'GET') {
    if (!authMiddleware()) {
        exit;
    }
    handleGetOrders();
    exit;
}

// GET /v1/orders/:orderId - Obtener orden específica (con autenticación Bearer)
if (preg_match('#^/v1/orders/(\d+)$#', $path, $matches) && $method === 'GET') {
    if (!authMiddleware()) {
        exit;
    }
    handleGetOrder($matches[1]);
    exit;
}

// 404 - Ruta no encontrada
jsonResponse(404, [
    'error' => 'Not Found',
    'message' => "Route $method $path not found",
    'available_routes' => [
        'GET /' => 'Home page',
        'GET /health' => 'Health check',
        'GET /auth?shop=...' => 'Start OAuth flow',
        'GET /auth/callback' => 'OAuth callback (automatic)',
        'GET /v1/orders?shop=...' => 'List orders (requires Bearer token)',
        'GET /v1/orders/:id?shop=...' => 'Get specific order (requires Bearer token)',
    ],
]);
