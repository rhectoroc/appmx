FROM oven/bun:1-alpine

WORKDIR /app

# 1. Copiar archivos de dependencias
COPY package.json bun.lock ./

# 2. Instalar dependencias (incluyendo dev para build)
RUN bun install

# 3. Copiar código fuente
COPY . .

# 4. Construir la aplicación
RUN bun run build

# 5. Verificar la estructura generada
RUN echo "=== Verifying build ===" && \
    ls -la __create/ && \
    test -f __create/route-builder.ts && echo "✅ route-builder.ts exists" || echo "❌ route-builder.ts missing" && \
    test -f build/server/index.js && echo "✅ React Router build exists" || echo "❌ React Router build missing"

EXPOSE 4001

# 6. Ejecutar con Bun
CMD ["bun", "./__create/index.ts"]