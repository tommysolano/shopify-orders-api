<?php
/**
 * Store para manejar tokens de tiendas Shopify
 * Persiste datos en shops.json
 */

define('SHOPS_FILE', __DIR__ . '/../../shops.json');

/**
 * Lee el archivo shops.json
 * @return array Objeto con las tiendas guardadas
 */
function readShops() {
    if (!file_exists(SHOPS_FILE)) {
        return [];
    }
    
    $data = file_get_contents(SHOPS_FILE);
    if ($data === false) {
        error_log('[ShopStore] Error reading shops.json');
        return [];
    }
    
    $shops = json_decode($data, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        error_log('[ShopStore] Error parsing shops.json: ' . json_last_error_msg());
        return [];
    }
    
    return $shops;
}

/**
 * Guarda el objeto de tiendas en shops.json
 * @return bool true si se guardó correctamente
 */
function writeShops($shops) {
    $json = json_encode($shops, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    $result = file_put_contents(SHOPS_FILE, $json);
    
    if ($result === false) {
        error_log('[ShopStore] Error writing shops.json');
        return false;
    }
    
    return true;
}

/**
 * Guarda el access_token de una tienda
 */
function saveShopToken($shop, $accessToken) {
    $shops = readShops();
    $shops[$shop] = [
        'access_token' => $accessToken,
        'installed_at' => date('c'), // ISO 8601
    ];
    return writeShops($shops);
}

/**
 * Obtiene el access_token de una tienda
 * Primero busca en shops.json, luego en SHOP_ADMIN_TOKEN si el shop coincide
 * @return string|null Access token o null si no existe
 */
function getShopToken($shop) {
    $shops = readShops();
    if (isset($shops[$shop]['access_token'])) {
        return $shops[$shop]['access_token'];
    }
    
    // Fallback: si el shop coincide con SHOP_DOMAIN o SHOP, usar SHOP_ADMIN_TOKEN
    $shopDomain = getenv('SHOP_DOMAIN') ?: getenv('SHOP');
    $adminToken = getenv('SHOP_ADMIN_TOKEN');
    
    if ($adminToken && $shopDomain) {
        // Normalizar para comparar
        $shopDomain = strtolower(trim($shopDomain));
        $shopDomain = preg_replace('/^https?:\/\//i', '', $shopDomain);
        $shopDomain = rtrim(explode('/', $shopDomain)[0], '/');
        
        if ($shop === $shopDomain) {
            return $adminToken;
        }
    }
    
    return null;
}

/**
 * Verifica si una tienda está autenticada
 */
function isShopAuthenticated($shop) {
    return getShopToken($shop) !== null;
}

/**
 * Elimina una tienda del store
 */
function removeShop($shop) {
    $shops = readShops();
    if (isset($shops[$shop])) {
        unset($shops[$shop]);
        return writeShops($shops);
    }
    return false;
}

/**
 * Obtiene todas las tiendas autenticadas
 * @return array Array con los dominios de las tiendas
 */
function getAllShops() {
    $shops = readShops();
    return array_keys($shops);
}
