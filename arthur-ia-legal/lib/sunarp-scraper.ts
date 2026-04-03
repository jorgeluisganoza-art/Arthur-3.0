import axios from 'axios'
import CryptoJS from 'crypto-js'
import crypto from 'crypto'

// ── SUNARP Síguelo Plus API Configuration ──────────────────────────────────────
// The old JSF form at enlinea.sunarp.gob.pe has been replaced by an Angular SPA
// at sigueloplus.sunarp.gob.pe backed by a REST API gateway. All payloads are
// AES-encrypted and the gateway requires an IBM Client-Id header.

const API_GATEWAY = 'https://api-gateway.sunarp.gob.pe:9443/sunarp/siguelo'
const TRACKING_API = `${API_GATEWAY}/siguelo-tracking/tracking/api`
const OFICINAS_API = 'https://utilitarios-sunarp-production.apps.paas.sunarp.gob.pe/componentes/api'

const CLIENT_ID = '30a3fd982c6f85a3a70b44fa1f302488'
const ENCRYPT_KEY = 'sV2zUWiuNo@3uv8nu9ir4'

const API_HEADERS = {
  'Content-Type': 'application/json',
  'X-IBM-Client-Id': CLIENT_ID,
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Origin': 'https://sigueloplus.sunarp.gob.pe',
  'Referer': 'https://sigueloplus.sunarp.gob.pe/',
}

// ── Encryption helpers ─────────────────────────────────────────────────────────

function encryptPayload(data: Record<string, unknown>): string {
  return CryptoJS.AES.encrypt(JSON.stringify(data), ENCRYPT_KEY).toString()
}

function decryptField(ciphertext: string): string {
  const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPT_KEY)
  return bytes.toString(CryptoJS.enc.Utf8)
}

function decryptApiResponse(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(data)) {
    let decodedKey = key
    try { decodedKey = Buffer.from(key, 'base64').toString('utf8') } catch { /* keep original key */ }
    if (typeof val === 'string' && val.startsWith('U2FsdGVk')) {
      const dec = decryptField(val)
      try { result[decodedKey] = JSON.parse(dec) } catch { result[decodedKey] = dec }
    } else {
      result[decodedKey] = val
    }
  }
  return result
}

// ── Oficina mapping ────────────────────────────────────────────────────────────
// The DB stores oficina_registral as a 4-digit string "ZZOO" where ZZ=zone, OO=office.
// The API needs codigoZona and codigoOficina separately.

function parseOficina(oficina: string): { codigoZona: string; codigoOficina: string } {
  const padded = oficina.padStart(4, '0')
  return {
    codigoZona: padded.substring(0, 2),
    codigoOficina: padded.substring(2, 4),
  }
}

const TIPO_REGISTRO_MAP: Record<string, string> = {
  predio: '001',
  empresa: '002',
  vehiculo: '003',
  persona: '004',
  mandatos: '005',
}

function mapTipoRegistro(tipo: string): string {
  return TIPO_REGISTRO_MAP[tipo.toLowerCase()] || '001'
}

/** SUNARP muestra el número a 8 dígitos (p. ej. 02416207); la API a veces acepta también sin ceros a la izquierda. */
function normalizeNumeroTitulo(numero: string): string {
  const trimmed = String(numero ?? '').trim().replace(/\s/g, '')
  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return trimmed
  return digits.padStart(8, '0')
}

/** Variantes de número a probar (dedupe) para mayor compatibilidad con la API. */
function numeroTituloVariants(numero: string): string[] {
  const digits = String(numero ?? '').replace(/\D/g, '')
  if (!digits) return [String(numero ?? '').trim()]
  const padded = digits.padStart(8, '0')
  const asInt = String(parseInt(digits, 10))
  return [...new Set([padded, asInt, digits])]
}

const ALL_TIPO_REGISTRO_CODES = ['001', '002', '003', '004', '005']

// ── Status extraction from tracking events ─────────────────────────────────────

const STATUS_KEYWORDS = [
  'INSCRITO', 'OBSERVADO', 'TACHA', 'PENDIENTE',
  'LIQUIDADO', 'BLOQUEADO', 'IMPROCEDENTE', 'EN CALIFICACIÓN',
  'PRESENTADO', 'DESPACHADO',
] as const

