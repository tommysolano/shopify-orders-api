FROM php:8.2-apache

# Habilitar mod_rewrite para .htaccess
RUN a2enmod rewrite

# Instalar extensión cURL (necesaria para Shopify API)
RUN apt-get update && apt-get install -y libcurl4-openssl-dev \
    && docker-php-ext-install curl \
    && rm -rf /var/lib/apt/lists/*

# Configurar Apache para permitir .htaccess
RUN sed -i 's/AllowOverride None/AllowOverride All/g' /etc/apache2/apache2.conf

# Copiar archivos de la app al document root de Apache
COPY . /var/www/html/

# Asegurar permisos de escritura para shops.json y nonces.json
RUN chown -R www-data:www-data /var/www/html/ \
    && chmod 755 /var/www/html/

EXPOSE 80
