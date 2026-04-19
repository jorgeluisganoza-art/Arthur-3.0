FROM mcr.microsoft.com/playwright:v1.40.0-jammy

WORKDIR /app

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY package*.json ./
RUN npm install

COPY . .

CMD ["node", "index.js"]
