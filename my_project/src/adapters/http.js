'use strict';

const http = require('node:http');
const https = require('node:https');
const { URL } = require('node:url');

class HttpAdapter {
  constructor(options = {}) {
    this.allowedHosts = options.allowedHosts ? new Set(options.allowedHosts) : null;
    this.timeoutMs = options.timeoutMs || 10000;
    this.maxBytes = options.maxBytes || 1024 * 1024;
  }

  request(url, options = {}) {
    const target = new URL(url);
    if (!['http:', 'https:'].includes(target.protocol)) throw new Error('Only HTTP and HTTPS URLs are supported');
    if (this.allowedHosts && !this.allowedHosts.has(target.hostname)) throw new Error(`Host is not allowed: ${target.hostname}`);
    const transport = target.protocol === 'https:' ? https : http;
    const requestOptions = { method: options.method || 'GET', hostname: target.hostname, port: target.port || undefined, path: `${target.pathname}${target.search}`, headers: options.headers || {} };
    return new Promise((resolve, reject) => {
      const request = transport.request(requestOptions, response => {
        const chunks = []; let size = 0;
        response.on('data', chunk => { size += chunk.length; if (size <= this.maxBytes) chunks.push(chunk); else request.destroy(new Error('HTTP response exceeds size limit')); });
        response.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          resolve({ statusCode: response.statusCode, headers: response.headers, body, ok: response.statusCode >= 200 && response.statusCode < 300 });
        });
      });
      request.setTimeout(options.timeoutMs || this.timeoutMs, () => request.destroy(Object.assign(new Error('HTTP request timed out'), { code: 'HTTP_TIMEOUT' })));
      request.on('error', reject);
      if (options.body) request.write(options.body);
      request.end();
    });
  }
}

module.exports = { HttpAdapter };
