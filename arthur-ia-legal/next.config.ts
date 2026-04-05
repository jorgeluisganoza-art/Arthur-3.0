import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    'better-sqlite3',
    'puppeteer-core',
    '@sparticuz/chromium-min',
    'playwright',
    'playwright-extra',
    'puppeteer-extra-plugin-stealth',
  ],
};

export default nextConfig;
