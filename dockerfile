FROM node:18
RUN apt-get update && apt-get install -y \
    curl \
    libglib2.0-0 \
    libsm6 \
    libxrender1 \
    libxext6 \
    libvips-dev \ 
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm install --build-from-source
COPY . .
EXPOSE 8080
CMD ["node", "app.js"]
