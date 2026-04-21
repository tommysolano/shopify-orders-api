<?php
/**
 * Definición de packs/kits de productos
 * Cada pack mapea un producto de Shopify a sus componentes individuales
 * para facturación y control de inventario.
 *
 * Clave: nombre del producto tal como aparece en Shopify (case-insensitive)
 */

function getPacksDefinitions() {
    return [
        'respira libremente' => [
            'nombre' => 'Respira Libremente',
            'descuento' => 20,
            'pvpSugeridoWeb' => '25.58',
            'productos' => [
                [
                    'sku' => '7271',
                    'titulo' => 'Eucamiel sobres x18',
                    'pvpSinIva' => '12.17',
                    'iva' => '1.82',
                    'precioUnitario' => '13.99',
                    'descuento' => 20,
                    'precioConDescuento' => '11.19',
                ],
                [
                    'sku' => '86',
                    'titulo' => 'Vapogarden 50ml',
                    'pvpSinIva' => null,
                    'iva' => null,
                    'precioUnitario' => '8.99',
                    'descuento' => 20,
                    'precioConDescuento' => '7.19',
                ],
                [
                    'sku' => '8398',
                    'titulo' => 'Eucamiel Tabletas naranja',
                    'pvpSinIva' => '7.82',
                    'iva' => '1.17',
                    'precioUnitario' => '8.99',
                    'descuento' => 20,
                    'precioConDescuento' => '7.19',
                ],
            ],
            'totalSinDescuento' => '31.97',
            'totalConDescuento' => '25.58',
        ],

        'inmune a todo' => [
            'nombre' => 'Inmune a Todo',
            'descuento' => 20,
            'pvpSugeridoWeb' => '35.18',
            'productos' => [
                [
                    'sku' => '38',
                    'titulo' => 'Inmunolive',
                    'pvpSinIva' => null,
                    'iva' => null,
                    'precioUnitario' => '14.99',
                    'descuento' => 20,
                    'precioConDescuento' => '11.99',
                ],
                [
                    'sku' => '6626',
                    'titulo' => 'Triple C total',
                    'pvpSinIva' => '14.77',
                    'iva' => '2.22',
                    'precioUnitario' => '16.99',
                    'descuento' => 20,
                    'precioConDescuento' => '13.59',
                ],
                [
                    'sku' => '7882',
                    'titulo' => 'Vitamina D3',
                    'pvpSinIva' => '10.43',
                    'iva' => '1.56',
                    'precioUnitario' => '11.99',
                    'descuento' => 20,
                    'precioConDescuento' => '9.59',
                ],
            ],
            'totalSinDescuento' => '43.97',
            'totalConDescuento' => '35.18',
        ],

        'duerme y desconecta' => [
            'nombre' => 'Duerme y desconecta',
            'descuento' => 20,
            'pvpSugeridoWeb' => '37.58',
            'productos' => [
                [
                    'sku' => '8257',
                    'titulo' => 'Spray de Magnesio',
                    'pvpSinIva' => '11.30',
                    'iva' => '1.69',
                    'precioUnitario' => '12.99',
                    'descuento' => 20,
                    'precioConDescuento' => '10.39',
                ],
                [
                    'sku' => '8770',
                    'titulo' => 'Cbd gotas',
                    'pvpSinIva' => '14.77',
                    'iva' => '2.22',
                    'precioUnitario' => '16.99',
                    'descuento' => 20,
                    'precioConDescuento' => '13.59',
                ],
                [
                    'sku' => '8472',
                    'titulo' => 'Bisglicinato de magnesio',
                    'pvpSinIva' => '14.77',
                    'iva' => '2.22',
                    'precioUnitario' => '16.99',
                    'descuento' => 20,
                    'precioConDescuento' => '13.59',
                ],
            ],
            'totalSinDescuento' => '46.97',
            'totalConDescuento' => '37.58',
        ],

        'activa tu energia' => [
            'nombre' => 'Activa tu energía',
            'descuento' => 20,
            'pvpSugeridoWeb' => '47.18',
            'productos' => [
                [
                    'sku' => '8051',
                    'titulo' => 'Magnesiolive Total 5 sales',
                    'pvpSinIva' => '16.51',
                    'iva' => '2.48',
                    'precioUnitario' => '18.99',
                    'descuento' => 20,
                    'precioConDescuento' => '15.19',
                ],
                [
                    'sku' => '9287',
                    'titulo' => 'Vitatoro shot',
                    'pvpSinIva' => '16.51',
                    'iva' => '2.48',
                    'precioUnitario' => '18.99',
                    'descuento' => 20,
                    'precioConDescuento' => '15.19',
                ],
                [
                    'sku' => '8762',
                    'titulo' => 'Oxivida',
                    'pvpSinIva' => '18.25',
                    'iva' => '2.74',
                    'precioUnitario' => '20.99',
                    'descuento' => 20,
                    'precioConDescuento' => '16.79',
                ],
            ],
            'totalSinDescuento' => '58.97',
            'totalConDescuento' => '47.18',
        ],

        'vive radiante' => [
            'nombre' => 'Vive Radiante',
            'descuento' => 20,
            'pvpSugeridoWeb' => '55.98',
            'productos' => [
                [
                    'sku' => '9036',
                    'titulo' => 'Pro nad',
                    'pvpSinIva' => '27.82',
                    'iva' => '4.17',
                    'precioUnitario' => '31.99',
                    'descuento' => 20,
                    'precioConDescuento' => '25.59',
                ],
                [
                    'sku' => '8762',
                    'titulo' => 'Oxivida',
                    'pvpSinIva' => '18.25',
                    'iva' => '2.74',
                    'precioUnitario' => '20.99',
                    'descuento' => 20,
                    'precioConDescuento' => '16.79',
                ],
                [
                    'sku' => '8763',
                    'titulo' => 'Ashwagandha',
                    'pvpSinIva' => '14.77',
                    'iva' => '2.22',
                    'precioUnitario' => '16.99',
                    'descuento' => 20,
                    'precioConDescuento' => '13.59',
                ],
            ],
            'totalSinDescuento' => '69.97',
            'totalConDescuento' => '55.98',
        ],
    ];
}

/**
 * Busca si un producto es un pack por su título
 * @param string $titulo Título del producto del line_item
 * @return array|null Definición del pack o null si no es un pack
 */
function findPackByTitle($titulo) {
    if (empty($titulo)) {
        return null;
    }

    $packs = getPacksDefinitions();
    $key = mb_strtolower(trim($titulo), 'UTF-8');

    // Colapsar múltiples espacios en uno solo
    $key = preg_replace('/\s+/', ' ', $key);

    // Normalizar: quitar tildes para comparación flexible
    $normalized = strtr($key, [
        'á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u',
        'ñ' => 'n',
    ]);

    // Buscar coincidencia exacta primero
    if (isset($packs[$key])) {
        return $packs[$key];
    }

    // Buscar con normalización de tildes
    if (isset($packs[$normalized])) {
        return $packs[$normalized];
    }

    // Buscar coincidencia parcial (por si el título en Shopify tiene variaciones)
    foreach ($packs as $packKey => $pack) {
        if (strpos($key, $packKey) !== false || strpos($normalized, $packKey) !== false) {
            return $pack;
        }
    }

    return null;
}
