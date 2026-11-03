/**
 * DSH-hosted HTTP surface for AtHand.
 *
 * This module contains no clipboard or database code. It authenticates the
 * browser with the normal DSH connection and forwards the request to the native
 * app's loopback API. The native token is added here and never reaches client
 * JavaScript.
 */

import { API_ROOT, forward, health } from './native.js';

export function createApi({ webServer, ctx }) {
  const dispose = webServer.register({
    kind: 'prefix',
    // The DSH web server matches prefixes with pathname === path or
    // pathname.startsWith(path + '/'). A path ending in '/' would therefore
    // only match the bare root and would let /api catch every API request.
    path: API_ROOT,
    handler: (request, response) => {
      if (!authorized(ctx, request, response)) return;
      const url = new URL(request.url || '/', 'http://localhost');
      if (url.pathname !== API_ROOT && !url.pathname.startsWith(API_ROOT + '/')) {
        writeJson(response, 404, { error: 'not found' });
        return;
      }
      const relative = url.pathname.slice(API_ROOT.length) + url.search;
      Promise.resolve()
        .then(() => forward(request, response, relative))
        .catch((error) => {
          if (response.headersSent) {
            response.destroy();
            return;
          }
          console.error('[athand] native proxy failed:', error);
          writeJson(response, 502, { error: 'AtHand native app request failed', native: false });
        });
    },
  });

  return {
    dispose,
    status: async () => health(),
  };
}

function authorized(ctx, request, response) {
  const connection = ctx.get('connection');
  if (!connection || typeof connection.requestRejection !== 'function') {
    writeJson(response, 503, { error: 'host bridge unavailable' });
    return false;
  }
  let rejection;
  try {
    rejection = connection.requestRejection(request);
  } catch (error) {
    rejection = 403;
  }
  if (rejection) {
    response.writeHead(rejection, {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
    });
    response.end(rejection === 401 ? 'authentication required' : 'forbidden');
    return false;
  }
  return true;
}

function writeJson(response, status, value) {
  const body = Buffer.from(JSON.stringify(value), 'utf8');
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(body.length),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(body);
}
