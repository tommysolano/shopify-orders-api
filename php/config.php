<?php
/**
 * Configuración global de la aplicación
 * Carga variables desde .env y define constantes
 */

// Cargar variables de entorno desde .env
function loadEnv($path) {
    if (!file_exists($path)) {
        return;
    }
    
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        // Ignorar comentarios
        $line = trim($line);
        if (empty($line) || $line[0] === '#') {
            continue;
        }
        
        // Separar key=value
        $parts = explode('=', $line, 2);
        if (count($parts) !== 2) {
            continue;
        }
        
        $key = trim($parts[0]);
        $value = trim($parts[1]);
        
        // Remover comillas si existen
        if (preg_match('/^"(.*)"$/', $value, $m)) {
            $value = $m[1];
        } elseif (preg_match("/^'(.*)'$/", $value, $m)) {
            $value = $m[1];
        }
        
        if (!array_key_exists($key, $_ENV)) {
            $_ENV[$key] = $value;
            putenv("$key=$value");
        }
    }
}

// Cargar .env desde el directorio raíz del proyecto
loadEnv(__DIR__ . '/../.env');

/**
 * Obtiene una variable de entorno con valor por defecto
 */
function env($key, $default = null) {
    $value = getenv($key);
    if ($value === false) {
        return $default;
    }
    return $value;
}

/**
 * Envía una respuesta JSON con el código HTTP apropiado
 */
function jsonResponse($statusCode, $data) {
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

/**
 * Envía una respuesta HTML
 */
function htmlResponse($statusCode, $html) {
    http_response_code($statusCode);
    header('Content-Type: text/html; charset=UTF-8');
    echo $html;
    exit;
}

/**
 * Valida las variables de entorno requeridas para OAuth
 * Retorna un array con las variables faltantes
 */
function validateEnvVars() {
    $required = [
        'SHOPIFY_API_KEY',
        'SHOPIFY_API_SECRET',
        'SCOPES',
        'HOST',
        'API_BEARER_TOKEN',
    ];
    
    $missing = [];
    foreach ($required as $varName) {
        if (!env($varName)) {
            $missing[] = $varName;
        }
    }
    
    return $missing;
}
