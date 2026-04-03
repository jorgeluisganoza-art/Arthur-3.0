# Integración Arthur-Síguelo → Arthur-Jorge

**Rama de trabajo:** `integracion-siguelo`
**Fecha de inicio:** 2026-04-03
**Última actualización:** 2026-04-03 — INTEGRACIÓN COMPLETA ✅ (build OK, 0 errores TypeScript)

---

## Estado actual

| Paso | Descripción | Estado |
|------|-------------|--------|
| 0 | Rama `integracion-siguelo` creada | ✅ Completo |
| 1 | Análisis de dependencias | ✅ Completo |
| 2 | Análisis de Sidebar y db.ts | ✅ Completo |
| 3 | Análisis de notifications.ts y plan de alertas | ✅ Completo |
| 4 | Crear `types/siguelo.ts` | ✅ Completo |
| 5 | Crear `lib/siguelo-db.ts` | ✅ Completo |
| 6 | Copiar `lib/siguelo-estados.ts`, `lib/oficinas.ts`, `lib/siguelo-scraper.ts` | ✅ Completo |
| 7 | Crear `lib/siguelo-excel.ts` y `lib/siguelo-alertas.ts` | ✅ Completo |
| 8 | Crear API routes (`/api/siguelo/...`) | ✅ Completo |
| 9 | Crear `app/siguelo/actions.ts` | ✅ Completo |
| 10 | Crear componentes en `components/siguelo/` | ✅ Completo |
| 11 | Crear página `app/dashboard/siguelo/page.tsx` | ✅ Completo |
| 12 | Agregar entrada al Sidebar | ✅ Completo |
| 13 | Instalar dependencias faltantes | ✅ Completo |
| 14 | TypeScript check + build local | ✅ Completo (0 errores, 31 rutas generadas) |
| 15 | Commit y merge a main | ⬜ Pendiente |

---

## Rutas importantes

