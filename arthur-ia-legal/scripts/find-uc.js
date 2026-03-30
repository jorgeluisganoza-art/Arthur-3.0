const fs = require('fs');
const s = fs.readFileSync(process.env.TEMP + '/sunarp-main.js', 'utf8');
const re = /Uc="https:\/\/[^"]+"/g;
let m;
while ((m = re.exec(s)) !== null) console.log(m[0]);
