import { Hono } from 'hono';
import * as generationController from '../controllers/generation.controller.js';
import { requireChat } from '../middleware/require-chat.js';

const generate = new Hono();

generate.post('/:chatId/generate', requireChat, generationController.generateDriveData);
generate.get('/:chatId/drive-data', requireChat, generationController.getDriveData);

export default generate;
