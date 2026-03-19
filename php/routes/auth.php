<?php
/**
 * Rutas de autenticación OAuth de Shopify
 * GET /auth - Inicia el flujo OAuth
 * GET /auth/callback - Callback de Shopify
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../store/shops.php';
require_once __DIR__ . '/../utils/shopValidator.php';

// Store temporal para nonces (usando archivos para compatibilidad con cPanel)
define('NONCE_FILE', __DIR__ . '/../../nonces.json');

/**
 * Genera un nonce aleatorio
 */
function generateNonce() {
    return bin2hex(random_bytes(16));
}

/**
 * Lee los nonces almacenados
 */
function readNonces() {
    if (!file_exists(NONCE_FILE)) {
        return [];
    }
    $data = file_get_contents(NONCE_FILE);
    $nonces = json_decode($data, true);
    return is_array($nonces) ? $nonces : [];
}

/**
 * Guarda los nonces
 */
function writeNonces($nonces) {
    file_put_contents(NONCE_FILE, json_encode($nonces, JSON_PRETTY_PRINT));
}

/**
 * Guarda un nonce con su shop asociado
 */
function storeNonce($nonce, $shop) {
    $nonces = readNonces();
    
    // Limpiar nonces expirados (más de 10 minutos)
    $now = time();
    foreach ($nonces as $key => $data) {
        if (($now - $data['created_at']) > 600) {
            unset($nonces[$key]);
        }
    }
    
    $nonces[$nonce] = [
        'shop' => $shop,
        'created_at' => $now,
    ];
    
    writeNonces($nonces);
}

/**
 * Obtiene y elimina un nonce
 * @return array|null Datos del nonce o null si no existe/expiró
 */
function consumeNonce($nonce) {
    $nonces = readNonces();
    
    if (!isset($nonces[$nonce])) {
        return null;
    }
    
    $data = $nonces[$nonce];
    
    // Verificar expiración (10 minutos)
    if ((time() - $data['created_at']) > 600) {
        unset($nonces[$nonce]);
        writeNonces($nonces);
        return null;
    }
    
    // Eliminar nonce usado
    unset($nonces[$nonce]);
    writeNonces($nonces);
    
    return $data;
}

/**
 * Verifica el HMAC del querystring de Shopify
 */
function verifyHmac($query, $secret) {
    if (!isset($query['hmac'])) {
        return false;
    }
    
    $hmac = $query['hmac'];
    
    // Crear copia del query sin hmac
    $params = $query;
    unset($params['hmac']);
    
    // Ordenar parámetros alfabéticamente
    ksort($params);
    
    // Crear string de parámetros
    $parts = [];
    foreach ($params as $key => $value) {
        $parts[] = "$key=$value";
    }
    $sortedParams = implode('&', $parts);
    
    // Calcular HMAC
    $calculatedHmac = hash_hmac('sha256', $sortedParams, $secret);
    
    // Comparar de forma segura (timing-safe)
    return hash_equals($hmac, $calculatedHmac);
}

/**
 * Valida las env vars de OAuth y retorna la configuración
 * @return array|null Configuración o null si faltan variables
 */
function getOAuthConfig() {
    $clientId = env('SHOPIFY_API_KEY');
    $clientSecret = env('SHOPIFY_API_SECRET');
    $scopes = env('SCOPES');
    $host = env('HOST');

    $missing = [];
    if (!$clientId) $missing[] = 'SHOPIFY_API_KEY';
    if (!$clientSecret) $missing[] = 'SHOPIFY_API_SECRET';
    if (!$scopes) $missing[] = 'SCOPES';
    if (!$host) $missing[] = 'HOST';

    if (!empty($missing)) {
        jsonResponse(500, [
            'error' => 'Server configuration error',
            'message' => 'Missing OAuth configuration',
            'missing' => $missing,
        ]);
        return null;
    }

    return compact('clientId', 'clientSecret', 'scopes', 'host');
}

/**
 * Maneja GET /auth
 * Inicia el flujo OAuth de Shopify
 */
function handleAuthStart() {
    $shop = isset($_GET['shop']) ? $_GET['shop'] : null;

    // Validar que se proporcionó el shop
    if (!$shop) {
        $exampleShop = env('SHOP') ? normalizeShopDomain(env('SHOP')) : 'tienda.myshopify.com';
        jsonResponse(400, [
            'error' => 'Missing required parameter: shop',
            'example' => "/auth?shop=$exampleShop",
        ]);
        return;
    }

    // Validar y normalizar shop
    $validation = validateAndNormalizeShop($shop);
    if (!$validation['valid']) {
        jsonResponse(400, [
            'error' => 'Invalid shop domain',
            'message' => $validation['error'],
            'received' => $validation['original'],
            'normalized' => $validation['normalized'],
        ]);
        return;
    }

    $normalizedShop = $validation['normalized'];

    // Obtener configuración de variables de entorno
    $config = getOAuthConfig();
    if (!$config) return;

    // Generar nonce para prevenir CSRF
    $nonce = generateNonce();

    // Guardar nonce temporalmente
    storeNonce($nonce, $normalizedShop);

    // Construir URL de autorización
    $redirectUri = $config['host'] . '/auth/callback';
    $authUrl = "https://$normalizedShop/admin/oauth/authorize?" .
        "client_id={$config['clientId']}&" .
        "scope={$config['scopes']}&" .
        "redirect_uri=" . urlencode($redirectUri) . "&" .
        "state=$nonce";

    error_log("[OAuth] Redirecting $normalizedShop to authorization");

    // Redirigir al OAuth de Shopify
    header("Location: $authUrl");
    exit;
}

