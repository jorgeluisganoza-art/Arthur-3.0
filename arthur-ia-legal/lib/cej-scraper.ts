import axios from 'axios'
import * as cheerio from 'cheerio'
import crypto from 'crypto'

const CEJ_BASE = 'https://cej.pj.gob.pe/cej/forms/'
const CEJ_SEARCH = 'https://cej.pj.gob.pe/cej/forms/busquedaform.html'

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'es-PE,es;q=0.9',
  'Referer': 'https://cej.pj.gob.pe/',
}

export interface CejMovimiento {
  fecha: string
  acto: string
  folio: string
  sumilla: string
}

export interface CejResult {
  movimientos: CejMovimiento[]
  totalMovimientos: number
  ultimoMovimiento: CejMovimiento | null
  etapaProcesal: string
  juez: string
  hash: string
  portalDown: boolean
  scrapedAt: string
}

export async function scrapeCEJ(
  numeroExpediente: string
): Promise<CejResult> {
  const MAX_RETRIES = 3

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[CEJ] Attempt ${attempt} — ${numeroExpediente}`)

      const result = await attemptScrapeCEJ(numeroExpediente)
      if (result) return result

      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 5000 * attempt))
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error(`[CEJ] Attempt ${attempt} error:`, msg)
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 5000 * attempt))
      }
    }
  }

  return {
    movimientos: [],
    totalMovimientos: 0,
    ultimoMovimiento: null,
    etapaProcesal: '',
    juez: '',
    hash: '',
    portalDown: true,
    scrapedAt: new Date().toISOString()
  }
}

async function attemptScrapeCEJ(
  numeroExpediente: string
): Promise<CejResult | null> {
  const getResp = await axios.get(CEJ_SEARCH, {
    headers: HEADERS,
    timeout: 20000
  })

  const $ = cheerio.load(getResp.data)

  const hiddenFields: Record<string, string> = {}
  $('input[type="hidden"]').each((_, el) => {
    const name = $(el).attr('name')
    const value = $(el).attr('value') || ''
    if (name) hiddenFields[name] = value
  })

  await new Promise(r => setTimeout(r, 1000 + Math.random() * 500))

  const formData = new URLSearchParams({
    ...hiddenFields,
    codigoExpediente: numeroExpediente,
    buscarPor: 'expediente',
  })

  const postResp = await axios.post(CEJ_SEARCH, formData.toString(), {
    headers: {
      ...HEADERS,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Origin': 'https://cej.pj.gob.pe',
      'Referer': CEJ_SEARCH,
    },
    timeout: 25000,
    maxRedirects: 5
  })

  const html = postResp.data as string
  if (!html || html.length < 200) return null

  return parseCEJResult(html, numeroExpediente)
}

function parseCEJResult(html: string, expediente: string): CejResult {
  const $ = cheerio.load(html)

  const movimientos: CejMovimiento[] = []
  let etapaProcesal = ''
  let juez = ''

  $('table tr, .expediente-data tr').each((_, row) => {
    const cells = $(row).find('td')
    if (cells.length >= 2) {
      const label = $(cells[0]).text().trim().toLowerCase()
      const value = $(cells[1]).text().trim()
      if (label.includes('juez') || label.includes('magistrado')) juez = value
      if (label.includes('etapa') || label.includes('estado')) etapaProcesal = value
    }
  })

  $('table').each((_, table) => {
    const headers = $(table).find('th').map((__, th) =>
      $(th).text().trim().toLowerCase()
    ).get()

    const hasFecha = headers.some(h => h.includes('fecha'))
    const hasActo = headers.some(h => h.includes('acto') || h.includes('tipo'))

    if (hasFecha && hasActo) {
      $(table).find('tbody tr, tr').each((__, row) => {
        const cells = $(row).find('td')
        if (cells.length >= 2) {
          const mov: CejMovimiento = {
            fecha: $(cells[0]).text().trim(),
            acto: $(cells[1]).text().trim(),
            folio: cells.length > 2 ? $(cells[2]).text().trim() : '',
            sumilla: cells.length > 3 ? $(cells[3]).text().trim() :
              $(cells[cells.length - 1]).text().trim()
          }
          if (mov.fecha && mov.acto) movimientos.push(mov)
        }
      })
    }
  })

  const ultimoMovimiento = movimientos.length > 0 ? movimientos[0] : null
  const hashInput = movimientos
    .slice(0, 5)
    .map(m => `${m.fecha}|${m.acto}|${m.sumilla}`)
    .join(';')
  const hash = crypto.createHash('md5').update(hashInput || expediente).digest('hex')

  return {
    movimientos: movimientos.slice(0, 20),
    totalMovimientos: movimientos.length,
    ultimoMovimiento,
    etapaProcesal,
    juez,
    hash,
    portalDown: false,
    scrapedAt: new Date().toISOString()
  }
}

export { CEJ_BASE, CEJ_SEARCH }
