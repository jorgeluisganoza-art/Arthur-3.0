import { chromium } from 'playwright-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { Solver } from '2captcha-ts'
import { CapSolver, HCaptchaTaskProxyLess } from '@captcha-libs/capsolver'
import type { Browser, Page } from 'playwright'
import crypto from 'crypto'

chromium.use(StealthPlugin())

const CEJ_SEARCH_URL = 'https://cej.pj.gob.pe/cej/forms/busquedaform.html'
const CEJ_DETAIL_URL = 'https://cej.pj.gob.pe/cej/forms/detalleform.html'
// Read lazily so dotenv has time to load before this is captured
const getTwocaptchaKey = () => process.env.TWOCAPTCHA_API_KEY || ''

async function solveHCaptchaWithCapSolver(sitekey: string, url: string): Promise<string | null> {
  const apiKey = process.env.CAPSOLVER_API_KEY
  if (!apiKey) {
    console.error('[CEJ] CAPSOLVER_API_KEY not set')
    return null
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const solver = new (CapSolver as any)({ clientKey: apiKey })
    console.log('[CEJ] Solving hCaptcha with CapSolver...')
    const task = new HCaptchaTaskProxyLess({ websiteURL: url, websiteKey: sitekey })
    const response = await solver.solve(task)
    const token = (response as Record<string, unknown>)?.solution
      ? ((response as Record<string, unknown>).solution as Record<string, unknown>)?.gRecaptchaResponse as string | undefined
      : undefined
    if (token) {
      console.log('[CEJ] hCaptcha solved with CapSolver!')
      return token
    }
    console.error('[CEJ] CapSolver returned no solution token')
    return null
  } catch (e: unknown) {
    console.error('[CEJ] CapSolver error:', e instanceof Error ? e.message : String(e))
    return null
  }
}

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

function isRadwareBlocked(url: string, title: string): boolean {
  return url.includes('perfdrive.com') || title.toLowerCase().includes('radware')
}

