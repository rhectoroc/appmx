FROM oven/bun:latest

WORKDIR /app

# Argumentos de construcción
ARG DATABASE_URL
ARG AUTH_SECRET

# Instalación de dependencias
COPY package.json bun.lock ./
RUN bun install

# Copiar el resto de la aplicación
COPY . .

# Variables de entorno para el Build y Runtime
ENV DATABASE_URL=$DATABASE_URL
ENV AUTH_SECRET=$AUTH_SECRET
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4001

# Construir la aplicación
RUN bun run build

# Exponer el puerto correcto
EXPOSE 4001

# Comando de inicio
CMD ["bun", "run", "start"]