# Shopify Orders API

Backend Node.js para conectar con Shopify Admin API.

## Requisitos

- Node.js 18+

## Instalación

```bash
npm install
```

## Configuración

Copia `.env.example` a `.env` y configura las variables:

```bash
cp .env.example .env
```

### Variables de entorno

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `PORT` | Puerto del servidor | `3000` |
| `BASE_URL` | URL base de la API (para logs y referencias) | `https://shopify-orders-api.onrender.com` |
| `SHOP_DOMAIN` | Dominio de tu tienda Shopify | `mi-tienda.myshopify.com` |
| `SHOP_ADMIN_TOKEN` | Token de Admin API de Shopify | `shpat_xxxxx` |
| `API_VERSION` | Versión de la API de Shopify | `2025-01` |
| `API_BEARER_TOKEN` | Token para autenticar requests a esta API | `mi_clave_secreta` |

## Ejecución

```bash
npm start
```

## Endpoints

### Health Check
```
GET /health
```
Responde `200 OK`

### Orders (requiere autenticación)
```
GET /v1/orders
Headers: Authorization: Bearer <API_BEARER_TOKEN>
```

## Autenticación

Todos los endpoints bajo `/v1` requieren el header:
```
Authorization: Bearer <API_BEARER_TOKEN>
```

## Deploy en Render

1. Conecta tu repositorio a Render
2. Configura las variables de entorno en Render Dashboard
3. Build Command: `npm install`
4. Start Command: `npm start`
