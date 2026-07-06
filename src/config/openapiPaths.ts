import { Express } from 'express';
import { env } from './env';

interface RouteEntry {
  method: string;
  path: string;
}

/**
 * Walks the Express router stack and produces an OpenAPI `paths` object so
 * every registered endpoint appears at /api/docs (§1: auto-generated docs),
 * tagged by its module segment. Express `:param` segments become `{param}`.
 */
function collectRoutes(app: Express): RouteEntry[] {
  const routes: RouteEntry[] = [];

  function pathFromRegexp(layer: any): string {
    // Express 4 stores mount prefixes as regexps; extract the literal segment.
    const source: string | undefined = layer.regexp?.source;
    if (!source) return '';
    const match = source.match(/^\^\\\/((?:[-\w]|\\\/)+?)\\\/\?\(\?=/);
    if (!match?.[1]) return '';
    return '/' + match[1].replace(/\\\//g, '/');
  }

  function walk(stack: any[], prefix: string) {
    for (const layer of stack ?? []) {
      if (layer.route) {
        for (const method of Object.keys(layer.route.methods)) {
          routes.push({ method, path: prefix + layer.route.path });
        }
      } else if (layer.name === 'router' && layer.handle?.stack) {
        walk(layer.handle.stack, prefix + pathFromRegexp(layer));
      }
    }
  }

  walk((app as any)._router?.stack, '');
  return routes;
}

export function generateOpenApiPaths(app: Express): Record<string, Record<string, unknown>> {
  const basePath = env.API_BASE_PATH;
  const paths: Record<string, Record<string, unknown>> = {};

  for (const route of collectRoutes(app)) {
    if (!route.path.startsWith(basePath)) continue;

    const relative = route.path.slice(basePath.length) || '/';
    const openApiPath = relative.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
    const tag = (relative.split('/')[1] ?? 'root').replace(/[{}]/g, '') || 'root';

    const params = [...openApiPath.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((m) => ({
      name: m[1],
      in: 'path',
      required: true,
      schema: { type: 'string' },
    }));

    paths[openApiPath] = paths[openApiPath] ?? {};
    paths[openApiPath][route.method] = {
      tags: [tag],
      summary: `${route.method.toUpperCase()} ${openApiPath}`,
      ...(params.length ? { parameters: params } : {}),
      responses: {
        '200': { description: 'Success — standard envelope { success, data, meta, error }', content: { 'application/json': { schema: { $ref: '#/components/schemas/Envelope' } } } },
        '401': { description: 'Unauthorized' },
        '403': { description: 'Forbidden / tenant scope violation' },
        '422': { description: 'Validation failed (field errors)' },
      },
      security: [{ bearerAuth: [] }],
    };
  }

  return paths;
}
