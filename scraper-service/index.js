'use strict'

const express = require('express')
const { scrapeCEJ } = require('./cej-scraper')

const app = express()
app.use(express.json({ limit: '1mb' }))

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.post('/scrape', async (req, res) => {
  try {
    const { numero, parte } = req.body || {}
    if (numero == null || String(numero).trim() === '') {
      return res.status(400).json({ error: 'numero es requerido' })
    }
    if (parte == null || String(parte).trim() === '') {
      return res.status(400).json({ error: 'parte es requerida' })
    }
    const result = await scrapeCEJ(String(numero).trim(), String(parte).trim())
    res.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[scraper-service] POST /scrape', message)
    res.status(500).json({ error: 'Error al ejecutar scrape CEJ', details: message })
  }
})

app.get('/health/proxy', async (req, res) => {
  const { chromium } = require('playwright')
  function parseProxy(proxyUrl) {
    const url = new URL(proxyUrl)
    return {
      server: url.protocol + '//' + url.hostname + ':' + url.port,
      username: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
    }
  }
  let browser
  try {
    browser = await chromium.launch({
      headless: true,
      proxy: parseProxy(process.env.PROXY_URL),
      args: ['--no-sandbox', '--ignore-certificate-errors']
    });
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({});
    const response = await page.goto('http://checkip.amazonaws.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    const ip = (await page.textContent('body')).trim();
    res.json({ ok: true, ip });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  } finally {
    if (browser) await browser.close()
  }
})

// ─── SPRL (Publicidad Registral) ────────────────────────────────
const { loginSPRL } = require('./sprl-scraper')

app.post('/sprl/login', async (req, res) => {
  try {
    const { username, password } = req.body || {}
    if (!username || !password) {
      return res.status(400).json({ ok: false, error: 'username y password son requeridos' })
    }
    const result = await loginSPRL(String(username).trim(), String(password).trim())
    res.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[scraper-service] POST /sprl/login', message)
    res.status(500).json({ ok: false, error: 'Error al ejecutar login SPRL', details: message })
  }
})

app.get('/sprl/health', (_req, res) => {
  res.json({ status: 'ok', module: 'sprl' })
})

const PORT = Number(process.env.PORT) || 3001
app.listen(PORT, () => {
  console.log(`[cej-scraper-service] listening on :${PORT}`)
})
