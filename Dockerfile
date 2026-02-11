# Imagen oficial de Playwright (ya trae Chromium listo)
FROM mcr.microsoft.com/playwright:v1.42.1-jammy

# Crear directorio de la app
WORKDIR /app

# Copiar package.json primero (mejor cache de Docker)
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar todo el proyecto
COPY . .

# Exponer puerto
EXPOSE 3000

# Comando para iniciar servidor
CMD ["npm", "start"]
