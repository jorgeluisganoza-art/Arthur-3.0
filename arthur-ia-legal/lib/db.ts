import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    const isVercel = !!process.env.VERCEL;
    const rawPath = process.env.DB_PATH || './data/arthur.db';
    const dbPath = isVercel
      ? '/tmp/arthur.db'
      : path.isAbsolute(rawPath)
        ? rawPath
        : path.join(/* turbopackIgnore: true */ process.cwd(), rawPath);
    const dataDir = path.dirname(dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    _db = new Database(dbPath);
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
      created_at TEXT DEFAULT (datetime('now')),
      archived_at TEXT,
      deleted_at TEXT
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

    CREATE TABLE IF NOT EXISTS casos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_expediente TEXT NOT NULL,
      distrito_judicial TEXT NOT NULL,
      organo_jurisdiccional TEXT,
      juez TEXT,
      tipo_proceso TEXT,
      especialidad TEXT,
      etapa_procesal TEXT,
      partes TEXT,
      cliente TEXT,
      alias TEXT,
      monto TEXT,
      prioridad TEXT DEFAULT 'baja',
      estado TEXT DEFAULT 'activo',
      ultimo_movimiento TEXT,
      ultimo_movimiento_fecha TEXT,
      proximo_evento TEXT,
      proximo_evento_fecha TEXT,
      estado_hash TEXT,
      polling_frequency_hours INTEGER DEFAULT 4,
      whatsapp_number TEXT,
      email TEXT,
      activo INTEGER DEFAULT 1,
      last_checked TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS movimientos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      caso_id INTEGER NOT NULL REFERENCES casos(id),
      fecha TEXT,
      acto TEXT,
      folio TEXT,
      sumilla TEXT,
      es_nuevo INTEGER DEFAULT 1,
      urgencia TEXT DEFAULT 'info',
      ai_sugerencia TEXT,
      scraped_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audiencias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      caso_id INTEGER NOT NULL REFERENCES casos(id),
      descripcion TEXT NOT NULL,
      fecha TEXT NOT NULL,
      tipo TEXT,
      completado INTEGER DEFAULT 0,
      google_calendar_link TEXT,
      outlook_link TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS escritos_judiciales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      caso_id INTEGER NOT NULL REFERENCES casos(id),
      tipo TEXT NOT NULL,
      contenido TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notificaciones_judiciales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      caso_id INTEGER REFERENCES casos(id),
      canal TEXT NOT NULL,
      movimiento_descripcion TEXT,
      urgencia TEXT,
      ai_sugerencia TEXT,
      enviado_at TEXT DEFAULT (datetime('now')),
      success INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS titulos_sunarp (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      oficina_registral TEXT NOT NULL,
      oficina_nombre TEXT,
      anio_titulo TEXT NOT NULL,
      numero_titulo TEXT NOT NULL,
      nombre_cliente TEXT NOT NULL,
      email_cliente TEXT,
      whatsapp_cliente TEXT,
      ultimo_estado TEXT DEFAULT 'SIN DATOS',
      ultima_consulta TEXT,
      area_registral TEXT,
      numero_partida TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS historial_estados_sunarp (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo_id INTEGER NOT NULL REFERENCES titulos_sunarp(id),
      estado_anterior TEXT,
      estado_nuevo TEXT NOT NULL,
      detectado_en TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migrate: add archived_at/deleted_at columns if missing
  const cols = db.prepare("PRAGMA table_info(tramites)").all() as { name: string }[];
  const colNames = new Set(cols.map(c => c.name));
  if (!colNames.has('archived_at')) {
    db.exec('ALTER TABLE tramites ADD COLUMN archived_at TEXT');
  }
  if (!colNames.has('deleted_at')) {
    db.exec('ALTER TABLE tramites ADD COLUMN deleted_at TEXT');
  }

  // Purge tramites deleted > 30 days ago
  db.prepare(`
    DELETE FROM tramites
    WHERE deleted_at IS NOT NULL
      AND deleted_at < datetime('now', '-30 days')
  `).run();

  // Seed data on first run
  const count = db.prepare('SELECT COUNT(*) as c FROM tramites').get() as { c: number };
  if (count.c === 0) {
    seedData(db);
  }

  const casosCount = db.prepare('SELECT COUNT(*) as c FROM casos').get() as { c: number };
  if (casosCount.c === 0) {
    seedJudicialData(db);
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
    'predio', '001234', '2024', '0101', 'Lima',
    'Casa San Borja', 'OBSERVADO',
    'Se observa el título por los siguientes motivos: 1) El plano de localización no coincide con las coordenadas UTM consignadas en la memoria descriptiva. 2) La firma del propietario en la minuta no cuenta con certificación notarial vigente. Sírvase subsanar en el plazo de ley.',
    4, '+51999000001', 'hector@estudio.pe'
  );

  insert.run(
    'empresa', '005678', '2024', '0101', 'Lima',
    'Tech Solutions SAC', 'PENDIENTE',
    null, 4, null, null
  );

  insert.run(
    'vehiculo', '009012', '2024', '0101', 'Lima',
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

function seedJudicialData(db: Database.Database) {
  const now = new Date();
  const fecha30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const fecha45 = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const insertCaso = db.prepare(`
    INSERT INTO casos (
      numero_expediente, distrito_judicial, organo_jurisdiccional, juez, tipo_proceso,
      etapa_procesal, partes, cliente, alias, monto, prioridad, ultimo_movimiento,
      ultimo_movimiento_fecha, polling_frequency_hours, activo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const c1 = insertCaso.run(
    '10001-2022-0-1801-JR-CI-01',
    'Lima',
    '1er Juzgado Civil de Lima',
    'Dr. Marcos Villanueva Torres',
    'Civil',
    'Probatoria',
    '[{"rol":"demandante","nombre":"Constructora Andina SAC"},{"rol":"demandado","nombre":"Municipalidad de Lima"}]',
    'Constructora Andina SAC',
    'Constructora Andina vs Municipalidad',
    'PEN 450,000',
    'baja',
    'Período de prueba ampliado',
    '2025-02-03',
    4,
    1
  );

  insertCaso.run(
    '10002-2023-0-1801-JR-LA-02',
    'Arequipa',
    '2do Juzgado Laboral de Arequipa',
    null,
    'Laboral',
    'Instrucción',
    '[{"rol":"demandante","nombre":"Juan Pérez Ríos"},{"rol":"demandado","nombre":"Empresa Minera del Sur SAC"}]',
    'Juan Pérez Ríos',
    'Pérez vs Minera Sur',
    null,
    'media',
    null,
    null,
    4,
    1
  );

  insertCaso.run(
    '10003-2024-0-1801-JR-PE-03',
    'Cusco',
    null,
    null,
    'Penal',
    'Juicio oral',
    null,
    null,
    'Caso Banco Comercial',
    null,
    'alta',
    null,
    null,
    2,
    1
  );

  const caso1Id = c1.lastInsertRowid as number;
  const insertAudiencia = db.prepare(`
    INSERT INTO audiencias (caso_id, descripcion, fecha, tipo)
    VALUES (?, ?, ?, ?)
  `);
  insertAudiencia.run(caso1Id, 'Presentación de descargos', fecha30, 'plazo');
  insertAudiencia.run(caso1Id, 'Audiencia de pruebas', fecha45, 'audiencia');
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
  archived_at: string | null;
  deleted_at: string | null;
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
  return getDb().prepare(
    'SELECT * FROM tramites WHERE activo = 1 AND archived_at IS NULL AND deleted_at IS NULL ORDER BY created_at DESC'
  ).all() as Tramite[];
}

export function getTramiteById(id: number): Tramite | null {
  return getDb().prepare(
    'SELECT * FROM tramites WHERE id = ? AND deleted_at IS NULL'
  ).get(id) as Tramite | null;
}

/** Fila por id aunque esté en papelera (soft-delete); no existe si fue purgado del SQLite. */
export function findTramiteById(id: number): Tramite | null {
  return getDb().prepare('SELECT * FROM tramites WHERE id = ?').get(id) as Tramite | null;
}

export function getArchivedTramites(): Tramite[] {
  return getDb().prepare(
    'SELECT * FROM tramites WHERE archived_at IS NOT NULL AND deleted_at IS NULL ORDER BY archived_at DESC'
  ).all() as Tramite[];
}

export function getDeletedTramites(): Tramite[] {
  return getDb().prepare(
    'SELECT * FROM tramites WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC'
  ).all() as Tramite[];
}

export function archiveTramite(id: number) {
  getDb().prepare(
    "UPDATE tramites SET archived_at = datetime('now'), activo = 0 WHERE id = ? AND deleted_at IS NULL"
  ).run(id);
}

export function restoreTramite(id: number) {
  getDb().prepare(
    'UPDATE tramites SET archived_at = NULL, deleted_at = NULL, activo = 1 WHERE id = ?'
  ).run(id);
}

export function softDeleteTramite(id: number) {
  getDb().prepare(
    "UPDATE tramites SET deleted_at = datetime('now'), archived_at = NULL, activo = 0 WHERE id = ?"
  ).run(id);
}

export function permanentDeleteTramite(id: number) {
  const db = getDb();
  db.prepare('DELETE FROM historial WHERE tramite_id = ?').run(id);
  db.prepare('DELETE FROM plazos WHERE tramite_id = ?').run(id);
  db.prepare('DELETE FROM notifications WHERE tramite_id = ?').run(id);
  db.prepare('DELETE FROM documentos WHERE tramite_id = ?').run(id);
  db.prepare('DELETE FROM tramites WHERE id = ?').run(id);
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
  softDeleteTramite(id);
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
    'SELECT estado_actual, COUNT(*) as count FROM tramites WHERE activo = 1 AND archived_at IS NULL AND deleted_at IS NULL GROUP BY estado_actual'
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

// ── Judicial module helpers ───────────────────────────────────────────────────

export interface Caso {
  id: number;
  numero_expediente: string;
  distrito_judicial: string;
  organo_jurisdiccional: string | null;
  juez: string | null;
  tipo_proceso: string | null;
  especialidad: string | null;
  etapa_procesal: string | null;
  partes: string | null;
  cliente: string | null;
  alias: string | null;
  monto: string | null;
  prioridad: 'alta' | 'media' | 'baja';
  estado: 'activo' | 'concluido' | 'archivado';
  ultimo_movimiento: string | null;
  ultimo_movimiento_fecha: string | null;
  proximo_evento: string | null;
  proximo_evento_fecha: string | null;
  estado_hash: string | null;
  polling_frequency_hours: number;
  whatsapp_number: string | null;
  email: string | null;
  activo: number;
  last_checked: string | null;
  created_at: string;
}

export interface MovimientoJudicial {
  id: number;
  caso_id: number;
  fecha: string | null;
  acto: string | null;
  folio: string | null;
  sumilla: string | null;
  es_nuevo: number;
  urgencia: 'alta' | 'normal' | 'info';
  ai_sugerencia: string | null;
  scraped_at: string;
}

export interface AudienciaJudicial {
  id: number;
  caso_id: number;
  descripcion: string;
  fecha: string;
  tipo: string | null;
  completado: number;
  google_calendar_link: string | null;
  outlook_link: string | null;
  created_at: string;
}

export interface EscritoJudicial {
  id: number;
  caso_id: number;
  tipo: string;
  contenido: string;
  created_at: string;
}

export interface NotificacionJudicial {
  id: number;
  caso_id: number | null;
  canal: string;
  movimiento_descripcion: string | null;
  urgencia: string | null;
  ai_sugerencia: string | null;
  enviado_at: string;
  success: number;
}

export function getAllCasosActivos(): Caso[] {
  return getDb().prepare(
    'SELECT * FROM casos WHERE activo = 1 ORDER BY created_at DESC'
  ).all() as Caso[];
}

export function getCasoById(id: number): Caso | null {
  return getDb().prepare('SELECT * FROM casos WHERE id = ?').get(id) as Caso | null;
}

export function createCaso(data: Partial<Caso>): Caso {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO casos (
      numero_expediente, distrito_judicial, organo_jurisdiccional, juez, tipo_proceso,
      especialidad, etapa_procesal, partes, cliente, alias, monto, prioridad, estado,
      ultimo_movimiento, ultimo_movimiento_fecha, proximo_evento, proximo_evento_fecha,
      estado_hash, polling_frequency_hours, whatsapp_number, email, activo, last_checked
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.numero_expediente,
    data.distrito_judicial,
    data.organo_jurisdiccional ?? null,
    data.juez ?? null,
    data.tipo_proceso ?? null,
    data.especialidad ?? null,
    data.etapa_procesal ?? null,
    data.partes ?? null,
    data.cliente ?? null,
    data.alias ?? null,
    data.monto ?? null,
    data.prioridad ?? 'baja',
    data.estado ?? 'activo',
    data.ultimo_movimiento ?? null,
    data.ultimo_movimiento_fecha ?? null,
    data.proximo_evento ?? null,
    data.proximo_evento_fecha ?? null,
    data.estado_hash ?? null,
    data.polling_frequency_hours ?? 4,
    data.whatsapp_number ?? null,
    data.email ?? null,
    data.activo ?? 1,
    data.last_checked ?? null
  );

  return getCasoById(result.lastInsertRowid as number)!;
}

export function updateCaso(id: number, data: Partial<Caso>) {
  const db = getDb();
  const fields = Object.keys(data).filter(k => k !== 'id');
  if (fields.length === 0) return;
  const setClause = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => (data as Record<string, unknown>)[f]);
  db.prepare(`UPDATE casos SET ${setClause} WHERE id = ?`).run(...values, id);
}

export function softDeleteCaso(id: number) {
  getDb().prepare('UPDATE casos SET activo = 0 WHERE id = ?').run(id);
}

export function getMovimientosByCaso(casoId: number): MovimientoJudicial[] {
  return getDb().prepare(
    'SELECT * FROM movimientos WHERE caso_id = ? ORDER BY scraped_at DESC, id DESC'
  ).all(casoId) as MovimientoJudicial[];
}

export function addMovimientoJudicial(
  casoId: number,
  data: {
    fecha?: string | null;
    acto?: string | null;
    folio?: string | null;
    sumilla?: string | null;
    es_nuevo?: boolean;
    urgencia?: 'alta' | 'normal' | 'info';
    ai_sugerencia?: string | null;
  }
) {
  getDb().prepare(`
    INSERT INTO movimientos (caso_id, fecha, acto, folio, sumilla, es_nuevo, urgencia, ai_sugerencia)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    casoId,
    data.fecha ?? null,
    data.acto ?? null,
    data.folio ?? null,
    data.sumilla ?? null,
    data.es_nuevo === false ? 0 : 1,
    data.urgencia ?? 'info',
    data.ai_sugerencia ?? null
  );
}

export function getAudienciasByCaso(casoId: number): AudienciaJudicial[] {
  return getDb().prepare(
    'SELECT * FROM audiencias WHERE caso_id = ? ORDER BY fecha ASC'
  ).all(casoId) as AudienciaJudicial[];
}

export function getAllAudienciasPendientes(): Array<AudienciaJudicial & { alias: string | null; tipo_proceso: string | null }> {
  return getDb().prepare(`
    SELECT a.*, c.alias, c.tipo_proceso
    FROM audiencias a
    JOIN casos c ON a.caso_id = c.id
    WHERE a.completado = 0 AND c.activo = 1
    ORDER BY a.fecha ASC
  `).all() as Array<AudienciaJudicial & { alias: string | null; tipo_proceso: string | null }>;
}

export function addAudienciaJudicial(
  casoId: number,
  descripcion: string,
  fecha: string,
  tipo?: string
) {
  getDb().prepare(`
    INSERT INTO audiencias (caso_id, descripcion, fecha, tipo)
    VALUES (?, ?, ?, ?)
  `).run(casoId, descripcion, fecha, tipo ?? null);
}

export function getEscritosByCaso(casoId: number): EscritoJudicial[] {
  return getDb().prepare(
    'SELECT * FROM escritos_judiciales WHERE caso_id = ? ORDER BY created_at DESC'
  ).all(casoId) as EscritoJudicial[];
}

export function saveEscritoJudicial(casoId: number, tipo: string, contenido: string) {
  getDb().prepare(`
    INSERT INTO escritos_judiciales (caso_id, tipo, contenido)
    VALUES (?, ?, ?)
  `).run(casoId, tipo, contenido);
}

export function getNotificacionesJudicialesByCaso(casoId: number, limit = 5): NotificacionJudicial[] {
  return getDb().prepare(
    'SELECT * FROM notificaciones_judiciales WHERE caso_id = ? ORDER BY enviado_at DESC LIMIT ?'
  ).all(casoId, limit) as NotificacionJudicial[];
}

export function logNotificacionJudicial(
  casoId: number,
  canal: string,
  movimientoDescripcion: string,
  urgencia: string,
  aiSugerencia: string,
  success: boolean
) {
  getDb().prepare(`
    INSERT INTO notificaciones_judiciales (caso_id, canal, movimiento_descripcion, urgencia, ai_sugerencia, success)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(casoId, canal, movimientoDescripcion, urgencia, aiSugerencia, success ? 1 : 0);
}

export function getCasosStats() {
  const db = getDb();
  const total = (db.prepare('SELECT COUNT(*) as c FROM casos').get() as { c: number }).c;
  const activos = (db.prepare('SELECT COUNT(*) as c FROM casos WHERE activo = 1').get() as { c: number }).c;
  const conAlerta = (db.prepare(
    "SELECT COUNT(DISTINCT caso_id) as c FROM movimientos WHERE es_nuevo = 1 AND urgencia = 'alta'"
  ).get() as { c: number }).c;
  const proximasAudiencias = (db.prepare(`
    SELECT COUNT(*) as c
    FROM audiencias a
    JOIN casos c ON c.id = a.caso_id
    WHERE c.activo = 1
      AND a.completado = 0
      AND date(a.fecha) BETWEEN date('now') AND date('now', '+7 day')
  `).get() as { c: number }).c;

  return { total, activos, conAlerta, proximasAudiencias };
}

export default getDb;

// ── SUNARP Síguelo module ─────────────────────────────────────────────────────

export interface TituloSunarp {
  id: number;
  oficina_registral: string;
  oficina_nombre: string | null;
  anio_titulo: string;
  numero_titulo: string;
  nombre_cliente: string;
  email_cliente: string | null;
  whatsapp_cliente: string | null;
  ultimo_estado: string;
  ultima_consulta: string | null;
  area_registral: string | null;
  numero_partida: string | null;
  created_at: string;
}

export interface HistorialSunarp {
  id: number;
  titulo_id: number;
  estado_anterior: string | null;
  estado_nuevo: string;
  detectado_en: string;
}

export function getAllTitulosSunarp(): TituloSunarp[] {
  return getDb().prepare(
    'SELECT * FROM titulos_sunarp ORDER BY created_at DESC'
  ).all() as TituloSunarp[];
}

export function getTituloSunarpById(id: number): TituloSunarp | null {
  return getDb().prepare('SELECT * FROM titulos_sunarp WHERE id = ?').get(id) as TituloSunarp | null;
}

export function createTituloSunarp(data: Omit<TituloSunarp, 'id' | 'created_at' | 'ultimo_estado' | 'ultima_consulta' | 'area_registral' | 'numero_partida'>): TituloSunarp {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO titulos_sunarp
      (oficina_registral, oficina_nombre, anio_titulo, numero_titulo, nombre_cliente, email_cliente, whatsapp_cliente)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.oficina_registral,
    data.oficina_nombre ?? null,
    data.anio_titulo,
    data.numero_titulo,
    data.nombre_cliente,
    data.email_cliente ?? null,
    data.whatsapp_cliente ?? null,
  );
  return getTituloSunarpById(result.lastInsertRowid as number)!;
}

export function updateTituloSunarp(id: number, data: Partial<TituloSunarp>) {
  const db = getDb();
  const fields = Object.keys(data).filter(k => k !== 'id');
  if (fields.length === 0) return;
  const setClause = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => (data as Record<string, unknown>)[f]);
  db.prepare(`UPDATE titulos_sunarp SET ${setClause} WHERE id = ?`).run(...values, id);
}

export function deleteTituloSunarp(id: number) {
  const db = getDb();
  db.prepare('DELETE FROM historial_estados_sunarp WHERE titulo_id = ?').run(id);
  db.prepare('DELETE FROM titulos_sunarp WHERE id = ?').run(id);
}

export function addHistorialSunarp(tituloId: number, estadoAnterior: string | null, estadoNuevo: string) {
  getDb().prepare(`
    INSERT INTO historial_estados_sunarp (titulo_id, estado_anterior, estado_nuevo)
    VALUES (?, ?, ?)
  `).run(tituloId, estadoAnterior, estadoNuevo);
}

export function getHistorialSunarp(tituloId: number): HistorialSunarp[] {
  return getDb().prepare(
    'SELECT * FROM historial_estados_sunarp WHERE titulo_id = ? ORDER BY detectado_en DESC LIMIT 20'
  ).all(tituloId) as HistorialSunarp[];
}
