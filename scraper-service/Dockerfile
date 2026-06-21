FROM mcr.microsoft.com/playwright:v1.40.0-jammy

WORKDIR /app

# Install microsocks — lightweight SOCKS5 proxy tunnel (no auth required from Chromium)
RUN apt-get update && apt-get install -y \
    git \
    gcc \
    make \
    && git clone https://github.com/rofl0r/microsocks.git /tmp/microsocks \
    && cd /tmp/microsocks && make && cp microsocks /usr/local/bin/ \
    && apt-get remove -y git gcc make \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/* /tmp/microsocks

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY package*.json ./
RUN npm install
COPY . .

CMD ["node", "index.js"]
