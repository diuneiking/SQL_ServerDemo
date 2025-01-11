# Base Node.js image
FROM node:16

# Install OpenVPN
RUN apt-get update && apt-get install -y openvpn

# Set the working directory
WORKDIR /app

# Copy application files
COPY . .

# Install Node.js dependencies
RUN npm install

# Start OpenVPN and your Node.js server
CMD openvpn --config /app/render-client.ovpn & node server.js
