# Dockerfile ejemplo
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./
RUN npm ci --only=production

# Copiar código fuente
COPY . .

# Construir la aplicación
RUN npm run build

# Fase de producción
FROM node:20-alpine

WORKDIR /app

# Copiar dependencias y build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./

# Exponer puerto
EXPOSE 4001

# Comando para iniciar
CMD ["node", "--enable-source-maps", "index.ts"]