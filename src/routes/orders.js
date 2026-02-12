const express = require('express');
const axios = require('axios');
const { getShopToken, isShopAuthenticated } = require('../store/shops');
const { validateAndNormalizeShop } = require('../utils/shopValidator');

const router = express.Router();

/**
 * Formatea una orden de Shopify al formato deseado
 * @param {object} order - Orden de Shopify
 * @returns {object} Orden formateada
 */
function formatOrder(order) {
  return {
    id: order.id,
    name: order.name,
    createdAt: order.created_at,
    financialStatus: order.financial_status,
    fulfillmentStatus: order.fulfillment_status,
    totalPrice: order.total_price,
    currency: order.currency,
    customer: order.customer
      ? {
          firstName: order.customer.first_name,
          lastName: order.customer.last_name,
          email: order.customer.email,
        }
      : null,
    lineItems: (order.line_items || []).map((item) => ({
      sku: item.sku,
      title: item.title,
      quantity: item.quantity,
      variantId: item.variant_id,
      productId: item.product_id,
    })),
  };
}

/**
 * GET /v1/orders
 * Obtiene las órdenes de una tienda
 * Query params: shop (requerido), limit (opcional, default 10)
 */
router.get('/', async (req, res) => {
  const { shop, limit = 10, status = 'any' } = req.query;

  // Validar que se proporcionó el shop
  if (!shop) {
    return res.status(400).json({
      error: 'Missing required parameter: shop',
      example: '/v1/orders?shop=tienda.myshopify.com',
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
  const host = process.env.HOST || '';

  // Verificar si la tienda está autenticada
  if (!isShopAuthenticated(normalizedShop)) {
    return res.status(401).json({
      error: 'Shop not installed',
      message: `The shop ${normalizedShop} has not completed OAuth. Please install the app first.`,
      auth_url: `${host}/auth?shop=${normalizedShop}`,
    });
  }

  // Obtener el access_token
  const accessToken = getShopToken(normalizedShop);

  if (!accessToken) {
    return res.status(401).json({
      error: 'Token not found',
      message: 'Access token not found for this shop. Please re-authenticate.',
      auth_url: `${host}/auth?shop=${normalizedShop}`,
    });
  }

  const apiVersion = process.env.API_VERSION || '2024-01';

  try {
    // Llamar a la API de Shopify
    const response = await axios.get(
      `https://${normalizedShop}/admin/api/${apiVersion}/orders.json`,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        params: {
          limit: Math.min(Math.max(parseInt(limit) || 10, 1), 250),
          status: status,
        },
      }
    );

    const orders = (response.data.orders || []).map(formatOrder);

    return res.json({
      ok: true,
      shop: normalizedShop,
      count: orders.length,
      orders,
    });
  } catch (error) {
    console.error(`[Orders] Error fetching orders for ${normalizedShop}:`, error.message);

    // Manejar errores de Shopify
    if (error.response) {
      const statusCode = error.response.status;

      // Token inválido o expirado
      if (statusCode === 401) {
        return res.status(401).json({
          error: 'Invalid or expired token',
          message: 'The access token is no longer valid. Please re-authenticate.',
          auth_url: `${host}/auth?shop=${normalizedShop}`,
        });
      }

      // Forbidden - permisos insuficientes
      if (statusCode === 403) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: 'The app does not have permission to read orders. Check your scopes.',
        });
      }

      return res.status(statusCode).json({
        error: 'Shopify API error',
        status: statusCode,
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
  const host = process.env.HOST || '';

  // Verificar autenticación
  if (!isShopAuthenticated(normalizedShop)) {
    return res.status(401).json({
      error: 'Shop not installed',
      message: `The shop ${normalizedShop} has not completed OAuth.`,
      auth_url: `${host}/auth?shop=${normalizedShop}`,
    });
  }

  const accessToken = getShopToken(normalizedShop);
  const apiVersion = process.env.API_VERSION || '2024-01';

  try {
    const response = await axios.get(
      `https://${normalizedShop}/admin/api/${apiVersion}/orders/${orderId}.json`,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      }
    );

    return res.json({
      ok: true,
      shop: normalizedShop,
      order: formatOrder(response.data.order),
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
