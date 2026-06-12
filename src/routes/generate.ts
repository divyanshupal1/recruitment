import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import {
  chatsCollection,
  chatFilesCollection,
  chatMessagesCollection,
} from '../lib/firebase.js';
import { mergeDriveData, applyAnswersToDriveData } from '../lib/merge.js';
import {
  generateClarificationQuestions,
  generateFinalDriveData,
} from '../services/gemini.js';
import type { Chat, ChatMessage, UploadedFile } from '../types/chat.js';
import type { DriveData } from '../types/drive.js';

const generate = new Hono();

// ==========================================
// POST /api/chats/:chatId/generate — Generate drive data
// ==========================================
generate.post('/:chatId/generate', async (c) => {
  try {
    const chatId = c.req.param('chatId');

    // Verify chat exists
    const chatDoc = await chatsCollection.doc(chatId).get();
    if (!chatDoc.exists) {
      return c.json({ error: 'Chat not found' }, 404);
    }

    const chatData = chatDoc.data() as Chat;
    let currentDriveData: Partial<DriveData> = chatData.driveData || {};

    // Parse request body
    const body = await c.req.json().catch(() => ({})) as {
      message?: string;
      answers?: Record<string, unknown>;
      fileIds?: string[];
    };

    const { message, answers, fileIds } = body;
    const now = new Date().toISOString();

    // 1. If answers provided, merge them into drive data
    if (answers && Object.keys(answers).length > 0) {
      currentDriveData = applyAnswersToDriveData(currentDriveData, answers);

      // Store the user's answers as a message
      const answersMessage: ChatMessage = {
        id: uuidv4(),
        chatId,
        role: 'user',
        type: 'answers',
        content: message || 'Provided answers to clarification questions',
        answers,
        createdAt: now,
      };
      await chatMessagesCollection(chatId).doc(answersMessage.id).set(answersMessage);
    }

    // 2. If user sent a text message, store it
    if (message && !answers) {
      const userMessage: ChatMessage = {
        id: uuidv4(),
        chatId,
        role: 'user',
        type: 'text',
        content: message,
        fileIds: fileIds || undefined,
        createdAt: now,
      };
      await chatMessagesCollection(chatId).doc(userMessage.id).set(userMessage);
    }

    // 3. If additional fileIds provided, merge their parsed data
    if (fileIds && fileIds.length > 0) {
      for (const fileId of fileIds) {
        const fileDoc = await chatFilesCollection(chatId).doc(fileId).get();
        if (fileDoc.exists) {
          const fileData = fileDoc.data() as UploadedFile;
          if (fileData.parsedData) {
            currentDriveData = mergeDriveData(currentDriveData, fileData.parsedData);
          }
        }
      }
    }

    // 4. Update the chat's accumulated driveData
    await chatsCollection.doc(chatId).update({
      driveData: currentDriveData,
      updatedAt: now,
    });

    // 5. Check for missing fields and generate questions
    const { questions, summary } = await generateClarificationQuestions(
      currentDriveData,
      answers
    );

    if (questions.length > 0) {
      // There are still missing fields — ask the user
      const questionMessage: ChatMessage = {
        id: uuidv4(),
        chatId,
        role: 'assistant',
        type: 'questions',
        content: summary,
        questions,
        createdAt: new Date().toISOString(),
      };
      await chatMessagesCollection(chatId).doc(questionMessage.id).set(questionMessage);

      return c.json({
        type: 'questions',
        summary,
        questions,
        currentDriveData,
      });
    }

    // 6. All data is complete — generate final drive data
    // Collect Gemini file URIs for additional context
    const fileSnapshot = await chatFilesCollection(chatId).get();
    const geminiFileUris = fileSnapshot.docs
      .map((doc) => (doc.data() as UploadedFile).geminiFileUri)
      .filter((uri): uri is string => !!uri);

    const finalDriveData = await generateFinalDriveData(currentDriveData, geminiFileUris);

    // Update chat with final data
    await chatsCollection.doc(chatId).update({
      driveData: finalDriveData,
      status: 'completed',
      updatedAt: new Date().toISOString(),
    });

    // Store the final drive data message
    const driveDataMessage: ChatMessage = {
      id: uuidv4(),
      chatId,
      role: 'assistant',
      type: 'drive_data',
      content: '✅ Recruitment drive data is complete! Here is the finalized configuration.',
      driveData: finalDriveData,
      createdAt: new Date().toISOString(),
    };
    await chatMessagesCollection(chatId).doc(driveDataMessage.id).set(driveDataMessage);

    return c.json({
      type: 'drive_data',
      driveData: finalDriveData,
      message: 'Recruitment drive data generated successfully.',
    });
  } catch (error) {
    console.error('[Generate] Error:', error);
    return c.json(
      { error: 'Failed to generate drive data', details: String(error) },
      500
    );
  }
});

// ==========================================
// GET /api/chats/:chatId/drive-data — Get current drive data
// ==========================================
generate.get('/:chatId/drive-data', async (c) => {
  try {
    const chatId = c.req.param('chatId');

    const chatDoc = await chatsCollection.doc(chatId).get();
    if (!chatDoc.exists) {
      return c.json({ error: 'Chat not found' }, 404);
    }

    const chatData = chatDoc.data() as Chat;

    return c.json({
      driveData: chatData.driveData || {},
      status: chatData.status,
    });
  } catch (error) {
    console.error('[Generate] Drive data error:', error);
    return c.json(
      { error: 'Failed to get drive data', details: String(error) },
      500
    );
  }
});

export default generate;