function classifyEstado(raw: string): string {
  const upper = raw.toUpperCase().trim()
  for (const keyword of STATUS_KEYWORDS) {
    if (upper.includes(keyword)) return keyword
  }
  return raw.trim() || 'SIN DATOS'
}

// ── Result interface ───────────────────────────────────────────────────────────

export interface SunarpResult {
  estado: string
  observacion: string
  calificador: string
  hash: string
  isObservado: boolean
  isInscrito: boolean
  isTacha: boolean
  isPendiente: boolean
  portalDown: boolean
  scrapedAt: string
  rawResponse?: string
  apiEndpoint: string
  codigoRespuesta: string
}

function buildResult(
  estado: string,
  observacion: string,
  calificador: string,
  portalDown: boolean,
  apiEndpoint: string,
  codigoRespuesta: string,
  rawResponse?: string,
): SunarpResult {
  const hashInput = `${estado}|${observacion}|${calificador}`
  const hash = portalDown ? '' : crypto.createHash('md5').update(hashInput).digest('hex')

  return {
    estado,
    observacion,
    calificador,
    hash,
    isObservado: estado === 'OBSERVADO',
    isInscrito: estado === 'INSCRITO',
    isTacha: estado === 'TACHA',
    isPendiente: estado === 'PENDIENTE' || estado === 'EN CALIFICACIÓN',
    portalDown,
    scrapedAt: new Date().toISOString(),
    rawResponse: rawResponse?.substring(0, 8000),
    apiEndpoint,
    codigoRespuesta,
  }
}

// ── API calls ──────────────────────────────────────────────────────────────────

interface DetalleTituloResponse {
  codigoRespuesta: string
  descripcionRespuesta: string
  lstDetalleTitulo?: Array<{
    codEstadoActual?: string
    descriEstadoActual?: string
    estadoActual?: string
    codEtapa?: string
    descriEtapa?: string
    codEvento?: string
    descriEvento?: string
    fechaCreacion?: string
    calificador?: string
    descriCalificador?: string
    observacion?: string
    [key: string]: unknown
  }>
}

async function callDetalleTitulo(
  numero: string,
  anio: string,
  codigoZona: string,
  codigoOficina: string,
  tipoRegistro: string,
): Promise<{ response: DetalleTituloResponse } | null> {
  const payload = {
    anioTitulo: anio,
    numeroTitulo: numero,
    codigoZona,
    codigoOficina,
    idAreaRegistro: codigoZona + codigoOficina,
    tipoRegistro,
    ip: '0.0.0.0',
    userApp: 'sigue+',
    userCrea: 'sigue+',
    status: 'A',
  }

  const res = await axios.post(
    `${TRACKING_API}/detalleTitulo`,
    { dmFsdWU: encryptPayload(payload) },
    { headers: API_HEADERS, timeout: 20000 },
  )

  const decrypted = decryptApiResponse(res.data) as { response?: DetalleTituloResponse }
  if (!decrypted.response) return null
  return { response: decrypted.response }
}

interface ConsultaTituloResponse {
  codigoRespuesta: string
  descripcionRespuesta: string
  lstTitulo?: Array<{
    estadoActual?: string
    codEstadoActual?: string
    areaRegistral?: string
    tipoRegistro?: string
    nombrePresentante?: string
    fechaHoraPresentacion?: string
    fechaVencimiento?: string
    [key: string]: unknown
  }>
}

async function callConsultaTitulo(
  numero: string,
  anio: string,
  codigoZona: string,
  codigoOficina: string,
  turnstileToken?: string | null,
  tipoRegistro?: string,
): Promise<{ response: ConsultaTituloResponse } | null> {
  // Misma forma que Síguelo Plus (Angular): token CAPTCHA en dG9rZW4; tipoRegistro como en detalleTitulo.
  const payload: Record<string, unknown> = {
    anioTitulo: anio,
    numeroTitulo: numero,
    codigoZona,
    codigoOficina,
    idAreaRegistro: codigoZona + codigoOficina,
    tipoRegistro: tipoRegistro || '001',
    ip: '0.0.0.0',
    userApp: 'sigue+',
    userCrea: 'sigue+',
    status: 'A',
    tipoConsulta: 'N',
    idioma: 'es',
  }
  const tok = turnstileToken?.trim()
  if (tok) payload.dG9rZW4 = tok

  const res = await axios.post(
    `${TRACKING_API}/consultaTitulo`,
    { dmFsdWU: encryptPayload(payload) },
    { headers: API_HEADERS, timeout: 25000 },
  )

  const decrypted = decryptApiResponse(res.data) as { response?: ConsultaTituloResponse }
  if (!decrypted.response) return null
  return { response: decrypted.response }
}

