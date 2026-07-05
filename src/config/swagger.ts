import swaggerJSDoc from 'swagger-jsdoc';
import { env } from './env';

export const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'JiNANAM Platform API',
      version: '1.0.0',
      description:
        'Multi-tenant Jain community platform backend — monk tracking, temples, dharamshalas, bookings, donations, events/ticketing, feed, visitors, staff, yatra tours.',
    },
    servers: [{ url: `http://localhost:${env.PORT}${env.API_BASE_PATH}` }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        Envelope: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', nullable: true },
            meta: { type: 'object', nullable: true },
            error: { type: 'object', nullable: true },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/modules/**/*.routes.ts', './src/modules/**/*.docs.ts'],
});
