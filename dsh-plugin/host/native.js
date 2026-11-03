/**
 * Client for the AtHand native app.
 *
 * The native app writes SQLite and exposes a small loopback HTTP API. The DSH
 * Host is deliberately only a proxy: it never opens the database and never
 * starts a second clipboard watcher. The bearer token stays in this process;
 * it is never sent to the browser.
 */

import { readFileSync, statSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

export const API_ROOT = '/api/athand';
const BRIDGE_PROTOCOL = 'athand/native-v1';
const REQUEST_TIMEOUT_MS = 15000;

export class NativeUnavailableError extends Error {
  constructor(message, cause) {
    super(message || 'AtHand native app is not running');
    this.name = 'NativeUnavailableError';
    this.status = 503;
    this.cause = cause;
  }
}

export function dataDirectory() {
  if (process.env.ATHAND_DATA_DIR) return process.env.ATHAND_DATA_DIR;
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'AtHand');
  }
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'AtHand');
  }
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'AtHand');
}

export function bridgeFile() {
  if (process.env.ATHAND_BRIDGE) return process.env.ATHAND_BRIDGE;
  return path.join(dataDirectory(), 'bridge.json');
}

function parseDiscovery(raw) {
  let value;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    throw new NativeUnavailableError('AtHand bridge file is invalid', error);
  }
  if (!value || value.protocol !== BRIDGE_PROTOCOL) {
    throw new NativeUnavailableError('AtHand bridge file has an unsupported protocol');
  }
  const port = Number(value.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new NativeUnavailableError('AtHand bridge file has an invalid port');
  }
  if (typeof value.token !== 'string' || value.token.length < 32) {
    throw new NativeUnavailableError('AtHand bridge file has an invalid token');
  }
  return { port, token: value.token, instanceId: typeof value.instanceId === 'string' ? value.instanceId : '' };
}

export function readBridge() {
  const file = bridgeFile();
  let raw;
  try {
    const info = statSync(file);
    if (process.platform !== 'win32' && (info.mode & 0o077) !== 0) {
      throw new NativeUnavailableError('AtHand bridge file is readable by other users');
    }
    raw = readFileSync(file, 'utf8');
  } catch (error) {
    if (error instanceof NativeUnavailableError) throw error;
    throw new NativeUnavailableError('AtHand native app is not running', error);
  }
  return parseDiscovery(raw);
}

function copyRequestHeaders(request, token) {
  const headers = {
    authorization: 'Bearer ' + token,
    accept: request.headers.accept || 'application/json',
  };
  if (request.headers['content-type']) headers['content-type'] = request.headers['content-type'];
  if (request.headers['content-length']) headers['content-length'] = request.headers['content-length'];
  return headers;
}

function copyResponseHeaders(nativeResponse) {
  const headers = {};
  for (const name of ['content-type', 'content-length', 'cache-control', 'content-disposition']) {
    const value = nativeResponse.headers[name];
    if (value !== undefined) headers[name] = value;
  }
  headers['x-content-type-options'] = 'nosniff';
  return headers;
}

/**
 * Forward one browser request to the native API. The returned promise resolves
 * after the native response has been streamed to the browser.
 */
export function forward(request, response, relativePath) {
  let bridge;
  try {
    bridge = readBridge();
  } catch (error) {
    sendUnavailable(response, error);
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      if (error) {
        if (!response.headersSent) sendUnavailable(response, error);
        else response.destroy();
      }
      resolve();
    };

    const nativeRequest = http.request({
      host: '127.0.0.1',
      port: bridge.port,
      method: request.method,
      path: API_ROOT + relativePath,
      headers: copyRequestHeaders(request, bridge.token),
    }, (nativeResponse) => {
      response.writeHead(nativeResponse.statusCode || 502, copyResponseHeaders(nativeResponse));
      nativeResponse.on('error', finish);
      nativeResponse.pipe(response);
      nativeResponse.on('end', () => finish());
    });

    nativeRequest.setTimeout(REQUEST_TIMEOUT_MS, () => {
      nativeRequest.destroy(new NativeUnavailableError('AtHand native app timed out'));
    });
    nativeRequest.on('error', finish);
    request.on('error', finish);
    request.pipe(nativeRequest);
  });
}

function sendUnavailable(response, error) {
  if (response.headersSent) {
    response.destroy();
    return;
  }
  const body = Buffer.from(JSON.stringify({
    error: error instanceof Error ? error.message : 'AtHand native app is not running',
    native: false,
  }), 'utf8');
  response.writeHead(503, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(body.length),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(body);
}

export async function health() {
  const bridge = readBridge();
  return new Promise((resolve, reject) => {
    const request = http.request({
      host: '127.0.0.1',
      port: bridge.port,
      method: 'GET',
      path: API_ROOT + '/status',
      headers: { authorization: 'Bearer ' + bridge.token },
      timeout: 2000,
    }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        if (response.statusCode !== 200) {
          reject(new NativeUnavailableError('AtHand native app returned ' + response.statusCode));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new NativeUnavailableError('AtHand native app returned invalid JSON', error));
        }
      });
    });
    request.on('timeout', () => request.destroy(new NativeUnavailableError('AtHand native app timed out')));
    request.on('error', reject);
    request.end();
  });
}