// ── Parsing logic ──────────────────────────────────────────────────────────────

function parseDetalleTitulo(data: DetalleTituloResponse): {
  estado: string
  observacion: string
  calificador: string
} {
  const events = data.lstDetalleTitulo || []
  if (events.length === 0) {
    return { estado: 'SIN DATOS', observacion: '', calificador: '' }
  }

  const latest = events[events.length - 1]

  const rawEstado =
    latest.descriEstadoActual ||
    latest.estadoActual ||
    latest.descriEvento ||
    latest.descriEtapa ||
    ''

  const estado = classifyEstado(rawEstado)
  const observacion = latest.observacion || ''
  const calificador =
    latest.descriCalificador ||
    latest.calificador ||
    ''

  return { estado, observacion, calificador }
}

function parseConsultaTitulo(data: ConsultaTituloResponse): {
  estado: string
  observacion: string
  calificador: string
} {
  const titulos = data.lstTitulo || []
  const desc = (data.descripcionRespuesta || '').trim()

  if (titulos.length === 0) {
    return { estado: 'SIN DATOS', observacion: desc, calificador: '' }
  }

  const titulo = titulos[0]
  const estado = classifyEstado(titulo.estadoActual || '')

  const observacion = [
    titulo.tipoRegistro && String(titulo.tipoRegistro),
    titulo.areaRegistral && String(titulo.areaRegistral),
    desc || undefined,
  ].filter(Boolean).join(' · ')

  return {
    estado,
    observacion: observacion || desc,
    calificador: titulo.nombrePresentante || '',
  }
}

// ── Main scraping function ─────────────────────────────────────────────────────

async function attemptScrape(
  numero: string,
  anio: string,
  oficina: string,
  tipo: string,
  turnstileToken?: string | null,
): Promise<SunarpResult | null> {
  const { codigoZona, codigoOficina } = parseOficina(oficina)
  const userTipoCode = mapTipoRegistro(tipo)
  const tipoTryOrder = [userTipoCode, ...ALL_TIPO_REGISTRO_CODES.filter(c => c !== userTipoCode)]
  const numVariants = numeroTituloVariants(numero)

  // Primary: detalleTitulo — probar variantes de número y de tipo (el sitio oficial a veces difiere del tipo elegido).
  let last0002: { response: DetalleTituloResponse; rawJson: string } | null = null

  for (const numStr of numVariants) {
    for (const tipoRegistro of tipoTryOrder) {
      try {
        const result = await callDetalleTitulo(numStr, anio, codigoZona, codigoOficina, tipoRegistro)
        if (result?.response) {
          const code = result.response.codigoRespuesta
          const rawJson = JSON.stringify(result.response)

          if (code === '0000') {
            const parsed = parseDetalleTitulo(result.response)
            return buildResult(
              parsed.estado, parsed.observacion, parsed.calificador,
              false, 'detalleTitulo', code, rawJson,
            )
          }

          if (code === '0002') {
            last0002 = { response: result.response, rawJson }
            continue
          }

          if (code === '0004') {
            console.error('[SUNARP] detalleTitulo: missing required fields:', result.response.descripcionRespuesta)
            continue
          }
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error('[SUNARP] detalleTitulo error:', msg)
      }
    }
  }

  // Tras detalleTitulo: consultaTitulo (misma ruta que la web con Turnstile): número, tipo y token alineados a Síguelo Plus.
  const consultaAttempts: Array<string | null | undefined> = turnstileToken?.trim()
    ? [turnstileToken.trim(), null]
    : [null]

  let lastConsulta0002: { response: ConsultaTituloResponse; rawJson: string } | null = null

  for (const numStr of numVariants) {
    for (const tipoRegistro of tipoTryOrder) {
      for (const token of consultaAttempts) {
        try {
          const result = await callConsultaTitulo(
            numStr, anio, codigoZona, codigoOficina, token, tipoRegistro,
          )
          if (result?.response) {
            const code = result.response.codigoRespuesta
            const rawJson = JSON.stringify(result.response)

            if (code === '0000') {
              const parsed = parseConsultaTitulo(result.response)
              return buildResult(
                parsed.estado, parsed.observacion, parsed.calificador,
                false, 'consultaTitulo', code, rawJson,
              )
            }

            if (code === '0002') {
              lastConsulta0002 = { response: result.response, rawJson }
              continue
            }

            if (code === '998') {
              console.warn(
                token
                  ? '[SUNARP] consultaTitulo 998 con token (CAPTCHA inválido o dominio del widget no autorizado para esta clave)'
                  : '[SUNARP] consultaTitulo requiere CAPTCHA (sin token)',
              )
            }
          }
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error)
          console.error('[SUNARP] consultaTitulo error:', msg)
        }
      }
    }
  }

  if (lastConsulta0002) {
    return buildResult(
      'SIN DATOS',
      lastConsulta0002.response.descripcionRespuesta ?? '',
      '',
      false,
      'consultaTitulo',
      lastConsulta0002.response.codigoRespuesta,
      lastConsulta0002.rawJson,
    )
  }

  if (last0002) {
    return buildResult(
      'SIN DATOS', last0002.response.descripcionRespuesta ?? '', '',
      false, 'detalleTitulo', last0002.response.codigoRespuesta, last0002.rawJson,
    )
  }

  return null
}

