import { z } from 'zod';

export const CreateChatSchema = z.object({
  title: z.string().default('New Recruitment Drive'),
});

export type CreateChatInput = z.output<typeof CreateChatSchema>;

export const GenerateRequestSchema = z.object({
  message: z.string().optional(),
  answers: z.record(z.unknown()).optional(),
  fileIds: z.array(z.string()).optional(),
});

export type GenerateRequestInput = z.infer<typeof GenerateRequestSchema>;

export const ListMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
  before: z.string().optional(),
});

export type ListMessagesQuery = z.infer<typeof ListMessagesQuerySchema>;
