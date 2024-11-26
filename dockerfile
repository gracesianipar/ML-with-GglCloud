# 1. Gunakan base image Node.js
FROM node:18

RUN apt-get update && apt-get install -y libglib2.0-0 libsm6 libxrender1 libxext6

# 2. Tentukan direktori kerja di dalam container
WORKDIR /app

# 3. Salin file package.json dan package-lock.json
COPY package*.json ./

# 4. Install dependensi aplikasi
RUN npm install

# 5. Salin semua file dari proyek Anda ke dalam container
COPY . .

COPY ./config/submissionmlgc-gracesianipar-ab75553a34a5.json ./config/

HEALTHCHECK CMD curl --fail http://localhost:8080 || exit 1

ENV PORT=8080

# 6. Expose port 3000 (sesuai dengan aplikasi Anda)
EXPOSE 8080

# 7. Tentukan perintah untuk menjalankan aplikasi
CMD ["node", "app.js"]
