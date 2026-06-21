'use strict'

const { chromium } = require('playwright-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')

let _stealthApplied = false
function applyStealthOnce() {
  if (_stealthApplied) return
  _stealthApplied = true
  try { chromium.use(StealthPlugin()) } catch {}
}

const SPRL_LOGIN_URL = 'https://sprl.sunarp.gob.pe/sprl/ingreso'

/**
 * Parse proxy URL from env and force a fresh session for each SPRL request.
 * IPRoyal format: http://USERNAME:PASSWORD@host:port
 * where USERNAME contains _country-pe_city-lima_session-XXX_lifetime-XXX
 */
function parseProxy(proxyUrl) {
  if (!proxyUrl) return null
  try {
    // Manual parse to avoid URL() mangling the username's underscores/params
    // Format: protocol://user:pass@host:port
    const match = proxyUrl.match(/^(https?):\/\/([^:]+):([^@]+)@([^:]+):(\d+)$/)
    if (!match) {
      console.error('[SPRL] PROXY_URL format not recognized')
      return null
    }

    const [, protocol, rawUser, rawPass, host, port] = match

    let username = decodeURIComponent(rawUser)
    const password = decodeURIComponent(rawPass)

    // Fresh session each time to get a new exit IP
    if (username.includes('_session-')) {
      username = username.replace(/_session-[^_]+/, '_session-sprl' + Date.now())
    } else {
      username += '_session-sprl' + Date.now()
    }

    console.log('[SPRL] Proxy configured:', host + ':' + port, 'user prefix:', username.substring(0, 20))

    return {
      server: protocol + '://' + host + ':' + port,
      username: username,
      password: password,
    }
  } catch (e) {
    console.error('[SPRL] parseProxy error:', e instanceof Error ? e.message : String(e))
    return null
  }
}

function sprlLaunchOptions() {
  const opts = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--ignore-certificate-errors',
    ],
  }
  const proxy = parseProxy(process.env.PROXY_URL)
  if (proxy) {
    opts.proxy = {
      server: proxy.server,
      username: proxy.username,
      password: proxy.password,
    }
  }
  return opts
}

