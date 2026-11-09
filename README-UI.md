# InvoiceAny glass UI patch (UI only)

Ye zip tumhare project ke ROOT mein extract/copy karo (same folder structure, files overwrite honge).
Sirf 20 UI files hain. Inme se kuch nahi badla: app/api, lib, tests, package.json, providers.

## Safe apply (PowerShell/terminal, project root mein)
git add -A && git commit -m "before ui"
git checkout -b ui-glass
# zip ke andar ke folders (app, components, tailwind.config.ts) ko project root mein copy/overwrite karo
npm test            # 49 pass hone chahiye
npm run typecheck
npm run dev
# kuch bigde:  git checkout main   (sab pehle jaisa)

## Naye packages: koi nahi. Font next/font se aata hai (internet chahiye pehli build par).

## Saare states ek saath dekhne ke liye (aurora mode mein bhi chalta hai)
npm run dev  ->  http://localhost:3000/dev/states
(sirf development mein; production build mein band rehta hai)
