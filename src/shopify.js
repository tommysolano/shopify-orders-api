const axios = require('axios');
const { getShopToken } = require('./store/shops');

/**
 * Cliente dinámico para Shopify Admin API
 * Soporta múltiples tiendas con diferentes tokens
 */

/**
 * Crea un cliente de Shopify para una tienda específica
 * @param {string} shop - Dominio de la tienda
 * @returns {object|null} Cliente axios configurado o null si no hay token
 */
function createShopifyClient(shop) {
  const accessToken = getShopToken(shop);
  
  if (!accessToken) {
    return null;
  }

  const apiVersion = process.env.API_VERSION || '2024-01';

  return axios.create({
    baseURL: `https://${shop}/admin/api/${apiVersion}`,
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Ejecuta una query GraphQL contra Shopify Admin API
 * @param {string} shop - Dominio de la tienda
 * @param {string} query - Query GraphQL
 * @param {object} variables - Variables para la query (opcional)
 * @returns {Promise<object>} Respuesta de Shopify
 * @throws {Error} Si hay error de conexión o Shopify devuelve errores
 */
async function shopifyGraphQL(shop, query, variables = {}) {
  const client = createShopifyClient(shop);
  
  if (!client) {
    throw new Error(`No access token found for shop: ${shop}`);
  }

  try {
    const response = await client.post('/graphql.json', {
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
 * Ejecuta una petición REST contra Shopify Admin API
 * @param {string} shop - Dominio de la tienda
 * @param {string} method - Método HTTP (GET, POST, PUT, DELETE)
 * @param {string} endpoint - Endpoint de la API (ej: /orders.json)
 * @param {object} data - Datos para POST/PUT (opcional)
 * @param {object} params - Query params (opcional)
 * @returns {Promise<object>} Respuesta de Shopify
 */
async function shopifyREST(shop, method, endpoint, data = null, params = {}) {
  const client = createShopifyClient(shop);
  
  if (!client) {
    throw new Error(`No access token found for shop: ${shop}`);
  }

  try {
    const config = {
      method,
      url: endpoint,
      params,
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      config.data = data;
    }

    const response = await client(config);
    return response.data;
  } catch (error) {
    if (error.response) {
      const httpError = new Error(`Shopify API Error: ${error.response.status}`);
      httpError.status = error.response.status;
      httpError.details = error.response.data;
      throw httpError;
    }
    throw new Error(`Connection error: ${error.message}`);
  }
}

/**
 * Verifica si una tienda tiene token configurado
 * @param {string} shop - Dominio de la tienda
 * @returns {boolean}
 */
function isShopConfigured(shop) {
  return getShopToken(shop) !== null;
}

module.exports = {
  createShopifyClient,
  shopifyGraphQL,
  shopifyREST,
  isShopConfigured,
};
