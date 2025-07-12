# Use official Node.js image as base
FROM node:18-alpine

# Set working directory inside container
WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all source code
COPY . .

# Expose port your dev server runs on (usually 3000 or 5173 for Vite)
EXPOSE 3000

# Start the dev server
CMD ["npm", "run", "dev"]
