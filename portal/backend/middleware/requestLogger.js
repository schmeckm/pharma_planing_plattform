export function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    console.log(
      JSON.stringify({
        level: 'info',
        msg: 'request',
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        userId: req.user?.id || null,
        durationMs: Date.now() - start,
      })
    );
  });
  next();
}
