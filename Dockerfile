FROM node:18-alpine

# Instalar poppler-utils (contiene pdftoppm)
RUN apk add --no-cache poppler-utils

WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el resto del código
COPY . .

# Build de Next.js
RUN npm run build

# Exponer puerto
EXPOSE 3000

# Comando para iniciar
CMD ["npm", "start"]
