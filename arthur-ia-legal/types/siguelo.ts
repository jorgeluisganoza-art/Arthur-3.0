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

export type TituloFormState = {
  error?: string
  success?: boolean
}

export type HistorialEstado = {
  id: string
  titulo_id: string
  estado_anterior: string
  estado_nuevo: string
  detectado_en: string
}

export type CronResumen = {
  total: number
  exitosos: number
  conCambios: number
  errores: number
  detalle: CronDetalleTitulo[]
}

export type CronDetalleTitulo = {
  id: string
  numero_titulo: string
  oficina_registral: string
  estado?: string
  cambio?: boolean
  error?: string
}
