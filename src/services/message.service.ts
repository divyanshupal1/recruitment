import { messageRepository } from '../repositories/message.repository.js';
import type { DriveData } from '../types/drive.js';
import type { Question } from '../types/question.js';

export const messageService = {
  createSystemMessage(chatId: string, content: string) {
    return messageRepository.create({
      chatId,
      role: 'system',
      type: 'text',
      content,
    });
  },

  createUserMessage(chatId: string, content: string, fileIds?: string[]) {
    return messageRepository.create({
      chatId,
      role: 'user',
      type: 'text',
      content,
      fileIds,
    });
  },

  createFileUploadMessage(chatId: string, fileName: string, fileId: string) {
    return messageRepository.create({
      chatId,
      role: 'user',
      type: 'file_upload',
      content: `Uploaded file: ${fileName}`,
      fileIds: [fileId],
    });
  },

  createAnswersMessage(chatId: string, content: string, answers: Record<string, unknown>) {
    return messageRepository.create({
      chatId,
      role: 'user',
      type: 'answers',
      content,
      answers,
    });
  },

  createAssistantTextMessage(chatId: string, content: string, driveData?: Partial<DriveData>) {
    return messageRepository.create({
      chatId,
      role: 'assistant',
      type: 'text',
      content,
      driveData,
    });
  },

  createQuestionsMessage(chatId: string, content: string, questions: Question[]) {
    return messageRepository.create({
      chatId,
      role: 'assistant',
      type: 'questions',
      content,
      questions,
    });
  },

  createDriveDataMessage(chatId: string, content: string, driveData: Partial<DriveData>) {
    return messageRepository.create({
      chatId,
      role: 'assistant',
      type: 'drive_data',
      content,
      driveData,
    });
  },

  listMessages(chatId: string, limit: number, before?: string) {
    return messageRepository.list(chatId, limit, before);
  },
};
