<?php
/**
 * Cliente para Shopify Admin API
 * Soporta múltiples tiendas con diferentes tokens
 * Usa cURL en lugar de axios
 */

require_once __DIR__ . '/store/shops.php';

/**
 * Ejecuta una petición HTTP usando cURL
 * @return array ['status' => int, 'body' => mixed, 'error' => string|null]
 */
function httpRequest($method, $url, $headers = [], $data = null, $params = []) {
    // Agregar query params a la URL
    if (!empty($params)) {
        $url .= '?' . http_build_query($params);
    }
    
    $ch = curl_init();
    
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    
    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        if ($data !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, is_string($data) ? $data : json_encode($data));
        }
    } elseif ($method === 'PUT') {
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
        if ($data !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, is_string($data) ? $data : json_encode($data));
        }
    } elseif ($method === 'DELETE') {
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'DELETE');
    }
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    
    if ($error) {
        return [
            'status' => 0,
            'body' => null,
            'error' => "Connection error: $error",
        ];
    }
    
    $body = json_decode($response, true);
    
    return [
        'status' => $httpCode,
        'body' => $body !== null ? $body : $response,
        'error' => null,
    ];
}

/**
 * Obtiene los headers estándar para Shopify API
 */
function getShopifyHeaders($accessToken) {
    return [
        'X-Shopify-Access-Token: ' . $accessToken,
        'Content-Type: application/json',
        'Accept: application/json',
    ];
}

/**
 * Ejecuta una query GraphQL contra Shopify Admin API
 */
function shopifyGraphQL($shop, $query, $variables = []) {
    $accessToken = getShopToken($shop);
    
    if (!$accessToken) {
        throw new Exception("No access token found for shop: $shop");
    }

    $apiVersion = env('API_VERSION', '2025-01');
    $url = "https://$shop/admin/api/$apiVersion/graphql.json";
    
    $result = httpRequest('POST', $url, getShopifyHeaders($accessToken), json_encode([
        'query' => $query,
        'variables' => $variables,
    ]));
    
    if ($result['error']) {
        throw new Exception($result['error']);
    }
    
    if ($result['status'] >= 400) {
        throw new Exception("Shopify API Error: {$result['status']}");
    }
    
    if (isset($result['body']['errors']) && !empty($result['body']['errors'])) {
        throw new Exception('Shopify GraphQL Error: ' . json_encode($result['body']['errors']));
    }
    
    return $result['body']['data'];
}

/**
 * Ejecuta una petición REST contra Shopify Admin API
 */
function shopifyREST($shop, $method, $endpoint, $data = null, $params = []) {
    $accessToken = getShopToken($shop);
    
    if (!$accessToken) {
        throw new Exception("No access token found for shop: $shop");
    }

    $apiVersion = env('API_VERSION', '2025-01');
    $url = "https://$shop/admin/api/$apiVersion$endpoint";
    
    $result = httpRequest($method, $url, getShopifyHeaders($accessToken), $data, $params);
    
    if ($result['error']) {
        throw new Exception($result['error']);
    }
    
    if ($result['status'] >= 400) {
        $details = is_array($result['body']) ? json_encode($result['body']) : $result['body'];
        $ex = new Exception("Shopify API Error: {$result['status']}");
        $ex->httpStatus = $result['status'];
        $ex->details = $result['body'];
        throw $ex;
    }
    
    return $result['body'];
}

/**
 * Verifica si una tienda tiene token configurado
 */
function isShopConfigured($shop) {
    return getShopToken($shop) !== null;
}
