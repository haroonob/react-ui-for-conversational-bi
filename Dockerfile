FROM node:22

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

ENV VITE_API_URL=http://api:8000

CMD ["npm", "run", "dev"]
