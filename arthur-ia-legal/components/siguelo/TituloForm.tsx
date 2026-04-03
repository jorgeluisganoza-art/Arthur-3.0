'use client'

import { useState, useTransition, useRef } from 'react'
import { agregarYConsultarTitulo } from '@/app/siguelo/actions'
import { OFICINAS_SUNARP } from '@/lib/oficinas'

type FormValues = {
  oficina_registral: string
  anio_titulo: string
  numero_titulo: string
  nombre_cliente: string
  email_cliente: string
  whatsapp_cliente: string
  proyecto: string
  asunto: string
  registro: string
  abogado: string
  notaria: string
}

type Result = {
  error?: string
  success?: boolean
  estado?: string
  detalle?: string
}

export default function TituloForm() {
  const [pendingValues, setPendingValues] = useState<FormValues | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    setPendingValues({
      oficina_registral: data.get('oficina_registral') as string,
      anio_titulo: data.get('anio_titulo') as string,
      numero_titulo: data.get('numero_titulo') as string,
      nombre_cliente: data.get('nombre_cliente') as string,
      email_cliente: data.get('email_cliente') as string,
      whatsapp_cliente: data.get('whatsapp_cliente') as string,
      proyecto: (data.get('proyecto') as string) ?? '',
      asunto: (data.get('asunto') as string) ?? '',
      registro: (data.get('registro') as string) ?? '',
      abogado: (data.get('abogado') as string) ?? '',
      notaria: (data.get('notaria') as string) ?? '',
    })
  }

  const handleConfirm = () => {
    if (!pendingValues) return
    const values = pendingValues
    setPendingValues(null)
    setResult(null)
    startTransition(async () => {
      const formData = new FormData()
      Object.entries(values).forEach(([k, v]) => formData.set(k, v))
      const res = await agregarYConsultarTitulo(formData)
      setResult(res)
      if (res.success) formRef.current?.reset()
    })
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 relative">
      <h2 className="text-lg font-semibold text-gray-900 mb-5">
        Agregar título registral
      </h2>

      {result?.error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {result.error}
        </div>
      )}
      {result?.success && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          Título agregado correctamente.
          {result.estado && (
            <> Estado actual: <strong>{result.estado}</strong>{result.detalle ? ` — ${result.detalle}` : ''}.</>
          )}
        </div>
      )}

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
        {/* Oficina registral */}
        <div>
          <label htmlFor="oficina_registral" className="block text-sm font-medium text-gray-700 mb-1">
            Oficina registral <span className="text-red-500">*</span>
          </label>
          <select
            id="oficina_registral"
            name="oficina_registral"
            required
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Seleccionar oficina…</option>
            {OFICINAS_SUNARP.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>

        {/* Año y número en fila */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="anio_titulo" className="block text-sm font-medium text-gray-700 mb-1">
              Año del título <span className="text-red-500">*</span>
            </label>
            <input
              id="anio_titulo"
              name="anio_titulo"
              type="number"
              min={1900}
              max={new Date().getFullYear() + 1}
              placeholder={String(new Date().getFullYear())}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="numero_titulo" className="block text-sm font-medium text-gray-700 mb-1">
              Número del título <span className="text-red-500">*</span>
            </label>
            <input
              id="numero_titulo"
              name="numero_titulo"
              type="text"
              placeholder="Ej. 431663"
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Nombre cliente */}
        <div>
          <label htmlFor="nombre_cliente" className="block text-sm font-medium text-gray-700 mb-1">
            Cliente <span className="text-red-500">*</span>
          </label>
          <input
            id="nombre_cliente"
            name="nombre_cliente"
            type="text"
            placeholder="Nombre completo"
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Email y WhatsApp en fila */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="email_cliente" className="block text-sm font-medium text-gray-700 mb-1">
              Email(s) para recibir alertas de seguimiento <span className="text-red-500">*</span>
            </label>
            <input
              id="email_cliente"
              name="email_cliente"
              type="text"
              placeholder="correo1@gmail.com, correo2@gmail.com"
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="whatsapp_cliente" className="block text-sm font-medium text-gray-700 mb-1">
              WhatsApp(s) para recibir alertas de seguimiento <span className="text-red-500">*</span>
            </label>
            <input
              id="whatsapp_cliente"
              name="whatsapp_cliente"
              type="tel"
              placeholder="+51 999 999 999"
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Separador campos adicionales */}
        <div className="pt-1 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Información del Título Registral</p>
        </div>

        {/* Proyecto y Asunto en fila */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="proyecto" className="block text-sm font-medium text-gray-700 mb-1">
              Proyecto
            </label>
            <input
              id="proyecto"
              name="proyecto"
              type="text"
              placeholder="Nombre del proyecto"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="asunto" className="block text-sm font-medium text-gray-700 mb-1">
              Asunto
            </label>
            <input
              id="asunto"
              name="asunto"
              type="text"
              placeholder="Descripción del asunto"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Registro */}
        <div>
          <label htmlFor="registro" className="block text-sm font-medium text-gray-700 mb-1">
            Registro
          </label>
          <select
            id="registro"
            name="registro"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Seleccionar registro…</option>
            <option value="Registro de Personas Jurídicas">Registro de Personas Jurídicas</option>
            <option value="Registro de Propiedad Inmueble">Registro de Propiedad Inmueble</option>
            <option value="Registro de Propiedad Minera">Registro de Propiedad Minera</option>
            <option value="Registro de Propiedad Vehicular">Registro de Propiedad Vehicular</option>
            <option value="Registro de Sucesiones Intestadas">Registro de Sucesiones Intestadas</option>
            <option value="Registro Personal">Registro Personal</option>
            <option value="Registro de Testamentos">Registro de Testamentos</option>
            <option value="Registro de Mandatos y Poderes">Registro de Mandatos y Poderes</option>
            <option value="Registro de Bienes Muebles">Registro de Bienes Muebles</option>
            <option value="Registro Mobiliario de Contratos">Registro Mobiliario de Contratos</option>
            <option value="Registro de Garantías Mobiliarias">Registro de Garantías Mobiliarias</option>
            <option value="Registro de Derechos Mineros">Registro de Derechos Mineros</option>
            <option value="Registro de Concesiones para la Explotación de Servicios Públicos">Registro de Concesiones para la Explotación de Servicios Públicos</option>
            <option value="Registro de Áreas Naturales Protegidas">Registro de Áreas Naturales Protegidas</option>
            <option value="Registro de Predios">Registro de Predios</option>
            <option value="Otro">Otro</option>
          </select>
        </div>

        {/* Abogado y Notaría en fila */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="abogado" className="block text-sm font-medium text-gray-700 mb-1">
              Abogado a cargo
            </label>
            <input
              id="abogado"
              name="abogado"
              type="text"
              placeholder="Nombre del abogado"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="notaria" className="block text-sm font-medium text-gray-700 mb-1">
              Notaría y/o Presentante
            </label>
            <input
              id="notaria"
              name="notaria"
              type="text"
              placeholder="Notaría o presentante"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Agregar título
        </button>
      </form>

      {/* Spinner overlay — visible mientras consulta SUNARP (~19s) */}
      {isPending && (
        <div className="absolute inset-0 rounded-2xl bg-white/90 flex flex-col items-center justify-center gap-3 z-10">
          <svg className="animate-spin w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <p className="text-sm font-medium text-gray-700">Consultando estado en SUNARP…</p>
          <p className="text-xs text-gray-400">Esto toma aproximadamente 20 segundos</p>
        </div>
      )}

      {/* Modal de confirmación */}
      {pendingValues && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 w-full max-w-sm mx-4">
            <h3 className="text-base font-semibold text-gray-900 mb-4">
              ¿Confirmar agregar título?
            </h3>
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 mb-5 space-y-1 text-sm text-gray-700">
              <div><span className="font-medium">Oficina:</span> {pendingValues.oficina_registral}</div>
              <div><span className="font-medium">Título:</span> {pendingValues.anio_titulo} — {pendingValues.numero_titulo}</div>
              <div><span className="font-medium">Cliente:</span> {pendingValues.nombre_cliente}</div>
            </div>
            <p className="text-xs text-gray-500 mb-5">
              Al confirmar, se guardará el título y se consultará automáticamente su estado en SUNARP.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setPendingValues(null)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