function makeBrowserArgs() {
  return [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled',
  ]
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

async function parseCaseHeader(page: Page): Promise<Partial<CejCaseData>> {
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
        if (posibleRol.includes('demand') || posibleRol.includes('accion') ||
          posibleRol.includes('imput') || posibleRol.includes('agrav')) {
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

async function solveCaptchaIfPresent(page: Page, solver: Solver): Promise<boolean> {
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

      const result = await solver.imageCaptcha({ body: imgBuffer, numeric: 1, min_len: 4, max_len: 8 })
      const captchaInput = await page.$('input[name*="captcha"], input[id*="captcha"], #codigoCaptcha')
      if (captchaInput && result.data) {
        await captchaInput.fill(result.data)
        console.log('[CEJ] Image captcha solved:', result.data)
        return true
      }
    } catch (e: unknown) {
      console.error('[CEJ] Image captcha solving failed:', e instanceof Error ? e.message : String(e))
    }
    return false
  }

  const recaptcha = await page.$('.g-recaptcha, [data-sitekey]')
  if (recaptcha) {
    console.log('[CEJ] reCAPTCHA detected — solving with 2captcha...')
    try {
      const sitekey = await recaptcha.getAttribute('data-sitekey')
      if (!sitekey) return false

      const result = await solver.recaptcha({ pageurl: CEJ_SEARCH_URL, googlekey: sitekey })
      await page.evaluate((token: string) => {
        const textarea = document.getElementById('g-recaptcha-response') as HTMLTextAreaElement | null
        if (textarea) { textarea.style.display = 'block'; textarea.value = token }
        const win = window as unknown as Record<string, unknown>
        const grecaptcha = win['grecaptcha'] as Record<string, unknown> | undefined
        const cfg = win['___grecaptcha_cfg'] as Record<string, unknown> | undefined
        if (grecaptcha && cfg) {
          const clients = cfg['clients'] as Record<string, unknown> | undefined
          if (clients) {
            const keys = Object.keys(clients)
            if (keys.length > 0) {
              const client = clients[keys[0]] as Record<string, unknown> | undefined
              const callback = (client?.['U'] as Record<string, unknown> | undefined)?.['U']
              if (typeof callback === 'function') (callback as (t: string) => void)(token)
            }
          }
        }
      }, result.data)
      console.log('[CEJ] reCAPTCHA solved')
      return true
    } catch (e: unknown) {
      console.error('[CEJ] reCAPTCHA solving failed:', e instanceof Error ? e.message : String(e))
    }
    return false
  }

  return false
}

// Solve and fill the image captcha on the current page.
// Returns true if solved and filled, false/null if no captcha found.
async function solveImageCaptcha(page: Page, solver: Solver, baseResult: CejCaseData): Promise<boolean> {
  const captchaImgEl = await page.$('img[src*="Captcha"], img[src*="captcha"], img[id*="captcha"], #captchaImg')
  if (!captchaImgEl) return false

  baseResult.captchaDetected = true
  console.log('[CEJ] Image captcha detected — solving with 2captcha...')
  try {
    const imgSrc = await captchaImgEl.getAttribute('src') || ''
    const absoluteSrc = await page.evaluate((src: string) => {
      if (src.startsWith('http')) return src
      const a = document.createElement('a'); a.href = src; return a.href
    }, imgSrc)
    console.log('[CEJ] Captcha image URL:', absoluteSrc)

    const imgBase64 = await page.evaluate(async (src: string) => {
      const resp = await fetch(src, { credentials: 'include', cache: 'no-store' })
      if (!resp.ok) return ''
      const blob = await resp.blob()
      return new Promise<string>((res) => {
        const reader = new FileReader()
        reader.onload = () => res((reader.result as string).split(',')[1])
        reader.readAsDataURL(blob)
      })
    }, absoluteSrc)

    if (!imgBase64) { console.error('[CEJ] Failed to fetch captcha image'); return false }
    console.log('[CEJ] Captcha image fetched, base64 length:', imgBase64.length)

    const captchaResult = await solver.imageCaptcha({ body: imgBase64, numeric: 0, min_len: 4, max_len: 8 })
    const captchaCode = captchaResult.data || ''
    console.log('[CEJ] Image captcha solved:', captchaCode)

    const captchaInput = await page.$('#codigoCaptcha, input[name*="captcha"], input[id*="captcha"]')
    if (captchaInput && captchaCode) {
      await captchaInput.click()
      await captchaInput.fill(captchaCode)
      baseResult.captchaSolved = true
      return true
    }
  } catch (e: unknown) {
    console.error('[CEJ] Image captcha solving failed:', e instanceof Error ? e.message : String(e))
  }
  return false
}

// Collect, paginate, and return actuaciones + header from a results page.
async function scrapeResultsPage(page: Page, baseResult: CejCaseData, numeroExpediente: string): Promise<CejCaseData | null> {
  const currentUrl = page.url()
  console.log('[CEJ] scrapeResultsPage — URL:', currentUrl.substring(0, 80))

  // If we're still on busquedaform.html the POST was rejected client-side
  if (currentUrl.includes('busquedaform.html')) {
    console.log('[CEJ] Still on busquedaform — submission blocked')
    return null
  }

  // On busquedacodform.html: wait for Angular/AJAX to render results.
  // The page may include the search form in its header, but the RESULTS area
  // is different. Wait up to 15s for any result content.
  await page.waitForSelector(
    'table tr:nth-child(2), .actuacion, #divResultados, .resultado, .alert, .mensaje, #listaExpedientes, .expediente',
    { timeout: 15000 }
  ).catch(() => console.log('[CEJ] Results selector timed out'))

  // Dump visible page text for diagnosis
  const snippets = await page.$$eval(
    'body *:not(script):not(style)',
    els => els
      .filter(el => (el as HTMLElement).offsetParent !== null && el.children.length === 0)
      .map(el => el.textContent?.trim() || '')
      .filter(t => t.length > 2)
      .slice(0, 30)
  ).catch(() => [] as string[])
  console.log('[CEJ] Page text sample:', snippets.slice(0, 10).join(' | ').substring(0, 300))

  const noResults = await page.evaluate(() => {
    const body = document.body.textContent || ''
    return body.includes('No se encontraron') || body.includes('no existe') || body.includes('Sin resultados')
  }).catch(() => false)

  if (noResults) {
    console.log('[CEJ] No results found for expediente')
    return { ...baseResult, error: 'Expediente no encontrado en el CEJ' }
  }

  const headerData = await parseCaseHeader(page)
  const actuaciones = await parseActuaciones(page)
  console.log(`[CEJ] Found ${actuaciones.length} actuaciones`)

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

  const hashInput = actuaciones.slice(0, 5).map(a => `${a.fecha}|${a.acto}|${a.sumilla}`).join(';')
  const hash = crypto.createHash('md5').update(hashInput || numeroExpediente).digest('hex')

  return { ...baseResult, ...headerData, actuaciones, totalActuaciones: actuaciones.length, hash, portalDown: false }
}

// Fill form and scrape results from a page that already loaded CEJ successfully.
// Returns scraped data, or null if the page shows no results / wrong structure.
//
// CEJ has two search tabs on busquedaform.html:
//   Tab 1 "Por filtros"   — #distritoJudicial, #organoJurisdiccional, #especialidad, #anio, #parte (required), #numeroExpediente
//   Tab 2 "Por Código"    — hidden text inputs: cod_expediente, cod_anio, cod_incidente, cod_distprov,
//                           cod_instancia, cod_especialidad, cod_organo
//
// CEJ expediente formats:
//   Old: AAAA-NNNNN-0-DDDD-EE-TT-JJJ  e.g. "2001-33088-0-1801-JR-CI-030"
//   New: NNNNN-AAAA-0-DDDD-EE-TT-JJJ  e.g. "02001-2023-0-1801-JR-CI-030"
async function fillAndScrape(
  page: Page,
  numeroExpediente: string,
  solver: Solver,
  baseResult: CejCaseData
): Promise<CejCaseData | null> {
  const parts = numeroExpediente.split('-')
  const firstNum = parseInt(parts[0] || '0', 10)
  const isOldFormat = firstNum >= 1990 && firstNum <= 2030
  const anio    = isOldFormat ? parts[0] || '' : parts[1] || ''
  const nroExp  = isOldFormat ? parts[1] || '' : parts[0] || ''
  const inc     = parts[2] || '0'
  const dist    = parts[3] || ''
  const instCod = parts[4] || ''
  const espCod  = parts[5] || ''
  const orgCod  = parts[6] || ''

  await page.waitForSelector('#consultarExpedientes', { timeout: 15000, state: 'attached' })
  await page.waitForTimeout(1000)

  // ── Strategy 1: Tab 2 "Por Código de Expediente" ────────────────────────
  // Tab 2 has its own <form id="busquedaPorCodigo" action="busquedacodform.html">.
  // It does NOT require captcha or #parte — only the 7 expediente code components.
  //
  // Field mapping (from Tab 2 Angular component HTML):
  //   cod_expediente  = 5-digit sequential number (parts[1] old / parts[0] new)
  //   cod_anio        = 4-digit year
  //   cod_incidente   = 1-4 digit incidente (usually 0)
  //   cod_distprov    = 4-digit district UBIGEO code (e.g. 1801)
  //   cod_organo      = 2-char instancia abbreviation (e.g. "JR")  ← NOT the 3-digit number
  //   cod_especialidad= 2-char especialidad (e.g. "CI")
  //   cod_instancia   = 2-digit court number (e.g. "30" from "030")← NOT the abbreviation
  //
  // IMPORTANT: use form.submit() (not button click) to bypass JS validation guards.
  console.log('[CEJ] Trying Tab 2 (Por Código)...')
  try {
    // Switch to Tab 2 so cod_* inputs become visible
    await page.click('a[href="#tabs-2"], a:has-text("Por Código")').catch(() => {})
    await page.waitForTimeout(500)

    // orgCod from expediente is zero-padded (e.g. "030"), strip leading zeros for cod_instancia
    const courtNum = orgCod.replace(/^0+/, '') || orgCod  // "030" → "30"

    await page.evaluate((args: Record<string, string>) => {
      for (const [id, val] of Object.entries(args)) {
        const el = document.getElementById(id) as HTMLInputElement | null
        if (el) {
          el.value = val
          el.dispatchEvent(new Event('input', { bubbles: true }))
          el.dispatchEvent(new Event('change', { bubbles: true }))
        }
      }
    }, {
      cod_expediente:   nroExp,
      cod_anio:         anio,
      cod_incidente:    inc,
      cod_distprov:     dist,
      cod_organo:       instCod,   // "JR" — instancia type abbreviation
      cod_especialidad: espCod,    // "CI" — especialidad abbreviation
      cod_instancia:    courtNum,  // "30" — court number (sans leading zeros)
    })

    console.log('[CEJ] Tab2 fields: exp=%s anio=%s dist=%s organo=%s esp=%s inst=%s',
      nroExp, anio, dist, instCod, espCod, courtNum)
    await page.waitForTimeout(300)

    // Solve captcha (it lives outside busquedaPorCodigo form, so we inject it)
    const captchaCode = await (async () => {
      const imgEl = await page.$('img[src*="Captcha"], img[src*="captcha"]')
      if (!imgEl) return ''
      baseResult.captchaDetected = true
      try {
        const imgSrc = await imgEl.getAttribute('src') || ''
        const absoluteSrc = await page.evaluate((s: string) => {
          if (s.startsWith('http')) return s
          const a = document.createElement('a'); a.href = s; return a.href
        }, imgSrc)
        const b64 = await page.evaluate(async (src: string) => {
          const r = await fetch(src, { credentials: 'include', cache: 'no-store' })
          if (!r.ok) return ''
          const blob = await r.blob()
          return new Promise<string>(res => {
            const reader = new FileReader()
            reader.onload = () => res((reader.result as string).split(',')[1])
            reader.readAsDataURL(blob)
          })
        }, absoluteSrc)
        if (!b64) return ''
        const solved = await solver.imageCaptcha({ body: b64, numeric: 0, min_len: 4, max_len: 8 })
        return solved.data || ''
      } catch { return '' }
    })()
    if (captchaCode) {
      console.log('[CEJ] Tab2 captcha solved:', captchaCode)
      baseResult.captchaSolved = true
    }

    // Submit: inject captcha as hidden field inside the form (captcha lives outside the form),
    // then call form.submit() to bypass JS click handlers
    const navPromise = page.waitForNavigation({ waitUntil: 'load', timeout: 30000 }).catch(() => null)
    await page.evaluate((code: string) => {
      const form = document.getElementById('busquedaPorCodigo') as HTMLFormElement | null
      if (!form) return
      if (code) {
        const hidden = document.createElement('input')
        hidden.type = 'hidden'; hidden.name = 'codigoCaptcha'; hidden.value = code
        form.appendChild(hidden)
      }
      form.submit()
    }, captchaCode)
    await navPromise
    await page.waitForTimeout(4000)  // wait for Angular to render results

    console.log('[CEJ] Tab2 navigated to:', page.url())

    const result = await scrapeResultsPage(page, { ...baseResult }, numeroExpediente)
    if (result && (result.actuaciones.length > 0 || result.error)) {
      console.log('[CEJ] Tab 2 succeeded')
      return result
    }
    console.log('[CEJ] Tab 2 returned no results — trying Tab 1')
  } catch (e: unknown) {
    console.log('[CEJ] Tab 2 error:', e instanceof Error ? e.message : String(e))
  }

  // ── Strategy 2: Tab 1 "Por filtros" ─────────────────────────────────────
  // Requires: district + organoJurisdiccional (instancia) + especialidad + año + expediente.
  // The #parte field (party name) is required by MINJUSDH but we try without it first.
  console.log('[CEJ] Trying Tab 1 (Por filtros)...')
  try {
    // Switch back to Tab 1
    await page.click('a[href="#tabs-1"], a:has-text("Por filtros")').catch(() => {})
    await page.waitForTimeout(300)

    // Map expediente district code → dropdown text label
    const DIST_NAME: Record<string, string> = {
      '1801': 'LIMA', '0701': 'CALLAO', '1802': 'LIMA ESTE', '1803': 'LIMA NORTE',
      '1804': 'LIMA SUR', '1805': 'VENTANILLA', '0201': 'AMAZONAS', '0301': 'ANCASH',
      '0401': 'APURIMAC', '0501': 'AREQUIPA', '0601': 'CAJAMARCA', '0802': 'CUSCO',
      '1001': 'HUANCAVELICA', '1101': 'HUANUCO', '1201': 'ICA', '1301': 'JUNIN',
      '1401': 'LA LIBERTAD', '1501': 'LAMBAYEQUE', '1601': 'LORETO',
      '1701': 'MADRE DE DIOS', '1901': 'MOQUEGUA', '2001': 'PASCO',
      '2101': 'PIURA', '2102': 'SULLANA', '2201': 'PUNO',
      '2301': 'SAN MARTIN', '2401': 'TACNA', '2501': 'TUMBES', '2601': 'UCAYALI',
    }
    const distName = DIST_NAME[dist] || null

    // Map expediente instancia code → partial text for dropdown match
    const INST_NAME: Record<string, string> = {
      'JR': 'ESPECIALIZADO', 'JP': 'PAZ LETRADO', 'MX': 'MIXTO',
      'SA': 'SALA SUPERIOR', 'ST': 'SALA SUPERIOR', 'SC': 'SALA SUPERIOR',
      'SP': 'SALA SUPERIOR', 'SL': 'SALA SUPERIOR', 'CS': 'SALA SUPREMA',
    }
    // Map expediente especialidad code → partial text for dropdown match
    const ESP_NAME: Record<string, string> = {
      'CI': 'CIVIL', 'PE': 'PENAL', 'LA': 'LABORAL', 'FA': 'FAMILIA',
      'CO': 'COMERCIAL', 'CA': 'CONSTITUCIONAL', 'AD': 'CONTENCIOSO',
      'CT': 'CONTENCIOSO', 'NI': 'NIÑO', 'LC': 'LIQUIDACION',
    }

    // Select district
    if (dist) {
      await page.evaluate((args: { name: string | null; code: string }) => {
        const sel = document.querySelector('#distritoJudicial') as HTMLSelectElement | null
        if (!sel) return
        const opt = args.name
          ? Array.from(sel.options).find(o => o.text.trim().toUpperCase().includes(args.name!.toUpperCase()))
          : Array.from(sel.options).find(o => o.text.includes(args.code))
        if (opt) { sel.value = opt.value; sel.dispatchEvent(new Event('change', { bubbles: true })) }
      }, { name: distName, code: dist }).catch(() => {})
      // Wait for #organoJurisdiccional to populate
      await page.waitForFunction(() => {
        const sel = document.querySelector('#organoJurisdiccional') as HTMLSelectElement | null
        return sel && sel.options.length > 1
      }, { timeout: 5000 }).catch(() => {})
      await page.waitForTimeout(300)
    }

    // Select instancia (#organoJurisdiccional)
    if (instCod) {
      const instText = INST_NAME[instCod.toUpperCase()] || null
      await page.evaluate((keyword: string | null) => {
        const sel = document.querySelector('#organoJurisdiccional') as HTMLSelectElement | null
        if (!sel || sel.options.length < 2) return
        const opt = keyword
          ? Array.from(sel.options).find(o => o.text.toUpperCase().includes(keyword.toUpperCase()))
          : sel.options[1]
        if (opt) { sel.value = opt.value; sel.dispatchEvent(new Event('change', { bubbles: true })) }
      }, instText).catch(() => {})
      // Wait for #especialidad to populate
      await page.waitForFunction(() => {
        const sel = document.querySelector('#especialidad') as HTMLSelectElement | null
        return sel && sel.options.length > 1
      }, { timeout: 5000 }).catch(() => {})
      await page.waitForTimeout(300)
    }

    // Select especialidad
    if (espCod) {
      const espText = ESP_NAME[espCod.toUpperCase()] || null
      await page.evaluate((keyword: string | null) => {
        const sel = document.querySelector('#especialidad') as HTMLSelectElement | null
        if (!sel || sel.options.length < 2) return
        const opt = keyword
          ? Array.from(sel.options).find(o => o.text.toUpperCase().includes(keyword.toUpperCase()))
          : sel.options[1]
        if (opt) { sel.value = opt.value; sel.dispatchEvent(new Event('change', { bubbles: true })) }
      }, espText).catch(() => {})
      await page.waitForTimeout(300)
    }

    // Select year
    if (anio) {
      await page.evaluate((y: string) => {
        const sel = document.querySelector('#anio') as HTMLSelectElement | null
        if (!sel) return
        const opt = Array.from(sel.options).find(o => o.value === y || o.text === y)
        if (opt) { sel.value = opt.value; sel.dispatchEvent(new Event('change', { bubbles: true })) }
      }, anio).catch(() => {})
      await page.waitForTimeout(200)
    }

    // Fill expediente number
    const numInput = await page.$('#numeroExpediente')
    if (numInput) { await numInput.click(); await numInput.fill(numeroExpediente) }

    console.log('[CEJ] Tab1 form filled: dist=%s inst=%s esp=%s anio=%s', dist, instCod, espCod, anio)
    await page.waitForTimeout(600)

    // Solve image captcha
    await solveImageCaptcha(page, solver, baseResult)

    // Submit
    await page.click('#consultarExpedientes')
    await page.waitForTimeout(3000)

    const result = await scrapeResultsPage(page, { ...baseResult }, numeroExpediente)
    if (result) {
      console.log('[CEJ] Tab 1 result — actuaciones:', result.actuaciones.length)
      return result
    }
  } catch (e: unknown) {
    console.log('[CEJ] Tab 1 error:', e instanceof Error ? e.message : String(e))
  }

  return null
}

// Attempt to reach CEJ without solving any captcha.
//
// Strategy:
//   1. Navigate to the search URL — Radware may block it but will set cookies in the context.
//   2. Try the detail URL in the SAME context — cookies carry over and may bypass the challenge.
//   3. If detail URL loads without Radware, navigate BACK to the search URL in that context;
//      the established session often lets it through now.
//   4. If still blocked, return null → fall back to captcha-solving flow.
//
// Returns scraped data if successful, null otherwise.
async function tryDirectAccess(
  numeroExpediente: string,
  solver: Solver,
  baseResult: CejCaseData
): Promise<CejCaseData | null> {
  let browser: Browser | null = null
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROME_EXECUTABLE_PATH || undefined,
      args: makeBrowserArgs(),
    }) as unknown as Browser

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      locale: 'es-PE',
    })

    // ── Step A: try the search URL directly ───────────────────────────────
    console.log(`[CEJ] Direct access attempt: ${CEJ_SEARCH_URL}`)
    const page = await context.newPage()
    await page.goto(CEJ_SEARCH_URL, { waitUntil: 'load', timeout: 30000 })
    await page.waitForTimeout(3000)

    let currentUrl = page.url()
    let title = await page.title()
    console.log(`[CEJ] After 3s — url: ${currentUrl.substring(0, 80)}  title: ${title}`)

    if (!isRadwareBlocked(currentUrl, title)) {
      // Lucky — search page loaded directly
      console.log('[CEJ] Search URL loaded without Radware — proceeding')
      const result = await fillAndScrape(page, numeroExpediente, solver, { ...baseResult }).catch((err: unknown) => {
        console.log('[CEJ] fillAndScrape error:', err instanceof Error ? err.message : String(err))
        return null
      })
      await browser.close()
      return result
    }

    console.log('[CEJ] Search URL blocked — Radware cookies should now be set in context')

    // ── Step B: visit the detail URL in same context (cookies carry over) ──
    console.log(`[CEJ] Trying detail URL in same context: ${CEJ_DETAIL_URL}`)
    await page.goto(CEJ_DETAIL_URL, { waitUntil: 'load', timeout: 30000 })
    await page.waitForTimeout(3000)

    currentUrl = page.url()
    title = await page.title()
    console.log(`[CEJ] Detail URL — url: ${currentUrl.substring(0, 80)}  title: ${title}`)

    if (isRadwareBlocked(currentUrl, title)) {
      console.log('[CEJ] Detail URL also blocked')
      await browser.close()
      return null
    }

    // ── Step C: detail URL bypassed Radware — retry search URL with cookies ─
    console.log('[CEJ] Detail URL passed — retrying search URL with established session')
    await page.goto(CEJ_SEARCH_URL, { waitUntil: 'load', timeout: 30000 })
    await page.waitForTimeout(3000)

    currentUrl = page.url()
    title = await page.title()
    console.log(`[CEJ] Search URL (retry) — url: ${currentUrl.substring(0, 80)}  title: ${title}`)

    if (isRadwareBlocked(currentUrl, title)) {
      console.log('[CEJ] Search URL still blocked after session warm-up')
      await browser.close()
      return null
    }

    console.log('[CEJ] Search URL accessible after session warm-up — proceeding to scrape')
    const result = await fillAndScrape(page, numeroExpediente, solver, { ...baseResult }).catch((err: unknown) => {
      console.log('[CEJ] fillAndScrape error:', err instanceof Error ? err.message : String(err))
      return null
    })
    await browser.close()
    return result

  } catch (err: unknown) {
    console.log('[CEJ] Direct access failed:', err instanceof Error ? err.message : String(err))
    if (browser) await browser.close().catch(() => {})
    return null
  }
}

