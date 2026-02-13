const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const { saveShopToken } = require('../store/shops');
const { validateAndNormalizeShop } = require('../utils/shopValidator');

const router = express.Router();

// Store temporal para nonces (en producción usar Redis o similar)
const nonceStore = new Map();

/**
 * Genera un nonce aleatorio
 * @returns {string}
 */
function generateNonce() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Verifica el HMAC del querystring de Shopify
 * @param {object} query - Query params del callback
 * @param {string} secret - SHOPIFY_API_SECRET
 * @returns {boolean}
 */
function verifyHmac(query, secret) {
  const hmac = query.hmac;
  if (!hmac) return false;

  // Crear copia del query sin hmac
  const params = { ...query };
  delete params.hmac;

  // Ordenar parámetros alfabéticamente y crear string
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  // Calcular HMAC
  const calculatedHmac = crypto
    .createHmac('sha256', secret)
    .update(sortedParams)
    .digest('hex');

  // Comparar de forma segura
  try {
    return crypto.timingSafeEqual(
      Buffer.from(hmac, 'hex'),
      Buffer.from(calculatedHmac, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Valida las env vars de OAuth y retorna error JSON si faltan
 */
function getOAuthConfig(res) {
  const clientId = process.env.SHOPIFY_API_KEY;
  const clientSecret = process.env.SHOPIFY_API_SECRET;
  const scopes = process.env.SCOPES;
  const host = process.env.HOST;

  const missing = [];
  if (!clientId) missing.push('SHOPIFY_API_KEY');
  if (!clientSecret) missing.push('SHOPIFY_API_SECRET');
  if (!scopes) missing.push('SCOPES');
  if (!host) missing.push('HOST');

  if (missing.length > 0) {
    res.status(500).json({
      error: 'Server configuration error',
      message: 'Missing OAuth configuration',
      missing,
    });
    return null;
  }

  return { clientId, clientSecret, scopes, host };
}

/**
 * GET /auth
 * Inicia el flujo OAuth de Shopify
 * Query params: shop (requerido)
 */
router.get('/', (req, res) => {
  const { shop } = req.query;

  // Validar que se proporcionó el shop
  if (!shop) {
    const exampleShop = process.env.SHOP ? require('../utils/shopValidator').normalizeShopDomain(process.env.SHOP) : 'tienda.myshopify.com';
    return res.status(400).json({
      error: 'Missing required parameter: shop',
      example: `/auth?shop=${exampleShop}`,
    });
  }

  // Validar y normalizar shop
  const validation = validateAndNormalizeShop(shop);
  if (!validation.valid) {
    return res.status(400).json({
      error: 'Invalid shop domain',
      message: validation.error,
      received: validation.original,
      normalized: validation.normalized,
    });
  }

  const normalizedShop = validation.normalized;

  // Obtener configuración de variables de entorno
  const config = getOAuthConfig(res);
  if (!config) return; // Ya se envió respuesta de error

  const { clientId, scopes, host } = config;

  // Generar nonce para prevenir CSRF
  const nonce = generateNonce();

  // Guardar nonce temporalmente (expira en 10 minutos)
  nonceStore.set(nonce, {
    shop: normalizedShop,
    createdAt: Date.now(),
  });

  // Limpiar nonces expirados
  setTimeout(() => {
    nonceStore.delete(nonce);
  }, 10 * 60 * 1000);

  // Construir URL de autorización
  const redirectUri = `${host}/auth/callback`;
  const authUrl =
    `https://${normalizedShop}/admin/oauth/authorize?` +
    `client_id=${clientId}&` +
    `scope=${scopes}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `state=${nonce}`;

  console.log(`[OAuth] Redirecting ${normalizedShop} to authorization`);

  // Redirigir al OAuth de Shopify
  res.redirect(authUrl);
});

/**
 * GET /auth/callback
 * Callback de OAuth de Shopify
 * Query params: shop, code, state, hmac, timestamp
 */
router.get('/callback', async (req, res) => {
  const { shop, code, state } = req.query;

  // Validar parámetros requeridos
  if (!shop || !code || !state) {
    return res.status(400).json({
      error: 'Missing required parameters',
      required: ['shop', 'code', 'state'],
      received: { shop: !!shop, code: !!code, state: !!state },
    });
  }

  // Validar y normalizar shop
  const validation = validateAndNormalizeShop(shop);
  if (!validation.valid) {
    return res.status(400).json({
      error: 'Invalid shop domain',
      message: validation.error,
      received: validation.original,
    });
  }

  const normalizedShop = validation.normalized;

  // Obtener configuración
  const config = getOAuthConfig(res);
  if (!config) return;

  const { clientId, clientSecret, host } = config;

  // Verificar HMAC (seguridad de Shopify)
  if (req.query.hmac && !verifyHmac(req.query, clientSecret)) {
    console.error(`[OAuth] HMAC verification failed for ${normalizedShop}`);
    return res.status(403).json({
      error: 'HMAC verification failed',
      message: 'The request signature is invalid.',
    });
  }

  // Verificar nonce (state)
  const storedNonce = nonceStore.get(state);
  if (!storedNonce) {
    return res.status(403).json({
      error: 'Invalid state parameter',
      message: 'State not found or expired. Please restart the OAuth flow.',
    });
  }

  // Verificar que el shop coincide (normalizado)
  if (storedNonce.shop !== normalizedShop) {
    return res.status(403).json({
      error: 'Shop mismatch',
      message: 'The shop in callback does not match the original request.',
    });
  }

  // Eliminar nonce usado
  nonceStore.delete(state);

  try {
    // Intercambiar código por access_token
    console.log(`[OAuth] Exchanging code for access_token for ${normalizedShop}`);

    const tokenResponse = await axios.post(
      `https://${normalizedShop}/admin/oauth/access_token`,
      {
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const { access_token } = tokenResponse.data;

    if (!access_token) {
      throw new Error('No access_token in response');
    }

    // Guardar el token en el store
    const saved = saveShopToken(normalizedShop, access_token);

    if (!saved) {
      throw new Error('Failed to save access token');
    }

    console.log(`[OAuth] Successfully authenticated ${normalizedShop}`);

    // Mostrar página de éxito HTML
    const successHtml = `
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
    <p>La tienda <span class="shop">${normalizedShop}</span> ha sido conectada exitosamente.</p>
    
    <div class="next-steps">
      <strong>Ahora puedes consultar:</strong><br><br>
      <code>GET ${host}/v1/orders?shop=${normalizedShop}</code><br><br>
      <small>Con header: Authorization: Bearer &lt;tu-token&gt;</small>
    </div>
  </div>
</body>
</html>
    `.trim();

    res.status(200).type('html').send(successHtml);
  } catch (error) {
    console.error(`[OAuth] Error exchanging token for ${normalizedShop}:`, error.message);

    // Manejar diferentes tipos de errores
    if (error.response) {
      return res.status(error.response.status).json({
        error: 'OAuth token exchange failed',
        details: error.response.data,
      });
    }

    return res.status(500).json({
      error: 'Failed to complete OAuth flow',
      message: error.message,
    });
  }
});

module.exports = router;
