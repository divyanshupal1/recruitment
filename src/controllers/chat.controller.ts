import type { Context } from 'hono';
import { withErrorHandling } from '../lib/http.js';
import { parseJsonBody } from '../lib/validation.js';
import { chatService } from '../services/chat.service.js';
import { messageService } from '../services/message.service.js';
import { chatRepository } from '../repositories/chat.repository.js';
import { CreateChatSchema, ListMessagesQuerySchema } from '../types/requests.js';
import type { ChatVariables } from '../middleware/require-chat.js';
import { hydrateDriveData } from '../services/prediction.service.js';

export const createChat = withErrorHandling('Failed to create chat', async (c) => {
  const input = await parseJsonBody(c.req.raw, CreateChatSchema);
  const chat = await chatService.create(input);
  return c.json({ chat }, 201);
});

export const listChats = withErrorHandling('Failed to list chats', async (c) => {
  const chats = await chatService.list();
  return c.json({ chats });
});

export const getChat = withErrorHandling('Failed to get chat', async (c) => {
  const chatId = c.req.param('chatId');
  if (!chatId) {
    return c.json({ error: 'Chat ID is required' }, 400);
  }

  const chat = await chatRepository.findById(chatId);

  if (!chat) {
    return c.json({ error: 'Chat not found' }, 404);
  }

  if (chat.driveData) {
    chat.driveData = await hydrateDriveData(chat.driveData);
  }

  return c.json({ chat });
});

export const listMessages = withErrorHandling('Failed to list messages', async (c: Context<{ Variables: ChatVariables }>) => {
  const chatId = c.get('chatId');
  const query = ListMessagesQuerySchema.parse({
    limit: c.req.query('limit'),
    before: c.req.query('before'),
  });

  const messages = await messageService.listMessages(chatId, query.limit, query.before);
  return c.json({ messages });
});
