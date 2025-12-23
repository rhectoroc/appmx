# Usa la imagen oficial de Bun
FROM oven/bun:latest

FROM oven/bun:latest

WORKDIR /app

# Argumentos de construcción (Easypanel los inyecta)
ARG DATABASE_URL
ARG AUTH_SECRET

COPY package.json bun.lock ./
RUN bun install

COPY . .

# Inyectar la URL durante el build por si React Router 
# intenta inicializar el adapter de auth
ENV DATABASE_URL=$DATABASE_URL
ENV NODE_ENV=production

RUN bun run build
RUN PORT=4001
EXPOSE 4001
ENV HOST=0.0.0.0
ENV PORT=4000
ENV NODE_ENV=production

CMD ["bun", "run", "start"]