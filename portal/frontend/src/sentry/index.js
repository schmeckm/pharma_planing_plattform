export function initSentry(app, router) {
  if (!import.meta.env.VITE_SENTRY_DSN) return;

  import('@sentry/vue').then((Sentry) => {
    Sentry.init({
      app,
      dsn: import.meta.env.VITE_SENTRY_DSN,
      integrations: [Sentry.browserTracingIntegration({ router })],
    });
  });
}
