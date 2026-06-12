import { createMiddleware } from 'hono/factory';
import { chatRepository } from '../repositories/chat.repository.js';
import type { Chat } from '../types/chat.js';

export type ChatVariables = {
  chat: Chat;
  chatId: string;
};

export const requireChat = createMiddleware<{ Variables: ChatVariables }>(async (c, next) => {
  const chatId = c.req.param('chatId');
  if (!chatId) {
    return c.json({ error: 'Chat ID is required' }, 400);
  }

  const chat = await chatRepository.findById(chatId);

  if (!chat) {
    return c.json({ error: 'Chat not found' }, 404);
  }

  c.set('chat', chat);
  c.set('chatId', chatId);
  await next();
});