export async function scrapeTitulo(
  numero: string,
  anio: string,
  oficina: string,
  tipo: string = 'predio',
  turnstileToken?: string | null,
): Promise<SunarpResult> {
  const MAX_RETRIES = 3
  const RETRY_DELAY = 3000
  const maxAttempts = turnstileToken?.trim() ? 1 : MAX_RETRIES

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(
        `[SUNARP] Attempt ${attempt}/${maxAttempts} — ${normalizeNumeroTitulo(numero)}/${anio}/${oficina} (${tipo}→${mapTipoRegistro(tipo)})` +
          (turnstileToken?.trim() ? ' [turnstile]' : ''),
      )

      const result = await attemptScrape(numero, anio, oficina, tipo, turnstileToken)

      if (result) {
        console.log(`[SUNARP] Success — Estado: ${result.estado} [${result.codigoRespuesta}] via ${result.apiEndpoint}`)
        return result
      }

      if (attempt < maxAttempts) {
        console.log(`[SUNARP] Attempt ${attempt} returned no result, retrying in ${RETRY_DELAY}ms...`)
        await new Promise(r => setTimeout(r, RETRY_DELAY))
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error(`[SUNARP] Attempt ${attempt} error:`, msg)

      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, RETRY_DELAY * attempt))
      }
    }
  }

  console.error('[SUNARP] All attempts failed — portal down or CAPTCHA blocked')
  return buildResult('SIN DATOS', '', '', true, 'none', '', undefined)
}

// ── Oficinas lookup ────────────────────────────────────────────────────────────

export interface SunarpOficina {
  codigoZona: string
  codigoOficina: string
  nombreOficina: string
}

let oficinasCache: SunarpOficina[] | null = null

export async function getOficinas(): Promise<SunarpOficina[]> {
  if (oficinasCache) return oficinasCache

  const res = await axios.get(`${OFICINAS_API}/cboOficinasSiguelo/1`, {
    headers: API_HEADERS,
    timeout: 15000,
  })

  const data = res.data as { lstOficinas?: SunarpOficina[] }
  oficinasCache = data.lstOficinas || []
  return oficinasCache
}

