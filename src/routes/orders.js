const express = require('express');
const axios = require('axios');
const { getShopToken, isShopAuthenticated } = require('../store/shops');
const { validateAndNormalizeShop } = require('../utils/shopValidator');

const router = express.Router();

/**
 * Traduce el estado financiero al español
 */
function traducirEstadoFinanciero(status) {
  const traducciones = {
    pending: 'pendiente',
    authorized: 'autorizado',
    partially_paid: 'parcialmente_pagado',
    paid: 'pagado',
    partially_refunded: 'parcialmente_reembolsado',
    refunded: 'reembolsado',
    voided: 'anulado',
  };
  return traducciones[status] || status;
}

/**
 * Traduce el estado de cumplimiento al español
 */
function traducirEstadoCumplimiento(status) {
  const traducciones = {
    fulfilled: 'completado',
    partial: 'parcial',
    unfulfilled: 'pendiente',
    null: 'pendiente',
  };
  return traducciones[status] || status || 'pendiente';
}

/**
 * Extrae la cédula/RUC de las notas del pedido
 */
function extraerCedulaRuc(note) {
  if (!note) return null;
  
  // Buscar patrones comunes: "Cédula/RUC: 1234567890", "RUC: 1234", "Cédula: 1234"
  const patterns = [
    /c[ée]dula\s*\/?\s*ruc\s*:?\s*(\d+)/i,
    /ruc\s*:?\s*(\d+)/i,
    /c[ée]dula\s*:?\s*(\d+)/i,
    /ci\s*:?\s*(\d+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = note.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Formatea una orden de Shopify al formato en español
 * @param {object} order - Orden de Shopify
 * @returns {object} Orden formateada
 */
function formatOrder(order) {
  // Calcular totales de impuestos
  const impuestos = (order.tax_lines || []).map((tax) => ({
    titulo: tax.title,
    tasa: tax.rate ? `${(tax.rate * 100).toFixed(2)}%` : null,
    precio: tax.price,
  }));
  
  const totalImpuestos = order.total_tax || '0.00';

  // Calcular descuentos
  const descuentos = (order.discount_codes || []).map((discount) => ({
    codigo: discount.code,
    tipo: discount.type === 'percentage' ? 'porcentaje' : 'monto_fijo',
    valor: discount.amount,
  }));

  const aplicacionesDescuento = (order.discount_applications || []).map((app) => ({
    tipo: app.type,
    titulo: app.title || app.description || app.code,
    valor: app.value,
    tipoValor: app.value_type === 'percentage' ? 'porcentaje' : 'monto_fijo',
  }));

  const totalDescuentos = order.total_discounts || '0.00';

  // Extraer cédula/RUC de las notas
  const cedulaRuc = extraerCedulaRuc(order.note);

  // Información de envío
  const envios = (order.shipping_lines || []).map((shipping) => ({
    id: shipping.id,
    titulo: shipping.title,
    codigo: shipping.code,
    precio: shipping.price,
    precioDescontado: shipping.discounted_price,
    origen: shipping.source,
    impuestos: (shipping.tax_lines || []).map((tax) => ({
      titulo: tax.title,
      tasa: tax.rate ? `${(tax.rate * 100).toFixed(2)}%` : null,
      precio: tax.price,
    })),
  }));

  const totalEnvio = (order.shipping_lines || []).reduce(
    (sum, line) => sum + parseFloat(line.price || 0),
    0
  ).toFixed(2);

  return {
    id: order.id,
    numeroPedido: order.name,
    fechaCreacion: order.created_at,
    fechaActualizacion: order.updated_at,
    estadoFinanciero: traducirEstadoFinanciero(order.financial_status),
    estadoCumplimiento: traducirEstadoCumplimiento(order.fulfillment_status),
    
    // Totales
    subtotal: order.subtotal_price,
    totalEnvio: totalEnvio,
    totalImpuestos: totalImpuestos,
    totalDescuentos: totalDescuentos,
    total: order.total_price,
    moneda: order.currency,
    
    // Envío detallado
    envios: envios,
    
    // Impuestos detallados
    impuestos: impuestos,
    impuestosIncluidos: order.taxes_included || false,
    
    // Descuentos detallados
    descuentos: descuentos,
    aplicacionesDescuento: aplicacionesDescuento,
    
    // Notas y cédula/RUC
    notas: order.note || null,
    cedulaRuc: cedulaRuc,
    atributosNotas: (order.note_attributes || []).map((attr) => ({
      nombre: attr.name,
      valor: attr.value,
    })),
    
    // Cliente
    cliente: order.customer
      ? {
          id: order.customer.id,
          nombre: order.customer.first_name,
          apellido: order.customer.last_name,
          nombreCompleto: `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim(),
          email: order.customer.email,
          telefono: order.customer.phone,
        }
      : null,
    
    // Dirección de facturación
    direccionFacturacion: order.billing_address
      ? {
          nombre: order.billing_address.name,
          empresa: order.billing_address.company,
          direccion1: order.billing_address.address1,
          direccion2: order.billing_address.address2,
          ciudad: order.billing_address.city,
          provincia: order.billing_address.province,
          codigoPostal: order.billing_address.zip,
          pais: order.billing_address.country,
          telefono: order.billing_address.phone,
        }
      : null,
    
    // Dirección de envío
    direccionEnvio: order.shipping_address
      ? {
          nombre: order.shipping_address.name,
          empresa: order.shipping_address.company,
          direccion1: order.shipping_address.address1,
          direccion2: order.shipping_address.address2,
          ciudad: order.shipping_address.city,
          provincia: order.shipping_address.province,
          codigoPostal: order.shipping_address.zip,
          pais: order.shipping_address.country,
          telefono: order.shipping_address.phone,
        }
      : null,
    
    // Productos
    productos: (order.line_items || []).map((item) => ({
      id: item.id,
      sku: item.sku,
      titulo: item.title,
      variante: item.variant_title,
      cantidad: item.quantity,
      precioUnitario: item.price,
      precioTotal: (parseFloat(item.price) * item.quantity).toFixed(2),
      descuento: item.total_discount || '0.00',
      impuesto: item.tax_lines ? item.tax_lines.reduce((sum, t) => sum + parseFloat(t.price || 0), 0).toFixed(2) : '0.00',
      varianteId: item.variant_id,
      productoId: item.product_id,
      requiereEnvio: item.requires_shipping,
    })),
  };
}

/**
 * GET /v1/orders
 * Obtiene las órdenes de una tienda
 * Query params: shop (requerido), limit (opcional, default 10)
 */
router.get('/', async (req, res) => {
  const { shop, limit = 10, status = 'any' } = req.query;

  // Validar que se proporcionó el shop
  if (!shop) {
    const exampleShop = process.env.SHOP ? require('../utils/shopValidator').normalizeShopDomain(process.env.SHOP) : 'tienda.myshopify.com';
    return res.status(400).json({
      error: 'Missing required parameter: shop',
      example: `/v1/orders?shop=${exampleShop}`,
    });
  }

  // Validar y normalizar shop
  const validation = validateAndNormalizeShop(shop);
  if (!validation.valid) {
    return res.status(400).json({
      error: 'Invalid shop domain',
      message: validation.error,
      received: validation.original,
      normalized: validation.normalized,
    });
  }

  const normalizedShop = validation.normalized;
  const host = process.env.HOST || '';

  // Verificar si la tienda está autenticada
  if (!isShopAuthenticated(normalizedShop)) {
    return res.status(401).json({
      error: 'Shop not installed',
      message: `The shop ${normalizedShop} has not completed OAuth. Please install the app first.`,
      auth_url: `${host}/auth?shop=${normalizedShop}`,
    });
  }

  // Obtener el access_token
  const accessToken = getShopToken(normalizedShop);

  if (!accessToken) {
    return res.status(401).json({
      error: 'Token not found',
      message: 'Access token not found for this shop. Please re-authenticate.',
      auth_url: `${host}/auth?shop=${normalizedShop}`,
    });
  }

  const apiVersion = process.env.API_VERSION || '2024-01';

  try {
    // Llamar a la API de Shopify
    const response = await axios.get(
      `https://${normalizedShop}/admin/api/${apiVersion}/orders.json`,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        params: {
          limit: Math.min(Math.max(parseInt(limit) || 10, 1), 250),
          status: status,
        },
      }
    );

    const pedidos = (response.data.orders || []).map(formatOrder);

    return res.json({
      exito: true,
      tienda: normalizedShop,
      cantidad: pedidos.length,
      pedidos,
    });
  } catch (error) {
    console.error(`[Orders] Error fetching orders for ${normalizedShop}:`, error.message);

    // Manejar errores de Shopify
    if (error.response) {
      const statusCode = error.response.status;

      // Token inválido o expirado
      if (statusCode === 401) {
        return res.status(401).json({
          error: 'Invalid or expired token',
          message: 'The access token is no longer valid. Please re-authenticate.',
          auth_url: `${host}/auth?shop=${normalizedShop}`,
        });
      }

      // Forbidden - permisos insuficientes
      if (statusCode === 403) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: 'The app does not have permission to read orders. Check your scopes.',
        });
      }

      return res.status(statusCode).json({
        error: 'Shopify API error',
        status: statusCode,
        details: error.response.data,
      });
    }

    return res.status(500).json({
      error: 'Failed to fetch orders',
      message: error.message,
    });
  }
});

