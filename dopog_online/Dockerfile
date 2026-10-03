FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm install --production
COPY . .
RUN mkdir -p data uploads/permits uploads/vehicles
EXPOSE 3000
VOLUME ["/app/data", "/app/uploads"]
CMD ["node", "server.js"]