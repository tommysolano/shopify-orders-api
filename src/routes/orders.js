const express = require('express');
const { shopifyGraphQL, isShopifyConfigured } = require('../shopify');

const router = express.Router();

/**
 * GET /v1/orders
 * Test de conexión con Shopify - obtiene el nombre de la tienda
 */
router.get('/', async (req, res) => {
  // Verificar que Shopify esté configurado
  if (!isShopifyConfigured()) {
    return res.status(500).json({
      error: 'Shopify not configured',
      details: 'Missing Shopify environment variables',
    });
  }

  try {
    const query = `
      query {
        shop {
          name
        }
      }
    `;

    const data = await shopifyGraphQL(query);

    return res.json({
      ok: true,
      shop: data.shop,
    });
  } catch (error) {
    console.error('[Orders] Error connecting to Shopify:', error.message);

    // Construir respuesta de error
    const errorResponse = {
      error: error.message,
    };

    // Agregar detalles si existen
    if (error.shopifyErrors) {
      errorResponse.details = error.shopifyErrors;
    } else if (error.details) {
      errorResponse.details = error.details;
    }

    return res.status(500).json(errorResponse);
  }
});

module.exports = router;