/**
 * Maneja GET /auth/callback
 * Callback de OAuth de Shopify
 */
function handleAuthCallback() {
    $shop = isset($_GET['shop']) ? $_GET['shop'] : null;
    $code = isset($_GET['code']) ? $_GET['code'] : null;
    $state = isset($_GET['state']) ? $_GET['state'] : null;

    // Validar parámetros requeridos
    if (!$shop || !$code || !$state) {
        jsonResponse(400, [
            'error' => 'Missing required parameters',
            'required' => ['shop', 'code', 'state'],
            'received' => [
                'shop' => !empty($shop),
                'code' => !empty($code),
                'state' => !empty($state),
            ],
        ]);
        return;
    }

    // Validar y normalizar shop
    $validation = validateAndNormalizeShop($shop);
    if (!$validation['valid']) {
        jsonResponse(400, [
            'error' => 'Invalid shop domain',
            'message' => $validation['error'],
            'received' => $validation['original'],
        ]);
        return;
    }

    $normalizedShop = $validation['normalized'];

    // Obtener configuración
    $config = getOAuthConfig();
    if (!$config) return;

    // Verificar HMAC (seguridad de Shopify)
    if (isset($_GET['hmac']) && !verifyHmac($_GET, $config['clientSecret'])) {
        error_log("[OAuth] HMAC verification failed for $normalizedShop");
        jsonResponse(403, [
            'error' => 'HMAC verification failed',
            'message' => 'The request signature is invalid.',
        ]);
        return;
    }

    // Verificar nonce (state)
    $storedNonce = consumeNonce($state);
    if (!$storedNonce) {
        jsonResponse(403, [
            'error' => 'Invalid state parameter',
            'message' => 'State not found or expired. Please restart the OAuth flow.',
        ]);
        return;
    }

    // Verificar que el shop coincide (normalizado)
    if ($storedNonce['shop'] !== $normalizedShop) {
        jsonResponse(403, [
            'error' => 'Shop mismatch',
            'message' => 'The shop in callback does not match the original request.',
        ]);
        return;
    }

    try {
        // Intercambiar código por access_token
        error_log("[OAuth] Exchanging code for access_token for $normalizedShop");

        $tokenUrl = "https://$normalizedShop/admin/oauth/access_token";
        $postData = json_encode([
            'client_id' => $config['clientId'],
            'client_secret' => $config['clientSecret'],
            'code' => $code,
        ]);

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $tokenUrl);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Accept: application/json',
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);

        if ($curlError) {
            throw new Exception("Connection error: $curlError");
        }

        if ($httpCode >= 400) {
            $body = json_decode($response, true);
            jsonResponse($httpCode, [
                'error' => 'OAuth token exchange failed',
                'details' => $body,
            ]);
            return;
        }

        $tokenData = json_decode($response, true);
        $accessToken = isset($tokenData['access_token']) ? $tokenData['access_token'] : null;

        if (!$accessToken) {
            throw new Exception('No access_token in response');
        }

        // Guardar el token en el store
        $saved = saveShopToken($normalizedShop, $accessToken);

        if (!$saved) {
            throw new Exception('Failed to save access token');
        }

        error_log("[OAuth] Successfully authenticated $normalizedShop");

        $host = $config['host'];

        // Mostrar página de éxito HTML
        $successHtml = <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Autorización Exitosa</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 500px;
      margin: 80px auto;
      padding: 20px;
      text-align: center;
      background: #f6f6f7;
    }
    .container {
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .success { color: #008060; font-size: 48px; }
    h1 { color: #202223; margin: 20px 0 10px; }
    .shop { color: #006fbb; font-weight: 500; }
    p { color: #6d7175; }
    .next-steps {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #e1e3e5;
      text-align: left;
    }
    code {
      background: #f4f6f8;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 12px;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="success">✓</div>
    <h1>Autorizado</h1>
    <p>La tienda <span class="shop">$normalizedShop</span> ha sido conectada exitosamente.</p>
    
    <div class="next-steps">
      <strong>Ahora puedes consultar:</strong><br><br>
      <code>GET $host/v1/orders?shop=$normalizedShop</code><br><br>
      <small>Con header: Authorization: Bearer &lt;tu-token&gt;</small>
    </div>
  </div>
</body>
</html>
HTML;

        header('Content-Type: text/html; charset=UTF-8');
        echo $successHtml;

    } catch (Exception $e) {
        error_log("[OAuth] Error exchanging token for $normalizedShop: " . $e->getMessage());

        jsonResponse(500, [
            'error' => 'Failed to complete OAuth flow',
            'message' => $e->getMessage(),
        ]);
    }
}
