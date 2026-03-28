import axios from 'axios';
import * as cheerio from 'cheerio';
import crypto from 'crypto';

export interface SunarpResult {
  estado: string;
  observacion: string | null;
  calificador: string | null;
  hash: string;
  isObservado: boolean;
  isInscrito: boolean;
  isTacha: boolean;
  scrapedAt: string;
}

const BASE_URL = 'https://enlinea.sunarp.gob.pe/sunarpweb/pages/acceso/frmTitulos.faces';

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'es-PE,es;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  Connection: 'keep-alive',
};

function generateHash(estado: string, observacion: string | null): string {
  const raw = `${estado}|${observacion || ''}`;
  return crypto.createHash('md5').update(raw).digest('hex');
}

function detectEstado(html: string): string {
  const $ = cheerio.load(html);
  const text = $('body').text().toUpperCase();

  // Look for explicit status keywords in the page content
  const statusPatterns = [
    { pattern: /TACHA/i, value: 'TACHA' },
    { pattern: /OBSERVAD[OA]/i, value: 'OBSERVADO' },
    { pattern: /INSCRIT[OA]/i, value: 'INSCRITO' },
    { pattern: /PENDIENTE/i, value: 'PENDIENTE' },
  ];

  // Check within specific result elements first
  const resultSelectors = [
    '#form1\\:estado',
    '#form1\\:txtEstado',
    '.estado',
    'span[id*="estado"]',
    'td[id*="estado"]',
    'div[id*="estado"]',
    'span[id*="Estado"]',
    'td[id*="Estado"]',
  ];

  for (const sel of resultSelectors) {
    const el = $(sel);
    if (el.length > 0) {
      const elText = el.text().toUpperCase().trim();
      for (const { pattern, value } of statusPatterns) {
        if (pattern.test(elText)) return value;
      }
    }
  }

  // Fallback: scan all table cells and spans
  const elements = $('td, span, div, p').toArray();
  for (const el of elements) {
    const elText = $(el).text().trim().toUpperCase();
    if (elText.length < 50) {
      for (const { pattern, value } of statusPatterns) {
        if (pattern.test(elText)) return value;
      }
    }
  }

  // Last resort: full page text
  for (const { pattern, value } of statusPatterns) {
    if (pattern.test(text)) return value;
  }

  return 'SIN DATOS';
}

function extractObservacion(html: string): string | null {
  const $ = cheerio.load(html);

  const obsSelectors = [
    '#form1\\:observacion',
    '#form1\\:txtObservacion',
    'textarea[id*="observ"]',
    'div[id*="observ"]',
    'span[id*="observ"]',
    'td[id*="observ"]',
  ];

  for (const sel of obsSelectors) {
    const text = $(sel).text().trim();
    if (text.length > 10) return text;
  }

  // Try to find observation text near "OBSERVADO" keyword
  const allText = $('body').text();
  const observMatch = allText.match(/(?:observaci[oó]n|esquela)[:\s]+(.{20,500})/i);
  if (observMatch) return observMatch[1].trim();

  return null;
}

function extractCalificador(html: string): string | null {
  const $ = cheerio.load(html);

  const calSelectors = [
    '#form1\\:calificador',
    '#form1\\:txtCalificador',
    'span[id*="calific"]',
    'td[id*="calific"]',
  ];

  for (const sel of calSelectors) {
    const text = $(sel).text().trim();
    if (text.length > 2) return text;
  }

  return null;
}

async function attemptScrape(
  numero: string,
  anio: string,
  oficina: string
): Promise<SunarpResult | null> {
  try {
    // Step 1: GET the form page
    const getResponse = await axios.get(BASE_URL, {
      headers: HEADERS,
      timeout: 15000,
    });

    const $get = cheerio.load(getResponse.data);
    const viewState = $get('input[name="javax.faces.ViewState"]').val() as string;

    if (!viewState) {
      console.warn('[SUNARP] Could not extract ViewState from page');
      // Try to parse what we got anyway
    }

    // Step 2: POST the form
    const postData = new URLSearchParams({
      'form1_SUBMIT': '1',
      'form1:anio': anio,
      'form1:numero': numero,
      'form1:oficina': oficina,
      'form1:btnConsultar': 'Consultar',
      'javax.faces.ViewState': viewState || 'e1s1',
    });

    const postResponse = await axios.post(BASE_URL, postData.toString(), {
      headers: {
        ...HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: BASE_URL,
      },
      timeout: 20000,
    });

    const html = postResponse.data as string;
    const estado = detectEstado(html);
    const observacion = estado === 'OBSERVADO' ? extractObservacion(html) : null;
    const calificador = extractCalificador(html);
    const hash = generateHash(estado, observacion);

    return {
      estado,
      observacion,
      calificador,
      hash,
      isObservado: estado === 'OBSERVADO',
      isInscrito: estado === 'INSCRITO',
      isTacha: estado === 'TACHA',
      scrapedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`[SUNARP] Axios error: ${error.message} (status: ${error.response?.status})`);
    } else {
      console.error('[SUNARP] Unexpected error:', error);
    }
    return null;
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function scrapeTitulo(
  numero: string,
  anio: string,
  oficina: string
): Promise<SunarpResult | null> {
  const maxAttempts = 3;
  const delayMs = 5000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[SUNARP] Attempt ${attempt}/${maxAttempts} for título ${numero}/${anio}`);
    const result = await attemptScrape(numero, anio, oficina);

    if (result !== null) {
      console.log(`[SUNARP] Success: ${result.estado} (${result.hash})`);
      return result;
    }

    if (attempt < maxAttempts) {
      console.log(`[SUNARP] Waiting ${delayMs}ms before retry...`);
      await sleep(delayMs);
    }
  }

  console.error(`[SUNARP] All ${maxAttempts} attempts failed for ${numero}/${anio}`);
  return null;
}
