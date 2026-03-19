<?php
/**
 * Rutas de órdenes de Shopify
 * GET /v1/orders - Lista órdenes de una tienda
 * GET /v1/orders/:orderId - Obtiene una orden específica
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../store/shops.php';
require_once __DIR__ . '/../utils/shopValidator.php';

/**
 * Traduce el estado financiero al español
 */
function traducirEstadoFinanciero($status) {
    $traducciones = [
        'pending' => 'pendiente',
        'authorized' => 'autorizado',
        'partially_paid' => 'parcialmente_pagado',
        'paid' => 'pagado',
        'partially_refunded' => 'parcialmente_reembolsado',
        'refunded' => 'reembolsado',
        'voided' => 'anulado',
    ];
    return isset($traducciones[$status]) ? $traducciones[$status] : $status;
}

/**
 * Traduce el estado de cumplimiento al español
 */
function traducirEstadoCumplimiento($status) {
    $traducciones = [
        'fulfilled' => 'completado',
        'partial' => 'parcial',
        'unfulfilled' => 'pendiente',
        'null' => 'pendiente',
    ];
    return isset($traducciones[$status]) ? $traducciones[$status] : ($status ?: 'pendiente');
}

/**
 * Extrae la cédula/RUC de las notas del pedido
 */
function extraerCedulaRuc($note) {
    if (!$note) return null;
    
    // Buscar patrones comunes
    $patterns = [
        '/c[ée]dula\s*\/?\s*ruc\s*:?\s*(\d+)/i',
        '/ruc\s*:?\s*(\d+)/i',
        '/c[ée]dula\s*:?\s*(\d+)/i',
        '/ci\s*:?\s*(\d+)/i',
    ];
    
    foreach ($patterns as $pattern) {
        if (preg_match($pattern, $note, $match)) {
            return $match[1];
        }
    }
    
    return null;
}

/**
 * Formatea una orden de Shopify al formato en español
 */
