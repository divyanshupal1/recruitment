import { applyAnswersToDriveData, mergeDriveData } from '../lib/merge.js';
import { chatRepository } from '../repositories/chat.repository.js';
import { fileRepository } from '../repositories/file.repository.js';
import {
  generateClarificationQuestions,
  generateFinalDriveData,
} from './gemini.js';
import { messageService } from './message.service.js';
import type { Chat } from '../types/chat.js';
import type { DriveData } from '../types/drive.js';
import type { Question } from '../types/question.js';
import type { GenerateRequestInput } from '../types/requests.js';

export type QuestionsResponse = {
  type: 'questions';
  summary: string;
  questions: Question[];
  currentDriveData: Partial<DriveData>;
};

export type DriveDataResponse = {
  type: 'drive_data';
  driveData: Partial<DriveData>;
  message: string;
};

export type GenerateResponse = QuestionsResponse | DriveDataResponse;

export const generationService = {
  async runGenerationFlow(chat: Chat, input: GenerateRequestInput): Promise<GenerateResponse> {
    let currentDriveData: Partial<DriveData> = chat.driveData || {};
    const { message, answers, fileIds } = input;

    if (answers && Object.keys(answers).length > 0) {
      currentDriveData = applyAnswersToDriveData(currentDriveData, answers);
      await messageService.createAnswersMessage(
        chat.id,
        message || 'Provided answers to clarification questions',
        answers
      );
    }

    if (message && !answers) {
      await messageService.createUserMessage(chat.id, message, fileIds);
    }

    if (fileIds && fileIds.length > 0) {
      currentDriveData = await this.mergeFileData(chat.id, currentDriveData, fileIds);
    }

    await chatRepository.updateDriveData(chat.id, currentDriveData);

    const { questions, summary } = await generateClarificationQuestions(currentDriveData, answers);

    if (questions.length > 0) {
      await messageService.createQuestionsMessage(chat.id, summary, questions);
      return { type: 'questions', summary, questions, currentDriveData };
    }

    const finalDriveData = await generateFinalDriveData(currentDriveData);
    await chatRepository.updateDriveData(chat.id, finalDriveData, 'completed');

    await messageService.createDriveDataMessage(
      chat.id,
      '✅ Recruitment drive data is complete! Here is the finalized configuration.',
      finalDriveData
    );

    return {
      type: 'drive_data',
      driveData: finalDriveData,
      message: 'Recruitment drive data generated successfully.',
    };
  },

  async getDriveData(chatId: string): Promise<{ driveData: Partial<DriveData>; status: Chat['status'] }> {
    const chat = await chatRepository.findByIdOrThrow(chatId);
    return {
      driveData: chat.driveData || {},
      status: chat.status,
    };
  },

  async mergeFileData(
    chatId: string,
    driveData: Partial<DriveData>,
    fileIds: string[]
  ): Promise<Partial<DriveData>> {
    const files = await fileRepository.findByIds(chatId, fileIds);
    let result = driveData;

    for (const file of files) {
      if (file.parsedData) {
        result = mergeDriveData(result, file.parsedData);
      }
    }

    return result;
  },
};
