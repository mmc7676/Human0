FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY physics-core.js universe.js server.js http.js stars.json ./
ENV PORT=8080
EXPOSE 8080
USER node
CMD ["node","http.js"]