function formatOrder($order) {
    // Calcular totales de impuestos
    $taxLines = isset($order['tax_lines']) ? $order['tax_lines'] : [];
    $impuestos = array_map(function($tax) {
        return [
            'titulo' => $tax['title'],
            'tasa' => isset($tax['rate']) ? number_format($tax['rate'] * 100, 2) . '%' : null,
            'precio' => $tax['price'],
        ];
    }, $taxLines);
    
    $totalImpuestos = isset($order['total_tax']) ? $order['total_tax'] : '0.00';

    // Calcular descuentos
    $discountCodes = isset($order['discount_codes']) ? $order['discount_codes'] : [];
    $descuentos = array_map(function($discount) {
        return [
            'codigo' => $discount['code'],
            'tipo' => $discount['type'] === 'percentage' ? 'porcentaje' : 'monto_fijo',
            'valor' => $discount['amount'],
        ];
    }, $discountCodes);

    $discountApplications = isset($order['discount_applications']) ? $order['discount_applications'] : [];
    $aplicacionesDescuento = array_map(function($app) {
        $titulo = '';
        if (isset($app['title'])) $titulo = $app['title'];
        elseif (isset($app['description'])) $titulo = $app['description'];
        elseif (isset($app['code'])) $titulo = $app['code'];
        
        return [
            'tipo' => $app['type'],
            'titulo' => $titulo,
            'valor' => $app['value'],
            'tipoValor' => (isset($app['value_type']) && $app['value_type'] === 'percentage') ? 'porcentaje' : 'monto_fijo',
        ];
    }, $discountApplications);

    $totalDescuentos = isset($order['total_discounts']) ? $order['total_discounts'] : '0.00';

    // Extraer cédula/RUC de las notas
    $note = isset($order['note']) ? $order['note'] : null;
    $cedulaRuc = extraerCedulaRuc($note);

    // Información de envío
    $shippingLines = isset($order['shipping_lines']) ? $order['shipping_lines'] : [];
    $envios = array_map(function($shipping) {
        $shippingTaxLines = isset($shipping['tax_lines']) ? $shipping['tax_lines'] : [];
        return [
            'id' => $shipping['id'],
            'titulo' => $shipping['title'],
            'codigo' => isset($shipping['code']) ? $shipping['code'] : null,
            'precio' => $shipping['price'],
            'precioDescontado' => isset($shipping['discounted_price']) ? $shipping['discounted_price'] : null,
            'origen' => isset($shipping['source']) ? $shipping['source'] : null,
            'impuestos' => array_map(function($tax) {
                return [
                    'titulo' => $tax['title'],
                    'tasa' => isset($tax['rate']) ? number_format($tax['rate'] * 100, 2) . '%' : null,
                    'precio' => $tax['price'],
                ];
            }, $shippingTaxLines),
        ];
    }, $shippingLines);

    $totalEnvio = number_format(array_reduce($shippingLines, function($sum, $line) {
        return $sum + floatval(isset($line['price']) ? $line['price'] : 0);
    }, 0), 2, '.', '');

    // Productos
    $lineItems = isset($order['line_items']) ? $order['line_items'] : [];
    $productos = array_map(function($item) {
        $itemTaxLines = isset($item['tax_lines']) ? $item['tax_lines'] : [];
        $impuesto = number_format(array_reduce($itemTaxLines, function($sum, $t) {
            return $sum + floatval(isset($t['price']) ? $t['price'] : 0);
        }, 0), 2, '.', '');
        
        return [
            'id' => $item['id'],
            'sku' => isset($item['sku']) ? $item['sku'] : null,
            'titulo' => $item['title'],
            'variante' => isset($item['variant_title']) ? $item['variant_title'] : null,
            'cantidad' => $item['quantity'],
            'precioUnitario' => $item['price'],
            'precioTotal' => number_format(floatval($item['price']) * $item['quantity'], 2, '.', ''),
            'descuento' => isset($item['total_discount']) ? $item['total_discount'] : '0.00',
            'impuesto' => $impuesto,
            'varianteId' => isset($item['variant_id']) ? $item['variant_id'] : null,
            'productoId' => isset($item['product_id']) ? $item['product_id'] : null,
            'requiereEnvio' => isset($item['requires_shipping']) ? $item['requires_shipping'] : false,
        ];
    }, $lineItems);

    // Agregar el envío como producto si existe
    if (floatval($totalEnvio) > 0) {
        $shippingTax = 0;
        foreach ($shippingLines as $line) {
            $lineTaxes = isset($line['tax_lines']) ? $line['tax_lines'] : [];
            foreach ($lineTaxes as $t) {
                $shippingTax += floatval(isset($t['price']) ? $t['price'] : 0);
            }
        }
        
        $productos[] = [
            'id' => null,
            'sku' => '4440',
            'titulo' => 'ENVÍO LOCAL 15%',
            'variante' => null,
            'cantidad' => 1,
            'precioUnitario' => $totalEnvio,
            'precioTotal' => $totalEnvio,
            'descuento' => '0.00',
            'impuesto' => number_format($shippingTax, 2, '.', ''),
            'varianteId' => null,
            'productoId' => null,
            'requiereEnvio' => false,
        ];
    }

    // Datos del cliente
    $cliente = null;
    if (isset($order['customer'])) {
        $c = $order['customer'];
        $firstName = isset($c['first_name']) ? $c['first_name'] : '';
        $lastName = isset($c['last_name']) ? $c['last_name'] : '';
        $cliente = [
            'id' => $c['id'],
            'nombre' => $firstName,
            'apellido' => $lastName,
            'nombreCompleto' => trim("$firstName $lastName"),
            'email' => isset($c['email']) ? $c['email'] : null,
            'telefono' => isset($c['phone']) ? $c['phone'] : null,
        ];
    }

    // Formatear dirección
    $formatAddress = function($addr) {
        if (!$addr) return null;
        return [
            'nombre' => isset($addr['name']) ? $addr['name'] : null,
            'empresa' => isset($addr['company']) ? $addr['company'] : null,
            'direccion1' => isset($addr['address1']) ? $addr['address1'] : null,
            'direccion2' => isset($addr['address2']) ? $addr['address2'] : null,
            'ciudad' => isset($addr['city']) ? $addr['city'] : null,
            'provincia' => isset($addr['province']) ? $addr['province'] : null,
            'codigoPostal' => isset($addr['zip']) ? $addr['zip'] : null,
            'pais' => isset($addr['country']) ? $addr['country'] : null,
            'telefono' => isset($addr['phone']) ? $addr['phone'] : null,
        ];
    };

    // Atributos de notas
    $noteAttributes = isset($order['note_attributes']) ? $order['note_attributes'] : [];
    $atributosNotas = array_map(function($attr) {
        return [
            'nombre' => $attr['name'],
            'valor' => $attr['value'],
        ];
    }, $noteAttributes);

    return [
        'id' => $order['id'],
        'numeroPedido' => $order['name'],
        'fechaCreacion' => $order['created_at'],
        'fechaActualizacion' => $order['updated_at'],
        'estadoFinanciero' => traducirEstadoFinanciero(isset($order['financial_status']) ? $order['financial_status'] : ''),
        'estadoCumplimiento' => traducirEstadoCumplimiento(isset($order['fulfillment_status']) ? $order['fulfillment_status'] : null),
        
        // Totales
        'subtotal' => isset($order['subtotal_price']) ? $order['subtotal_price'] : '0.00',
        'totalEnvio' => $totalEnvio,
        'totalImpuestos' => $totalImpuestos,
        'totalDescuentos' => $totalDescuentos,
        'total' => isset($order['total_price']) ? $order['total_price'] : '0.00',
        'moneda' => isset($order['currency']) ? $order['currency'] : null,
        
        // Envío detallado
        'envios' => $envios,
        
        // Impuestos detallados
        'impuestos' => $impuestos,
        'impuestosIncluidos' => isset($order['taxes_included']) ? $order['taxes_included'] : false,
        
        // Descuentos detallados
        'descuentos' => $descuentos,
        'aplicacionesDescuento' => $aplicacionesDescuento,
        
        // Notas y cédula/RUC
        'notas' => $note,
        'cedulaRuc' => $cedulaRuc,
        'atributosNotas' => $atributosNotas,
        
        // Cliente
        'cliente' => $cliente,
        
        // Direcciones
        'direccionFacturacion' => $formatAddress(isset($order['billing_address']) ? $order['billing_address'] : null),
        'direccionEnvio' => $formatAddress(isset($order['shipping_address']) ? $order['shipping_address'] : null),
        
        // Productos
        'productos' => $productos,
    ];
}

