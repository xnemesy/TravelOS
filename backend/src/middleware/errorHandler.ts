import { FastifyError, FastifyRequest, FastifyReply } from 'fastify';

export const errorHandler = (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
  request.log.error(error);

  if (error.validation) {
    return reply.status(400).send({
      error: 'Bad Request',
      message: 'Validation failed',
      details: error.validation,
    });
  }

  // Se è un errore del provider (es. Axios)
  if ((error as any).isAxiosError) {
    return reply.status(502).send({
      error: 'Bad Gateway',
      message: 'Upstream provider error',
    });
  }

  return reply.status(error.statusCode || 500).send({
    error: error.name || 'Internal Server Error',
    message: error.message || 'Something went wrong',
  });
};
