import { Hono } from 'hono';
import * as fileController from '../controllers/file.controller.js';
import { requireChat } from '../middleware/require-chat.js';

const files = new Hono();

files.post('/:chatId/files', requireChat, fileController.uploadFile);
files.get('/:chatId/files', requireChat, fileController.listFiles);

export default files;