// ── Static OFICINAS fallback ───────────────────────────────────────────────────
// Full list fetched dynamically via getOficinas(); this is a minimal fallback.
export const OFICINAS_ESTATICAS: SunarpOficina[] = [
  { codigoZona: '01', codigoOficina: '01', nombreOficina: 'Lima - Sede Central' },
  { codigoZona: '01', codigoOficina: '02', nombreOficina: 'Lima Norte' },
  { codigoZona: '01', codigoOficina: '03', nombreOficina: 'Lima Sur' },
  { codigoZona: '01', codigoOficina: '04', nombreOficina: 'Lima Este' },
  { codigoZona: '01', codigoOficina: '05', nombreOficina: 'Lima - Callao' },
  { codigoZona: '02', codigoOficina: '01', nombreOficina: 'La Libertad - Trujillo' },
  { codigoZona: '02', codigoOficina: '02', nombreOficina: 'La Libertad - Chepén' },
  { codigoZona: '03', codigoOficina: '01', nombreOficina: 'Piura - Piura' },
  { codigoZona: '03', codigoOficina: '02', nombreOficina: 'Piura - Sullana' },
  { codigoZona: '03', codigoOficina: '03', nombreOficina: 'Piura - Talara' },
  { codigoZona: '04', codigoOficina: '01', nombreOficina: 'Loreto - Iquitos' },
  { codigoZona: '05', codigoOficina: '01', nombreOficina: 'Lambayeque - Chiclayo' },
  { codigoZona: '05', codigoOficina: '02', nombreOficina: 'Lambayeque - Ferreñafe' },
  { codigoZona: '06', codigoOficina: '01', nombreOficina: 'Pucallpa' },
  { codigoZona: '07', codigoOficina: '01', nombreOficina: 'Huaraz' },
  { codigoZona: '08', codigoOficina: '01', nombreOficina: 'Huancayo' },
  { codigoZona: '09', codigoOficina: '01', nombreOficina: 'Ica - Ica' },
  { codigoZona: '09', codigoOficina: '02', nombreOficina: 'Ica - Chincha' },
  { codigoZona: '10', codigoOficina: '01', nombreOficina: 'Cusco - Cusco' },
  { codigoZona: '10', codigoOficina: '02', nombreOficina: 'Cusco - Sicuani' },
  { codigoZona: '11', codigoOficina: '01', nombreOficina: 'Arequipa - Arequipa' },
  { codigoZona: '11', codigoOficina: '02', nombreOficina: 'Arequipa - Camaná' },
  { codigoZona: '12', codigoOficina: '01', nombreOficina: 'Tacna' },
  { codigoZona: '13', codigoOficina: '01', nombreOficina: 'Puno - Puno' },
  { codigoZona: '13', codigoOficina: '02', nombreOficina: 'Puno - Juliaca' },
  { codigoZona: '14', codigoOficina: '01', nombreOficina: 'Amazonas - Moyobamba' },
  { codigoZona: '14', codigoOficina: '02', nombreOficina: 'San Martín - Tarapoto' },
  { codigoZona: '15', codigoOficina: '01', nombreOficina: 'Áncash - Huaraz' },
  { codigoZona: '15', codigoOficina: '02', nombreOficina: 'Áncash - Chimbote' },
  { codigoZona: '16', codigoOficina: '01', nombreOficina: 'Ayacucho' },
  { codigoZona: '17', codigoOficina: '01', nombreOficina: 'Cajamarca' },
  { codigoZona: '18', codigoOficina: '01', nombreOficina: 'Junín - Huancayo' },
  { codigoZona: '19', codigoOficina: '01', nombreOficina: 'Moquegua' },
  { codigoZona: '20', codigoOficina: '01', nombreOficina: 'Tumbes' },
  { codigoZona: '21', codigoOficina: '01', nombreOficina: 'Madre de Dios - Puerto Maldonado' },
]

// ── 2captcha Turnstile solver ─────────────────────────────────────────────────

async function getPublicIp(): Promise<string> {
  try {
    const res = await axios.get('https://api.ipify.org?format=json', { timeout: 5000 })
    return (res.data as { ip: string }).ip || '0.0.0.0'
  } catch {
    return '0.0.0.0'
  }
}

