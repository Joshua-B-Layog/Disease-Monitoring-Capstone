FROM node:20-alpine
WORKDIR /app

# Copy dependency manifests first so npm ci is cached as its own layer and only
# re-runs when package.json / package-lock.json actually change.
COPY package*.json ./
RUN npm ci

COPY . .
EXPOSE 5000

# nodemon for live reload (npm run dev = "nodemon server.js")
CMD ["npm", "run", "dev"]
