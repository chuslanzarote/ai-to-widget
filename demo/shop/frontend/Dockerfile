FROM node:20.14.0-alpine AS builder
WORKDIR /app

ARG VITE_SHOP_BACKEND_URL=http://localhost:3200
ENV VITE_SHOP_BACKEND_URL=$VITE_SHOP_BACKEND_URL

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json vite.config.ts tailwind.config.ts postcss.config.cjs index.html ./
COPY src ./src
COPY public ./public

RUN npx tsc -p tsconfig.json && npx vite build

FROM nginx:1.27.0-alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
