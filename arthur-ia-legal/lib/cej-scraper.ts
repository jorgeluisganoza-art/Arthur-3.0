import { chromium } from 'playwright-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { Solver } from '2captcha-ts'
import type { Browser, Page } from 'playwright'
import crypto from 'crypto'

chromium.use(StealthPlugin())

const CEJ_URL = 'https://cej.pj.gob.pe/cej/forms/busquedaform.html'
const TWOCAPTCHA_KEY = process.env.TWOCAPTCHA_API_KEY || ''

export interface CejActuacion {
  numero: string
  fecha: string
  acto: string
  folio: string
  sumilla: string
  tieneDocumento: boolean
  documentoUrl: string
  tieneResolucion: boolean
}

export interface CejCaseData {
  numeroExpediente: string
  organoJurisdiccional: string
  distritoJudicial: string
  juez: string
  especialidad: string
  proceso: string
  etapa: string
  estadoProceso: string
  partes: { rol: string; nombre: string }[]
  actuaciones: CejActuacion[]
  totalActuaciones: number
  hash: string
  portalDown: boolean
  captchaDetected: boolean
  captchaSolved: boolean
  scrapedAt: string
  error?: string
}

// Keep old interface for backward compat with debug-cej route
export interface CejResult extends CejCaseData {
  movimientos: CejActuacion[]
  totalMovimientos: number
  ultimoMovimiento: CejActuacion | null
  etapaProcesal: string
  portalMessage: string
  rawHtmlSample: string
}

async function solveCaptchaIfPresent(
  page: Page,
  solver: Solver
): Promise<boolean> {
  // Check for image captcha
  const captchaImg = await page.$('img[src*="captcha"], img[id*="captcha"], #captchaImage')
  if (captchaImg) {
    console.log('[CEJ] Image captcha detected — solving with 2captcha...')
    try {
      const imgSrc = await captchaImg.getAttribute('src')
      if (!imgSrc) return false

      const imgBuffer = await page.evaluate(async (src: string) => {
        const response = await fetch(src)
        const blob = await response.blob()
        return new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve((reader.result as string).split(',')[1])
          reader.readAsDataURL(blob)
        })
      }, imgSrc)

      const result = await solver.imageCaptcha({
        body: imgBuffer,
        numeric: 1,
        min_len: 4,
        max_len: 8
      })

      const captchaInput = await page.$('input[name*="captcha"], input[id*="captcha"], #codigoCaptcha')
      if (captchaInput && result.data) {
        await captchaInput.fill(result.data)
        console.log('[CEJ] Image captcha solved:', result.data)
        return true
      }
    } catch (e: unknown) {
      console.error('[CEJ] Image captcha solving failed:', e instanceof Error ? e.message : String(e))
      return false
    }
  }

  // Check for reCAPTCHA
  const recaptcha = await page.$('.g-recaptcha, [data-sitekey]')
  if (recaptcha) {
    console.log('[CEJ] reCAPTCHA detected — solving with 2captcha...')
    try {
      const sitekey = await recaptcha.getAttribute('data-sitekey')
      if (!sitekey) return false

      const result = await solver.recaptcha({
        pageurl: CEJ_URL,
        googlekey: sitekey
      })

      await page.evaluate((token: string) => {
        const textarea = document.getElementById('g-recaptcha-response') as HTMLTextAreaElement | null
        if (textarea) {
          textarea.style.display = 'block'
          textarea.value = token
        }
        const win = window as unknown as Record<string, unknown>
        const grecaptcha = win['grecaptcha'] as Record<string, unknown> | undefined
        const cfg = win['___grecaptcha_cfg'] as Record<string, unknown> | undefined
        if (grecaptcha && cfg) {
          const clients = cfg['clients'] as Record<string, unknown> | undefined
          if (clients) {
            const keys = Object.keys(clients)
            if (keys.length > 0) {
              const client = clients[keys[0]] as Record<string, unknown> | undefined
              const U = client?.['U'] as Record<string, unknown> | undefined
              const UU = U?.['U'] as Record<string, unknown> | undefined
              const callback = UU?.['callback'] as ((t: string) => void) | undefined
              if (callback) callback(token)
            }
          }
        }
      }, result.data)

      console.log('[CEJ] reCAPTCHA solved')
      return true
    } catch (e: unknown) {
      console.error('[CEJ] reCAPTCHA solving failed:', e instanceof Error ? e.message : String(e))
      return false
    }
  }

  return false
}