- **Repo de Jorge (Next.js project):** `C:\Users\DELL\arthur-jorge\arthur-ia-legal\`
- **Repo de Síguelo (referencia, NO modificar):** `C:\Users\DELL\arthur-siguelo\`
- **Rama activa en Jorge:** `integracion-siguelo`

> **Atención:** El proyecto Next.js está en `arthur-ia-legal/` (un nivel más profundo de lo esperado).
> El git repo root es `C:\Users\DELL\arthur-jorge\`.

---

## Plan técnico detallado

### PASO 4 — `types/siguelo.ts`

**Destino:** `arthur-ia-legal/types/siguelo.ts`
**Origen:** Copiar `arthur-siguelo/types/index.ts` sin cambios

```ts
export type Titulo = {
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

export type HistorialEstado = {
  id: string
  titulo_id: string
  estado_anterior: string
  estado_nuevo: string
  detectado_en: string
}

export type TituloFormState = {
  error?: string
  success?: boolean
}

export type CronResumen = { ... }
export type CronDetalleTitulo = { ... }
```

---

### PASO 5 — `lib/siguelo-db.ts`

**Destino:** `arthur-ia-legal/lib/siguelo-db.ts`
**Origen:** NUEVO — reescritura de `arthur-siguelo/lib/supabase.ts` para SQLite

**Decisión técnica:** Importar `getDb()` desde `./db` (la misma instancia singleton de Jorge)
para que ambos módulos compartan la misma conexión SQLite y la misma base de datos (`arthur.db`).
No se crea una segunda instancia DB.

**Tablas nuevas** que `siguelo-db.ts` crea en su primera llamada (usando `CREATE TABLE IF NOT EXISTS`
— no rompe las tablas existentes de Jorge):

```sql
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
```

**Funciones a implementar** (equivalentes 1:1 a `supabase.ts`):
- `getTitulosSiguelo(): Titulo[]`
- `createTituloSiguelo(data): string` — genera UUID con `crypto.randomUUID()`
- `actualizarEstadoTituloSiguelo(id, estado, area?, partida?): void`
- `registrarCambioEstadoSiguelo(entrada): void`
- `getUltimoEstadoSiguelo(id): string | null`
- `getTituloSigueloById(id): Titulo | null`
- `eliminarTituloSiguelo(id): void`
- `getHistorialSigueloByTituloId(id): HistorialEstado[]`

---

### PASO 6 — Copias directas (sin adaptación)

| Origen | Destino | Cambios |
|--------|---------|---------|
| `arthur-siguelo/lib/scraper.ts` | `arthur-ia-legal/lib/siguelo-scraper.ts` | Ninguno — autocontenido |
| `arthur-siguelo/lib/estados.ts` | `arthur-ia-legal/lib/siguelo-estados.ts` | Ninguno — autocontenido |
| `arthur-siguelo/lib/oficinas.ts` | `arthur-ia-legal/lib/oficinas.ts` | Ninguno |

---

### PASO 7A — `lib/siguelo-excel.ts`

**Destino:** `arthur-ia-legal/lib/siguelo-excel.ts`
**Origen:** Adaptar `arthur-siguelo/lib/excel.ts`

Único cambio: `import type { Titulo } from '@/types'` → `import type { Titulo } from '@/types/siguelo'`

---

### PASO 7B — `lib/siguelo-alertas.ts`

**Destino:** `arthur-ia-legal/lib/siguelo-alertas.ts`
**Origen:** NUEVO — reescritura de `arthur-siguelo/lib/alertas.ts` usando Nodemailer

**Decisiones técnicas:**
- Usa `nodemailer` (ya instalado en Jorge) en lugar de `resend`
- Env vars: `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS` (las mismas de Jorge)
- Adjunto Excel: se pasa como `Buffer` directo a Nodemailer (más simple que el base64 de Resend)
- `czavala19365@gmail.com` siempre se agrega como destinatario fijo en todos los emails
- HTML de los emails: se mantiene idéntico al de `arthur-siguelo/lib/alertas.ts`
- WhatsApp: se reutiliza Twilio igual que en siguelo (mismas vars de entorno que ya tiene Jorge)

**Funciones:**
- `enviarAlertaEmail(datos: DatosAlerta): Promise<void>`
- `enviarConfirmacionAgregado(datos: DatosConfirmacion): Promise<void>`
- `enviarAlertaWhatsApp(datos: DatosAlerta): Promise<void>`

---

### PASO 8 — API routes

**Base path:** `arthur-ia-legal/app/api/siguelo/`

| Archivo | Origen | Adaptaciones |
|---------|--------|--------------|
| `descargar-esquela/route.ts` | `arthur-siguelo/app/api/descargar-esquela/route.ts` | `@/lib/supabase` → `@/lib/siguelo-db`; `@/lib/scraper` → `@/lib/siguelo-scraper` |
| `descargar-asiento/route.ts` | `arthur-siguelo/app/api/descargar-asiento/route.ts` | Ídem |
| `consultar/route.ts` | `arthur-siguelo/app/api/cron/consultar/route.ts` | Ídem + quitar imports de Resend/alertas; usar `siguelo-alertas.ts` |

---

### PASO 9 — `app/siguelo/actions.ts`

**Destino:** `arthur-ia-legal/app/siguelo/actions.ts`
**Origen:** Adaptar `arthur-siguelo/app/actions.ts`

Cambios:
- `@/lib/supabase` → `@/lib/siguelo-db` (con funciones renombradas, ej. `createTituloSiguelo`)
- `@/lib/scraper` → `@/lib/siguelo-scraper`
- `@/lib/alertas` → `@/lib/siguelo-alertas`
- `@/types` → `@/types/siguelo`
- `revalidatePath('/')` → `revalidatePath('/dashboard/siguelo')`

---

### PASO 10 — Componentes en `components/siguelo/`

Todos los imports se ajustan al namespace `siguelo`:

| Archivo | Cambios de imports clave |
|---------|--------------------------|
| `EstadoBadge.tsx` | `@/lib/estados` → `@/lib/siguelo-estados` |
| `ConsultarButton.tsx` | `@/app/actions` → `@/app/siguelo/actions`; URLs API → `/api/siguelo/...`; `@/lib/estados` → `@/lib/siguelo-estados` |
| `TituloDetailModal.tsx` | `@/app/actions` → `@/app/siguelo/actions`; `@/types` → `@/types/siguelo`; componentes → `@/components/siguelo/...` |
| `TituloSection.tsx` | `@/lib/estados` → `@/lib/siguelo-estados`; `@/types` → `@/types/siguelo`; URLs API → `/api/siguelo/...` |
| `MetricsCards.tsx` | `@/types` → `@/types/siguelo`; `@/lib/estados` → `@/lib/siguelo-estados` |
| `TitulosList.tsx` | `@/types` → `@/types/siguelo`; `@/lib/estados` → `@/lib/siguelo-estados`; componentes → `@/components/siguelo/...` |
| `TituloForm.tsx` | `@/app/actions` → `@/app/siguelo/actions`; `@/lib/oficinas` igual |

---

### PASO 11 — `app/dashboard/siguelo/page.tsx`

Server Component que:
- Importa `getTitulosSiguelo()` desde `@/lib/siguelo-db`
- Renderiza `TituloForm` + `MetricsCards` + `TitulosList` desde `@/components/siguelo/`
- Hereda automáticamente el layout de `app/dashboard/layout.tsx` (auth guard + Sidebar)

---

### PASO 12 — Sidebar

**Archivo:** `arthur-ia-legal/components/Sidebar.tsx`
**Es la única modificación a un archivo existente de Jorge.**

Agregar ícono SVG `IconSunarp` (antes de la función `Sidebar`):
```tsx
const IconSunarp = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="1" width="10" height="13" rx="1" />
    <path d="M4 4h6M4 7h6M4 10h4" />
    <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.15" />
    <path d="M11 12h2M12 11v2" />
  </svg>
)
```

Insertar en el array `links` (entre "Consulta Legal" y "Archivados"):
```ts
{ href: '/dashboard/siguelo', label: 'SUNARP Síguelo', hasAlert: false, Icon: IconSunarp },
```

---

### PASO 13 — Dependencias a instalar

```bash
cd arthur-ia-legal
npm install @2captcha/captcha-solver@^1.3.4 @sparticuz/chromium-min@^143.0.4 puppeteer-core@^24.40.0 xlsx@^0.18.5
```

**Ya presentes en Jorge (no instalar):**
- `crypto-js` ✓
- `twilio` ✓
- `nodemailer` ✓
- `better-sqlite3` ✓

**No instalar:**
- `@supabase/supabase-js` — usamos SQLite
- `resend` — usamos Nodemailer

---

## Variables de entorno requeridas

### Ya presentes en Jorge (verificar que existan en `.env.local`)

```env
# Email (Nodemailer) — usado por notifications.ts de Jorge y siguelo-alertas.ts
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=tu-email@gmail.com
EMAIL_PASS=tu-app-password