export async function solveTurnstileWith2Captcha(): Promise<string | null> {
  const apiKey = process.env.TWOCAPTCHA_API_KEY
  if (!apiKey) return null

  try {
    console.log('[2captcha] Submitting Turnstile...')
    const submitRes = await axios.post(
      'https://2captcha.com/in.php',
      {
        key: apiKey,
        method: 'turnstile',
        sitekey: '0x4AAAAAABjHwQpFgHGVKCei',
        pageurl: 'https://sigueloplus.sunarp.gob.pe/siguelo/',
        json: 1,
      },
      { timeout: 15000 },
    )

    if (submitRes.data.status !== 1) {
      console.error('[2captcha] Submit failed:', submitRes.data)
      return null
    }

    const captchaId = String(submitRes.data.request)
    console.log(`[2captcha] Task created: ${captchaId}`)

    for (let i = 0; i < 24; i++) {
      await new Promise(r => setTimeout(r, 5000))
      const pollRes = await axios.get('https://2captcha.com/res.php', {
        params: { key: apiKey, action: 'get', id: captchaId, json: 1 },
        timeout: 10000,
      })

      if (pollRes.data.status === 1) {
        console.log('[2captcha] Turnstile solved successfully')
        return String(pollRes.data.request)
      }

      if (pollRes.data.request !== 'CAPCHA_NOT_READY') {
        console.error('[2captcha] Solve error:', pollRes.data.request)
        return null
      }
    }

    console.error('[2captcha] Timeout waiting for Turnstile solution')
    return null
  } catch (err) {
    console.error('[2captcha] Exception:', err)
    return null
  }
}

// ── Higher-level consultation wrapper (for Síguelo module) ───────────────────

export interface TituloConsultaResult {
  estado: string
  detalle: string
  areaRegistral: string
  numeroPartida: string
  portalDown: boolean
  scrapedAt: string
}

/**
 * High-level SUNARP title consultation. Tries detalleTitulo (no CAPTCHA)
 * and falls back to consultaTitulo with a 2captcha-resolved Turnstile token
 * if TWOCAPTCHA_API_KEY is configured.
 */
export async function consultarTituloSUNARP(
  oficina: string,
  anio: string,
  numero: string,
): Promise<TituloConsultaResult> {
  let token: string | null = null
  if (process.env.TWOCAPTCHA_API_KEY) {
    token = await solveTurnstileWith2Captcha()
  }

  const result = await scrapeTitulo(numero, anio, oficina, 'predio', token)

  if (result.portalDown) {
    return { estado: 'SIN DATOS', detalle: '', areaRegistral: '', numeroPartida: '', portalDown: true, scrapedAt: result.scrapedAt }
  }

  let areaRegistral = ''
  let numeroPartida = ''
  try {
    if (result.rawResponse) {
      const raw = JSON.parse(result.rawResponse) as {
        lstDetalleTitulo?: Array<{ areaRegistral?: string; numeroPartida?: string; numeroAsiento?: string; [key: string]: unknown }>
        lstTitulo?: Array<{ areaRegistral?: string; numeroPartida?: string; [key: string]: unknown }>
      }
      const items = raw.lstDetalleTitulo || raw.lstTitulo || []
      const last = items[items.length - 1]
      if (last) {
        areaRegistral = String(last.areaRegistral || '')
        numeroPartida = String(last.numeroPartida || last.numeroAsiento || '')
      }
    }
  } catch { /* ignore */ }

  return {
    estado: result.estado,
    detalle: result.observacion,
    areaRegistral,
    numeroPartida,
    portalDown: false,
    scrapedAt: result.scrapedAt,
  }
}

// ── Esquelas (observation letters) ───────────────────────────────────────────

export interface EsquelaParams {
  numeroTitulo: string
  anioTitulo: string
  oficina: string
}

/**
 * Fetches esquela PDFs (observation letters) for a given title.
 * Returns an array of base64-encoded PDF strings.
 * This endpoint does NOT require AES encryption or CAPTCHA.
 */
export async function descargarEsquela(params: EsquelaParams): Promise<string[]> {
  const { codigoZona, codigoOficina } = parseOficina(params.oficina)
  const numero = normalizeNumeroTitulo(params.numeroTitulo)

  const res = await axios.post(
    `${API_GATEWAY}/siguelo-esquela/listarEsquela`,
    {
      numeroTitulo: numero,
      anioTitulo: params.anioTitulo,
      codigoZona,
      codigoOficina,
    },
    { headers: API_HEADERS, timeout: 30000 },
  )

  const data = res.data as {
    codigoRespuesta?: string
    lstEsquelas?: Array<{ contenido?: string; archivo?: string; nombreArchivo?: string }>
  }

  if (!data.lstEsquelas?.length) return []

  return data.lstEsquelas
    .map(e => e.contenido || e.archivo || '')
    .filter(Boolean)
}

