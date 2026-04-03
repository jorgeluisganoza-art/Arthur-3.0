import { NextResponse } from 'next/server'
import { scrapeTitulo } from '@/lib/sunarp-scraper'
import getDb from '@/lib/db'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = getDb()
  const tramiteId = Number.parseInt(id, 10)

  let turnstileToken: string | undefined
  try {
    const body = (await request.json()) as { turnstileToken?: string }
    if (typeof body?.turnstileToken === 'string' && body.turnstileToken.trim()) {
      turnstileToken = body.turnstileToken.trim()
    }
  } catch {
    /* cuerpo vacío o no JSON */
  }

  try {
    // 1. Get tramite from DB
    // Archivados tienen activo = 0; deben poder abrirse y revisarse. Excluir solo papelera (soft-delete).
    const tramite = db.prepare(
      'SELECT * FROM tramites WHERE id = ? AND deleted_at IS NULL'
    ).get(tramiteId) as Record<string, unknown> | undefined

    if (!tramite) {
      return NextResponse.json(
        { error: 'Trámite no encontrado' },
        { status: 404 }
      )
    }

    // 2. Scrape SUNARP (tipo is needed for the API's tipoRegistro field)
    const result = await scrapeTitulo(
      String(tramite.numero_titulo ?? ''),
      String(tramite.anio ?? ''),
      String(tramite.oficina_registral ?? ''),
      String(tramite.tipo ?? 'predio'),
      turnstileToken,
    )

    // 3. If portal is down, return gracefully
    if (result.portalDown) {
      return NextResponse.json({
        changed: false,
        estado: String(tramite.estado_actual ?? ''),
        portalDown: true,
        message: 'Portal SUNARP no disponible. Mostrando último estado conocido.',
        lastChecked: tramite.last_checked
      })
    }

    // 4. Check if anything changed
    const hasChanged = result.hash !== String(tramite.estado_hash ?? '') && result.hash !== ''

    // 5. Always update last_checked
    db.prepare(`
      UPDATE tramites
      SET last_checked = datetime('now')
      WHERE id = ?
    `).run(tramiteId)

    // 6. If changed: update everything
    if (hasChanged) {
      // Update tramite
      db.prepare(`
        UPDATE tramites
        SET estado_actual = ?,
            estado_hash = ?,
            observacion_texto = ?,
            calificador = ?,
            last_checked = datetime('now')
        WHERE id = ?
      `).run(
        result.estado,
        result.hash,
        result.observacion || '',
        result.calificador || '',
        tramiteId
      )

      // Save to historial
      db.prepare(`
        INSERT INTO historial
        (tramite_id, estado, observacion, estado_hash, es_cambio)
        VALUES (?, ?, ?, ?, 1)
      `).run(
        tramiteId,
        result.estado,
        result.observacion || '',
        result.hash
      )

      // If OBSERVADO, create plazo automatically
      if (result.isObservado) {
        const vencimiento = new Date()
        vencimiento.setDate(vencimiento.getDate() + 30)

        db.prepare(`
          INSERT INTO plazos
          (tramite_id, descripcion, fecha_vencimiento, tipo)
          VALUES (?, ?, ?, ?)
        `).run(
          tramiteId,
          'Plazo de subsanación de observaciones',
          vencimiento.toISOString(),
          'subsanacion'
        )
      }

      if (result.isTacha) {
        const vencimiento = new Date()
        vencimiento.setDate(vencimiento.getDate() + 15)

        db.prepare(`
          INSERT INTO plazos
          (tramite_id, descripcion, fecha_vencimiento, tipo)
          VALUES (?, ?, ?, ?)
        `).run(
          tramiteId,
          'Plazo para recurso de apelación por tacha',
          vencimiento.toISOString(),
          'apelacion'
        )
      }

      // TODO: Send WhatsApp + email notifications here
      // (implement after confirming scraper works)
    }

    return NextResponse.json({
      changed: hasChanged,
      estado: result.estado,
      observacion: result.observacion,
      calificador: result.calificador,
      portalDown: false,
      scrapedAt: result.scrapedAt,
      message: hasChanged
        ? `Estado actualizado a ${result.estado}`
        : 'Sin cambios desde la última revisión'
    })

  } catch (error: unknown) {
    console.error('[poll-now] Error:', error)
    const message = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json(
      { error: message, portalDown: true },
      { status: 500 }
    )
  }
}
