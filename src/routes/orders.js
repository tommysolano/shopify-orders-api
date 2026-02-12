const express = require('express');
const axios = require('axios');
const { getShopToken, isShopAuthenticated } = require('../store/shops');

const router = express.Router();

/**
 * Valida que el shop sea un dominio válido de Shopify
 * @param {string} shop 
 * @returns {boolean}
 */
function isValidShopDomain(shop) {
  if (!shop || typeof shop !== 'string') {
    return false;
  }
  const shopRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
  return shopRegex.test(shop);
}

/**
 * GET /v1/orders
 * Obtiene las órdenes de una tienda
 * Query params: shop (requerido), limit (opcional, default 50)
 */
router.get('/', async (req, res) => {
  const { shop, limit = 50, status = 'any' } = req.query;

  // Validar que se proporcionó el shop
  if (!shop) {
    return res.status(400).json({
      error: 'Missing required parameter: shop',
      example: '/v1/orders?shop=tienda.myshopify.com',
    });
  }

  // Validar formato del shop
  if (!isValidShopDomain(shop)) {
    return res.status(400).json({
      error: 'Invalid shop domain',
      message: 'Shop must be a valid .myshopify.com domain',
    });
  }

  // Verificar si la tienda está autenticada
  if (!isShopAuthenticated(shop)) {
    return res.status(401).json({
      error: 'Shop not authenticated',
      message: `The shop ${shop} has not completed OAuth. Please authenticate first.`,
      auth_url: `${process.env.HOST}/auth?shop=${shop}`,
    });
  }

  // Obtener el access_token
  const accessToken = getShopToken(shop);
  
  if (!accessToken) {
    return res.status(401).json({
      error: 'Token not found',
      message: 'Access token not found for this shop. Please re-authenticate.',
    });
  }

  const apiVersion = process.env.API_VERSION || '2024-01';

  try {
    // Llamar a la API de Shopify
    const response = await axios.get(
      `https://${shop}/admin/api/${apiVersion}/orders.json`,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        params: {
          limit: Math.min(parseInt(limit), 250), // Máximo 250 por Shopify
          status: status,
        },
      }
    );

    return res.json({
      ok: true,
      shop: shop,
      count: response.data.orders?.length || 0,
      orders: response.data.orders,
    });

  } catch (error) {
    console.error(`[Orders] Error fetching orders for ${shop}:`, error.message);

    // Manejar errores de Shopify
    if (error.response) {
      const status = error.response.status;
      
      // Token inválido o expirado
      if (status === 401) {
        return res.status(401).json({
          error: 'Invalid or expired token',
          message: 'The access token is no longer valid. Please re-authenticate.',
          auth_url: `${process.env.HOST}/auth?shop=${shop}`,
        });
      }

      // Forbidden - permisos insuficientes
      if (status === 403) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: 'The app does not have permission to read orders. Check your scopes.',
        });
      }

      return res.status(status).json({
        error: 'Shopify API error',
        status: status,
        details: error.response.data,
      });
    }

    return res.status(500).json({
      error: 'Failed to fetch orders',
      message: error.message,
    });
  }
});

/**
 * GET /v1/orders/:orderId
 * Obtiene una orden específica
 * Query params: shop (requerido)
 */
router.get('/:orderId', async (req, res) => {
  const { shop } = req.query;
  const { orderId } = req.params;

  // Validar que se proporcionó el shop
  if (!shop) {
    return res.status(400).json({
      error: 'Missing required parameter: shop',
    });
  }

  // Validar formato del shop
  if (!isValidShopDomain(shop)) {
    return res.status(400).json({
      error: 'Invalid shop domain',
    });
  }

  // Verificar autenticación
  if (!isShopAuthenticated(shop)) {
    return res.status(401).json({
      error: 'Shop not authenticated',
      auth_url: `${process.env.HOST}/auth?shop=${shop}`,
    });
  }

  const accessToken = getShopToken(shop);
  const apiVersion = process.env.API_VERSION || '2024-01';

  try {
    const response = await axios.get(
      `https://${shop}/admin/api/${apiVersion}/orders/${orderId}.json`,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      }
    );

    return res.json({
      ok: true,
      shop: shop,
      order: response.data.order,
    });

  } catch (error) {
    console.error(`[Orders] Error fetching order ${orderId}:`, error.message);

    if (error.response) {
      if (error.response.status === 404) {
        return res.status(404).json({
          error: 'Order not found',
          orderId: orderId,
        });
      }

      return res.status(error.response.status).json({
        error: 'Shopify API error',
        details: error.response.data,
      });
    }

    return res.status(500).json({
      error: 'Failed to fetch order',
      message: error.message,
    });
  }
});

module.exports = router;
