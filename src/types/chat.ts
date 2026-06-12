import { z } from 'zod';
import { DriveDataSchema, type DriveData } from './drive.js';
import { QuestionSchema, type Question } from './question.js';

// ==========================================
// Chat
// ==========================================

export const ChatStatusSchema = z.enum(['active', 'completed']);
export type ChatStatus = z.infer<typeof ChatStatusSchema>;

export const ChatSchema = z.object({
  id: z.string(),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  status: ChatStatusSchema,
  driveData: DriveDataSchema.nullable().optional(),
});

export type Chat = z.infer<typeof ChatSchema>;

// ==========================================
// Message Types
// ==========================================

export const MessageRoleSchema = z.enum(['user', 'assistant', 'system']);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

export const MessageTypeSchema = z.enum([
  'text',
  'file_upload',
  'questions',
  'drive_data',
  'answers',
]);
export type MessageType = z.infer<typeof MessageTypeSchema>;

// ==========================================
// Chat Message
// ==========================================

export const ChatMessageSchema = z.object({
  id: z.string(),
  chatId: z.string(),
  role: MessageRoleSchema,
  type: MessageTypeSchema,
  content: z.string(),
  questions: z.array(QuestionSchema).optional(),
  answers: z.record(z.unknown()).optional(),
  fileIds: z.array(z.string()).optional(),
  driveData: DriveDataSchema.optional(),
  createdAt: z.string(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

// ==========================================
// Uploaded File
// ==========================================

export const UploadedFileSchema = z.object({
  id: z.string(),
  chatId: z.string(),
  fileName: z.string(),
  mimeType: z.string(),
  fileSize: z.number(),
  storageUrl: z.string(),
  parsedData: DriveDataSchema.optional(),
  uploadedAt: z.string(),
});

export type UploadedFile = z.infer<typeof UploadedFileSchema>;
