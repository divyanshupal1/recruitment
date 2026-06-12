import type { Context } from 'hono';
import { withErrorHandling } from '../lib/http.js';
import { parseJsonBody } from '../lib/validation.js';
import { generationService } from '../services/generation.service.js';
import { GenerateRequestSchema } from '../types/requests.js';
import type { ChatVariables } from '../middleware/require-chat.js';

export const generateDriveData = withErrorHandling('Failed to generate drive data', async (c: Context<{ Variables: ChatVariables }>) => {
  const chat = c.get('chat');
  const input = await parseJsonBody(c.req.raw, GenerateRequestSchema);
  const result = await generationService.runGenerationFlow(chat, input);
  return c.json(result);
});

export const getDriveData = withErrorHandling('Failed to get drive data', async (c: Context<{ Variables: ChatVariables }>) => {
  const chatId = c.get('chatId');
  const result = await generationService.getDriveData(chatId);
  return c.json(result);
});
