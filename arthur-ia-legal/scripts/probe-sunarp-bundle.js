const fs = require('fs');
const s = fs.readFileSync(process.env.TEMP + '/sunarp-main.js', 'utf8');
const i = s.indexOf('getDatosTituloSuccess');
console.log(s.slice(i, i + 1200));
