
import type {
  Request,
  Response,
  NextFunction,
} from 'express';

import { timingSafeEqual } from 'node:crypto';

import { env } from '../config/env.js';

export function authenticateAPI(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authorization = req.headers.authorization;

  const suppliedKey =
    req.headers['x-api-key'] ||
    (authorization?.startsWith('Bearer ')
      ? authorization.slice(7)
      : '');

  const suppliedBytes = typeof suppliedKey === 'string' ? Buffer.from(suppliedKey) : Buffer.alloc(0);
  const expectedBytes = Buffer.from(env.API_SECRET);
  if (
    typeof suppliedKey !== 'string' ||
    !suppliedKey ||
    suppliedBytes.length !== expectedBytes.length
  ) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Unauthorized. Invalid API key.' },
      requestId: res.locals.requestId,
    });
  }

  const valid = timingSafeEqual(
    suppliedBytes,
    expectedBytes
  );

  if (!valid) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Unauthorized. Invalid API key.' },
      requestId: res.locals.requestId,
    });
  }

  next();
}
