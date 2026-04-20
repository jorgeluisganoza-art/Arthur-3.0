"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeCEJ = scrapeCEJ;
const playwright_extra_1 = require("playwright-extra");
const puppeteer_extra_plugin_stealth_1 = __importDefault(require("puppeteer-extra-plugin-stealth"));
const _2captcha_ts_1 = require("2captcha-ts");
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const supabase_storage_1 = require("./supabase-storage");
function parseProxy(proxyUrl) {
    const url = new URL(proxyUrl);
    return {
        server: url.protocol + '//' + url.hostname + ':' + url.port,
        username: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
    };
}
/** Aplicar stealth solo al abrir el navegador (evita fallos al importar el módulo en Next/API). */
let cejStealthApplied = false;
function applyCejStealthOnce() {
    if (cejStealthApplied)
        return;
    cejStealthApplied = true;
    try {
        playwright_extra_1.chromium.use((0, puppeteer_extra_plugin_stealth_1.default)());
    }
    catch (e) {
        console.warn('[CEJ] Stealth plugin no aplicado:', e instanceof Error ? e.message : String(e));
    }
}
const CEJ_SEARCH_URL = 'https://cej.pj.gob.pe/cej/forms/busquedaform.html';
const CEJ_DETAIL_URL = 'https://cej.pj.gob.pe/cej/forms/detalleform.html';
class TwoCaptchaImageSolver {
    apiKey;
    opts;
    constructor(apiKey, opts = { timeoutMs: 120_000, pollMs: 4_000 }) {
        this.apiKey = apiKey;
        this.opts = opts;
    }
    async solve(imageBase64) {
        if (!this.apiKey)
            throw new Error('TWOCAPTCHA_API_KEY not set');
        const submit = await fetch('https://2captcha.com/in.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                key: this.apiKey,
                method: 'base64',
                body: imageBase64,
                json: '1',
            }),
        }).then(r => r.json());
        if (submit.status !== 1)
            throw new Error(`2captcha submit failed: ${submit.request}`);
        const id = submit.request;
        const started = Date.now();
        while (Date.now() - started < this.opts.timeoutMs) {
            await new Promise(r => setTimeout(r, this.opts.pollMs));
            const res = await fetch(`https://2captcha.com/res.php?${new URLSearchParams({
                key: this.apiKey,
                action: 'get',
                id,
                json: '1',
            }).toString()}`).then(r => r.json());
            if (res.status === 1)
                return String(res.request || '').trim();
            if (res.request !== 'CAPCHA_NOT_READY')
                throw new Error(`2captcha solve failed: ${res.request}`);
        }
        throw new Error('2captcha timeout');
    }
}
class CapSolverImageSolver {
    apiKey;
    opts;
    constructor(apiKey, opts = { timeoutMs: 120_000, pollMs: 3_500 }) {
        this.apiKey = apiKey;
        this.opts = opts;
    }
    async solve(imageBase64) {
        if (!this.apiKey)
            throw new Error('CAPSOLVER_API_KEY not set');
        const create = await fetch('https://api.capsolver.com/createTask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                clientKey: this.apiKey,
                task: {
                    type: 'ImageToTextTask',
                    module: 'common',
                    body: imageBase64,
                },
            }),
        }).then(r => r.json());
        // ImageToText may return sync solution in createTask response (status=ready)
        const maybeSolution = create.solution?.text;
        if (maybeSolution && String(maybeSolution).trim())
            return String(maybeSolution).trim();
        if (create.errorId !== 0 || !create.taskId) {
            throw new Error(`CapSolver createTask failed: ${create.errorCode || 'unknown'}`);
        }
        const taskId = create.taskId;
        const started = Date.now();
        while (Date.now() - started < this.opts.timeoutMs) {
            await new Promise(r => setTimeout(r, this.opts.pollMs));
            const r = await fetch('https://api.capsolver.com/getTaskResult', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientKey: this.apiKey, taskId }),
            }).then(rr => rr.json());
            if (r.errorId !== 0)
                throw new Error(`CapSolver getTaskResult failed: ${r.errorCode || 'unknown'}`);
            if (r.status === 'ready') {
                const text = String(r.solution?.text || '').trim();
                if (!text)
                    throw new Error('CapSolver returned empty text');
                return text;
            }
        }
        throw new Error('CapSolver timeout');
    }
}
/** CEJ image captcha: CapSolver first; 2captcha only if CapSolver fails or if only TWOCAPTCHA is set. */
class CapSolverImageWithTwoCaptchaFallback {
    async solve(imageBase64) {
        const capKey = process.env.CAPSOLVER_API_KEY?.trim();
        const twoKey = process.env.TWOCAPTCHA_API_KEY?.trim();
        if (capKey) {
            try {
                return await new CapSolverImageSolver(capKey).solve(imageBase64);
            }
            catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                console.warn('[CEJ] CapSolver image captcha failed:', msg);
                if (!twoKey)
                    throw e;
                console.log('[CEJ] Image captcha: falling back to 2captcha');
                return await new TwoCaptchaImageSolver(twoKey).solve(imageBase64);
            }
        }
        if (twoKey)
            return await new TwoCaptchaImageSolver(twoKey).solve(imageBase64);
        throw new Error('No CAPTCHA provider configured. Set CAPSOLVER_API_KEY (CEJ) or TWOCAPTCHA_API_KEY as fallback.');
    }
}
function getImageCaptchaSolver() {
    const capKey = process.env.CAPSOLVER_API_KEY?.trim();
    const twoKey = process.env.TWOCAPTCHA_API_KEY?.trim();
    if (!capKey && !twoKey) {
        throw new Error('No CAPTCHA provider configured. Set CAPSOLVER_API_KEY (primary for CEJ) or TWOCAPTCHA_API_KEY (fallback).');
    }
    return new CapSolverImageWithTwoCaptchaFallback();
}
async function refreshImageCaptcha(page) {
    const before = await page.evaluate(() => {
        const img = document.getElementById('captcha_image');
        return img?.src || '';
    }).catch(() => '');
    await page.click('#captcha_image, img#captcha_image').catch(async () => {
        await page.evaluate(() => {
            const img = document.getElementById('captcha_image');
            img?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }).catch(() => { });
    });
    await page.waitForFunction((prev) => {
        const img = document.getElementById('captcha_image');
        const src = img?.src || '';
        return src && src !== prev;
    }, before, { timeout: 8000 }).catch(() => { });
    await page.waitForTimeout(300);
}
async function solveImageCaptchaFromDom(page, baseResult) {
    const imgEl = await page.$('#captcha_image, img[id=\"captcha_image\"]');
    if (!imgEl)
        return '';
    baseResult.captchaDetected = true;
    await page.waitForFunction(() => {
        const img = document.getElementById('captcha_image');
        return !!(img?.complete && (img?.naturalWidth ?? 0) > 10);
    }, { timeout: 10000 }).catch(() => { });
    await imgEl.scrollIntoViewIfNeeded().catch(() => { });
    await page.waitForTimeout(250);
    const imgBuffer = await imgEl.screenshot({ type: 'jpeg', quality: 80 }).catch(() => Buffer.alloc(0));
    if (!imgBuffer.length || imgBuffer.length < 200)
        return '';
    const solver = getImageCaptchaSolver();
    const code = await solver.solve(imgBuffer.toString('base64'));
    baseResult.captchaSolved = !!code;
    return code;
}
// ── CapSolver via direct HTTP (more reliable than the npm wrapper) ────────────
async function solveHCaptchaWithCapSolver(sitekey, url) {
    const apiKey = process.env.CAPSOLVER_API_KEY;
    if (!apiKey) {
        console.log('[CEJ] CAPSOLVER_API_KEY not set, skipping CapSolver');
        return null;
    }
    console.log('[CEJ] Using captcha solver: CapSolver (HTTP API)');
    try {
        // Create task
        const createRes = await fetch('https://api.capsolver.com/createTask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                clientKey: apiKey,
                task: { type: 'HCaptchaTaskProxyless', websiteURL: url, websiteKey: sitekey },
            }),
        });
        const createData = await createRes.json();
        if (createData.errorId !== 0) {
            console.error('[CEJ] CapSolver createTask error:', createData.errorDescription);
            return null;
        }
        const taskId = createData.taskId;
        console.log('[CEJ] CapSolver task created:', taskId);
        // Poll for result (up to 60 seconds)
        for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 2000));
            const getRes = await fetch('https://api.capsolver.com/getTaskResult', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientKey: apiKey, taskId }),
            });
            const getData = await getRes.json();
            if (getData.status === 'ready') {
                const token = getData.solution?.gRecaptchaResponse;
                if (token) {
                    console.log('[CEJ] hCaptcha solved with CapSolver!');
                    return token;
                }
                console.error('[CEJ] CapSolver ready but no token in solution');
                return null;
            }
            if (getData.errorId !== 0) {
                console.error('[CEJ] CapSolver getTaskResult error:', getData.errorDescription);
                return null;
            }
        }
        console.error('[CEJ] CapSolver polling timeout (60s)');
        return null;
    }
    catch (e) {
        console.error('[CEJ] CapSolver HTTP error:', e instanceof Error ? e.message : String(e));
        return null;
    }
}
function isRadwareBlocked(url, title) {
    return (url.includes('perfdrive.com') ||
        url.includes('radware') ||
        title.toLowerCase().includes('radware') ||
        title.toLowerCase().includes('bot manager'));
}
/** Solo para captchaDetected (Radware): true si hay iframe con perfdrive.com en src. */
async function hasPerfdriveChallengeIframe(page) {
    return page.evaluate(() => {
        return Array.from(document.querySelectorAll('iframe')).some((ifr) => {
            const src = ifr.getAttribute('src') || '';
            return src.includes('perfdrive.com');
        });
    }).catch(() => false);
}
function makeBrowserArgs() {
    return [
        '--no-sandbox',
        '--ignore-certificate-errors',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
    ];
}
/** CEJ_DEBUG=1 o true → navegador visible + DevTools (equivalente práctico a debug: true, headless: false). */
function isCejBrowserDebug() {
    const v = process.env.CEJ_DEBUG;
    return v === '1' || v === 'true';
}
function cejChromiumLaunchOptions() {
    const debug = isCejBrowserDebug();
    return {
        headless: !debug,
        devtools: debug,
        executablePath: process.env.CHROME_EXECUTABLE_PATH || undefined,
        proxy: process.env.PROXY_URL ? parseProxy(process.env.PROXY_URL) : undefined,
        ignoreHTTPSErrors: true,
        args: makeBrowserArgs(),
    };
}
// Dump visible page text without the `offsetParent` filter (which is always null in headless).
async function dumpPageText(page, label) {
    const texts = await page.$$eval('body *:not(script):not(style):not(head)', els => els
        .filter(el => el.children.length === 0)
        .map(el => el.textContent?.trim() || '')
        .filter(t => t.length > 2)
        .slice(0, 40)).catch(() => []);
    console.log(`[CEJ] ${label} text:`, texts.slice(0, 15).join(' | ').substring(0, 400) || '(empty)');
}
// Dump inner HTML of a selector for debugging.
async function dumpHtml(page, selector, label) {
    const html = await page.$eval(selector, el => el.innerHTML).catch(() => '(not found)');
    console.log(`[CEJ] ${label} HTML:`, String(html).substring(0, 500));
}
async function parseActuaciones(page) {
    await page.waitForSelector('[id^="pnlSeguimiento1"]', { timeout: 15000 });
    await page.waitForTimeout(2000);
    const parsed = await page.evaluate(() => {
        const results = [];
        const debugLines = [];
        debugLines.push('[CEJ parseActuaciones] Detección de documento — heurística en todos los <a href> del panel:', `  • PDF: href contiene .pdf, /pdf, formato=pdf, type=pdf, application/pdf (minúsculas)`, `  • Alternativo: href contiene documento, descarga, visor, verdoc`, `  • documento_url = enlace PDF si hay; si no, el alternativo. Paneles: [id^="pnlSeguimiento"] + cpnlSeguimiento`);
        const panels = document.querySelectorAll('[id^="pnlSeguimiento"]');
        let actIdx = 0;
        panels.forEach((panel) => {
            if (!panel.classList.contains('cpnlSeguimiento'))
                return;
            const numero = panel.querySelector('.esquina')?.textContent?.trim() || '';
            const labels = panel.querySelectorAll('.roptionss, .roptionss-corto');
            let fecha = '';
            let resolucion = '';
            let acto = '';
            let sumilla = '';
            let proveido = '';
            labels.forEach((label) => {
                const txt = label.textContent?.trim().toLowerCase() || '';
                const next = label.nextElementSibling;
                const val = next?.textContent?.trim() || '';
                if (txt.includes('fecha'))
                    fecha = val;
                if (txt === 'resolución:' || txt === 'resolucion:')
                    resolucion = val;
                if (txt === 'acto:')
                    acto = val;
                if (txt === 'sumilla:')
                    sumilla = val;
                if (txt === 'proveido:')
                    proveido = val;
            });
            let sumillaFinal = sumilla;
            if (proveido) {
                sumillaFinal = sumilla ? `${sumilla} | Proveído: ${proveido}` : `Proveído: ${proveido}`;
            }
            const anchors = Array.from(panel.querySelectorAll('a[href]'));
            let docPdf = null;
            let docOther = null;
            for (const a of anchors) {
                const u = (a.href || '').toLowerCase();
                const rel = (a.getAttribute('href') || '').toLowerCase();
                if (!docPdf &&
                    (u.includes('.pdf') ||
                        rel.includes('.pdf') ||
                        u.includes('/pdf') ||
                        u.includes('formato=pdf') ||
                        u.includes('type=pdf') ||
                        u.includes('application/pdf'))) {
                    docPdf = a;
                }
                if (!docOther &&
                    (u.includes('documento') ||
                        u.includes('descarga') ||
                        u.includes('visor') ||
                        u.includes('verdoc') ||
                        rel.includes('documento'))) {
                    docOther = a;
                }
            }
            const docUrl = (docPdf || docOther)?.href || '';
            const tienePdf = !!docPdf;
            const tieneDocLink = !!docOther;
            const tieneDocumento = !!(docPdf || docOther);
            let motivo = '';
            if (!tieneDocumento) {
                motivo =
                    'tiene_documento=false — ningún <a href> del panel coincide con PDF (case-insensitive) ni patrones documento/descarga/visor';
            }
            else if (tienePdf && tieneDocLink && docPdf !== docOther) {
                motivo =
                    'tiene_documento=true — enlace tipo PDF y otro tipo documento; documento_url prioriza PDF';
            }
            else if (tienePdf) {
                motivo = 'tiene_documento=true — enlace con indicadores de PDF en href';
            }
            else {
                motivo =
                    'tiene_documento=true — solo enlace documento/descarga/visor (sin .pdf explícito); documento_url = ese href';
            }
            const snippetPdf = docPdf?.outerHTML?.slice(0, 220) || '(ningún ancla tipo PDF)';
            const snippetDoc = docOther && docOther !== docPdf ? docOther.outerHTML?.slice(0, 220) || '' : '(mismo que PDF o ningún otro)';
            const actoShort = acto.length > 60 ? acto.slice(0, 60) + '…' : acto;
            if (!(numero || fecha || acto || sumillaFinal))
                return;
            actIdx += 1;
            debugLines.push(`[CEJ parseActuaciones] actuación #${actIdx} numero="${numero}" fecha="${fecha}" acto="${actoShort}"`);
            debugLines.push(`  → ${motivo}`);
            debugLines.push(`  → HTML ancla PDF (heurística): ${snippetPdf}`);
            debugLines.push(`  → HTML ancla doc alternativa: ${snippetDoc}`);
            if (docUrl)
                debugLines.push(`  → documento_url (completa): ${docUrl}`);
            else
                debugLines.push(`  → documento_url: (vacío)`);
            const actoL = acto.toLowerCase();
            const sumL = sumillaFinal.toLowerCase();
            const tieneResolucion = !!resolucion ||
                actoL.includes('resoluc') ||
                actoL.includes('sentenc') ||
                sumL.includes('resoluc') ||
                sumL.includes('sentencia');
            results.push({
                numero,
                fecha,
                acto,
                folio: '',
                sumilla: sumillaFinal,
                tieneDocumento,
                documentoUrl: docUrl || '',
                tieneResolucion,
            });
        });
        debugLines.push(`[CEJ parseActuaciones] total actuaciones con datos: ${results.length}`);
        return { results, debugLines };
    }).catch(() => ({
        results: [],
        debugLines: ['[CEJ parseActuaciones] page.evaluate falló — sin datos'],
    }));
    console.log('[CEJ parseActuaciones] paneles: document.querySelectorAll(\'[id^="pnlSeguimiento"]\') + classList.contains("cpnlSeguimiento")');
    for (const line of parsed.debugLines) {
        console.log(line);
    }
    return parsed.results;
}
function sanitizeFilename(s) {
    return s.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').substring(0, 80);
}
function bufferLooksLikePdf(buf) {
    return buf.length >= 4 && buf.subarray(0, 4).toString('ascii') === '%PDF';
}
/** Descarga el binario del enlace CEJ: primero fetch en el contexto del navegador (cookies/JS), luego request de Playwright. */
async function downloadCejDocumentBuffer(page, docUrl) {
    const referer = page.url().startsWith('http') ? page.url() : CEJ_DETAIL_URL;
    const evaluated = await page
        .evaluate(async ({ url, ref }) => {
        try {
            const r = await fetch(url, {
                credentials: 'include',
                mode: 'cors',
                cache: 'no-store',
                headers: { Accept: 'application/pdf,*/*', Referer: ref },
            });
            if (!r.ok)
                return { ok: false, status: r.status };
            const ab = await r.arrayBuffer();
            return { ok: true, bytes: Array.from(new Uint8Array(ab)) };
        }
        catch (e) {
            return {
                ok: false,
                status: 0,
                message: e instanceof Error ? e.message : String(e),
            };
        }
    }, { url: docUrl, ref: referer })
        .catch((e) => {
        console.warn('[CEJ] In-page doc fetch error:', e.message);
        return { ok: false, status: 0, message: e.message };
    });
    if (evaluated.ok && evaluated.bytes.length > 0) {
        return Buffer.from(evaluated.bytes);
    }
    if (!evaluated.ok && 'message' in evaluated && evaluated.message) {
        console.warn(`[CEJ] In-page doc fetch: ${evaluated.message} status=${evaluated.status}`);
    }
    const res = await page.request.get(docUrl, {
        timeout: 30_000,
        headers: {
            Referer: referer,
            Accept: 'application/pdf,application/octet-stream;q=0.9,*/*;q=0.8',
        },
    });
    if (!res.ok()) {
        console.warn(`[CEJ] Doc download HTTP ${res.status()} for ${docUrl}`);
        return null;
    }
    return Buffer.from(await res.body());
}
async function uploadActuacionDocuments(page, actuaciones, numeroExpediente) {
    for (const a of actuaciones) {
        if (!a.tieneDocumento || !a.documentoUrl)
            continue;
        try {
            const buf = await downloadCejDocumentBuffer(page, a.documentoUrl);
            if (!buf) {
                a.documentoUrl = '';
                continue;
            }
            if (!bufferLooksLikePdf(buf)) {
                const sniff = buf.subarray(0, 200).toString('utf8').replace(/\s+/g, ' ').slice(0, 120);
                console.warn(`[CEJ] Respuesta no es PDF (HTML/captcha u otro). bytes=${buf.length} head="${sniff}" url=${a.documentoUrl}`);
                a.documentoUrl = '';
                continue;
            }
            const uploadedUrl = await (0, supabase_storage_1.uploadPdfToSupabase)(buf, numeroExpediente, a.fecha ?? '', a.acto ?? '');
            if (uploadedUrl) {
                a.documentoUrl = uploadedUrl;
                console.log(`[CEJ] Doc saved: ${uploadedUrl}`);
            }
            else {
                a.documentoUrl = '';
            }
        }
        catch (err) {
            console.error('[CEJ] Doc upload error:', err instanceof Error ? err.message : String(err));
            a.documentoUrl = '';
        }
    }
}
async function parseCaseHeader(page) {
    return page.evaluate(() => {
        const norm = (s) => s.replace(/\s+/g, ' ').trim();
        /** .celdaGridN que contiene keyword → siguiente .celdaGrid / .celdaGridxT */
        function valueAfterCeldaGridN(contains) {
            const labels = document.querySelectorAll('.celdaGridN');
            for (let i = 0; i < labels.length; i++) {
                const label = labels[i];
                const lt = label.textContent || '';
                if (!lt.includes(contains))
                    continue;
                let sib = label.nextElementSibling;
                while (sib) {
                    if (sib.classList.contains('celdaGrid') ||
                        sib.classList.contains('celdaGridxT') ||
                        sib.classList.contains('celdaGridXe')) {
                        return norm(sib.textContent || '');
                    }
                    sib = sib.nextElementSibling;
                }
            }
            return '';
        }
        const getGridVal = (keywords) => {
            const labels = document.querySelectorAll('.celdaGridN');
            for (let i = 0; i < labels.length; i++) {
                const label = labels[i];
                const text = (label.textContent || '').toLowerCase();
                if (keywords.some(k => text.includes(k.toLowerCase()))) {
                    let sib = label.nextElementSibling;
                    while (sib) {
                        if (sib.classList.contains('celdaGrid') ||
                            sib.classList.contains('celdaGridxT') ||
                            sib.classList.contains('celdaGridXe')) {
                            return norm(sib.textContent || '');
                        }
                        sib = sib.nextElementSibling;
                    }
                }
            }
            return '';
        };
        const getText = (keywords) => {
            const rows = document.querySelectorAll('table tr, .dato-expediente');
            for (let r = 0; r < rows.length; r++) {
                const row = rows[r];
                const cells = row.querySelectorAll('td, span, div');
                for (let i = 0; i < cells.length - 1; i++) {
                    const label = (cells[i].textContent || '').toLowerCase();
                    if (keywords.some(k => label.includes(k.toLowerCase()))) {
                        return norm(cells[i + 1].textContent || '');
                    }
                }
            }
            return '';
        };
        const g = (keywords) => getGridVal(keywords) || getText(keywords);
        const partes = [];
        const nombreCells = document.querySelectorAll('.cNombresD.cPartVJ');
        for (let i = 0; i < nombreCells.length; i++) {
            const cell = nombreCells[i];
            const row = cell.closest('.partes');
            const nombre = norm(cell.textContent || '');
            if (!nombre)
                continue;
            let rol = '';
            if (row) {
                const tips = row.querySelectorAll('.cPartTip');
                for (let t = 0; t < tips.length; t++) {
                    const tx = norm(tips[t].textContent || '');
                    if (!tx || tx.toUpperCase() === 'PARTE' || tx.toLowerCase().includes('tipo de'))
                        continue;
                    rol = tx;
                    break;
                }
            }
            partes.push({ rol: rol || 'PARTE', nombre });
        }
        if (partes.length === 0) {
            document.querySelectorAll('.partes').forEach(row => {
                const tips = row.querySelectorAll('.cPartTip');
                const rol = tips[0] ? norm(tips[0].textContent || '') : '';
                if (rol && rol.toUpperCase() !== 'PARTE') {
                    const nombreEl = row.querySelector('.cNombresD') || row.querySelector('.cNombresDN');
                    const nombre = nombreEl ? norm(nombreEl.textContent || '') : '';
                    if (nombre)
                        partes.push({ rol, nombre });
                }
            });
        }
        if (partes.length === 0) {
            document.querySelectorAll('table tr').forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 2) {
                    const posibleRol = (cells[0].textContent || '').toLowerCase();
                    if (posibleRol.includes('demand') ||
                        posibleRol.includes('accion') ||
                        posibleRol.includes('imput') ||
                        posibleRol.includes('agrav') ||
                        posibleRol.includes('procurad')) {
                        partes.push({
                            rol: norm(cells[0].textContent || ''),
                            nombre: norm(cells[1].textContent || ''),
                        });
                    }
                }
            });
        }
        return {
            organoJurisdiccional: valueAfterCeldaGridN('Órgano') || g(['organo jurisdiccional', 'juzgado', 'sala', 'tribunal']),
            distritoJudicial: g(['distrito judicial', 'corte']),
            juez: valueAfterCeldaGridN('Juez:') || valueAfterCeldaGridN('Juez') || g(['juez', 'magistrado', 'vocal']),
            especialidad: g(['especialidad']),
            proceso: g(['proceso']),
            etapa: g(['etapa procesal', 'etapa', 'instancia']),
            estadoProceso: valueAfterCeldaGridN('Estado:') || valueAfterCeldaGridN('Estado') || g(['estado']),
            partes,
        };
    }).catch(() => ({}));
}
// Wait for Angular/AJAX to render the results on busquedacodform.html.
// Uses multiple strategies to confirm the page has settled.
async function waitForAngularResults(page) {
    // Strategy 1: network idle (all XHR done)
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {
        console.log('[CEJ] networkidle timeout — continuing anyway');
    });
    // Strategy 2: wait for a known results container or no-results message
    await page.waitForSelector([
        'table tr:nth-child(2)',
        '#listadoExpedientes',
        '#listaExpedientes',
        '.expediente',
        '#divResultados',
        '.resultado',
        '.alert',
        '.mensaje',
        '[ng-repeat]',
        'td',
        // detalleform.html selectors
        '#pnlSeguimiento1',
        '.divGLRE0',
        '.celdaGridN',
        '.divRepExp',
    ].join(', '), { timeout: 15000 }).catch(() => console.log('[CEJ] Results element not found within 15s'));
    // Strategy 3: extra buffer for Angular digest cycle
    await page.waitForTimeout(3000);
}
async function scrapeResultsPage(page, baseResult, numeroExpediente, tab1Mode = false) {
    const currentUrl = page.url();
    console.log('[CEJ] scrapeResultsPage — URL:', currentUrl.substring(0, 100));
    if (currentUrl.includes('busquedaform.html') && !tab1Mode) {
        console.log('[CEJ] Still on busquedaform — submission was blocked');
        await dumpPageText(page, 'Blocked form page');
        return null;
    }
    if (currentUrl.includes('busquedaform.html') && tab1Mode) {
        // Tab 1 posts back to busquedaform.html — check if results are present
        const hasSearchForm = await page.$('#distritoJudicial, #busquedaFiltros').catch(() => null);
        const hasResultRows = await page.$('table tr:nth-child(2), #listadoExpedientes, .expediente').catch(() => null);
        if (hasSearchForm && !hasResultRows) {
            console.log('[CEJ] Tab1: busquedaform.html with no results — submission was blocked');
            await dumpPageText(page, 'Tab1 blocked form page');
            return null;
        }
    }
    await waitForAngularResults(page);
    await dumpPageText(page, 'Results page');
    const noResults = await page.evaluate(() => {
        const body = document.body.textContent || '';
        return (body.includes('No se encontraron') ||
            body.includes('no existe') ||
            body.includes('Sin resultados') ||
            body.includes('No se ha encontrado'));
    }).catch(() => false);
    if (noResults) {
        console.log('[CEJ] No results found for expediente');
        return { ...baseResult, error: 'Expediente no encontrado en el CEJ' };
    }
    // Check if we're on a results LIST page (multiple expedientes found).
    // CEJ shows a list with clickable rows — we need to click into the correct case.
    const isResultsList = await page.evaluate(() => {
        const body = document.body.textContent || '';
        return body.includes('RESULTADO DE LA BÚSQUEDA') || body.includes('Expedientes encontrados');
    }).catch(() => false);
    if (isResultsList) {
        console.log('[CEJ] On results list page — submitting detail form...');
        // CEJ results list: each case has a <form action="detalleform.html"> with a submit button
        const navDetailPromise = page.waitForNavigation({ waitUntil: 'load', timeout: 30000 }).catch(() => null);
        const detailClicked = await page.click('button[title="Ver detalle de expediente"], form[action="detalleform.html"] button[type="submit"], form[action*="detalle"] button').then(() => true).catch(() => false);
        if (detailClicked) {
            await navDetailPromise;
            console.log('[CEJ] Navigated to detail page:', page.url().substring(0, 100));
            await page.waitForTimeout(2000);
        }
        else {
            // Fallback: submit the form directly
            const submitted = await page.evaluate(() => {
                const form = document.querySelector('form[action="detalleform.html"]');
                if (form) {
                    form.submit();
                    return true;
                }
                return false;
            }).catch(() => false);
            if (submitted) {
                await navDetailPromise;
                console.log('[CEJ] Form submitted to detail page:', page.url().substring(0, 100));
                await page.waitForTimeout(2000);
            }
            else {
                console.log('[CEJ] Could not navigate to detail page — scraping list page directly');
            }
        }
    }
    // If we're on detalleform, wait for the actuaciones panel to load
    if (page.url().includes('detalleform')) {
        await page.waitForSelector('#pnlSeguimiento1, .pnl-seg, .divRepExp', { timeout: 15000 })
            .catch(() => console.log('[CEJ] detalleform panel not found — continuing anyway'));
        await page.waitForTimeout(1000);
        // Debug: count panels
        const panelCount = await page.$$eval('#pnlSeguimiento1 .panel, [id^="pnlSeguimiento"] .panel', els => els.length).catch(() => -1);
        const esquinaCount = await page.$$eval('.esquina', els => els.length).catch(() => -1);
        console.log('[CEJ] detalleform panels:', panelCount, 'esquinas:', esquinaCount);
    }
    const headerData = await parseCaseHeader(page);
    const actuaciones = await parseActuaciones(page);
    console.log(`[CEJ] Found ${actuaciones.length} actuaciones`);
    // DEBUG TEMPORAL - borrar después
    if (actuaciones.length === 0) {
        const html = await page.content();
        fs_1.default.writeFileSync('debug-detalle.html', html);
        console.log('[CEJ] HTML guardado en debug-detalle.html');
    }
    // Paginate
    let hasNext = await page.$('a:has-text("Siguiente"), .siguiente, [title="Siguiente"]');
    let pageNum = 2;
    while (hasNext && pageNum <= 20) {
        await page.click('a:has-text("Siguiente"), .siguiente, [title="Siguiente"]').catch(() => { });
        await page.waitForTimeout(2000);
        const more = await parseActuaciones(page);
        if (more.length === 0)
            break;
        actuaciones.push(...more);
        pageNum++;
        hasNext = await page.$('a:has-text("Siguiente"), .siguiente');
    }
    const hashInput = actuaciones.slice(0, 5).map(a => `${a.fecha}|${a.acto}|${a.sumilla}`).join(';');
    const hash = crypto_1.default.createHash('md5').update(hashInput || numeroExpediente).digest('hex');
    await uploadActuacionDocuments(page, actuaciones, numeroExpediente);
    return { ...baseResult, ...headerData, actuaciones, totalActuaciones: actuaciones.length, hash, portalDown: false };
}
// Fill form and scrape results from a page that already loaded CEJ successfully.
async function fillAndScrape(page, numeroExpediente, baseResult, parte) {
    const parts = numeroExpediente.split('-');
    const firstNum = parseInt(parts[0] || '0', 10);
    const isOldFormat = firstNum >= 1990 && firstNum <= 2030;
    const anio = isOldFormat ? parts[0] || '' : parts[1] || '';
    const nroExp = isOldFormat ? parts[1] || '' : parts[0] || '';
    const inc = parts[2] || '0';
    const dist = parts[3] || '';
    const instCod = parts[4] || '';
    const espCod = parts[5] || '';
    const orgCod = parts[6] || '';
    await page.waitForSelector('#consultarExpedientes', { timeout: 20000, state: 'attached' })
        .catch(() => console.log('[CEJ] #consultarExpedientes not found immediately'));
    await page.waitForTimeout(1000);
    // ── Strategy 1: Tab 2 "Por Código de Expediente" ────────────────────────
    console.log('[CEJ] Trying Tab 2 (Por Código)...');
    try {
        // parte is mandatory (Ley 29733)
        if (!parte || !parte.trim())
            throw new Error('parte requerida');
        // CEJ last box (instancia/juzgado) expects 2 digits (e.g. 01, 03, 06). Do NOT strip leading zeros.
        const courtNum = String(orgCod || '').padStart(2, '0').slice(-2);
        for (let capAttempt = 1; capAttempt <= 3; capAttempt++) {
            // Ensure Tab 1 visible for captcha
            await page.click('a[href="#tabs-1"], a:has-text("Por filtros"), #tabs-1').catch(() => { });
            await page.waitForTimeout(350);
            if (capAttempt > 1)
                await refreshImageCaptcha(page).catch(() => { });
            const captchaCode = await solveImageCaptchaFromDom(page, baseResult).catch(() => '');
            // Switch to Tab 2
            await page.click('a[href="#tabs-2"], a:has-text("Por Código"), #tabs-2').catch(() => { });
            await page.waitForTimeout(800);
            await page.evaluate((args) => {
                for (const [id, val] of Object.entries(args)) {
                    const el = document.getElementById(id);
                    if (el) {
                        el.value = val;
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }
            }, {
                cod_expediente: nroExp,
                cod_anio: anio,
                cod_incidente: inc,
                cod_distprov: dist,
                cod_organo: instCod,
                cod_especialidad: espCod,
                cod_instancia: courtNum,
            });
            console.log('[CEJ] Tab2 fields: exp=%s anio=%s dist=%s organo=%s esp=%s inst=%s parte=%s (capAttempt %s)', nroExp, anio, dist, instCod, espCod, courtNum, parte.substring(0, 20), capAttempt);
            await page.waitForTimeout(450);
            await page.evaluate((captcha) => {
                const captchaEl = document.getElementById('codigoCaptcha');
                if (captchaEl) {
                    captchaEl.value = captcha;
                    captchaEl.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }, captchaCode);
            await page.fill('input[placeholder*="APELLIDO"], input[name="parte"], #parte', parte).catch(() => page.evaluate((p) => {
                const parteEl = document.getElementById('parte');
                if (parteEl) {
                    parteEl.value = p;
                    parteEl.dispatchEvent(new Event('input', { bubbles: true }));
                    parteEl.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }, parte));
            const ajaxRespPromise = page.waitForResponse(resp => resp.url().includes('ValidarFiltrosCodigo'), { timeout: 35000 }).catch(() => null);
            const navPromise = page.waitForNavigation({ waitUntil: 'load', timeout: 45000 }).catch(() => null);
            await page.click('#consultarExpedientes').catch(async () => {
                // Fallback: call the CEJ JS function so their AJAX validation runs.
                await page.evaluate((captchaValue) => {
                    const form = document.querySelector('form');
                    if (!form)
                        return;
                    let input = document.querySelector('#codigoCaptcha');
                    if (!input || !form.contains(input)) {
                        input = document.createElement('input');
                        input.type = 'hidden';
                        input.name = 'codigoCaptcha';
                        input.id = 'codigoCaptcha';
                        form.appendChild(input);
                    }
                    input.value = captchaValue;
                }, captchaCode);
                await page.evaluate(() => {
                    const win = window;
                    const fn = win['consultarExpedientes'];
                    const form = document.getElementById('busquedaPorCodigo');
                    if (typeof fn === 'function')
                        fn();
                    else
                        form?.submit();
                });
            });
            const ajaxResp = await ajaxRespPromise;
            if (ajaxResp) {
                const ajaxText = (await ajaxResp.text().catch(() => '')).trim();
                const errorCodes = ['1', '2', '3', '4', '5', '-C', '-CM', '-CV', 'PE', 'parte_req', 'index', 'DistJud_x', 'Error...'];
                if (errorCodes.includes(ajaxText) || ajaxText.startsWith('Sin conexion') || ajaxText.startsWith('Sin servicio') || ajaxText.startsWith('No existen')) {
                    const errorMap = {
                        '1': 'parte no coincide con el expediente',
                        '2': 'error de conexión a la base de datos',
                        '3': 'no se encontraron registros',
                        '5': 'error de conexión',
                        '-C': 'captcha incorrecto',
                        '-CM': 'problema con captcha',
                        '-CV': 'captcha vacío',
                        'parte_req': 'parte requerida',
                        'DistJud_x': 'distrito judicial incorrecto',
                    };
                    console.log('[CEJ] Tab 2 AJAX validation failed:', errorMap[ajaxText] || ajaxText);
                    if (ajaxText === '-C' || ajaxText === '-CM' || ajaxText === '-CV') {
                        continue;
                    }
                    throw new Error(`Tab2 AJAX failed: ${errorMap[ajaxText] || ajaxText}`);
                }
            }
            await navPromise;
            console.log('[CEJ] Tab2 navigated to:', page.url());
            const result = await scrapeResultsPage(page, { ...baseResult }, numeroExpediente);
            if (result && (result.actuaciones.length > 0 || result.error)) {
                console.log('[CEJ] Tab 2 succeeded — actuaciones:', result.actuaciones.length);
                return result;
            }
        }
        console.log('[CEJ] Tab 2 captcha retries exhausted — falling back to Tab 1');
    }
    catch (e) {
        console.log('[CEJ] Tab 2 error:', e instanceof Error ? e.message : String(e));
    }
    // ── Strategy 2: Tab 1 "Por filtros" ─────────────────────────────────────
    console.log('[CEJ] Trying Tab 1 (Por filtros)...');
    try {
        // Navigate back to search page to try Tab 1
        await page.goto(CEJ_SEARCH_URL, { waitUntil: 'load', timeout: 30000 });
        await page.waitForTimeout(2000);
        await page.click('a[href="#tabs-1"], a:has-text("Por filtros")').catch(() => { });
        await page.waitForTimeout(500);
        const DIST_NAME = {
            '1801': 'LIMA', '0701': 'CALLAO', '1802': 'LIMA ESTE', '1803': 'LIMA NORTE',
            '1804': 'LIMA SUR', '1805': 'VENTANILLA', '0201': 'AMAZONAS', '0301': 'ANCASH',
            '0401': 'APURIMAC', '0501': 'AREQUIPA', '0601': 'CAJAMARCA', '0802': 'CUSCO',
            '1001': 'HUANCAVELICA', '1101': 'HUANUCO', '1201': 'ICA', '1301': 'JUNIN',
            '1401': 'LA LIBERTAD', '1501': 'LAMBAYEQUE', '1601': 'LORETO',
            '1701': 'MADRE DE DIOS', '1901': 'MOQUEGUA', '2001': 'PASCO',
            '2101': 'PIURA', '2102': 'SULLANA', '2201': 'PUNO',
            '2301': 'SAN MARTIN', '2401': 'TACNA', '2501': 'TUMBES', '2601': 'UCAYALI',
        };
        const INST_NAME = {
            'JR': 'ESPECIALIZADO', 'JP': 'PAZ LETRADO', 'MX': 'MIXTO',
            'SA': 'SALA SUPERIOR', 'ST': 'SALA SUPERIOR', 'SC': 'SALA SUPERIOR',
            'SP': 'SALA SUPERIOR', 'SL': 'SALA SUPERIOR', 'CS': 'SALA SUPREMA',
        };
        const ESP_NAME = {
            'CI': 'CIVIL', 'PE': 'PENAL', 'LA': 'LABORAL', 'FA': 'FAMILIA',
            'CO': 'COMERCIAL', 'CA': 'CONSTITUCIONAL', 'AD': 'CONTENCIOSO',
            'CT': 'CONTENCIOSO', 'NI': 'NIÑO', 'LC': 'LIQUIDACION',
        };
        const distName = DIST_NAME[dist] || null;
        if (dist) {
            await page.evaluate((args) => {
                const sel = document.querySelector('#distritoJudicial');
                if (!sel)
                    return;
                const opt = args.name
                    ? Array.from(sel.options).find(o => o.text.trim().toUpperCase().includes(args.name.toUpperCase()))
                    : Array.from(sel.options).find(o => o.text.includes(args.code));
                if (opt) {
                    sel.value = opt.value;
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }, { name: distName, code: dist }).catch(() => { });
            await page.waitForFunction(() => {
                const sel = document.querySelector('#organoJurisdiccional');
                return sel && sel.options.length > 1;
            }, { timeout: 8000 }).catch(() => { });
            await page.waitForTimeout(500);
        }
        if (instCod) {
            const instText = INST_NAME[instCod.toUpperCase()] || null;
            await page.evaluate((keyword) => {
                const sel = document.querySelector('#organoJurisdiccional');
                if (!sel || sel.options.length < 2)
                    return;
                const opt = keyword
                    ? Array.from(sel.options).find(o => o.text.toUpperCase().includes(keyword.toUpperCase()))
                    : sel.options[1];
                if (opt) {
                    sel.value = opt.value;
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }, instText).catch(() => { });
            await page.waitForFunction(() => {
                const sel = document.querySelector('#especialidad');
                return sel && sel.options.length > 1;
            }, { timeout: 8000 }).catch(() => { });
            await page.waitForTimeout(300);
        }
        if (espCod) {
            const espText = ESP_NAME[espCod.toUpperCase()] || null;
            await page.evaluate((keyword) => {
                const sel = document.querySelector('#especialidad');
                if (!sel || sel.options.length < 2)
                    return;
                const opt = keyword
                    ? Array.from(sel.options).find(o => o.text.toUpperCase().includes(keyword.toUpperCase()))
                    : sel.options[1];
                if (opt) {
                    sel.value = opt.value;
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }, espText).catch(() => { });
            await page.waitForTimeout(300);
        }
        if (anio) {
            await page.evaluate((y) => {
                const sel = document.querySelector('#anio');
                if (!sel)
                    return;
                const opt = Array.from(sel.options).find(o => o.value === y || o.text === y);
                if (opt) {
                    sel.value = opt.value;
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }, anio).catch(() => { });
            await page.waitForTimeout(200);
        }
        // Tab 1 #numeroExpediente expects just the number (e.g. "33088"), not the full format string
        const numInput = await page.$('#numeroExpediente');
        if (numInput) {
            await numInput.click();
            await numInput.fill(nroExp);
        }
        console.log('[CEJ] Tab1 form filled: dist=%s inst=%s esp=%s anio=%s nroExp=%s', dist, instCod, espCod, anio, nroExp);
        await page.waitForTimeout(600);
        // Solve image captcha for Tab 1
        const captchaImgEl = await page.$('#captcha_image, img[id="captcha_image"]');
        if (captchaImgEl) {
            baseResult.captchaDetected = true;
            console.log('[CEJ] Tab1 image captcha detected — solving...');
            try {
                await captchaImgEl.scrollIntoViewIfNeeded();
                await page.waitForTimeout(300);
                const imgBuffer = await captchaImgEl.screenshot({ type: 'jpeg', quality: 80 });
                const b64 = imgBuffer.toString('base64');
                if (b64) {
                    const code = await getImageCaptchaSolver().solve(b64);
                    const captchaInput = await page.$('#codigoCaptcha, input[name*="captcha"], input[id*="captcha"]');
                    if (captchaInput && code) {
                        await captchaInput.fill(code);
                        baseResult.captchaSolved = true;
                        console.log('[CEJ] Tab1 captcha filled:', code);
                    }
                }
            }
            catch (e) {
                console.error('[CEJ] Tab1 captcha error:', e instanceof Error ? e.message : String(e));
            }
        }
        // Fill parte using page.fill() for reliable value setting
        if (parte) {
            await page.fill('input[placeholder*="APELLIDO"], input[name="parte"], #parte', parte).catch(() => page.evaluate((p) => {
                const parteEl = document.getElementById('parte');
                if (parteEl) {
                    parteEl.value = p;
                    if (!parteEl.name)
                        parteEl.name = 'parte';
                    parteEl.dispatchEvent(new Event('input', { bubbles: true }));
                    parteEl.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }, parte));
        }
        // Verify parte in DOM before Tab 1 click
        const tab1ParteInDom = await page.evaluate(() => {
            const el = document.getElementById('parte');
            return el?.value || '(empty)';
        }).catch(() => '(error)');
        console.log('[CEJ] parte in DOM before Tab1 click:', tab1ParteInDom);
        // Intercept Tab 1 AJAX (ValidarFiltros.htm) to fail fast on errors
        const tab1AjaxReqPromise = page.waitForRequest(req => req.url().includes('ValidarFiltros') && !req.url().includes('ValidarFiltrosCodigo'), { timeout: 30000 }).catch(() => null);
        const tab1AjaxRespPromise = page.waitForResponse(resp => resp.url().includes('ValidarFiltros') && !resp.url().includes('ValidarFiltrosCodigo'), { timeout: 30000 }).catch(() => null);
        const navPromise1 = page.waitForNavigation({ waitUntil: 'load', timeout: 45000 }).catch(() => null);
        await page.click('#consultarExpedientes').catch(async () => {
            await page.evaluate(() => {
                const win = window;
                const fn = win['consultarExpedientes'];
                if (typeof fn === 'function')
                    fn();
                else
                    document.getElementById('busquedaFiltros')?.submit();
            });
        });
        // Log Tab 1 AJAX request body
        const tab1AjaxReq = await tab1AjaxReqPromise;
        if (tab1AjaxReq) {
            console.log('[CEJ] ValidarFiltros request body:', (tab1AjaxReq.postData() || '(none)').substring(0, 300));
        }
        // Check Tab 1 AJAX response
        const tab1AjaxResp = await tab1AjaxRespPromise;
        if (tab1AjaxResp) {
            const tab1AjaxBody = await tab1AjaxResp.body().catch(() => Buffer.alloc(0));
            const tab1AjaxText = tab1AjaxBody.toString('utf-8').trim();
            console.log('[CEJ] ValidarFiltros response:', tab1AjaxText.substring(0, 200));
            const errorCodes1 = ['1', '2', '3', '4', '5', '-C', '-CM', '-CV', 'PE', 'parte_req', 'index', 'DistJud_x', 'Error...'];
            if (errorCodes1.includes(tab1AjaxText) || tab1AjaxText.startsWith('Sin conexion') || tab1AjaxText.startsWith('Sin servicio') || tab1AjaxText.startsWith('No existen')) {
                const errorMap1 = {
                    '1': 'parte no coincide con el expediente',
                    '2': 'error de conexión a la base de datos',
                    '3': 'no se encontraron registros',
                    '-C': 'captcha incorrecto',
                    '-CV': 'captcha vacío',
                    'parte_req': 'parte requerida',
                };
                console.log('[CEJ] Tab 1 AJAX validation failed:', errorMap1[tab1AjaxText] || tab1AjaxText);
                throw new Error(`Tab1 AJAX failed: ${errorMap1[tab1AjaxText] || tab1AjaxText}`);
            }
        }
        else {
            console.log('[CEJ] Tab 1 AJAX did not fire (client-side validation failed?)');
        }
        await navPromise1;
        console.log('[CEJ] Tab1 navigated to:', page.url());
        const result = await scrapeResultsPage(page, { ...baseResult }, numeroExpediente, true);
        if (result) {
            console.log('[CEJ] Tab 1 result — actuaciones:', result.actuaciones.length);
            return result;
        }
    }
    catch (e) {
        console.log('[CEJ] Tab 1 error:', e instanceof Error ? e.message : String(e));
    }
    return null;
}
// Attempt to reach CEJ without solving hCaptcha (direct access).
async function tryDirectAccess(numeroExpediente, baseResult, parte) {
    let browser = null;
    try {
        applyCejStealthOnce();
        browser = await playwright_extra_1.chromium.launch(cejChromiumLaunchOptions());
        const context = await browser.newContext({
            ignoreHTTPSErrors: true,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1280, height: 800 },
            locale: 'es-PE',
        });
        console.log(`[CEJ] Direct access attempt: ${CEJ_SEARCH_URL}`);
        const page = await context.newPage();
        await page.goto(CEJ_SEARCH_URL, { waitUntil: 'load', timeout: 30000 });
        await page.waitForTimeout(3000);
        let currentUrl = page.url();
        let title = await page.title();
        console.log(`[CEJ] After 3s — url: ${currentUrl.substring(0, 80)}  title: ${title}`);
        if (!isRadwareBlocked(currentUrl, title)) {
            console.log('[CEJ] Search URL loaded without Radware — proceeding');
            const result = await fillAndScrape(page, numeroExpediente, { ...baseResult }, parte).catch((err) => {
                console.log('[CEJ] fillAndScrape error:', err instanceof Error ? err.message : String(err));
                return null;
            });
            await browser.close();
            return result;
        }
        console.log('[CEJ] Search URL blocked — trying detail URL for session warm-up');
        await page.goto(CEJ_DETAIL_URL, { waitUntil: 'load', timeout: 30000 });
        await page.waitForTimeout(3000);
        currentUrl = page.url();
        title = await page.title();
        console.log(`[CEJ] Detail URL — url: ${currentUrl.substring(0, 80)}  title: ${title}`);
        if (isRadwareBlocked(currentUrl, title)) {
            console.log('[CEJ] Detail URL also blocked');
            await browser.close();
            return null;
        }
        console.log('[CEJ] Detail URL passed — retrying search URL with established session');
        await page.goto(CEJ_SEARCH_URL, { waitUntil: 'load', timeout: 30000 });
        await page.waitForTimeout(3000);
        currentUrl = page.url();
        title = await page.title();
        if (isRadwareBlocked(currentUrl, title)) {
            console.log('[CEJ] Search URL still blocked after warm-up');
            await browser.close();
            return null;
        }
        const result = await fillAndScrape(page, numeroExpediente, { ...baseResult }, parte).catch((err) => {
            console.log('[CEJ] fillAndScrape error:', err instanceof Error ? err.message : String(err));
            return null;
        });
        await browser.close();
        return result;
    }
    catch (err) {
        console.log('[CEJ] Direct access failed:', err instanceof Error ? err.message : String(err));
        if (browser)
            await browser.close().catch(() => { });
        return null;
    }
}
async function scrapeCEJ(numeroExpediente, parte) {
    try {
        const MAX_RETRIES = process.env.NODE_ENV === 'test' ? 1 : 3;
        return await _scrapeCEJ(numeroExpediente, MAX_RETRIES, parte);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[CEJ] scrapeCEJ aborted:', msg);
        return {
            numeroExpediente,
            organoJurisdiccional: '', distritoJudicial: '', juez: '',
            especialidad: '', proceso: '', etapa: '', estadoProceso: '',
            partes: [], actuaciones: [], totalActuaciones: 0, hash: '',
            portalDown: true, captchaDetected: false, captchaSolved: false,
            scrapedAt: new Date().toISOString(),
            error: msg,
        };
    }
}
async function _scrapeCEJ(numeroExpediente, maxRetries, parte) {
    const baseResult = {
        numeroExpediente,
        organoJurisdiccional: '', distritoJudicial: '', juez: '',
        especialidad: '', proceso: '', etapa: '', estadoProceso: '',
        partes: [], actuaciones: [], totalActuaciones: 0, hash: '',
        portalDown: false, captchaDetected: false, captchaSolved: false,
        scrapedAt: new Date().toISOString(),
    };
    const TWOCAPTCHA_KEY = process.env.TWOCAPTCHA_API_KEY || '';
    const solver = TWOCAPTCHA_KEY ? new _2captcha_ts_1.Solver(TWOCAPTCHA_KEY) : null;
    // ── Step 1: try without Radware captcha ──────────────────────────────────
    console.log('[CEJ] Trying direct access (no Radware captcha)...');
    const directResult = await tryDirectAccess(numeroExpediente, { ...baseResult }, parte);
    if (directResult) {
        console.log('[CEJ] Direct access succeeded!');
        return directResult;
    }
    console.log('[CEJ] Direct access blocked — falling back to hCaptcha-solving flow');
    // ── Step 2: hCaptcha-solving loop (Radware Bot Manager) ──────────────────
    let browser = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[CEJ] hCaptcha attempt ${attempt}/${maxRetries} — ${numeroExpediente}`);
            applyCejStealthOnce();
            browser = await playwright_extra_1.chromium.launch(cejChromiumLaunchOptions());
            const context = await browser.newContext({
                ignoreHTTPSErrors: true,
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                viewport: { width: 1280, height: 800 },
                locale: 'es-PE',
            });
            const page = await context.newPage();
            console.log('[CEJ] Navigating to portal...');
            await page.goto(CEJ_SEARCH_URL, { waitUntil: 'load', timeout: 30000 });
            if (await hasPerfdriveChallengeIframe(page)) {
                console.log('[CEJ] Radware Bot Manager detected (perfdrive iframe) — solving hCaptcha...');
                baseResult.captchaDetected = true;
                const sitekey = await page.evaluate(() => {
                    const direct = document.querySelector('[data-sitekey]');
                    if (direct)
                        return direct.getAttribute('data-sitekey') || '';
                    const iframe = document.querySelector('iframe[src*="hcaptcha"][src*="sitekey"]');
                    if (iframe) {
                        const src = iframe.getAttribute('src') || '';
                        const m = src.match(/sitekey=([a-f0-9-]+)/);
                        return m ? m[1] : '';
                    }
                    return '';
                }).catch(() => '');
                console.log('[CEJ] Radware sitekey:', sitekey || '(none)');
                if (!sitekey) {
                    await browser.close();
                    browser = null;
                    if (attempt < maxRetries) {
                        await new Promise(r => setTimeout(r, 8000));
                        continue;
                    }
                    return { ...baseResult, portalDown: true, error: 'Portal CEJ protegido por Radware — no se pudo extraer sitekey.' };
                }
                console.log('[CEJ] Using captcha solver:', process.env.CAPSOLVER_API_KEY ? 'CapSolver' : '2captcha');
                // Try CapSolver first (direct HTTP), fall back to 2captcha
                let captchaToken = await Promise.race([
                    solveHCaptchaWithCapSolver(sitekey, page.url()),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('CapSolver timeout 60s')), 60000)),
                ]).catch((e) => {
                    console.error('[CEJ] CapSolver timed out:', e instanceof Error ? e.message : String(e));
                    return null;
                });
                if (!captchaToken && solver) {
                    console.log('[CEJ] CapSolver failed — trying 2captcha hCaptcha...');
                    console.log('[CEJ] Using captcha solver: 2captcha (fallback)');
                    try {
                        const captchaResult = await solver.hcaptcha({ pageurl: page.url(), sitekey });
                        captchaToken = captchaResult.data || null;
                    }
                    catch (captchaErr) {
                        const errCode = captchaErr?.err || '';
                        const errMsg = captchaErr instanceof Error ? captchaErr.message : String(captchaErr);
                        console.error('[CEJ] 2captcha hCaptcha also failed:', errCode || errMsg);
                    }
                }
                if (captchaToken) {
                    await page.evaluate((token) => {
                        document.querySelectorAll('textarea[name="h-captcha-response"]').forEach(ta => {
                            ta.value = token;
                        });
                        const win = window;
                        if (typeof win['ocs'] === 'function')
                            win['ocs']();
                    }, captchaToken);
                    await page.waitForNavigation({ waitUntil: 'load', timeout: 30000 }).catch(() => { });
                    console.log('[CEJ] Radware hCaptcha solved, now at:', page.url());
                    baseResult.captchaSolved = true;
                }
                else {
                    await browser.close();
                    browser = null;
                    if (attempt < maxRetries) {
                        await new Promise(r => setTimeout(r, 8000));
                        continue;
                    }
                    return { ...baseResult, portalDown: true, error: 'No se pudo resolver el hCaptcha de Radware (CapSolver y 2captcha fallaron).' };
                }
            }
            const result = await fillAndScrape(page, numeroExpediente, baseResult, parte);
            await browser.close();
            if (result)
                return result;
            if (attempt < maxRetries)
                await new Promise(r => setTimeout(r, 6000 * attempt));
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            console.error(`[CEJ] hCaptcha attempt ${attempt} failed:`, msg);
            if (browser) {
                await browser.close().catch(() => { });
                browser = null;
            }
            if (attempt < maxRetries)
                await new Promise(r => setTimeout(r, 6000 * attempt));
        }
    }
    return { ...baseResult, portalDown: true, error: 'Portal CEJ no disponible después de 3 intentos' };
}
