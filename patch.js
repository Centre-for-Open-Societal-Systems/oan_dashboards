const fs = require('fs');
let code = fs.readFileSync('components/registry/registry-ui.tsx', 'utf8');

const regex = /items: Array<{ name: string; percent: number }>/;
const replacement = 'items: Array<{ name: string; percent: number; id?: string }>';
code = code.replace(regex, replacement);

const regex2 = /<div key={item.name} className="flex min-w-0 flex-1 flex-col items-center gap-1">/;
const replacement2 = '<div key={item.id || item.name} className="flex min-w-0 flex-1 flex-col items-center gap-1">';
code = code.replace(regex2, replacement2);

fs.writeFileSync('components/registry/registry-ui.tsx', code);
