const SUPPORTED = ['en', 'de'];

function pickLocale(value) {
  if (!value) return 'en';
  const code = String(value).split(',')[0].trim().slice(0, 2).toLowerCase();
  return SUPPORTED.includes(code) ? code : 'en';
}

export function localeMiddleware(req, _res, next) {
  const fromHeader = req.headers['x-language'] || req.headers['accept-language'];
  const fromQuery = req.query?.lang;
  const fromBody = req.body?.language;
  const fromUser = req.user?.language;

  req.locale = pickLocale(fromHeader || fromQuery || fromBody || fromUser);
  req.t = (key) => key;
  next();
}
