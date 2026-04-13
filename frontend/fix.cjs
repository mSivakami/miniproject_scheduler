const fs = require('fs');
let c = fs.readFileSync('src/app/pages/Groups.tsx', 'utf8');
c = c.replace(/\\`/g, '`').replace(/\\\$/g, '$');
fs.writeFileSync('src/app/pages/Groups.tsx', c);