# WhatsApp (Twilio) — compartido con módulo judicial de Jorge
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_FROM=+14155238886

# AI (para módulos de Jorge, no se usa en siguelo)
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
GEMINI_API_KEY=...

# Auth (login de Jorge)
ACCESS_CODE=ARTHUR2026
```

### Nuevas — exclusivas de la integración Síguelo

```env
# CAPTCHA — para consultarTitulo() en SUNARP (obtener en 2captcha.com)
TWOCAPTCHA_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Chromium local (solo desarrollo en Windows/Mac, NO necesario en Vercel)
# Si no se define, puppeteer descarga el binario automáticamente desde GitHub
CHROME_EXECUTABLE_PATH=
```

### Variables que NO se necesitan (quedan en arthur-siguelo solamente)

```env
# NO agregar en Jorge:
RESEND_API_KEY=...          # Jorge usa Nodemailer
RESEND_FROM_EMAIL=...       # ídem
NEXT_PUBLIC_SUPABASE_URL=...     # Jorge usa SQLite
NEXT_PUBLIC_SUPABASE_ANON_KEY=...  # ídem
```

---

## Decisiones técnicas tomadas

### 1. SQLite compartido (no segunda DB)
`siguelo-db.ts` importa `getDb()` de `lib/db.ts` de Jorge para usar la misma
instancia singleton. Las tablas `titulos_siguelo` e `historial_siguelo` se crean
en el mismo archivo `arthur.db`. Esto simplifica el deployment y evita gestionar
dos bases de datos.

### 2. Nodemailer en lugar de Resend
Jorge ya tiene Nodemailer configurado con `EMAIL_HOST/PORT/USER/PASS`.
No se instala Resend. El adjunto Excel se pasa como `Buffer` directamente
(Nodemailer lo soporta nativamente, más simple que base64 de Resend).

### 3. Namespace `siguelo` para evitar colisiones
Todos los archivos nuevos usan el prefijo `siguelo-` en `lib/` y viven en
subcarpetas `siguelo/` en `app/` y `components/`. Ningún nombre colisiona
con los módulos existentes de Jorge (`tramites`, `casos`).

### 4. `czavala19365@gmail.com` como destinatario fijo
Todos los emails del módulo Síguelo incluyen este email como destinatario
adicional fijo (admin/prueba), además del `email_cliente` de cada título.

### 5. UUIDs generados en Node
`createTituloSiguelo()` usa `crypto.randomUUID()` (nativo en Node 16+)
para generar el `id` del título. No depende de Supabase para esto.

### 6. Una sola modificación a archivos existentes de Jorge
Solo se toca `components/Sidebar.tsx` para agregar la entrada de menú.
Todos los demás cambios son archivos nuevos.

### 7. Herencia del layout de dashboard
La nueva página `app/dashboard/siguelo/page.tsx` vive dentro de `app/dashboard/`
y hereda automáticamente `app/dashboard/layout.tsx` de Jorge, que ya incluye
el auth guard (verifica `localStorage.arthur_auth`) y el Sidebar.
No se necesita crear un nuevo layout.

### 8. API paths aislados
Las API routes van en `/api/siguelo/...` para no colisionar con
`/api/tramites/...` y `/api/casos/...` de Jorge.

---

## Archivos a crear (resumen)

```
arthur-ia-legal/
├── types/
│   └── siguelo.ts                              NUEVO
├── lib/
│   ├── siguelo-scraper.ts                      NUEVO (copia de scraper.ts)
│   ├── siguelo-estados.ts                      NUEVO (copia de estados.ts)
│   ├── siguelo-db.ts                           NUEVO (reescritura de supabase.ts)
│   ├── siguelo-excel.ts                        NUEVO (adaptar excel.ts)
│   ├── siguelo-alertas.ts                      NUEVO (reescritura de alertas.ts)
│   └── oficinas.ts                             NUEVO (copia)
├── app/
│   ├── api/
│   │   └── siguelo/
│   │       ├── descargar-esquela/route.ts      NUEVO
│   │       ├── descargar-asiento/route.ts      NUEVO
│   │       └── consultar/route.ts              NUEVO
│   ├── siguelo/
│   │   └── actions.ts                          NUEVO
│   └── dashboard/
│       └── siguelo/
│           └── page.tsx                        NUEVO
└── components/
    ├── Sidebar.tsx                             MODIFICAR (solo +1 entrada en links[])
    └── siguelo/
        ├── EstadoBadge.tsx                     NUEVO
        ├── ConsultarButton.tsx                 NUEVO
        ├── TituloDetailModal.tsx               NUEVO
        ├── TituloSection.tsx                   NUEVO
        ├── MetricsCards.tsx                    NUEVO
        ├── TitulosList.tsx                     NUEVO
        └── TituloForm.tsx                      NUEVO
```

**Total: 19 archivos nuevos + 1 modificación mínima.**

---

## Cómo retomar en una nueva sesión

1. Abrir `C:\Users\DELL\arthur-jorge\` en Claude Code
2. Leer este archivo: `cat INTEGRACION_PROGRESS.md`
3. Verificar rama activa: `git branch` (debe decir `integracion-siguelo`)
4. Revisar qué pasos están completos (tabla al inicio de este archivo)
5. Continuar desde el primer paso con estado ⬜

### Contexto de repos para la IA

- `arthur-siguelo` (en `C:\Users\DELL\arthur-siguelo\`) es la referencia — contiene el scraper SUNARP con AES+captcha, esquelas, asiento
- `arthur-jorge` (en `C:\Users\DELL\arthur-jorge\arthur-ia-legal\`) es el destino — Next.js + SQLite + auth + módulos registral y judicial
- El módulo siguelo va en `/dashboard/siguelo` dentro del dashboard de Jorge
- Todos los archivos nuevos tienen prefijo/subcarpeta `siguelo` para evitar colisiones

---

*Última actualización: 2026-04-03 — Integración completa. Build limpio, 19 archivos nuevos, 1 modificación (Sidebar). Pendiente: commit y merge a main.*
