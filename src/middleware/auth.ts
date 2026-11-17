
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

  if (
    typeof suppliedKey !== 'string' ||
    !suppliedKey ||
    suppliedKey.length !== env.API_SECRET.length
  ) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Unauthorized. Invalid API key.' },
      requestId: res.locals.requestId,
    });
  }

  const valid = timingSafeEqual(
    Buffer.from(suppliedKey),
    Buffer.from(env.API_SECRET)
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
