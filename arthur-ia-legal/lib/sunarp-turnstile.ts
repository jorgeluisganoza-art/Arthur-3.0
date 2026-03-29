/**
 * Clave pública del widget Turnstile usada por Síguelo Plus (extraída del bundle oficial).
 * Para otro dominio puedes definir NEXT_PUBLIC_SUNARP_TURNSTILE_SITE_KEY si SUNARP/Cloudflare añaden hostnames.
 */
export const SUNARP_TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_SUNARP_TURNSTILE_SITE_KEY ?? '0x4AAAAAABjHwQpFgHGVKCei'
