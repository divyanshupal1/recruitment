import { v4 as uuidv4 } from 'uuid';
import { chatMessagesCollection } from '../lib/firebase.js';
import { nowISO } from '../lib/time.js';
import type { ChatMessage, MessageRole, MessageType } from '../types/chat.js';
import type { DriveData } from '../types/drive.js';
import type { Question } from '../types/question.js';

export interface CreateMessageInput {
  chatId: string;
  role: MessageRole;
  type: MessageType;
  content: string;
  questions?: Question[];
  answers?: Record<string, unknown>;
  fileIds?: string[];
  driveData?: Partial<DriveData>;
}

export const messageRepository = {
  async create(input: CreateMessageInput): Promise<ChatMessage> {
    const message: ChatMessage = {
      id: uuidv4(),
      chatId: input.chatId,
      role: input.role,
      type: input.type,
      content: input.content,
      questions: input.questions,
      answers: input.answers,
      fileIds: input.fileIds,
      driveData: input.driveData,
      createdAt: nowISO(),
    };

    await chatMessagesCollection(input.chatId).doc(message.id).set(message);
    return message;
  },

  async list(chatId: string, limit: number, before?: string): Promise<ChatMessage[]> {
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
    return snapshot.docs.map((doc) => doc.data() as ChatMessage);
  },
};
