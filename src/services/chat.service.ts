import { v4 as uuidv4 } from 'uuid';
import { chatRepository } from '../repositories/chat.repository.js';
import { messageService } from './message.service.js';
import { nowISO } from '../lib/time.js';
import type { Chat } from '../types/chat.js';
import type { CreateChatInput } from '../types/requests.js';

export const chatService = {
  async create(input: CreateChatInput): Promise<Chat> {
    const chatId = uuidv4();
    const now = nowISO();

    const chat: Chat = {
      id: chatId,
      title: input.title,
      createdAt: now,
      updatedAt: now,
      status: 'active',
      driveData: {},
    };

    await chatRepository.create(chat);
    await messageService.createSystemMessage(
      chatId,
      'Chat created. Upload a Job Description PDF to get started.'
    );

    return chat;
  },

  async getById(chatId: string): Promise<Chat> {
    return chatRepository.findByIdOrThrow(chatId);
  },

  async list(): Promise<Chat[]> {
    return chatRepository.list();
  },
};