async function parseActuaciones(page: Page): Promise<CejActuacion[]> {
  await page.waitForSelector(
    'table, .actuacion, #divActuaciones, .listado',
    { timeout: 10000 }
  ).catch(() => console.log('[CEJ] No table selector found'))

  // Strategy 1: table rows
  const rows = await page.$$eval(
    'table tr, .actuacion-row, #tablaActuaciones tr',
    (els) => els.map(row => {
      const cells = Array.from(row.querySelectorAll('td'))
      if (cells.length < 3) return null

      const links = Array.from(row.querySelectorAll('a[href], button'))
      const docLinks = links
        .filter((l: Element) => {
          const a = l as HTMLAnchorElement
          return a.href?.includes('.pdf') ||
            l.textContent?.toLowerCase().includes('ver') ||
            l.textContent?.toLowerCase().includes('pdf')
        })
        .map((l: Element) => (l as HTMLAnchorElement).href || '')

      return {
        numero: cells[0]?.textContent?.trim() || '',
        fecha: cells[1]?.textContent?.trim() || cells[0]?.textContent?.trim() || '',
        acto: cells[2]?.textContent?.trim() || cells[1]?.textContent?.trim() || '',
        folio: cells[3]?.textContent?.trim() || '',
        sumilla: cells[4]?.textContent?.trim() || cells[3]?.textContent?.trim() || cells[cells.length - 1]?.textContent?.trim() || '',
        tieneDocumento: docLinks.length > 0,
        documentoUrl: docLinks[0] || '',
        tieneResolucion: cells.some((c: Element) =>
          c.textContent?.toLowerCase().includes('resoluc') ||
          c.textContent?.toLowerCase().includes('sentencia') ||
          c.textContent?.toLowerCase().includes('auto')
        )
      }
    }).filter(Boolean)
  ).catch(() => [] as null[])

  const validRows = (rows as (CejActuacion | null)[]).filter((r): r is CejActuacion => r !== null)

  if (validRows.length > 0) return validRows

  // Strategy 2: div-based actuaciones
  const divActuaciones = await page.$$eval(
    '.actuacion, .item-actuacion, [class*="actuacion"]',
    (divs) => divs.map(div => ({
      numero: (div.querySelector('.numero, [class*="numero"]') as HTMLElement | null)?.textContent?.trim() || '',
      fecha: (div.querySelector('.fecha, [class*="fecha"]') as HTMLElement | null)?.textContent?.trim() || '',
      acto: (div.querySelector('.acto, [class*="acto"], .tipo') as HTMLElement | null)?.textContent?.trim() || '',
      folio: (div.querySelector('.folio, [class*="folio"]') as HTMLElement | null)?.textContent?.trim() || '',
      sumilla: (div.querySelector('.sumilla, [class*="sumilla"], .descripcion') as HTMLElement | null)?.textContent?.trim() || div.textContent?.trim() || '',
      tieneDocumento: !!div.querySelector('a[href*=".pdf"], button'),
      documentoUrl: ((div.querySelector('a[href*=".pdf"]') as HTMLAnchorElement | null)?.href) || '',
      tieneResolucion: div.textContent?.toLowerCase().includes('resoluc') || false
    }))
  ).catch(() => [] as CejActuacion[])

  return (divActuaciones as CejActuacion[]).filter(a => a.fecha || a.acto)
}

interface CaseHeader {
  organoJurisdiccional: string
  distritoJudicial: string
  juez: string
  especialidad: string
  proceso: string
  etapa: string
  estadoProceso: string
  partes: { rol: string; nombre: string }[]
}

async function parseCaseHeader(page: Page): Promise<Partial<CaseHeader>> {
  return page.evaluate(() => {
    const getText = (keywords: string[]): string => {
      const rows = document.querySelectorAll('table tr, .dato-expediente')
      for (const row of rows) {
        const cells = row.querySelectorAll('td, span, div')
        for (let i = 0; i < cells.length - 1; i++) {
          const label = cells[i]?.textContent?.toLowerCase() || ''
          if (keywords.some(k => label.includes(k.toLowerCase()))) {
            return cells[i + 1]?.textContent?.trim() || ''
          }
        }
      }
      return ''
    }

    const partes: { rol: string; nombre: string }[] = []
    document.querySelectorAll('.parte, [class*="parte"], tr').forEach(row => {
      const cells = row.querySelectorAll('td')
      if (cells.length >= 2) {
        const posibleRol = cells[0]?.textContent?.trim()?.toLowerCase() || ''
        if (posibleRol.includes('demand') ||
          posibleRol.includes('accion') ||
          posibleRol.includes('imput') ||
          posibleRol.includes('agrav')) {
          partes.push({
            rol: cells[0]?.textContent?.trim() || '',
            nombre: cells[1]?.textContent?.trim() || ''
          })
        }
      }
    })

    return {
      organoJurisdiccional: getText(['organo', 'juzgado', 'sala', 'tribunal']),
      distritoJudicial: getText(['distrito', 'corte']),
      juez: getText(['juez', 'magistrado', 'vocal']),
      especialidad: getText(['especialidad', 'materia']),
      proceso: getText(['proceso', 'tipo de proceso']),
      etapa: getText(['etapa', 'estado del proceso', 'instancia']),
      estadoProceso: getText(['estado', 'situación']),
      partes
    }
  }).catch(() => ({}))
}

