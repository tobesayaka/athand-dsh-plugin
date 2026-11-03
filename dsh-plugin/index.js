/**
 * Host half of the AtHand bundle.
 *
 * The native Wails app is the only writer. It owns the clipboard watcher and
 * SQLite storage; this Host process only exposes the existing authenticated
 * /api/athand/* surface and proxies it to the native loopback API.
 *
 * Keeping the proxy here means the browser still uses the same DSH session and
 * never receives the native app's bearer token.
 */

import { createApi } from './host/api.js';

export const inject = ['webServer'];

export function apply(ctx) {
  const webServer = ctx.get('webServer');
  if (!webServer || typeof webServer.register !== 'function') {
    console.error('[athand] web server is unavailable; native bridge not registered');
    return;
  }

  let api;
  try {
    api = createApi({ webServer, ctx });
  } catch (error) {
    console.error('[athand] could not register the native bridge:', error);
    return;
  }

  ctx.effect(() => () => {
    try {
      api.dispose();
    } catch (error) {
      /* The route was already removed. */
    }
  });
}
