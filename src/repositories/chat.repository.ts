import { chatsCollection } from '../lib/firebase.js';
import { NotFoundError } from '../lib/errors.js';
import { nowISO } from '../lib/time.js';
import { DEFAULT_CHAT_LIST_LIMIT } from '../lib/constants.js';
import type { Chat } from '../types/chat.js';
import type { DriveData } from '../types/drive.js';

export const chatRepository = {
  async create(chat: Chat): Promise<Chat> {
    await chatsCollection.doc(chat.id).set(chat);
    return chat;
  },

  async findById(chatId: string): Promise<Chat | null> {
    const doc = await chatsCollection.doc(chatId).get();
    if (!doc.exists) return null;
    return doc.data() as Chat;
  },

  async findByIdOrThrow(chatId: string): Promise<Chat> {
    const chat = await this.findById(chatId);
    if (!chat) throw new NotFoundError('Chat not found');
    return chat;
  },

  async list(limit = DEFAULT_CHAT_LIST_LIMIT): Promise<Chat[]> {
    const snapshot = await chatsCollection
      .orderBy('updatedAt', 'desc')
      .limit(limit)
      .get();
    return snapshot.docs.map((doc) => doc.data() as Chat);
  },

  async update(chatId: string, data: Partial<Chat>): Promise<void> {
    await chatsCollection.doc(chatId).update(data);
  },

  async updateDriveData(chatId: string, driveData: Partial<DriveData>, status?: Chat['status']): Promise<void> {
    const update: Partial<Chat> = {
      driveData,
      updatedAt: nowISO(),
    };
    if (status) {
      update.status = status;
    }
    if (driveData?.setupDetails?.driveTitle) {
      update.title = driveData.setupDetails.driveTitle;
    }
    await chatsCollection.doc(chatId).update(update);
  },
};
