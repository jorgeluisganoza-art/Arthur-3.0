import { chromium } from 'playwright-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import type { Browser } from 'playwright'

chromium.use(StealthPlugin())

const CEJ_URL = 'https://cej.pj.gob.pe/cej/forms/busquedaform.html'

async function main() {
  let browser: Browser | null = null
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    }) as unknown as Browser

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
    })
    const page = await context.newPage()

    console.log('Navigating...')
    await page.goto(CEJ_URL, { waitUntil: 'load', timeout: 30000 })
    console.log('Page title:', await page.title())
    console.log('URL after nav:', page.url())

    // Look for hCaptcha sitekey
    const hcaptchaData = await page.evaluate(() => {
      const els = document.querySelectorAll('[data-sitekey], .h-captcha, iframe[src*="hcaptcha"]')
      return Array.from(els).map(el => ({
        tag: el.tagName,
        sitekey: el.getAttribute('data-sitekey'),
        src: el.getAttribute('src'),
        className: el.className,
      }))
    })
    console.log('\nhCaptcha elements:', JSON.stringify(hcaptchaData, null, 2))

    // Dump full HTML (first 5000 chars)
    const html = await page.content()
    console.log('\n=== HTML (first 5000 chars) ===')
    console.log(html.substring(0, 5000))

  } finally {
    if (browser) await browser.close()
  }
}

main().catch(console.error)
