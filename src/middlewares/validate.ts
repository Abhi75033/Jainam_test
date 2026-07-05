import { NextFunction, Request, Response } from 'express';
import { ZodTypeAny } from 'zod';

/**
 * Validates the whole request shape { body, query, params } against a single
 * Zod schema, e.g. `z.object({ body: z.object({...}), query: z.object({...}) })`.
 * Only the keys present in the schema are parsed/replaced; omitted keys (e.g.
 * no `query` key) are left untouched on the request.
 * Failures propagate to errorHandler as ZodError -> 422 with field errors.
 */
export function validate(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse({ body: req.body, query: req.query, params: req.params }) as {
        body?: unknown;
        query?: unknown;
        params?: unknown;
      };
      if (parsed.body !== undefined) req.body = parsed.body;
      if (parsed.query !== undefined) req.query = parsed.query as Request['query'];
      if (parsed.params !== undefined) req.params = parsed.params as Request['params'];
      next();
    } catch (err) {
      next(err);
    }
  };
}
