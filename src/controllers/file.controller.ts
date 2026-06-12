import type { Context } from 'hono';
import { withErrorHandling } from '../lib/http.js';
import { BadRequestError } from '../lib/errors.js';
import { fileService } from '../services/file.service.js';
import type { ChatVariables } from '../middleware/require-chat.js';

export const uploadFile = withErrorHandling('Failed to upload file', async (c: Context<{ Variables: ChatVariables }>) => {
  const chat = c.get('chat');
  const formData = await c.req.formData();
  const file = formData.get('file');

  if (!file || !(file instanceof File)) {
    throw new BadRequestError('No file provided. Send a file with the key "file".');
  }

  const result = await fileService.uploadAndParse(chat, file);
  return c.json(result, 201);
});

export const listFiles = withErrorHandling('Failed to list files', async (c: Context<{ Variables: ChatVariables }>) => {
  const chatId = c.get('chatId');
  const files = await fileService.listFiles(chatId);
  return c.json({ files });
});
