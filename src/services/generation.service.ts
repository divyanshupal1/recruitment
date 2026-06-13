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

/**
 * Extracts all field dot-paths that have been populated in a DriveData object.
 * Used to track which fields already have values and shouldn't be asked again.
 */
function extractPopulatedFields(data: Partial<DriveData>, prefix = ''): string[] {
  const fields: string[] = [];

  for (const [key, value] of Object.entries(data)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (value === null || value === undefined) continue;

    if (Array.isArray(value)) {
      if (value.length > 0) fields.push(path);
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      // Recurse into nested objects (but not arrays)
      fields.push(...extractPopulatedFields(value as Record<string, unknown>, path));
    } else {
      fields.push(path);
    }
  }

  return fields;
}

/**
 * Extracts the dot-path field names from answer keys.
 * Also extracts skipped/null answers to mark them as explicitly skipped.
 */
function extractAnsweredFields(answers: Record<string, unknown>): string[] {
  return Object.keys(answers);
}

export const generationService = {
  /** Accumulated set of all fields that have been answered or skipped across rounds */
  _getAnsweredFields(driveData: Partial<DriveData>, allAnswers: Record<string, unknown>): string[] {
    const populated = extractPopulatedFields(driveData);
    const answered = extractAnsweredFields(allAnswers);
    return [...new Set([...populated, ...answered])];
  },

  async runGenerationFlow(chat: Chat, input: GenerateRequestInput): Promise<GenerateResponse> {
    let currentDriveData: Partial<DriveData> = chat.driveData || {};
    const { message, answers, fileIds } = input;

    // Accumulate all answers ever provided for this chat
    const allAnswers: Record<string, unknown> = { ...(chat.answeredFields || {}) };

    if (answers && Object.keys(answers).length > 0) {
      currentDriveData = applyAnswersToDriveData(currentDriveData, answers);

      // Track all answered fields (including explicitly skipped/null ones)
      Object.assign(allAnswers, answers);

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

    // Save drive data and the cumulative answer tracking
    await chatRepository.updateDriveData(chat.id, currentDriveData);

    // Build the list of fields NOT to ask about
    const answeredFields = this._getAnsweredFields(currentDriveData, allAnswers);

    const { questions, summary } = await generateClarificationQuestions(
      currentDriveData,
      answeredFields,
      answers // pass only the latest answers for dependency resolution
    );

    if (questions.length > 0) {
      await messageService.createQuestionsMessage(chat.id, summary, questions);
      return { type: 'questions', summary, questions, currentDriveData };
    }

    // All data complete — finalize
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
