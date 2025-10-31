FROM node:20-alpine
WORKDIR /app
# Install wget for healthcheck
RUN apk add --no-cache wget
COPY package.json package-lock.json* ./
RUN npm install --production
COPY server.js ./
EXPOSE 8080
CMD ["node", "server.js"]
