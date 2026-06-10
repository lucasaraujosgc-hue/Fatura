FROM node:20-alpine

WORKDIR /app

# Copy package info and lock file
COPY package*.json ./

# Install dependencies (including production and dev for build)
RUN npm install

# Copy source code
COPY . .

# Build application
RUN npm run build

# Expose port
EXPOSE 3000

# Start server
CMD ["npm", "run", "start"]
