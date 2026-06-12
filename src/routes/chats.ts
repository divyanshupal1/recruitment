import { Hono } from 'hono';
import * as chatController from '../controllers/chat.controller.js';
import { requireChat } from '../middleware/require-chat.js';

const chats = new Hono();

chats.post('/', chatController.createChat);
chats.get('/', chatController.listChats);
chats.get('/:chatId', chatController.getChat);
chats.get('/:chatId/messages', requireChat, chatController.listMessages);

export default chats;
