import { bucket } from '../lib/firebase.js';
import { SIGNED_URL_EXPIRY_MS } from '../lib/constants.js';

export interface StorageUploadResult {
  storagePath: string;
  signedUrl: string;
}

export const storageService = {
  async uploadFile(
    chatId: string,
    fileId: string,
    fileName: string,
    mimeType: string,
    buffer: Buffer
  ): Promise<StorageUploadResult> {
    const storagePath = `chats/${chatId}/files/${fileId}/${fileName}`;
    const storageFile = bucket.file(storagePath);

    await storageFile.save(buffer, {
      metadata: {
        contentType: mimeType,
        metadata: { chatId, fileId, originalName: fileName },
      },
    });

    const [signedUrl] = await storageFile.getSignedUrl({
      action: 'read',
      expires: Date.now() + SIGNED_URL_EXPIRY_MS,
    });

    console.log(`[Storage] Uploaded: ${storagePath}`);
    return { storagePath, signedUrl };
  },
};
