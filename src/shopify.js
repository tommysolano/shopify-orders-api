const axios = require('axios');

/**
 * Cliente para Shopify Admin GraphQL API
 */

let shopifyClient = null;

/**
 * Inicializa el cliente de Shopify con las variables de entorno
 * @returns {boolean} true si la configuración es válida
 */
function initShopifyClient() {
  const shopDomain = process.env.SHOP_DOMAIN;
  const adminToken = process.env.SHOP_ADMIN_TOKEN;
  const apiVersion = process.env.API_VERSION;

  if (!shopDomain || !adminToken || !apiVersion) {
    return false;
  }

  shopifyClient = axios.create({
    baseURL: `https://${shopDomain}/admin/api/${apiVersion}/graphql.json`,
    headers: {
      'X-Shopify-Access-Token': adminToken,
      'Content-Type': 'application/json',
    },
  });

  return true;
}

/**
 * Ejecuta una query GraphQL contra Shopify Admin API
 * @param {string} query - Query GraphQL
 * @param {object} variables - Variables para la query (opcional)
 * @returns {Promise<object>} Respuesta de Shopify
 * @throws {Error} Si hay error de conexión o Shopify devuelve errores
 */
async function shopifyGraphQL(query, variables = {}) {
  if (!shopifyClient) {
    throw new Error('Shopify client not initialized. Check environment variables.');
  }

  try {
    const response = await shopifyClient.post('', {
      query,
      variables,
    });

    // Verificar si Shopify devolvió errores en la respuesta GraphQL
    if (response.data.errors && response.data.errors.length > 0) {
      const error = new Error('Shopify GraphQL Error');
      error.shopifyErrors = response.data.errors;
      throw error;
    }

    return response.data.data;
  } catch (error) {
    // Si es un error de axios (HTTP error)
    if (error.response) {
      const httpError = new Error(`Shopify API Error: ${error.response.status}`);
      httpError.status = error.response.status;
      httpError.details = error.response.data;
      throw httpError;
    }

    // Si ya es un error procesado (GraphQL errors)
    if (error.shopifyErrors) {
      throw error;
    }

    // Error de red u otro
    throw new Error(`Connection error: ${error.message}`);
  }
}

/**
 * Verifica si el cliente de Shopify está configurado
 * @returns {boolean}
 */
function isShopifyConfigured() {
  return shopifyClient !== null;
}

module.exports = {
  initShopifyClient,
  shopifyGraphQL,
  isShopifyConfigured,
};