/**
 * GET /v1/orders/:orderId
 * Obtiene una orden específica
 * Query params: shop (requerido)
 */
router.get('/:orderId', async (req, res) => {
  const { shop } = req.query;
  const { orderId } = req.params;

  // Validar que se proporcionó el shop
  if (!shop) {
    return res.status(400).json({
      error: 'Missing required parameter: shop',
    });
  }

  // Validar y normalizar shop
  const validation = validateAndNormalizeShop(shop);
  if (!validation.valid) {
    return res.status(400).json({
      error: 'Invalid shop domain',
      message: validation.error,
      received: validation.original,
    });
  }

  const normalizedShop = validation.normalized;
  const host = process.env.HOST || '';

  // Verificar autenticación
  if (!isShopAuthenticated(normalizedShop)) {
    return res.status(401).json({
      error: 'Shop not installed',
      message: `The shop ${normalizedShop} has not completed OAuth.`,
      auth_url: `${host}/auth?shop=${normalizedShop}`,
    });
  }

  const accessToken = getShopToken(normalizedShop);
  const apiVersion = process.env.API_VERSION || '2024-01';

  try {
    const response = await axios.get(
      `https://${normalizedShop}/admin/api/${apiVersion}/orders/${orderId}.json`,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      }
    );

    return res.json({
      exito: true,
      tienda: normalizedShop,
      pedido: formatOrder(response.data.order),
    });
  } catch (error) {
    console.error(`[Orders] Error fetching order ${orderId}:`, error.message);

    if (error.response) {
      if (error.response.status === 404) {
        return res.status(404).json({
          error: 'Order not found',
          orderId: orderId,
        });
      }

      return res.status(error.response.status).json({
        error: 'Shopify API error',
        details: error.response.data,
      });
    }

    return res.status(500).json({
      error: 'Failed to fetch order',
      message: error.message,
    });
  }
});

module.exports = router;
