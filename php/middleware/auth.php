<?php
/**
 * Middleware de autenticación Bearer Token
 * Valida que el header Authorization contenga el token correcto
 */

require_once __DIR__ . '/../config.php';

/**
 * Verifica la autenticación Bearer Token
 * Si falla, envía respuesta JSON de error y retorna false
 * Si pasa, retorna true
 */
function authMiddleware() {
    $expectedToken = env('API_BEARER_TOKEN');

    // Si no hay token configurado, rechazar todas las requests
    if (!$expectedToken) {
        error_log('[Auth] API_BEARER_TOKEN no está configurado');
        jsonResponse(500, [
            'error' => 'Server configuration error',
            'message' => 'API_BEARER_TOKEN is not configured',
        ]);
        return false;
    }

    // Obtener el header Authorization
    $authHeader = getAuthorizationHeader();

    // Verificar que existe el header Authorization
    if (!$authHeader) {
        jsonResponse(401, [
            'error' => 'Unauthorized',
            'message' => 'Missing Authorization header',
        ]);
        return false;
    }

    // Verificar formato del header (Bearer token)
    if (strpos($authHeader, 'Bearer ') !== 0) {
        jsonResponse(401, [
            'error' => 'Unauthorized',
            'message' => 'Invalid Authorization header format. Expected: Bearer <token>',
        ]);
        return false;
    }

    // Extraer y validar el token
    $token = substr($authHeader, 7); // Quitar "Bearer "

    if (!hash_equals($expectedToken, $token)) {
        jsonResponse(401, [
            'error' => 'Unauthorized',
            'message' => 'Invalid token',
        ]);
        return false;
    }

    return true;
}

/**
 * Obtiene el header Authorization de la petición
 * Compatible con diferentes configuraciones de servidor
 */
function getAuthorizationHeader() {
    // Método estándar
    if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        return $_SERVER['HTTP_AUTHORIZATION'];
    }
    
    // Apache con mod_rewrite
    if (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        return $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    }
    
    // Alternativa para Apache
    if (function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        foreach ($headers as $key => $value) {
            if (strtolower($key) === 'authorization') {
                return $value;
            }
        }
    }
    
    return null;
}
