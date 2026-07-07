import fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { placesRoutes } from './controllers/PlacesController';
import { placesService } from './services/PlacesService';

const server = fastify({
  logger: {
    transport: env.NODE_ENV === 'development' ? {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      }
    } : undefined
  }
});

server.setErrorHandler(errorHandler);

// Logging strutturato della durata richiesta e tracciamento
server.addHook('onResponse', (request, reply, done) => {
  request.log.info({
    url: request.url,
    method: request.method,
    statusCode: reply.statusCode,
    durationMs: reply.elapsedTime, // integrato in Fastify
  }, 'Request processed');
  done();
});

// Registrazione Rate Limiting
server.register(rateLimit, {
  max: 100, // Massimo 100 richieste
  timeWindow: '1 minute', // per minuto
});

// Registrazione Swagger
server.register(swagger, {
  openapi: {
    info: {
      title: 'Travel OS Backend API',
      description: 'API del Travel Engine per la ricerca e dettagli dei luoghi reali',
      version: '1.0.0',
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}`,
        description: 'Server locale di sviluppo',
      },
    ],
  },
});

server.register(swaggerUi, {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: false,
  },
});

// Endpoints Base
server.get('/health', async () => {
  return { status: 'ok' };
});

server.get('/version', async () => {
  return {
    version: '1.0.0',
    commit: process.env.K_REVISION || 'latest',
    environment: env.NODE_ENV,
  };
});

server.get('/ready', async (request, reply) => {
  try {
    // 1. Verifica presenza API Key
    if (!env.GOOGLE_PLACES_API_KEY || env.GOOGLE_PLACES_API_KEY.length < 5) {
      return reply.code(500).send({
        status: 'unready',
        error: 'GOOGLE_PLACES_API_KEY is not set or invalid',
      });
    }

    // 2. Test chiamata leggera a Google Places
    await placesService.autocomplete('Roma');

    return {
      status: 'ready',
      database: 'stateless',
      services: {
        googlePlaces: 'ok',
      },
    };
  } catch (e: any) {
    return reply.code(500).send({
      status: 'unready',
      error: e.message,
    });
  }
});

// Registrazione Routes
server.register(placesRoutes, { prefix: '/api/places' });

const start = async () => {
  try {
    await server.listen({ port: parseInt(env.PORT, 10), host: '0.0.0.0' });
    server.log.info(`Server listening on http://localhost:${env.PORT}`);
    server.log.info(`Swagger docs available on http://localhost:${env.PORT}/docs`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
