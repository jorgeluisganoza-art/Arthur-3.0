import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    const dbPath = process.env.DB_PATH || './data/arthur.db';
    const resolvedPath = path.resolve(process.cwd(), dbPath);
    const dataDir = path.dirname(resolvedPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    _db = new Database(resolvedPath);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tramites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL,
      numero_titulo TEXT NOT NULL,
      anio TEXT NOT NULL,
      oficina_registral TEXT NOT NULL,
      oficina_nombre TEXT,
      alias TEXT NOT NULL,
      estado_actual TEXT DEFAULT 'SIN DATOS',
      estado_hash TEXT,
      observacion_texto TEXT,
      calificador TEXT,
      polling_frequency_hours INTEGER DEFAULT 4,
      polling_times TEXT,
      whatsapp_number TEXT,
      email TEXT,
      activo INTEGER DEFAULT 1,
      last_checked TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS historial (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tramite_id INTEGER NOT NULL REFERENCES tramites(id),
      estado TEXT NOT NULL,
      observacion TEXT,
      estado_hash TEXT,
      es_cambio INTEGER DEFAULT 0,
      notificacion_enviada INTEGER DEFAULT 0,
      scraped_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS plazos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tramite_id INTEGER NOT NULL REFERENCES tramites(id),
      descripcion TEXT NOT NULL,
      fecha_vencimiento TEXT NOT NULL,
      tipo TEXT,
      completado INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS documentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tramite_id INTEGER NOT NULL REFERENCES tramites(id),
      tipo TEXT NOT NULL,
      contenido TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tramite_id INTEGER REFERENCES tramites(id),
      canal TEXT NOT NULL,
      estado TEXT,
      mensaje TEXT,
      enviado_at TEXT DEFAULT (datetime('now')),
      success INTEGER DEFAULT 1
    );
  `);

  // Seed data on first run
  const count = db.prepare('SELECT COUNT(*) as c FROM tramites').get() as { c: number };
  if (count.c === 0) {
    seedData(db);
  }
}

function seedData(db: Database.Database) {
  const now = new Date();

  const insert = db.prepare(`
    INSERT INTO tramites (tipo, numero_titulo, anio, oficina_registral, oficina_nombre,
      alias, estado_actual, observacion_texto, polling_frequency_hours, whatsapp_number, email, activo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  const r1 = insert.run(
    'predio', '001234', '2024', '1401', 'Lima',
    'Casa San Borja', 'OBSERVADO',
    'Se observa el título por los siguientes motivos: 1) El plano de localización no coincide con las coordenadas UTM consignadas en la memoria descriptiva. 2) La firma del propietario en la minuta no cuenta con certificación notarial vigente. Sírvase subsanar en el plazo de ley.',
    4, '+51999000001', 'hector@estudio.pe'
  );

  insert.run(
    'empresa', '005678', '2024', '1401', 'Lima',
    'Tech Solutions SAC', 'PENDIENTE',
    null, 4, null, null
  );

  insert.run(
    'vehiculo', '009012', '2024', '1401', 'Lima',
    'Toyota Hilux', 'INSCRITO',
    null, 8, null, null
  );

  // Seed plazos for tramite 1
  const tramite1Id = r1.lastInsertRowid as number;
  const fecha30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const fecha15 = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const insertPlazo = db.prepare(`
    INSERT INTO plazos (tramite_id, descripcion, fecha_vencimiento, tipo)
    VALUES (?, ?, ?, ?)
  `);

  insertPlazo.run(tramite1Id, 'Plazo de subsanación de observaciones', fecha30, 'subsanacion');
  insertPlazo.run(tramite1Id, 'Plazo para recurso de apelación', fecha15, 'apelacion');

  // Seed initial historial for tramite 1
  db.prepare(`
    INSERT INTO historial (tramite_id, estado, observacion, es_cambio)
    VALUES (?, ?, ?, ?)
  `).run(
    tramite1Id,
    'OBSERVADO',
    'Se observa el título por los siguientes motivos: 1) El plano de localización no coincide con las coordenadas UTM consignadas en la memoria descriptiva.',
    1
  );
}

// ── Query helpers ────────────────────────────────────────────────────────────

export interface Tramite {
  id: number;
  tipo: string;
  numero_titulo: string;
  anio: string;
  oficina_registral: string;
  oficina_nombre: string | null;
  alias: string;
  estado_actual: string;
  estado_hash: string | null;
  observacion_texto: string | null;
  calificador: string | null;
  polling_frequency_hours: number;
  polling_times: string | null;
  whatsapp_number: string | null;
  email: string | null;
  activo: number;
  last_checked: string | null;
  created_at: string;
}

export interface Historial {
  id: number;
  tramite_id: number;
  estado: string;
  observacion: string | null;
  estado_hash: string | null;
  es_cambio: number;
  notificacion_enviada: number;
  scraped_at: string;
}

export interface Plazo {
  id: number;
  tramite_id: number;
  descripcion: string;
  fecha_vencimiento: string;
  tipo: string | null;
  completado: number;
  created_at: string;
}

export interface Notification {
  id: number;
  tramite_id: number | null;
  canal: string;
  estado: string | null;
  mensaje: string | null;
  enviado_at: string;
  success: number;
}

export function getAllTramites(): Tramite[] {
  return getDb().prepare('SELECT * FROM tramites WHERE activo = 1 ORDER BY created_at DESC').all() as Tramite[];
}

export function getTramiteById(id: number): Tramite | null {
  return getDb().prepare('SELECT * FROM tramites WHERE id = ? AND activo = 1').get(id) as Tramite | null;
}

export function createTramite(data: Partial<Tramite>): Tramite {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO tramites (tipo, numero_titulo, anio, oficina_registral, oficina_nombre,
      alias, polling_frequency_hours, polling_times, whatsapp_number, email)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.tipo, data.numero_titulo, data.anio, data.oficina_registral, data.oficina_nombre ?? null,
    data.alias, data.polling_frequency_hours ?? 4, data.polling_times ?? null,
    data.whatsapp_number ?? null, data.email ?? null
  );
  return getTramiteById(result.lastInsertRowid as number)!;
}

