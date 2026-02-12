const fs = require('fs');
const path = require('path');

const SHOPS_FILE = path.join(__dirname, '../../shops.json');

/**
 * Lee el archivo shops.json
 * @returns {object} Objeto con las tiendas guardadas
 */
function readShops() {
  try {
    if (!fs.existsSync(SHOPS_FILE)) {
      return {};
    }
    const data = fs.readFileSync(SHOPS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[ShopStore] Error reading shops.json:', error.message);
    return {};
  }
}

/**
 * Guarda el objeto de tiendas en shops.json
 * @param {object} shops - Objeto con las tiendas
 * @returns {boolean} true si se guardó correctamente
 */
function writeShops(shops) {
  try {
    fs.writeFileSync(SHOPS_FILE, JSON.stringify(shops, null, 2));
    return true;
  } catch (error) {
    console.error('[ShopStore] Error writing shops.json:', error.message);
    return false;
  }
}

/**
 * Guarda el access_token de una tienda
 * @param {string} shop - Dominio de la tienda (ej: tienda.myshopify.com)
 * @param {string} accessToken - Access token de Shopify
 * @returns {boolean} true si se guardó correctamente
 */
function saveShopToken(shop, accessToken) {
  const shops = readShops();
  shops[shop] = {
    access_token: accessToken,
    installed_at: new Date().toISOString(),
  };
  return writeShops(shops);
}

/**
 * Obtiene el access_token de una tienda
 * @param {string} shop - Dominio de la tienda
 * @returns {string|null} Access token o null si no existe
 */
function getShopToken(shop) {
  const shops = readShops();
  return shops[shop]?.access_token || null;
}

/**
 * Verifica si una tienda está autenticada
 * @param {string} shop - Dominio de la tienda
 * @returns {boolean}
 */
function isShopAuthenticated(shop) {
  return getShopToken(shop) !== null;
}

/**
 * Elimina una tienda del store
 * @param {string} shop - Dominio de la tienda
 * @returns {boolean}
 */
function removeShop(shop) {
  const shops = readShops();
  if (shops[shop]) {
    delete shops[shop];
    return writeShops(shops);
  }
  return false;
}

/**
 * Obtiene todas las tiendas autenticadas
 * @returns {string[]} Array con los dominios de las tiendas
 */
function getAllShops() {
  const shops = readShops();
  return Object.keys(shops);
}

module.exports = {
  saveShopToken,
  getShopToken,
  isShopAuthenticated,
  removeShop,
  getAllShops,
};
