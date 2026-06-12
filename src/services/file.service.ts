import { v4 as uuidv4 } from 'uuid';
import { BadRequestError } from '../lib/errors.js';
import { buildParsingSummary } from '../lib/format.js';
import { mergeDriveData } from '../lib/merge.js';
import { nowISO } from '../lib/time.js';
import { ALLOWED_MIME_TYPES } from '../lib/constants.js';
import { chatRepository } from '../repositories/chat.repository.js';
import { fileRepository } from '../repositories/file.repository.js';
import { parseJDFromFile } from './gemini.js';
import { messageService } from './message.service.js';
import { storageService } from './storage.service.js';
import type { Chat, UploadedFile } from '../types/chat.js';
import type { DriveData } from '../types/drive.js';

export interface FileUploadResult {
  file: UploadedFile;
  parsedData: Partial<DriveData>;
  parseWarning?: string;
  message: string;
}

export const fileService = {
  async uploadAndParse(chat: Chat, file: File): Promise<FileUploadResult> {
    if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
      throw new BadRequestError(
        `Unsupported file type: ${file.type}. Allowed: PDF, DOC, DOCX`
      );
    }

    const fileId = uuidv4();
    const now = nowISO();
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const { signedUrl } = await storageService.uploadFile(
      chat.id,
      fileId,
      file.name,
      file.type,
      fileBuffer
    );

    let parsedData: Partial<DriveData> = {};
    let parseWarning: string | undefined;

    try {
      const parseResult = await parseJDFromFile(fileBuffer, file.type, file.name);
      parsedData = parseResult.parsedData;
      console.log('[FileService] JD parsed successfully via Gemini');
    } catch (parseError) {
      parseWarning = String(parseError);
      console.error('[FileService] JD parsing failed:', parseWarning);
    }

    const uploadedFile: UploadedFile = {
      id: fileId,
      chatId: chat.id,
      fileName: file.name,
      mimeType: file.type,
      fileSize: fileBuffer.length,
      storageUrl: signedUrl,
      parsedData,
      uploadedAt: now,
    };

    await fileRepository.create(chat.id, uploadedFile);

    const updatedDriveData = mergeDriveData(chat.driveData || {}, parsedData);
    await chatRepository.updateDriveData(chat.id, updatedDriveData);

    await messageService.createFileUploadMessage(chat.id, file.name, fileId);

    const parsingSummary = buildParsingSummary(parsedData, parseWarning);
    await messageService.createAssistantTextMessage(chat.id, parsingSummary, parsedData);

    return {
      file: uploadedFile,
      parsedData,
      parseWarning,
      message: parsingSummary,
    };
  },

  async listFiles(chatId: string): Promise<UploadedFile[]> {
    return fileRepository.list(chatId);
  },
};
