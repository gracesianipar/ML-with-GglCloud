FROM node:18

# Install TensorFlow dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    libglib2.0-0 \
    libsm6 \
    libxrender1 \
    libxext6

# Set working directory
WORKDIR /app

# Copy project files
COPY package*.json ./
RUN npm install

COPY . .

# Expose port
ENV PORT=8080
EXPOSE 8080

# Run app
CMD ["node", "app.js"]
