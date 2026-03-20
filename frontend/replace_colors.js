const fs = require('fs');
let content = fs.readFileSync('src/components/billing/InvoiceTemplate.tsx', 'utf8');
const map = {
  'bg-white': 'bg-[#ffffff]',
  'text-black': 'text-[#000000]',
  'border-black': 'border-[#000000]',
  'border-neutral-300': 'border-[#d4d4d4]',
  'text-neutral-800': 'text-[#262626]',
  'text-neutral-700': 'text-[#404040]',
  'text-neutral-600': 'text-[#525252]',
  'bg-neutral-100': 'bg-[#f5f5f5]',
  'bg-neutral-50': 'bg-[#fafafa]',
  'text-green-700': 'text-[#15803d]',
  'text-green-600': 'text-[#16a34a]',
  'border-neutral-400': 'border-[#a3a3a3]',
  'text-white': 'text-[#ffffff]'
};
for (const [key, val] of Object.entries(map)) {
  const regex = new RegExp(`(?<=[\\\\s"'\`])${key}(?=[\\\\s"'\`])`, 'g');
  content = content.replace(regex, val);
}
fs.writeFileSync('src/components/billing/InvoiceTemplate.tsx', content);
