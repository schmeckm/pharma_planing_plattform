import { MESSAGES, NAV_BASE, ROUTE_TITLE_KEYS } from './messages';

export { MESSAGES, NAV_BASE, ROUTE_TITLE_KEYS };

export function getMessages(locale) {
  return MESSAGES[locale] || MESSAGES.en;
}

export function t(locale, path, params = {}) {
  const parts = path.split('.');
  let node = getMessages(locale);
  for (const part of parts) {
    node = node?.[part];
    if (node == null) {
      let fallback = MESSAGES.en;
      for (const p of parts) fallback = fallback?.[p];
      if (typeof fallback !== 'string') return path;
      node = fallback;
      break;
    }
  }
  if (typeof node !== 'string') return path;
  return node.replace(/\{(\w+)\}/g, (_, key) => (params[key] != null ? String(params[key]) : ''));
}

export function getNavSections(locale) {
  return NAV_BASE.map((section) => ({
    ...section,
    label: t(locale, section.labelKey),
    items: section.items.map((item) => ({
      ...item,
      label: t(locale, item.labelKey),
    })),
  }));
}

export function getRouteTitle(locale, routeName) {
  const key = ROUTE_TITLE_KEYS[routeName];
  return key ? t(locale, key) : t(locale, 'routes.default');
}

export function localeDateFormat(locale) {
  return { en: 'en-GB', de: 'de-DE', fr: 'fr-FR' }[locale] || 'en-GB';
}
