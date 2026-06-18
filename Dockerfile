FROM node:22-alpine

WORKDIR /app

# Copy package.json and lockfile first for optimal layer caching
COPY package.json package-lock.json* ./
RUN npm install

# Copy application files
COPY . .

# Expose the correct port matching vite default config
EXPOSE 3000

CMD ["npm", "run", "dev"]
