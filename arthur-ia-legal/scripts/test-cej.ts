import { scrapeCEJ } from '../lib/cej-scraper'

const expediente = process.argv[2] || '10001-2022-0-1801-JR-CI-01'

console.log('Testing CEJ scraper with:', expediente)
console.log('Opening real Chromium browser...\n')

scrapeCEJ(expediente).then(result => {
  console.log('=== RESULT ===')
  console.log('Portal down:      ', result.portalDown)
  console.log('Captcha detected: ', result.captchaDetected)
  console.log('Captcha solved:   ', result.captchaSolved)
  console.log('Total actuaciones:', result.totalActuaciones)
  console.log('Juez:             ', result.juez || '—')
  console.log('Órgano:           ', result.organoJurisdiccional || '—')
  console.log('Distrito:         ', result.distritoJudicial || '—')
  console.log('Etapa:            ', result.etapa || '—')
  console.log('Hash:             ', result.hash || '—')
  if (result.partes.length > 0) {
    console.log('\nPartes:')
    result.partes.forEach(p => console.log(`  ${p.rol}: ${p.nombre}`))
  }
  console.log('\nPrimeras 5 actuaciones:')
  result.actuaciones.slice(0, 5).forEach(a => {
    console.log(`  [${a.fecha}] ${a.acto}`)
    if (a.sumilla) console.log(`    Sumilla: ${a.sumilla.substring(0, 100)}`)
    if (a.tieneDocumento) console.log(`    Documento: ${a.documentoUrl}`)
  })
  if (result.error) console.log('\nError:', result.error)
}).catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
