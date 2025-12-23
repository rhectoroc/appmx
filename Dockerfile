FROM oven/bun:latest

WORKDIR /app

# 1. Copiar dependencias
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# 2. Copiar todo el código
COPY . .

# 3. Construir la aplicación
RUN bun run build

# 4. Verificar que el build se creó
RUN echo "=== Verificando build ===" && \
    ls -la build/ && \
    echo "=== build/client ===" && \
    ls -la build/client/ && \
    [ -f build/client/index.html ] && echo "✅ HTML encontrado" || echo "❌ HTML NO encontrado"

# 5. Variables de entorno
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

EXPOSE 3000

# 6. Comando de inicio
CMD ["bun", "run", "start"]