/**
 * Maneja GET /v1/orders
 * Obtiene las órdenes de una tienda
 */
function handleGetOrders() {
    $shop = isset($_GET['shop']) ? $_GET['shop'] : null;
    $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 10;
    $status = isset($_GET['status']) ? $_GET['status'] : 'any';

    // Validar que se proporcionó el shop
    if (!$shop) {
        $exampleShop = env('SHOP') ? normalizeShopDomain(env('SHOP')) : 'tienda.myshopify.com';
        jsonResponse(400, [
            'error' => 'Missing required parameter: shop',
            'example' => "/v1/orders?shop=$exampleShop",
        ]);
        return;
    }

    // Validar y normalizar shop
    $validation = validateAndNormalizeShop($shop);
    if (!$validation['valid']) {
        jsonResponse(400, [
            'error' => 'Invalid shop domain',
            'message' => $validation['error'],
            'received' => $validation['original'],
            'normalized' => $validation['normalized'],
        ]);
        return;
    }

    $normalizedShop = $validation['normalized'];
    $host = env('HOST', '');

    // Verificar si la tienda está autenticada
    if (!isShopAuthenticated($normalizedShop)) {
        jsonResponse(401, [
            'error' => 'Shop not installed',
            'message' => "The shop $normalizedShop has not completed OAuth. Please install the app first.",
            'auth_url' => "$host/auth?shop=$normalizedShop",
        ]);
        return;
    }

    // Obtener el access_token
    $accessToken = getShopToken($normalizedShop);

    if (!$accessToken) {
        jsonResponse(401, [
            'error' => 'Token not found',
            'message' => 'Access token not found for this shop. Please re-authenticate.',
            'auth_url' => "$host/auth?shop=$normalizedShop",
        ]);
        return;
    }

    $apiVersion = env('API_VERSION', '2025-01');

    try {
        // Limitar el valor de limit entre 1 y 250
        $limit = max(1, min($limit, 250));
        
        $params = http_build_query([
            'limit' => $limit,
            'status' => $status,
            'financial_status' => 'paid',
        ]);

        $url = "https://$normalizedShop/admin/api/$apiVersion/orders.json?$params";
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'X-Shopify-Access-Token: ' . $accessToken,
            'Content-Type: application/json',
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);

        if ($curlError) {
            throw new Exception("Connection error: $curlError");
        }

        if ($httpCode >= 400) {
            $body = json_decode($response, true);
            
            // Token inválido o expirado
            if ($httpCode === 401) {
                jsonResponse(401, [
                    'error' => 'Invalid or expired token',
                    'message' => 'The access token is no longer valid. Please re-authenticate.',
                    'auth_url' => "$host/auth?shop=$normalizedShop",
                ]);
                return;
            }

            // Forbidden - permisos insuficientes
            if ($httpCode === 403) {
                jsonResponse(403, [
                    'error' => 'Insufficient permissions',
                    'message' => 'The app does not have permission to read orders. Check your scopes.',
                ]);
                return;
            }

            jsonResponse($httpCode, [
                'error' => 'Shopify API error',
                'status' => $httpCode,
                'details' => $body,
            ]);
            return;
        }

        $data = json_decode($response, true);
        $orders = isset($data['orders']) ? $data['orders'] : [];
        $pedidos = array_map('formatOrder', $orders);

        jsonResponse(200, [
            'exito' => true,
            'tienda' => $normalizedShop,
            'cantidad' => count($pedidos),
            'pedidos' => $pedidos,
        ]);

    } catch (Exception $e) {
        error_log("[Orders] Error fetching orders for $normalizedShop: " . $e->getMessage());

        jsonResponse(500, [
            'error' => 'Failed to fetch orders',
            'message' => $e->getMessage(),
        ]);
    }
}

