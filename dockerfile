FROM node:18-slim

RUN apt-get update && apt-get install -y \
    curl \
    libglib2.0-0 \
    libsm6 \
    libxrender1 \
    libxext6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN npm install --build-from-source

COPY . .

RUN ls -R /app

ENV PORT 8080

EXPOSE 8080

CMD ["node", "app.js"]
