import { sendError } from '../utils/apiResponse.js';

export function adminMiddleware(req, res, next) {
  if (req.user?.role !== 'admin') {
    return sendError(res, req, 403, 'errors.forbidden');
  }
  next();
}
