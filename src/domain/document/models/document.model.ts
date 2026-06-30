import { z } from 'zod';

export const DocumentTypeSchema = z.enum([
  'ticket', // Biglietto aereo, treno, ecc
  'booking', // Prenotazione hotel
  'id', // Passaporto, carta di identità
  'visa', // Visto
  'other', // Altro
]);

export const DocumentSchema = z.object({
  id: z.string(),
  tripId: z.string(),
  type: DocumentTypeSchema,
  title: z.string().min(1),
  fileUrl: z.string().url(), // URL Firebase Storage
  localPath: z.string().optional(), // Percorso per consultazione offline
  eventId: z.string().optional(), // Collegamento a un evento dell'itinerario
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Document = z.infer<typeof DocumentSchema>;
