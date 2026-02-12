/**
 * Utilidades para validar y normalizar dominios de tiendas Shopify
 */

/**
 * Normaliza un dominio de tienda Shopify
 * Acepta:
 *   - tienda.myshopify.com
 *   - https://tienda.myshopify.com
 *   - tienda.myshopify.com/
 *   - https://tienda.myshopify.com/admin
 * 
 * Retorna: tienda.myshopify.com (sin protocolo, sin slash, sin path)
 * 
 * @param {string} shop - Dominio de la tienda (puede incluir protocolo o slash)
 * @returns {string|null} Dominio normalizado o null si es inválido
 */
function normalizeShopDomain(shop) {
  if (!shop || typeof shop !== 'string') {
    return null;
  }

  let normalized = shop.trim();

  // Remover protocolo (http:// o https://)
  normalized = normalized.replace(/^https?:\/\//i, '');

  // Remover cualquier path después del dominio
  normalized = normalized.split('/')[0];

  // Remover slash final (por si acaso)
  normalized = normalized.replace(/\/+$/, '');

  // Convertir a minúsculas
  normalized = normalized.toLowerCase();

  return normalized;
}

/**
 * Valida que el shop sea un dominio válido de Shopify
 * @param {string} shop - Dominio de la tienda (ya normalizado o no)
 * @returns {boolean}
 */
function isValidShopDomain(shop) {
  const normalized = normalizeShopDomain(shop);
  
  if (!normalized) {
    return false;
  }

  // Debe terminar en .myshopify.com y tener un nombre válido
  // Nombre: letras, números, guiones, pero no empezar/terminar con guión
  const shopRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]\.myshopify\.com$|^[a-z0-9]\.myshopify\.com$/;
  return shopRegex.test(normalized);
}

/**
 * Valida y normaliza un dominio de tienda
 * @param {string} shop - Dominio de la tienda
 * @returns {{ valid: boolean, normalized: string|null, original: string, error: string|null }}
 */
function validateAndNormalizeShop(shop) {
  const original = shop;
  const normalized = normalizeShopDomain(shop);

  if (!normalized) {
    return {
      valid: false,
      normalized: null,
      original,
      error: 'Shop parameter is empty or invalid type',
    };
  }

  if (!isValidShopDomain(normalized)) {
    return {
      valid: false,
      normalized,
      original,
      error: 'Shop must be a valid .myshopify.com domain',
    };
  }

  return {
    valid: true,
    normalized,
    original,
    error: null,
  };
}

module.exports = {
  normalizeShopDomain,
  isValidShopDomain,
  validateAndNormalizeShop,
};
