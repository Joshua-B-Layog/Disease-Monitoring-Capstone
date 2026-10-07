FROM node:20-alpine
WORKDIR /app

# Manifests first so npm ci is a cached layer; app code lands on top of it.
COPY package*.json ./
RUN npm ci

COPY . .
EXPOSE 3000

# Vite binds 3000 per vite.config.js (port: 3000 + strictPort: true),
# so compose maps the host port straight to 3000.
CMD ["npm", "run", "dev"]
