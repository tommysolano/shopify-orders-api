# Shopify Orders API

Backend Node.js con OAuth para conectar con múltiples tiendas Shopify.

## Requisitos

- Node.js 18+

## Instalación

```bash
npm install
```

## Configuración

Crea un archivo `.env` con las siguientes variables:

### Variables de entorno

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `PORT` | Puerto del servidor | `3000` |
| `HOST` | URL pública del servidor | `https://shopify-orders-api.onrender.com` |
| `SHOPIFY_API_KEY` | Client ID de tu app Shopify | `abc123...` |
| `SHOPIFY_API_SECRET` | Client Secret de tu app Shopify | `shpss_xxxxx` |
| `SCOPES` | Permisos OAuth de la app | `read_orders,read_customers,read_products` |
| `API_VERSION` | Versión de la API de Shopify | `2024-01` |
| `API_BEARER_TOKEN` | Token para proteger tus endpoints | `mi_clave_secreta` |

## Ejecución

```bash
npm start
```

## Endpoints

### Health Check
```
GET /health
```
Responde `200 OK` con timestamp.

---

### OAuth - Iniciar autenticación
```
GET /auth?shop=tienda.myshopify.com
```
Redirige al flujo OAuth de Shopify. Al completarse, el token se guarda automáticamente.

---

### OAuth - Callback
```
GET /auth/callback
```
Callback interno de Shopify. No llamar directamente.

---

### Orders - Listar órdenes (requiere autenticación)
```
GET /v1/orders?shop=tienda.myshopify.com
Headers: Authorization: Bearer <API_BEARER_TOKEN>
```

**Query params opcionales:**
- `limit` - Número de órdenes (default: 50, max: 250)
- `status` - Estado de las órdenes (default: any)

**Respuesta:**
```json
{
  "ok": true,
  "shop": "tienda.myshopify.com",
  "count": 10,
  "orders": [...]
}
```

---

### Orders - Obtener orden específica
```
GET /v1/orders/:orderId?shop=tienda.myshopify.com
Headers: Authorization: Bearer <API_BEARER_TOKEN>
```

## Flujo de autenticación

1. El comerciante visita: `https://tu-app.com/auth?shop=su-tienda.myshopify.com`
2. Se redirige a Shopify para autorizar
3. Shopify redirige a `/auth/callback` con el código
4. El backend intercambia el código por un `access_token`
5. El token se guarda en `shops.json`
6. Ahora puedes consultar `/v1/orders?shop=su-tienda.myshopify.com`

## Autenticación de endpoints

Todos los endpoints bajo `/v1` requieren el header:
```
Authorization: Bearer <API_BEARER_TOKEN>
```

Los endpoints `/auth` y `/health` son públicos.

## Configuración en Shopify Partners

1. Ve a [partners.shopify.com](https://partners.shopify.com)
2. Apps → Tu app → Configuration
3. Configura:
   - **App URL:** `https://shopify-orders-api.onrender.com`
   - **Allowed redirection URL(s):** `https://shopify-orders-api.onrender.com/auth/callback`
4. Copia el **Client ID** y **Client Secret** a tu `.env`

## Deploy en Render

1. Conecta tu repositorio a Render
2. Configura las variables de entorno en Render Dashboard
3. Build Command: `npm install`
4. Start Command: `npm start`

## Estructura del proyecto

```
src/
├── server.js           # Servidor Express principal
├── shopify.js          # Cliente dinámico para Shopify API
├── middleware/
│   └── auth.js         # Middleware Bearer Token
├── routes/
│   ├── auth.js         # Rutas OAuth (/auth, /auth/callback)
│   └── orders.js       # Rutas de órdenes (/v1/orders)
└── store/
    └── shops.js        # Store de tokens por tienda
shops.json              # Tokens guardados (auto-generado)
```
