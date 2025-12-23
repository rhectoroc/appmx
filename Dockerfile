# Usa la imagen oficial de Bun
FROM oven/bun:latest

WORKDIR /app

# Copiar archivos de configuración de dependencias
COPY package.json bun.lock ./

# Instalar dependencias
RUN bun install

# Copiar el resto del código
COPY . .

# Construir la aplicación para producción
RUN bun run build

# Exponer el puerto que configuraste en vite.config.ts (4000)
EXPOSE 4000

# Comando para arrancar el servidor de producción
# Nota: Asegúrate de tener un script "start" en package.json que use react-router-serve
CMD ["bun", "run", "start"]