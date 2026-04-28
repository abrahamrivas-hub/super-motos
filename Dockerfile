FROM node:18-slim

# Instalar poppler-utils (contiene pdftoppm)
RUN apt-get update && apt-get install -y \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

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
