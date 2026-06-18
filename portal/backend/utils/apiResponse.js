export function sendError(res, req, status, key, code) {
  const locale = req?.locale || 'en';
  const message = req?.t?.(key) || key;
  res.status(status).json({ error: message, code: code || key, locale });
}

export function sendSuccess(res, data = {}, status = 200) {
  res.status(status).json(data);
}
