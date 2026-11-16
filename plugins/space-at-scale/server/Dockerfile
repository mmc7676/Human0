FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY physics-core.js galaxy-core.js universe.js server.js http.js stars.json galaxy.json ./
COPY dist ./dist
ENV PORT=8080
EXPOSE 8080
USER node
CMD ["node","http.js"]
