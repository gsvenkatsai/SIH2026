FROM node:20-alpine

WORKDIR /app

# Install npm packages
COPY package.json package-lock.json ./
RUN npm ci

# Copy frontend source code
COPY . .

# Build production React app
RUN npm run build

EXPOSE 5173

# Serve production React app on port 5173 with SPA fallback (-s)
CMD ["npx", "serve", "-s", "dist", "-l", "5173"]
