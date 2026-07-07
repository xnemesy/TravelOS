import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { placesService } from '../services/PlacesService';
import { PlacesSearchOptions } from '../providers/core/PlacesProvider';
import { GooglePlacesProvider } from '../providers/google/GooglePlacesProvider';

export async function placesRoutes(fastify: FastifyInstance) {
  
  fastify.get('/search', async (
    request: FastifyRequest<{ Querystring: any }>,
    reply: FastifyReply
  ) => {
    try {
      const q = request.query as any;
      const options: PlacesSearchOptions = {
        query: q.query,
        category: q.category ? q.category.split(',') : undefined,
      };
      
      if (q.lat && q.lng) {
        options.location = {
          lat: parseFloat(q.lat),
          lng: parseFloat(q.lng)
        };
      }
      if (q.radius) {
        options.radius = parseFloat(q.radius);
      }

      const results = await placesService.search(options);
      return results;
    } catch (e: any) {
      request.log.error(e);
      return reply.code(500).send({ error: e.message });
    }
  });

  fastify.get('/autocomplete', async (
    request: FastifyRequest<{ Querystring: { query?: string, lat?: string, lng?: string } }>,
    reply: FastifyReply
  ) => {
    const { query, lat, lng } = request.query;
    if (!query) return reply.code(400).send({ error: 'Missing query' });

    const location = lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : undefined;
    const results = await placesService.autocomplete(query, location);
    return results;
  });

  fastify.get('/:id/details', async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;
    if (!id) return reply.code(400).send({ error: 'Missing place ID' });
    const result = await placesService.getDetails(id);
    return result;
  });

  // Proxy per le foto di Google Places
  fastify.get('/photo/*', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const wild = request.params as any;
      const photoName = wild['*'];
      if (!photoName) {
        return reply.code(400).send({ error: 'Missing photo reference' });
      }

      const provider = new GooglePlacesProvider();
      const imageBuffer = await provider.getPhotoMedia(photoName);

      reply.header('Content-Type', 'image/jpeg');
      reply.header('Cache-Control', 'public, max-age=2592000'); // Cache per 30 giorni
      return reply.send(imageBuffer);
    } catch (e: any) {
      request.log.error(e);
      return reply.code(500).send({ error: 'Failed to proxy photo' });
    }
  });

}
