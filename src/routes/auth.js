const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const { saveShopToken } = require('../store/shops');

const router = express.Router();

// Store temporal para nonces (en producción usar Redis o similar)
const nonceStore = new Map();

/**
 * Valida que el shop sea un dominio válido de Shopify
 * @param {string} shop 
 * @returns {boolean}
 */
function isValidShopDomain(shop) {
  if (!shop || typeof shop !== 'string') {
    return false;
  }
  // Debe terminar en .myshopify.com y no tener caracteres inválidos
  const shopRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
  return shopRegex.test(shop);
}

/**
 * Genera un nonce aleatorio
 * @returns {string}
 */
function generateNonce() {
  return crypto.randomBytes(16).toString('hex');
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
    return res.status(400).json({
      error: 'Missing required parameter: shop',
      example: '/auth?shop=tienda.myshopify.com',
    });
  }

  // Validar formato del shop
  if (!isValidShopDomain(shop)) {
    return res.status(400).json({
      error: 'Invalid shop domain',
      message: 'Shop must be a valid .myshopify.com domain',
      received: shop,
    });
  }

  // Obtener configuración de variables de entorno
  const clientId = process.env.SHOPIFY_API_KEY;
  const scopes = process.env.SCOPES;
  const host = process.env.HOST;

  if (!clientId || !scopes || !host) {
    console.error('[OAuth] Missing environment variables');
    return res.status(500).json({
      error: 'Server configuration error',
      message: 'Missing OAuth configuration',
    });
  }

  // Generar nonce para prevenir CSRF
  const nonce = generateNonce();
  
  // Guardar nonce temporalmente (expira en 10 minutos)
  nonceStore.set(nonce, {
    shop,
    createdAt: Date.now(),
  });

  // Limpiar nonces expirados
  setTimeout(() => {
    nonceStore.delete(nonce);
  }, 10 * 60 * 1000);

  // Construir URL de autorización
  const redirectUri = `${host}/auth/callback`;
  const authUrl = `https://${shop}/admin/oauth/authorize?` +
    `client_id=${clientId}&` +
    `scope=${scopes}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `state=${nonce}`;

  console.log(`[OAuth] Redirecting ${shop} to authorization`);
  
  // Redirigir al OAuth de Shopify
  res.redirect(authUrl);
});

/**
 * GET /auth/callback
 * Callback de OAuth de Shopify
 * Query params: shop, code, state
 */
router.get('/callback', async (req, res) => {
  const { shop, code, state } = req.query;

  // Validar parámetros requeridos
  if (!shop || !code || !state) {
    return res.status(400).json({
      error: 'Missing required parameters',
      required: ['shop', 'code', 'state'],
    });
  }

  // Validar formato del shop
  if (!isValidShopDomain(shop)) {
    return res.status(400).json({
      error: 'Invalid shop domain',
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

  // Verificar que el shop coincide
  if (storedNonce.shop !== shop) {
    return res.status(403).json({
      error: 'Shop mismatch',
      message: 'The shop in callback does not match the original request.',
    });
  }

  // Eliminar nonce usado
  nonceStore.delete(state);

  // Obtener configuración
  const clientId = process.env.SHOPIFY_API_KEY;
  const clientSecret = process.env.SHOPIFY_API_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({
      error: 'Server configuration error',
    });
  }

  try {
    // Intercambiar código por access_token
    console.log(`[OAuth] Exchanging code for access_token for ${shop}`);
    
    const tokenResponse = await axios.post(
      `https://${shop}/admin/oauth/access_token`,
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
    const saved = saveShopToken(shop, access_token);
    
    if (!saved) {
      throw new Error('Failed to save access token');
    }

    console.log(`[OAuth] Successfully authenticated ${shop}`);

    // Responder con éxito
    res.json({
      success: true,
      message: 'Shop authenticated successfully',
      shop: shop,
    });

  } catch (error) {
    console.error(`[OAuth] Error exchanging token for ${shop}:`, error.message);
    
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
