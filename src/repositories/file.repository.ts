import { chatFilesCollection } from '../lib/firebase.js';
import type { UploadedFile } from '../types/chat.js';

export const fileRepository = {
  async create(chatId: string, file: UploadedFile): Promise<UploadedFile> {
    await chatFilesCollection(chatId).doc(file.id).set(file);
    return file;
  },

  async findById(chatId: string, fileId: string): Promise<UploadedFile | null> {
    const doc = await chatFilesCollection(chatId).doc(fileId).get();
    if (!doc.exists) return null;
    return doc.data() as UploadedFile;
  },

  async list(chatId: string): Promise<UploadedFile[]> {
    const snapshot = await chatFilesCollection(chatId)
      .orderBy('uploadedAt', 'asc')
      .get();
    return snapshot.docs.map((doc) => doc.data() as UploadedFile);
  },

  async findByIds(chatId: string, fileIds: string[]): Promise<UploadedFile[]> {
    const files: UploadedFile[] = [];
    for (const fileId of fileIds) {
      const file = await this.findById(chatId, fileId);
      if (file) files.push(file);
    }
    return files;
  },
};