export function updateTramite(id: number, data: Partial<Tramite>) {
  const db = getDb();
  const fields = Object.keys(data).filter(k => k !== 'id');
  if (fields.length === 0) return;
  const setClause = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => (data as Record<string, unknown>)[f]);
  db.prepare(`UPDATE tramites SET ${setClause} WHERE id = ?`).run(...values, id);
}

export function deleteTramite(id: number) {
  getDb().prepare('UPDATE tramites SET activo = 0 WHERE id = ?').run(id);
}

export function getHistorialByTramite(tramiteId: number): Historial[] {
  return getDb().prepare(
    'SELECT * FROM historial WHERE tramite_id = ? ORDER BY scraped_at DESC'
  ).all(tramiteId) as Historial[];
}

export function addHistorial(tramiteId: number, estado: string, observacion: string | null, estadoHash: string | null, esCambio: boolean): void {
  getDb().prepare(`
    INSERT INTO historial (tramite_id, estado, observacion, estado_hash, es_cambio)
    VALUES (?, ?, ?, ?, ?)
  `).run(tramiteId, estado, observacion, estadoHash, esCambio ? 1 : 0);
}

export function getPlazos(tramiteId?: number): Plazo[] {
  const db = getDb();
  if (tramiteId !== undefined) {
    return db.prepare(
      'SELECT * FROM plazos WHERE tramite_id = ? AND completado = 0 ORDER BY fecha_vencimiento ASC'
    ).all(tramiteId) as Plazo[];
  }
  return db.prepare(
    'SELECT p.*, t.alias FROM plazos p JOIN tramites t ON p.tramite_id = t.id WHERE p.completado = 0 ORDER BY p.fecha_vencimiento ASC'
  ).all() as Plazo[];
}

export function addPlazo(tramiteId: number, descripcion: string, fechaVencimiento: string, tipo: string) {
  getDb().prepare(`
    INSERT INTO plazos (tramite_id, descripcion, fecha_vencimiento, tipo)
    VALUES (?, ?, ?, ?)
  `).run(tramiteId, descripcion, fechaVencimiento, tipo);
}

export function getNotificationsByTramite(tramiteId: number, limit = 5): Notification[] {
  return getDb().prepare(
    'SELECT * FROM notifications WHERE tramite_id = ? ORDER BY enviado_at DESC LIMIT ?'
  ).all(tramiteId, limit) as Notification[];
}

export function logNotification(tramiteId: number, canal: string, estado: string, mensaje: string, success: boolean) {
  getDb().prepare(`
    INSERT INTO notifications (tramite_id, canal, estado, mensaje, success)
    VALUES (?, ?, ?, ?, ?)
  `).run(tramiteId, canal, estado, mensaje, success ? 1 : 0);
}

export function getDashboardStats() {
  const db = getDb();
  const rows = db.prepare(
    'SELECT estado_actual, COUNT(*) as count FROM tramites WHERE activo = 1 GROUP BY estado_actual'
  ).all() as { estado_actual: string; count: number }[];

  const stats: Record<string, number> = {};
  let total = 0;
  for (const row of rows) {
    stats[row.estado_actual] = row.count;
    total += row.count;
  }

  return {
    total,
    observados: stats['OBSERVADO'] || 0,
    pendientes: stats['PENDIENTE'] || 0,
    inscritos: stats['INSCRITO'] || 0,
    tachas: stats['TACHA'] || 0,
    sinDatos: stats['SIN DATOS'] || 0,
  };
}

export function saveDocument(tramiteId: number, tipo: string, contenido: string) {
  getDb().prepare(`
    INSERT INTO documentos (tramite_id, tipo, contenido)
    VALUES (?, ?, ?)
  `).run(tramiteId, tipo, contenido);
}

export default getDb;
