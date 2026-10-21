import { mkdir, copyFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.resolve(root, 'dist');
if (path.dirname(output) !== path.resolve(root) || path.basename(output) !== 'dist') throw new Error('Invalid build destination');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const name of ['index.html', 'app.js', 'workspace.js', 'workspace.css', 'exemplo.html', 'brand.config.js', 'styles.css', 'favicon.svg', '_redirects']) await copyFile(path.join(root, name), path.join(output, name));
// Physical route entries also make exported static previews navigable without rewrite support.
for (const route of ['login', 'register', 'app', 'projects', 'novo', 'editor', 'planos', 'dominios', 'indique']) {
  await mkdir(path.join(output, route), { recursive: true });
  await copyFile(path.join(root, 'index.html'), path.join(output, route, 'index.html'));
}
await writeFile(path.join(output, '404.html'), '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Página não encontrada — Jutsoclone</title><h1>Página não encontrada</h1><a href="/">Voltar para o início</a></html>');
console.log('Build concluído: dist/ (somente arquivos públicos; nenhuma credencial ou código do servidor).');