async function loginSPRL(username, password) {
  applyStealthOnce()

  // Diagnostic: log which proxy config is being used
  const proxyCheck = parseProxy(process.env.PROXY_URL)
  console.log('[SPRL] Proxy server:', proxyCheck ? proxyCheck.server : 'NONE')
  console.log('[SPRL] Proxy has auth:', proxyCheck ? !!(proxyCheck.username && proxyCheck.password) : false)

  let browser = null

  try {
    console.log('[SPRL] Starting login attempt for user:', username)
    browser = await chromium.launch(sprlLaunchOptions())

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      locale: 'es-PE',
      ignoreHTTPSErrors: true,
    })

    const page = await context.newPage()

    console.log('[SPRL] Navigating to:', SPRL_LOGIN_URL)
    // Navigate with retry — proxy + HTTPS can be flaky on first attempt
    let navSuccess = false
    for (let navAttempt = 1; navAttempt <= 3; navAttempt++) {
      try {
        await page.goto(SPRL_LOGIN_URL, {
          waitUntil: 'domcontentloaded',
          timeout: 45000,
        })
        navSuccess = true
        break
      } catch (navErr) {
        const msg = navErr instanceof Error ? navErr.message : String(navErr)
        console.log(`[SPRL] Nav attempt ${navAttempt}/3 failed: ${msg}`)
        if (navAttempt < 3) {
          await page.waitForTimeout(3000)
        } else {
          throw navErr
        }
      }
    }
    if (!navSuccess) {
      throw new Error('No se pudo cargar la página de SPRL después de 3 intentos')
    }
    await page.waitForTimeout(2000)

    console.log('[SPRL] Page loaded:', page.url())
    const pageTitle = await page.title()
    console.log('[SPRL] Page title:', pageTitle)

    let hasLoginFields = await page.$('input[type="text"][name*="usuario" i], input[type="text"][name*="user" i], input[id*="usuario" i], input[id*="user" i], input[id*="login" i]').catch(() => null)

    if (!hasLoginFields) {
      console.log('[SPRL] Login fields not visible — looking for INGRESAR button...')
      const ingresarClicked = await page.click('a:has-text("INGRESAR"), button:has-text("INGRESAR"), input[value="INGRESAR"], .btn-ingresar, a[href*="login"], a[href*="ingreso"]', { timeout: 5000 }).then(() => true).catch(() => false)

      if (ingresarClicked) {
        console.log('[SPRL] Clicked INGRESAR, waiting for login form...')
        await page.waitForTimeout(3000)
        console.log('[SPRL] After INGRESAR click:', page.url())
      }

      hasLoginFields = await page.$('input[type="text"], input[type="email"]').catch(() => null)
    }

    const usernameField = await page.$('input[name*="usuario" i], input[name*="user" i], input[id*="usuario" i], input[id*="user" i], input[id*="login" i], input[type="text"]:not([name*="captcha" i])').catch(() => null)

    if (!usernameField) {
      const bodyText = await page.evaluate(() => document.body?.textContent?.substring(0, 500) || '').catch(() => '')
      console.log('[SPRL] Could not find username field. Page text:', bodyText.replace(/\s+/g, ' ').trim().substring(0, 300))

      await page.screenshot({ path: '/tmp/sprl-login-debug.png', fullPage: true }).catch(() => {})

      await browser.close()
      return { ok: false, error: 'No se encontró el formulario de login en SPRL. Posible cambio en el portal.' }
    }

    await usernameField.click()
    await usernameField.fill(username)
    console.log('[SPRL] Username filled')

    const passwordField = await page.$('input[type="password"]').catch(() => null)
    if (!passwordField) {
      await browser.close()
      return { ok: false, error: 'No se encontró el campo de contraseña en SPRL.' }
    }

    await passwordField.click()
    await passwordField.fill(password)
    console.log('[SPRL] Password filled')

    const captchaImg = await page.$('img[id*="captcha" i], img[src*="captcha" i], img[alt*="captcha" i], #imgCaptcha, .captcha-image').catch(() => null)

    if (captchaImg) {
      console.log('[SPRL] Captcha detected — attempting to solve...')

      const captchaBase64 = await captchaImg.evaluate(img => {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth || img.width
        canvas.height = img.naturalHeight || img.height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0)
        return canvas.toDataURL('image/png').split(',')[1]
      }).catch(() => null)

      if (captchaBase64 && process.env.TWOCAPTCHA_API_KEY) {
        try {
          const { Solver } = require('2captcha-ts')
          const solver = new Solver(process.env.TWOCAPTCHA_API_KEY)
          const result = await solver.imageCaptcha({ body: captchaBase64, numeric: 0, minLen: 4, maxLen: 6 })
          const captchaCode = result?.data || ''

          if (captchaCode) {
            console.log('[SPRL] Captcha solved:', captchaCode)
            const captchaInput = await page.$('input[name*="captcha" i], input[id*="captcha" i]:not(img)').catch(() => null)
            if (captchaInput) {
              await captchaInput.fill(captchaCode)
            }
          }
        } catch (e) {
          console.error('[SPRL] Captcha solve error:', e instanceof Error ? e.message : String(e))
        }
      }
    }

    console.log('[SPRL] Submitting login...')
    const navPromise = page.waitForNavigation({ waitUntil: 'load', timeout: 30000 }).catch(() => null)

    const submitClicked = await page.click('button[type="submit"], input[type="submit"], button:has-text("Ingresar"), button:has-text("INGRESAR"), input[value*="Ingresar" i], .btn-login, #btnLogin, #btnIngresar').then(() => true).catch(() => false)

    if (!submitClicked) {
      await page.evaluate(() => {
        const form = document.querySelector('form')
        if (form) form.submit()
      }).catch(() => {})
    }

    await navPromise
    await page.waitForTimeout(3000)

    console.log('[SPRL] After login submit:', page.url())

    const loginResult = await page.evaluate(() => {
      const body = document.body?.textContent || ''

      const hasHola = body.includes('HOLA!') || body.includes('HOLA ')
      const hasSaldo = body.includes('SALDO DISPONIBLE') || body.includes('Saldo')
      const hasUsuario = body.includes('USUARIO:') || body.includes('Usuario:')

      const hasError = body.includes('incorrecto') || body.includes('inválido') ||
                       body.includes('invalido') || body.includes('error') ||
                       body.includes('no válido') || body.includes('contraseña incorrecta') ||
                       body.includes('usuario no existe') || body.includes('credenciales')

      let saldo = null
      const saldoMatch = body.match(/SALDO\s*DISPONIBLE[:\s]*S\/?\s*([\d.,]+)/i) ||
                         body.match(/S\/\s*([\d.,]+)\s*Soles/i)
      if (saldoMatch) {
        saldo = parseFloat(saldoMatch[1].replace(',', '.'))
      }

      let displayName = null
      const holaMatch = body.match(/HOLA!?\s*([A-ZÁÉÍÓÚÑ\s]+?)(?:\n|USUARIO|SALDO)/i)
      if (holaMatch) {
        displayName = holaMatch[1].trim()
      }

      let displayUsername = null
      const userMatch = body.match(/USUARIO:\s*(\S+)/i)
      if (userMatch) {
        displayUsername = userMatch[1].trim()
      }

      return {
        isLoggedIn: hasHola || hasSaldo || hasUsuario,
        hasError,
        saldo,
        displayName,
        displayUsername,
        bodySnippet: body.replace(/\s+/g, ' ').trim().substring(0, 400),
      }
    }).catch(() => ({
      isLoggedIn: false, hasError: true, saldo: null,
      displayName: null, displayUsername: null, bodySnippet: '',
    }))

    console.log('[SPRL] Login result:', {
      isLoggedIn: loginResult.isLoggedIn,
      hasError: loginResult.hasError,
      saldo: loginResult.saldo,
      displayName: loginResult.displayName,
      displayUsername: loginResult.displayUsername,
    })

    if (loginResult.hasError && !loginResult.isLoggedIn) {
      const errorText = loginResult.bodySnippet.toLowerCase()
      let errorMsg = 'Credenciales SPRL incorrectas o cuenta inactiva.'

      if (errorText.includes('captcha')) {
        errorMsg = 'Error de captcha en SPRL. Intente nuevamente.'
      } else if (errorText.includes('bloqueado') || errorText.includes('suspendido')) {
        errorMsg = 'Cuenta SPRL bloqueada o suspendida.'
      } else if (errorText.includes('no existe')) {
        errorMsg = 'El usuario SPRL no existe.'
      }

      console.log('[SPRL] Login FAILED:', errorMsg)
      await browser.close()
      return { ok: false, error: errorMsg }
    }

    if (!loginResult.isLoggedIn) {
      console.log('[SPRL] Login unclear — body snippet:', loginResult.bodySnippet.substring(0, 200))
      await page.screenshot({ path: '/tmp/sprl-login-unclear.png', fullPage: true }).catch(() => {})
      await browser.close()
      return { ok: false, error: 'No se pudo confirmar el login en SPRL. Intente nuevamente.' }
    }

    console.log('[SPRL] Login SUCCESS — saldo:', loginResult.saldo, 'user:', loginResult.displayName)

    await browser.close()

    return {
      ok: true,
      saldo: loginResult.saldo,
      displayName: loginResult.displayName || null,
      displayUsername: loginResult.displayUsername || null,
    }

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[SPRL] Login error:', msg)
    if (browser) await browser.close().catch(() => {})
    return { ok: false, error: 'Error al intentar login en SPRL: ' + msg }
  }
}

module.exports = { loginSPRL }
