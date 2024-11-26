# Gunakan base image Node.js versi Linux
FROM node:18-slim

# Instal dependensi yang dibutuhkan
RUN apt-get update && apt-get install -y \
    curl \
    libglib2.0-0 \
    libsm6 \
    libxrender1 \
    libxext6 \
    libc6 \
    && rm -rf /var/lib/apt/lists/*

# Tentukan direktori kerja
WORKDIR /app

# Salin file package.json dan package-lock.json
COPY package*.json ./ 

# Install dependensi Node.js
RUN npm install --build-from-source

# Salin seluruh project ke container
COPY . . 

# Verifikasi file di dalam container
RUN ls -R /app

# Expose port untuk container
EXPOSE 8080

# Jalankan aplikasi
CMD ["node", "app.js"]
