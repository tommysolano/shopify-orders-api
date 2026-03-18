<?php
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
 */
function normalizeShopDomain($shop) {
    if (empty($shop) || !is_string($shop)) {
        return null;
    }

    $normalized = trim($shop);

    // Remover protocolo (http:// o https://)
    $normalized = preg_replace('/^https?:\/\//i', '', $normalized);

    // Remover cualquier path después del dominio
    $parts = explode('/', $normalized);
    $normalized = $parts[0];

    // Remover slash final (por si acaso)
    $normalized = rtrim($normalized, '/');

    // Convertir a minúsculas
    $normalized = strtolower($normalized);

    return $normalized;
}

/**
 * Valida que el shop sea un dominio válido de Shopify
 */
function isValidShopDomain($shop) {
    $normalized = normalizeShopDomain($shop);
    
    if (!$normalized) {
        return false;
    }

    // Debe terminar en .myshopify.com y tener un nombre válido
    return (bool) preg_match('/^[a-z0-9][a-z0-9-]*[a-z0-9]\.myshopify\.com$|^[a-z0-9]\.myshopify\.com$/', $normalized);
}

/**
 * Valida y normaliza un dominio de tienda
 * @return array ['valid' => bool, 'normalized' => string|null, 'original' => string, 'error' => string|null]
 */
function validateAndNormalizeShop($shop) {
    $original = $shop;
    $normalized = normalizeShopDomain($shop);

    if (!$normalized) {
        return [
            'valid' => false,
            'normalized' => null,
            'original' => $original,
            'error' => 'Shop parameter is empty or invalid type',
        ];
    }

    if (!isValidShopDomain($normalized)) {
        return [
            'valid' => false,
            'normalized' => $normalized,
            'original' => $original,
            'error' => 'Shop must be a valid .myshopify.com domain',
        ];
    }

    return [
        'valid' => true,
        'normalized' => $normalized,
        'original' => $original,
        'error' => null,
    ];
}
