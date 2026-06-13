export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'image/jpg',
] as const;

export const DEFAULT_CHAT_LIST_LIMIT = 50;
export const DEFAULT_MESSAGE_LIST_LIMIT = 50;
export const SIGNED_URL_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
