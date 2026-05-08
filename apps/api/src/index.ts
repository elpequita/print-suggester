import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger as honoLogger } from 'hono/logger';
import { searchesRoute } from './routes/searches.js';
import { config, visionMockEnabled } from './config.js';
import { logger } from './logger.js';

const app = new Hono();
app.use('*', honoLogger());

app.get('/health', (c) =>
  c.json({ ok: true, vision: visionMockEnabled ? 'mock' : 'live' }),
);
app.route('/searches', searchesRoute);

serve({ fetch: app.fetch, port: config.PORT }, (info) => {
  logger.info('server.listening', {
    port: info.port,
    vision: visionMockEnabled ? 'mock' : 'live',
  });
});
