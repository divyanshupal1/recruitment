import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import {
  chatsCollection,
  chatMessagesCollection,
} from '../lib/firebase.js';
import type { Chat, ChatMessage } from '../types/chat.js';

const chats = new Hono();

// ==========================================
// POST /api/chats — Create a new chat
// ==========================================
chats.post('/', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const title = (body as Record<string, unknown>).title as string || 'New Recruitment Drive';

    const chatId = uuidv4();
    const now = new Date().toISOString();

    const chat: Chat = {
      id: chatId,
      title,
      createdAt: now,
      updatedAt: now,
      status: 'active',
      driveData: {},
    };

    await chatsCollection.doc(chatId).set(chat);

    // Create a system message
    const systemMessage: ChatMessage = {
      id: uuidv4(),
      chatId,
      role: 'system',
      type: 'text',
      content: 'Chat created. Upload a Job Description PDF to get started.',
      createdAt: now,
    };

    await chatMessagesCollection(chatId).doc(systemMessage.id).set(systemMessage);

    return c.json({ chat }, 201);
  } catch (error) {
    console.error('[Chats] Create error:', error);
    return c.json(
      { error: 'Failed to create chat', details: String(error) },
      500
    );
  }
});

// ==========================================
// GET /api/chats — List all chats
// ==========================================
chats.get('/', async (c) => {
  try {
    const snapshot = await chatsCollection
      .orderBy('updatedAt', 'desc')
      .limit(50)
      .get();

    const chatsList = snapshot.docs.map((doc) => doc.data() as Chat);

    return c.json({ chats: chatsList });
  } catch (error) {
    console.error('[Chats] List error:', error);
    return c.json(
      { error: 'Failed to list chats', details: String(error) },
      500
    );
  }
});

// ==========================================
// GET /api/chats/:chatId — Get chat details
// ==========================================
chats.get('/:chatId', async (c) => {
  try {
    const chatId = c.req.param('chatId');
    const doc = await chatsCollection.doc(chatId).get();

    if (!doc.exists) {
      return c.json({ error: 'Chat not found' }, 404);
    }

    return c.json({ chat: doc.data() as Chat });
  } catch (error) {
    console.error('[Chats] Get error:', error);
    return c.json(
      { error: 'Failed to get chat', details: String(error) },
      500
    );
  }
});

// ==========================================
// GET /api/chats/:chatId/messages — List messages
// ==========================================
chats.get('/:chatId/messages', async (c) => {
  try {
    const chatId = c.req.param('chatId');
    const limit = parseInt(c.req.query('limit') || '50', 10);
    const before = c.req.query('before'); // cursor-based pagination

    // Verify chat exists
    const chatDoc = await chatsCollection.doc(chatId).get();
    if (!chatDoc.exists) {
      return c.json({ error: 'Chat not found' }, 404);
    }

    let query = chatMessagesCollection(chatId)
      .orderBy('createdAt', 'asc')
      .limit(limit);

    if (before) {
      query = chatMessagesCollection(chatId)
        .orderBy('createdAt', 'asc')
        .endBefore(before)
        .limit(limit);
    }

    const snapshot = await query.get();
    const messages = snapshot.docs.map((doc) => doc.data() as ChatMessage);

    return c.json({ messages });
  } catch (error) {
    console.error('[Chats] Messages error:', error);
    return c.json(
      { error: 'Failed to list messages', details: String(error) },
      500
    );
  }
});

export default chats;