export async function scrapeCEJ(numeroExpediente: string): Promise<CejCaseData> {
  // Vercel: Playwright not supported, return early
  if (process.env.VERCEL === '1') {
    return {
      numeroExpediente,
      organoJurisdiccional: '', distritoJudicial: '', juez: '',
      especialidad: '', proceso: '', etapa: '', estadoProceso: '',
      partes: [], actuaciones: [], totalActuaciones: 0, hash: '',
      portalDown: true, captchaDetected: false, captchaSolved: false,
      scrapedAt: new Date().toISOString(),
      error: 'El scraping en tiempo real requiere el servidor local. Ejecuta npm run dev para usar esta función.'
    }
  }

  const baseResult: CejCaseData = {
    numeroExpediente,
    organoJurisdiccional: '', distritoJudicial: '', juez: '',
    especialidad: '', proceso: '', etapa: '', estadoProceso: '',
    partes: [], actuaciones: [], totalActuaciones: 0, hash: '',
    portalDown: false, captchaDetected: false, captchaSolved: false,
    scrapedAt: new Date().toISOString()
  }

  const solver = new Solver(TWOCAPTCHA_KEY)
  let browser: Browser | null = null

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`[CEJ] Attempt ${attempt}/3 — ${numeroExpediente}`)

      browser = await chromium.launch({
        headless: true,
        executablePath: process.env.CHROME_EXECUTABLE_PATH || undefined,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled'
        ]
      }) as unknown as Browser

      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 800 },
        locale: 'es-PE',
      })

      const page = await context.newPage()

      console.log('[CEJ] Navigating to portal...')
      await page.goto(CEJ_URL, { waitUntil: 'load', timeout: 30000 })

      // Handle Radware Bot Manager hCaptcha challenge
      if (page.url().includes('perfdrive.com') || (await page.title()).includes('Radware')) {
        console.log('[CEJ] Radware Bot Manager detected — solving hCaptcha...')
        baseResult.captchaDetected = true

        const sitekey = await page.$eval(
          '.h-captcha[data-sitekey]',
          (el: Element) => el.getAttribute('data-sitekey') || ''
        ).catch(() => '')

        if (!sitekey || !TWOCAPTCHA_KEY) {
          console.log('[CEJ] Cannot solve Radware hCaptcha — no sitekey or no 2captcha key')
          await browser.close()
          browser = null
          if (attempt < 3) {
            await new Promise(r => setTimeout(r, 8000))
            continue
          }
          return { ...baseResult, portalDown: true, error: 'Portal CEJ protegido por Radware Bot Manager. Configure TWOCAPTCHA_API_KEY para resolver el captcha automáticamente.' }
        }

        let captchaToken: string | null = null
        try {
          const captchaResult = await solver.hcaptcha({ pageurl: page.url(), sitekey })
          captchaToken = captchaResult.data || null
        } catch (captchaErr: unknown) {
          const errMsg = captchaErr instanceof Error ? captchaErr.message : String(captchaErr)
          const errCode = (captchaErr as Record<string, unknown>)?.err as string || ''
          console.error('[CEJ] hCaptcha solving failed:', errCode || errMsg)
          if (errCode === 'ERROR_METHOD_CALL' || errMsg.includes('ERROR_METHOD_CALL')) {
            await browser.close()
            browser = null
            return {
              ...baseResult, portalDown: true,
              error: 'Portal CEJ protegido por Radware hCaptcha. La cuenta de 2captcha no tiene soporte de hCaptcha habilitado. Verifica la configuración en tu panel de 2captcha.com o contacta su soporte.'
            }
          }
        }

        if (captchaToken) {
          await page.evaluate((token: string) => {
            document.querySelectorAll('textarea[name="h-captcha-response"]').forEach(ta => {
              (ta as HTMLTextAreaElement).value = token
            })
            const win = window as unknown as Record<string, unknown>
            if (typeof win['ocs'] === 'function') (win['ocs'] as () => void)()
          }, captchaToken)

          // Wait for redirect back to CEJ
          await page.waitForNavigation({ waitUntil: 'load', timeout: 30000 }).catch(() => {})
          console.log('[CEJ] Radware hCaptcha solved, now at:', page.url())
          baseResult.captchaSolved = true
        } else {
          await browser.close()
          browser = null
          if (attempt < 3) {
            await new Promise(r => setTimeout(r, 8000))
            continue
          }
          return { ...baseResult, portalDown: true, error: 'No se pudo resolver el hCaptcha de Radware Bot Manager.' }
        }
      }

      // Wait for search form
      await page.waitForSelector(
        'input[name*="expediente"], input[id*="expediente"], #numeroCausa, #codigoExpediente',
        { timeout: 15000 }
      )

      // Fill expediente field
      const inputExpediente = await page.$(
        'input[name*="expediente"], input[id*="expediente"], #numeroCausa, #codigoExpediente'
      )

      if (inputExpediente) {
        await inputExpediente.click()
        await inputExpediente.fill(numeroExpediente)
        console.log('[CEJ] Filled expediente:', numeroExpediente)
      } else {
        // Try separate fields — format: "00847-2023-0-1801-JR-CI-12"
        const parts = numeroExpediente.split('-')
        if (parts.length >= 4) {
          await page.fill('#nroExpediente, [name="numero"]', parts[0] || '').catch(() => {})
          await page.fill('#anioExpediente, [name="anio"]', parts[1] || '').catch(() => {})
          await page.fill('#codDistrito, [name="distrito"]', parts[3] || '').catch(() => {})
        }
      }

      await page.waitForTimeout(800 + Math.floor(Math.random() * 400))

      // Check captcha before submit
      const hasCaptcha = await page.$('img[src*="captcha"], .g-recaptcha, #captchaImage, [data-sitekey]')
      if (hasCaptcha) {
        baseResult.captchaDetected = true
        console.log('[CEJ] Captcha detected before submit')
        const solved = await solveCaptchaIfPresent(page, solver)
        baseResult.captchaSolved = solved
        if (!solved) {
          console.log('[CEJ] Could not solve captcha')
          await browser.close()
          browser = null
          if (attempt < 3) {
            await new Promise(r => setTimeout(r, 8000))
            continue
          }
          return { ...baseResult, portalDown: true, error: 'Captcha no resuelto' }
        }
      }

      // Submit search
      await page.click(
        'button[type="submit"], input[type="submit"], #btnBuscar, button:has-text("Buscar"), button:has-text("Consultar")'
      )

      await page.waitForTimeout(2000)

      // Check captcha after submit
      const hasCaptchaAfter = await page.$('img[src*="captcha"], .g-recaptcha, #captchaImage')
      if (hasCaptchaAfter) {
        baseResult.captchaDetected = true
        const solved = await solveCaptchaIfPresent(page, solver)
        baseResult.captchaSolved = solved
        if (solved) {
          await page.click('button[type="submit"], input[type="submit"], #btnBuscar').catch(() => {})
          await page.waitForTimeout(2000)
        }
      }

      // Wait for results
      await page.waitForSelector(
        'table tr:nth-child(2), .actuacion, #divResultados, .resultado',
        { timeout: 20000 }
      ).catch(() => console.log('[CEJ] Results may be empty or different format'))

      // Check no-results messages
      const noResults = await page.evaluate(() => {
        const body = document.body.textContent || ''
        return body.includes('No se encontraron') ||
          body.includes('no existe') ||
          body.includes('Sin resultados')
      }).catch(() => false)

      if (noResults) {
        console.log('[CEJ] No results found for expediente')
        await browser.close()
        return { ...baseResult, error: 'Expediente no encontrado en el CEJ' }
      }

      // Parse case header
      const headerData = await parseCaseHeader(page)

      // Parse actuaciones
      const actuaciones = await parseActuaciones(page)
      console.log(`[CEJ] Found ${actuaciones.length} actuaciones`)

      // Paginate if needed (max 20 pages)
      let hasNext = await page.$('a:has-text("Siguiente"), .siguiente, [title="Siguiente"]')
      let pageNum = 2
      while (hasNext && pageNum <= 20) {
        await page.click('a:has-text("Siguiente"), .siguiente, [title="Siguiente"]').catch(() => {})
        await page.waitForTimeout(1500)
        const more = await parseActuaciones(page)
        if (more.length === 0) break
        actuaciones.push(...more)
        pageNum++
        hasNext = await page.$('a:has-text("Siguiente"), .siguiente')
      }

      const hashInput = actuaciones
        .slice(0, 5)
        .map(a => `${a.fecha}|${a.acto}|${a.sumilla}`)
        .join(';')
      const hash = crypto.createHash('md5').update(hashInput || numeroExpediente).digest('hex')

      await browser.close()

      return {
        ...baseResult,
        ...headerData,
        actuaciones,
        totalActuaciones: actuaciones.length,
        hash,
        portalDown: false
      }

    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error(`[CEJ] Attempt ${attempt} failed:`, msg)
      if (browser) {
        await browser.close().catch(() => {})
        browser = null
      }
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 6000 * attempt))
      }
    }
  }

  return {
    ...baseResult,
    portalDown: true,
    error: 'Portal CEJ no disponible después de 3 intentos'
  }
}