/**
 * Maneja GET /v1/orders/:orderId
 * Obtiene una orden específica
 */
function handleGetOrder($orderId) {
    $shop = isset($_GET['shop']) ? $_GET['shop'] : null;

    // Validar que se proporcionó el shop
    if (!$shop) {
        jsonResponse(400, [
            'error' => 'Missing required parameter: shop',
        ]);
        return;
    }

    // Validar y normalizar shop
    $validation = validateAndNormalizeShop($shop);
    if (!$validation['valid']) {
        jsonResponse(400, [
            'error' => 'Invalid shop domain',
            'message' => $validation['error'],
            'received' => $validation['original'],
        ]);
        return;
    }

    $normalizedShop = $validation['normalized'];
    $host = env('HOST', '');

    // Verificar autenticación
    if (!isShopAuthenticated($normalizedShop)) {
        jsonResponse(401, [
            'error' => 'Shop not installed',
            'message' => "The shop $normalizedShop has not completed OAuth.",
            'auth_url' => "$host/auth?shop=$normalizedShop",
        ]);
        return;
    }

    $accessToken = getShopToken($normalizedShop);
    $apiVersion = env('API_VERSION', '2025-01');

    // Validar que orderId sea numérico
    if (!ctype_digit((string)$orderId)) {
        jsonResponse(400, [
            'error' => 'Invalid order ID',
            'message' => 'Order ID must be numeric.',
        ]);
        return;
    }

    try {
        $url = "https://$normalizedShop/admin/api/$apiVersion/orders/$orderId.json";
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'X-Shopify-Access-Token: ' . $accessToken,
            'Content-Type: application/json',
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);

        if ($curlError) {
            throw new Exception("Connection error: $curlError");
        }

        if ($httpCode >= 400) {
            $body = json_decode($response, true);
            
            if ($httpCode === 404) {
                jsonResponse(404, [
                    'error' => 'Order not found',
                    'orderId' => $orderId,
                ]);
                return;
            }

            jsonResponse($httpCode, [
                'error' => 'Shopify API error',
                'details' => $body,
            ]);
            return;
        }

        $data = json_decode($response, true);

        jsonResponse(200, [
            'exito' => true,
            'tienda' => $normalizedShop,
            'pedido' => formatOrder($data['order']),
        ]);

    } catch (Exception $e) {
        error_log("[Orders] Error fetching order $orderId: " . $e->getMessage());

        jsonResponse(500, [
            'error' => 'Failed to fetch order',
            'message' => $e->getMessage(),
        ]);
    }
}
