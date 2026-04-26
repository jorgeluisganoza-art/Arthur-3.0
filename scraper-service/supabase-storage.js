'use strict'

let _warnedNoCfg = false
let _supabase = null

function _warnOnce(msg) {
  if (_warnedNoCfg) return
  _warnedNoCfg = true
  console.warn(msg)
}

function _sanitize(s, max = 120) {
  return String(s || '')
    .trim()
    .replace(/[\/\\]+/g, '-')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, max) || 'x'
}

function _getClient() {
  const url = (process.env.SUPABASE_URL || '').trim()
  const key = (process.env.SUPABASE_SERVICE_KEY || '').trim()
  if (!url || !key) {
    _warnOnce('[SUPABASE] No configurado — PDFs no se subirán')
    return null
  }
  if (_supabase) return _supabase
  try {
    const { createClient } = require('@supabase/supabase-js')
    _supabase = createClient(url, key, { auth: { persistSession: false } })
    return _supabase
  } catch (e) {
    console.warn('[SUPABASE] Error inicializando cliente:', e instanceof Error ? e.message : String(e))
    return null
  }
}

async function uploadPdfToSupabase(buf, numeroExpediente, fecha, acto) {
  const supabase = _getClient()
  if (!supabase) return null
  try {
    const bucket = (process.env.SUPABASE_BUCKET || 'Documentos CEJ').trim()
    const exp = _sanitize(numeroExpediente, 140)
    const f = _sanitize(String(fecha || '').replace(/\//g, '-'), 20)
    const a = _sanitize(String(acto || '').toLowerCase().replace(/\s+/g, '-'), 50)
    const ts = Math.floor(Date.now() / 1000)
    const path = `${exp}/${f}_${a}_${ts}.pdf`
    const { error: upErr } = await supabase.storage.from(bucket).upload(path, buf, {
      contentType: 'application/pdf',
      upsert: true,
    })
    if (upErr) {
      console.warn('[SUPABASE] Upload falló:', upErr.message || upErr)
      return null
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    return data && data.publicUrl ? String(data.publicUrl) : null
  } catch (e) {
    console.warn('[SUPABASE] Error subiendo PDF:', e instanceof Error ? e.message : String(e))
    return null
  }
}

exports.uploadPdfToSupabase = uploadPdfToSupabase