export async function scrapeCEJ(numeroExpediente: string): Promise<CejCaseData> {
  const MAX_RETRIES = process.env.NODE_ENV === 'test' ? 1 : 3
  const GLOBAL_TIMEOUT = 60000

  async function _scrape(): Promise<CejCaseData> {
    return _scrapeCEJ(numeroExpediente, MAX_RETRIES)
  }

  try {
    const result = await Promise.race([
      _scrape(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Global timeout 60s')), GLOBAL_TIMEOUT)
      ),
    ])
    return result
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[CEJ] scrapeCEJ aborted:', msg)
    return {
      numeroExpediente,
      organoJurisdiccional: '', distritoJudicial: '', juez: '',
      especialidad: '', proceso: '', etapa: '', estadoProceso: '',
      partes: [], actuaciones: [], totalActuaciones: 0, hash: '',
      portalDown: true, captchaDetected: false, captchaSolved: false,
      scrapedAt: new Date().toISOString(),
      error: msg,
    }
  }
}

async function _scrapeCEJ(numeroExpediente: string, maxRetries: number): Promise<CejCaseData> {
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

  const TWOCAPTCHA_KEY = getTwocaptchaKey()
  const solver = new Solver(TWOCAPTCHA_KEY)

  // ── Step 1: try without captcha solving ──────────────────────────────────
  console.log('[CEJ] Trying direct access (no captcha)...')
  const directResult = await tryDirectAccess(numeroExpediente, solver, { ...baseResult })
  if (directResult) {
    console.log('[CEJ] Direct access succeeded!')
    return directResult
  }
  console.log('[CEJ] Direct access blocked — falling back to captcha-solving flow')

  // ── Step 2: captcha-solving loop ─────────────────────────────────────────
  let browser: Browser | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[CEJ] Captcha attempt ${attempt}/${maxRetries} — ${numeroExpediente}`)

      browser = await chromium.launch({
        headless: true,
        executablePath: process.env.CHROME_EXECUTABLE_PATH || undefined,
        args: makeBrowserArgs(),
      }) as unknown as Browser

      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 800 },
        locale: 'es-PE',
      })

      const page = await context.newPage()

      console.log('[CEJ] Navigating to portal...')
      await page.goto(CEJ_SEARCH_URL, { waitUntil: 'load', timeout: 30000 })

      // Handle Radware Bot Manager hCaptcha challenge
      if (isRadwareBlocked(page.url(), await page.title())) {
        console.log('[CEJ] Radware Bot Manager detected — solving hCaptcha...')
        baseResult.captchaDetected = true

        const sitekey = await page.evaluate(() => {
          const direct = document.querySelector('[data-sitekey]')
          if (direct) return direct.getAttribute('data-sitekey') || ''
          const iframe = document.querySelector('iframe[src*="hcaptcha"][src*="sitekey"]')
          if (iframe) {
            const src = iframe.getAttribute('src') || ''
            const m = src.match(/sitekey=([a-f0-9-]+)/)
            return m ? m[1] : ''
          }
          return ''
        }).catch(() => '')

        console.log('[CEJ] Radware sitekey:', sitekey || '(none)')

        if (!sitekey) {
          await browser.close(); browser = null
          if (attempt < maxRetries) { await new Promise(r => setTimeout(r, 8000)); continue }
          return { ...baseResult, portalDown: true, error: 'Portal CEJ protegido por Radware Bot Manager. No se pudo extraer el sitekey del captcha.' }
        }

        // Try CapSolver first (with 30s timeout), fall back to 2captcha
        let captchaToken: string | null = await Promise.race([
          solveHCaptchaWithCapSolver(sitekey, page.url()),
          new Promise<null>((_, reject) => setTimeout(() => reject(new Error('CapSolver timeout 30s')), 30000)),
        ]).catch((e: unknown) => {
          console.error('[CEJ] CapSolver timed out:', e instanceof Error ? e.message : String(e))
          return null
        })

        if (!captchaToken && TWOCAPTCHA_KEY) {
          console.log('[CEJ] CapSolver failed — trying 2captcha hCaptcha...')
          try {
            const captchaResult = await solver.hcaptcha({ pageurl: page.url(), sitekey })
            captchaToken = captchaResult.data || null
          } catch (captchaErr: unknown) {
            const errCode = (captchaErr as Record<string, unknown>)?.err as string || ''
            const errMsg = captchaErr instanceof Error ? captchaErr.message : String(captchaErr)
            console.error('[CEJ] 2captcha hCaptcha also failed:', errCode || errMsg)
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

          await page.waitForNavigation({ waitUntil: 'load', timeout: 30000 }).catch(() => {})
          console.log('[CEJ] Radware hCaptcha solved, now at:', page.url())
          baseResult.captchaSolved = true
        } else {
          await browser.close(); browser = null
          if (attempt < maxRetries) { await new Promise(r => setTimeout(r, 8000)); continue }
          return { ...baseResult, portalDown: true, error: 'No se pudo resolver el hCaptcha de Radware Bot Manager (CapSolver y 2captcha fallaron).' }
        }
      }

      // Past the wall — fill form and scrape
      const result = await fillAndScrape(page, numeroExpediente, solver, baseResult)
      await browser.close()

      if (result) return result

      // fillAndScrape returned null (captcha unsolvable mid-flow)
      if (attempt < maxRetries) await new Promise(r => setTimeout(r, 6000 * attempt))

    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error(`[CEJ] Captcha attempt ${attempt} failed:`, msg)
      if (browser) { await browser.close().catch(() => {}); browser = null }
      if (attempt < maxRetries) await new Promise(r => setTimeout(r, 6000 * attempt))
    }
  }

  return { ...baseResult, portalDown: true, error: 'Portal CEJ no disponible después de 3 intentos' }
}
