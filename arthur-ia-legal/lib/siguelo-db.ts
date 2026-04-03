/**
 * siguelo-db.ts
 *
 * Equivalente SQLite de arthur-siguelo/lib/supabase.ts.
 * Usa la misma base de datos arthur.db de Jorge (WAL mode, misma ruta).
 * No modifica ninguna tabla existente — solo agrega titulos_siguelo e historial_siguelo.
 */

import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { randomUUID } from 'crypto'
import type { Titulo, HistorialEstado } from '@/types/siguelo'

// ── Conexión — misma ruta que lib/db.ts de Jorge ─────────────────────────────

let _db: Database.Database | null = null

function getDb(): Database.Database {
  if (!_db) {
    const isVercel = !!process.env.VERCEL
    const dbPath = isVercel
      ? '/tmp/arthur.db'
      : path.resolve(process.cwd(), process.env.DB_PATH || './data/arthur.db')

    const dataDir = path.dirname(dbPath)
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }

    _db = new Database(dbPath)
    _db.pragma('journal_mode = WAL')
    _db.pragma('foreign_keys = ON')
    initSchema(_db)
  }
  return _db
}

// ── Schema — solo tablas siguelo, nunca toca las de Jorge ────────────────────

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS titulos_siguelo (
      id TEXT PRIMARY KEY,
      oficina_registral TEXT NOT NULL,
      anio_titulo INTEGER NOT NULL,
      numero_titulo TEXT NOT NULL,
      nombre_cliente TEXT NOT NULL,
      email_cliente TEXT NOT NULL,
      whatsapp_cliente TEXT NOT NULL,
      proyecto TEXT,
      asunto TEXT,
      registro TEXT,
      abogado TEXT,
      notaria TEXT,
      ultimo_estado TEXT,
      ultima_consulta TEXT,
      area_registral TEXT,
      numero_partida TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS historial_siguelo (
      id TEXT PRIMARY KEY,
      titulo_id TEXT NOT NULL REFERENCES titulos_siguelo(id) ON DELETE CASCADE,
      estado_anterior TEXT NOT NULL,
      estado_nuevo TEXT NOT NULL,
      detectado_en TEXT DEFAULT (datetime('now'))
    );
  `)
}

// ── Helpers de mapeo ──────────────────────────────────────────────────────────

type RawTitulo = {
  id: string
  oficina_registral: string
  anio_titulo: number
  numero_titulo: string
  nombre_cliente: string
  email_cliente: string
  whatsapp_cliente: string
  proyecto: string | null
  asunto: string | null
  registro: string | null
  abogado: string | null
  notaria: string | null
  ultimo_estado: string | null
  ultima_consulta: string | null
  area_registral: string | null
  numero_partida: string | null
  created_at: string
}

type RawHistorial = {
  id: string
  titulo_id: string
  estado_anterior: string
  estado_nuevo: string
  detectado_en: string
}

// ── Funciones públicas — equivalentes 1:1 a supabase.ts ──────────────────────

export function getTitulosSiguelo(): Titulo[] {
  return getDb()
    .prepare('SELECT * FROM titulos_siguelo ORDER BY created_at DESC')
    .all() as Titulo[]
}

export function createTituloSiguelo(
  titulo: Omit<Titulo, 'id' | 'created_at'>
): string {
  const id = randomUUID()
  getDb().prepare(`
    INSERT INTO titulos_siguelo (
      id, oficina_registral, anio_titulo, numero_titulo,
      nombre_cliente, email_cliente, whatsapp_cliente,
      proyecto, asunto, registro, abogado, notaria,
      ultimo_estado, ultima_consulta, area_registral, numero_partida
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `).run(
    id,
    titulo.oficina_registral,
    titulo.anio_titulo,
    titulo.numero_titulo,
    titulo.nombre_cliente,
    titulo.email_cliente,
    titulo.whatsapp_cliente,
    titulo.proyecto ?? null,
    titulo.asunto ?? null,
    titulo.registro ?? null,
    titulo.abogado ?? null,
    titulo.notaria ?? null,
    titulo.ultimo_estado ?? null,
    titulo.ultima_consulta ?? null,
    titulo.area_registral ?? null,
    titulo.numero_partida ?? null,
  )
  return id
}

export function actualizarEstadoTituloSiguelo(
  id: string,
  nuevoEstado: string,
  areaRegistral?: string | null,
  numeroPartida?: string | null
): void {
  const updates: string[] = [
    'ultimo_estado = ?',
    "ultima_consulta = datetime('now')",
  ]
  const values: unknown[] = [nuevoEstado]

  if (areaRegistral !== undefined) {
    updates.push('area_registral = ?')
    values.push(areaRegistral)
  }
  if (numeroPartida !== undefined) {
    updates.push('numero_partida = ?')
    values.push(numeroPartida)
  }

  values.push(id)
  getDb()
    .prepare(`UPDATE titulos_siguelo SET ${updates.join(', ')} WHERE id = ?`)
    .run(...values)
}

export function registrarCambioEstadoSiguelo(
  entrada: Omit<HistorialEstado, 'id' | 'detectado_en'>
): void {
  getDb().prepare(`
    INSERT INTO historial_siguelo (id, titulo_id, estado_anterior, estado_nuevo)
    VALUES (?, ?, ?, ?)
  `).run(
    randomUUID(),
    entrada.titulo_id,
    entrada.estado_anterior,
    entrada.estado_nuevo,
  )
}

export function getUltimoEstadoSiguelo(titulo_id: string): string | null {
  const row = getDb()
    .prepare('SELECT ultimo_estado FROM titulos_siguelo WHERE id = ?')
    .get(titulo_id) as Pick<RawTitulo, 'ultimo_estado'> | undefined
  return row?.ultimo_estado ?? null
}

export function getTituloSigueloById(id: string): Titulo | null {
  const row = getDb()
    .prepare('SELECT * FROM titulos_siguelo WHERE id = ?')
    .get(id) as RawTitulo | undefined
  return row ?? null
}

export function eliminarTituloSiguelo(id: string): void {
  // historial_siguelo se borra en cascada por la FK ON DELETE CASCADE
  getDb()
    .prepare('DELETE FROM titulos_siguelo WHERE id = ?')
    .run(id)
}

export function getHistorialSigueloByTituloId(titulo_id: string): HistorialEstado[] {
  return getDb()
    .prepare(
      'SELECT * FROM historial_siguelo WHERE titulo_id = ? ORDER BY detectado_en DESC'
    )
    .all(titulo_id) as RawHistorial[]
}
