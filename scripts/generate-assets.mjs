import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tokens } from '../ui/src/theme/tokens.ts';
import { fa } from '../ui/src/locales/fa.ts';
const sharp=createRequire(import.meta.url)('../ui/node_modules/sharp');
const palette=tokens.palette.light;
// Owner-supplied originals are the only source of brand assets.
const logo = await readFile('ui/public/brand/logo-transparent.png');
const symbol = await readFile('ui/public/brand/symbol-source.png');
await sharp(logo).resize(512, 512).png().toFile('ui/public/logo.png');
for (const size of [32, 192, 512])
  await sharp(symbol).resize(size, size).png().toFile(`ui/public/icon-${size}.png`);
// Keep the offline shell's existing icon URL, embedding the actual supplied mark.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><image width="512" height="512" href="data:image/png;base64,${(await readFile('ui/public/icon-512.png')).toString('base64')}"/></svg>`;
await writeFile('ui/public/icon.svg', svg);
// A PNG-backed ICO is supported by modern browsers and avoids another dependency.
const png = await sharp(symbol).resize(32, 32).png().toBuffer();
const ico = Buffer.alloc(22);
ico.writeUInt16LE(1, 2);
ico.writeUInt16LE(1, 4);
ico[6] = 32;
ico[7] = 32;
ico.writeUInt16LE(1, 10);
ico.writeUInt16LE(32, 12);
ico.writeUInt32LE(png.length, 14);
ico.writeUInt32LE(22, 18);
await writeFile('ui/public/favicon.ico', Buffer.concat([ico, png]));
const style=`body{background:${palette.bg};color:${palette.text};font-family:sans-serif;line-height:${tokens.type.line};padding:${tokens.space.xl}px}main{max-width:${tokens.layout.max}px;margin:auto;border:1px solid ${palette.border};border-radius:${tokens.radius.card}px;padding:${tokens.space.xl}px;background:${palette.surface}}a{color:${palette.brand}}`;
await writeFile('ui/public/offline.html',`<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${fa.brand}</title><style>${style}</style><main><h1>${fa.offline}</h1><p>${fa.offlineHint}</p><a href="/">${fa.retry}</a></main></html>`);
