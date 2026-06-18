import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import { isTokenRevoked } from '../services/tokenBlacklistService.js';
import { sendError } from '../utils/apiResponse.js';

export async function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      return sendError(res, req, 401, 'errors.unauthorized');
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    if (await isTokenRevoked(payload.jti)) {
      return sendError(res, req, 401, 'errors.tokenRevoked');
    }
    const user = await User.findByPk(payload.sub);
    if (!user) {
      return sendError(res, req, 401, 'errors.unauthorized');
    }

    req.user = user;
    next();
  } catch {
    return sendError(res, req, 401, 'errors.unauthorized');
  }
}