// ── Partidas ──────────────────────────────────────────────────────────────────

export interface PartidaResult {
  numeroPartida: string
  areaRegistral: string
  descripcion: string
}

export async function descargarPartidas(params: {
  numeroTitulo: string
  anioTitulo: string
  oficina: string
}): Promise<PartidaResult[]> {
  const { codigoZona, codigoOficina } = parseOficina(params.oficina)
  const numero = normalizeNumeroTitulo(params.numeroTitulo)

  const payload = {
    numeroTitulo: numero,
    anioTitulo: params.anioTitulo,
    codigoZona,
    codigoOficina,
    userApp: 'sigue+',
    userCrea: 'sigue+',
    status: 'A',
  }

  const res = await axios.post(
    `${API_GATEWAY}/asientoinscripcion/listarPartidas`,
    { dmFsdWU: encryptPayload(payload) },
    { headers: API_HEADERS, timeout: 30000 },
  )

  const decrypted = decryptApiResponse(res.data) as {
    lstPartidas?: Array<{ numeroPartida?: string; areaRegistral?: string; descripcion?: string }>
  }

  return (decrypted.lstPartidas || []).map(p => ({
    numeroPartida: String(p.numeroPartida || ''),
    areaRegistral: String(p.areaRegistral || ''),
    descripcion: String(p.descripcion || ''),
  }))
}

// ── Asientos de inscripción ───────────────────────────────────────────────────

/**
 * Downloads an inscripción asiento PDF.
 * The API returns Java signed bytes; we convert them to unsigned before encoding as base64.
 */
export async function descargarAsiento(params: {
  numeroPartida: string
  oficina: string
}): Promise<{ pdf: string; numeroPartida: string }> {
  const { codigoZona, codigoOficina } = parseOficina(params.oficina)

  const payload = {
    numeroPartida: params.numeroPartida,
    codigoZona,
    codigoOficina,
    userApp: 'sigue+',
    userCrea: 'sigue+',
    status: 'A',
  }

  const res = await axios.post(
    `${API_GATEWAY}/asientoinscripcion/listarAsientos`,
    { dmFsdWU: encryptPayload(payload) },
    { headers: API_HEADERS, timeout: 30000 },
  )

  const decrypted = decryptApiResponse(res.data) as {
    lstAsientos?: Array<{ contenido?: number[] | string; tipoContenido?: string }>
  }

  const asientos = decrypted.lstAsientos || []
  if (asientos.length === 0) throw new Error('No se encontraron asientos de inscripción')

  const contenido = asientos[0].contenido
  let pdf: string

  if (Array.isArray(contenido)) {
    // Java signed bytes → unsigned → base64
    const unsigned = (contenido as number[]).map(b => (b < 0 ? b + 256 : b))
    pdf = Buffer.from(unsigned).toString('base64')
  } else if (typeof contenido === 'string') {
    // Already base64 or a string
    pdf = contenido
  } else {
    throw new Error('Formato de asiento no reconocido')
  }

  return { pdf, numeroPartida: params.numeroPartida }
}

// ── Test helper ────────────────────────────────────────────────────────────────

export async function testSunarp(
  numero: string = '001234',
  anio: string = '2024',
  oficina: string = '0101',
  tipo: string = 'predio',
) {
  console.log('Testing SUNARP scraper...')
  console.log(`Parameters: ${numero}/${anio}/${oficina} (${tipo})`)

  try {
    const oficinas = await getOficinas()
    console.log(`Loaded ${oficinas.length} oficinas`)
  } catch (e) {
    console.log('Could not load oficinas (non-fatal)')
  }

  const result = await scrapeTitulo(numero, anio, oficina, tipo)
  console.log('Result:', JSON.stringify(result, null, 2))
  return result
}

// Run with: npx tsx lib/sunarp-scraper.ts

