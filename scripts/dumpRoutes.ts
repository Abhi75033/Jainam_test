/* Dumps every registered API route as "METHOD /path" — used to generate docs. */
import { createApp } from '../src/app';

const app = createApp();
const routes: { m: string; p: string }[] = [];

function pathFromRegexp(layer: any): string {
  const source: string | undefined = layer.regexp?.source;
  if (!source) return '';
  const match = source.match(/^\^\\\/((?:[-\w]|\\\/)+?)\\\/\?\(\?=/);
  if (!match?.[1]) return '';
  return '/' + match[1].replace(/\\\//g, '/');
}

function walk(stack: any[], prefix = '') {
  for (const layer of stack ?? []) {
    if (layer.route) {
      for (const method of Object.keys(layer.route.methods)) {
        routes.push({ m: method.toUpperCase(), p: prefix + layer.route.path });
      }
    } else if (layer.name === 'router' && layer.handle?.stack) {
      walk(layer.handle.stack, prefix + pathFromRegexp(layer));
    }
  }
}

walk((app as any)._router.stack);
for (const r of routes.filter((r) => r.p.startsWith('/api/v1'))) {
  // eslint-disable-next-line no-console
  console.log(`${r.m} ${r.p}`);
}
process.exit(0);
