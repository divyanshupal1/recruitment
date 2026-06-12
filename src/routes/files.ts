import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import {
  chatsCollection,
  chatFilesCollection,
  chatMessagesCollection,
  bucket,
} from '../lib/firebase.js';
import { mergeDriveData } from '../lib/merge.js';
import { parseJDFromFile } from '../services/gemini.js';
import type { Chat, UploadedFile, ChatMessage } from '../types/chat.js';
import type { DriveData } from '../types/drive.js';

const files = new Hono();

// ==========================================
// POST /api/chats/:chatId/files — Upload a file
// ==========================================
files.post('/:chatId/files', async (c) => {
  try {
    const chatId = c.req.param('chatId');

    // Verify chat exists
    const chatDoc = await chatsCollection.doc(chatId).get();
    if (!chatDoc.exists) {
      return c.json({ error: 'Chat not found' }, 404);
    }

    // Parse multipart form data
    const formData = await c.req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return c.json({ error: 'No file provided. Send a file with the key "file".' }, 400);
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      return c.json(
        { error: `Unsupported file type: ${file.type}. Allowed: PDF, DOC, DOCX` },
        400
      );
    }

    const fileId = uuidv4();
    const now = new Date().toISOString();
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // 1. Upload to Firebase Storage
    const storagePath = `chats/${chatId}/files/${fileId}/${file.name}`;
    const storageFile = bucket.file(storagePath);

    await storageFile.save(fileBuffer, {
      metadata: {
        contentType: file.type,
        metadata: {
          chatId,
          fileId,
          originalName: file.name,
        },
      },
    });

    // Generate a signed URL for access (valid for 7 days)
    const [signedUrl] = await storageFile.getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    console.log(`[Files] Uploaded to Storage: ${storagePath}`);

    // 2. Parse the JD using Gemini
    let parsedData: Partial<DriveData> = {};
    let geminiFileUri: string | undefined;
    let parseWarning: string | undefined;

    try {
      const parseResult = await parseJDFromFile(fileBuffer, file.type, file.name);
      parsedData = parseResult.parsedData;
      geminiFileUri = parseResult.geminiFileUri;
      console.log('[Files] JD parsed successfully via Gemini');
    } catch (parseError) {
      const errorMsg = String(parseError);
      console.error('[Files] JD parsing failed:', errorMsg);
      parseWarning = errorMsg;
      // Continue even if parsing fails — file is still uploaded
    }

    // 3. Store file metadata in Firestore
    const uploadedFile: UploadedFile = {
      id: fileId,
      chatId,
      fileName: file.name,
      mimeType: file.type,
      fileSize: fileBuffer.length,
      storageUrl: signedUrl,
      geminiFileUri,
      parsedData,
      uploadedAt: now,
    };

    await chatFilesCollection(chatId).doc(fileId).set(uploadedFile);

    // 4. Merge parsed data into chat's accumulated driveData
    const chatData = chatDoc.data() as Chat;
    const updatedDriveData = mergeDriveData(chatData.driveData || {}, parsedData);

    await chatsCollection.doc(chatId).update({
      driveData: updatedDriveData,
      updatedAt: now,
    });

    // 5. Create a message for this upload
    const uploadMessage: ChatMessage = {
      id: uuidv4(),
      chatId,
      role: 'user',
      type: 'file_upload',
      content: `Uploaded file: ${file.name}`,
      fileIds: [fileId],
      createdAt: now,
    };

    await chatMessagesCollection(chatId).doc(uploadMessage.id).set(uploadMessage);

    // Create an assistant message with parsing summary
    const parsingSummary = buildParsingSummary(parsedData, parseWarning);
    const assistantMessage: ChatMessage = {
      id: uuidv4(),
      chatId,
      role: 'assistant',
      type: 'text',
      content: parsingSummary,
      driveData: parsedData,
      createdAt: new Date().toISOString(),
    };

    await chatMessagesCollection(chatId).doc(assistantMessage.id).set(assistantMessage);

    return c.json({
      file: uploadedFile,
      parsedData,
      parseWarning,
      message: parsingSummary,
    }, 201);
  } catch (error) {
    console.error('[Files] Upload error:', error);
    return c.json(
      { error: 'Failed to upload file', details: String(error) },
      500
    );
  }
});

// ==========================================
// GET /api/chats/:chatId/files — List files
// ==========================================
files.get('/:chatId/files', async (c) => {
  try {
    const chatId = c.req.param('chatId');

    // Verify chat exists
    const chatDoc = await chatsCollection.doc(chatId).get();
    if (!chatDoc.exists) {
      return c.json({ error: 'Chat not found' }, 404);
    }

    const snapshot = await chatFilesCollection(chatId)
      .orderBy('uploadedAt', 'asc')
      .get();

    const filesList = snapshot.docs.map((doc) => doc.data() as UploadedFile);

    return c.json({ files: filesList });
  } catch (error) {
    console.error('[Files] List error:', error);
    return c.json(
      { error: 'Failed to list files', details: String(error) },
      500
    );
  }
});

// ==========================================
// Helpers
// ==========================================

function buildParsingSummary(data: Partial<DriveData>, parseWarning?: string): string {
  const parts: string[] = ['📄 Job Description parsed successfully. Here\'s what I found:\n'];

  const setup = data.setupDetails;
  if (setup) {
    if (setup.jobTitle) parts.push(`• **Job Title**: ${setup.jobTitle}`);
    if (setup.candidateType) parts.push(`• **Candidate Type**: ${setup.candidateType}`);
    if (setup.positionTitles?.length) parts.push(`• **Positions**: ${setup.positionTitles.join(', ')}`);
    if (setup.numberOfVacancies) parts.push(`• **Vacancies**: ${setup.numberOfVacancies}`);
    if (setup.experience) parts.push(`• **Experience**: ${setup.experience}`);
  }

  const position = data.positionDetails;
  if (position) {
    if (position.employmentType) parts.push(`• **Employment**: ${position.employmentType.replace(/_/g, ' ')}`);
    if (position.locationType) parts.push(`• **Location**: ${position.locationType}${position.locationDetails ? ` (${position.locationDetails})` : ''}`);
    if (position.salaryPackage) parts.push(`• **Salary**: ${position.salaryPackage}`);
    if (position.requiredSkills?.length) parts.push(`• **Required Skills**: ${position.requiredSkills.join(', ')}`);
  }

  const eligibility = data.eligibilityCriteria;
  if (eligibility) {
    if (eligibility.eligibleCourses?.length) parts.push(`• **Eligible Courses**: ${eligibility.eligibleCourses.join(', ')}`);
  }

  if (parts.length === 1) {
    if (parseWarning) {
      parts.push(`⚠️ AI parsing failed: ${parseWarning}\n\nThe file was uploaded successfully. You can proceed with manual input.`);
    } else {
      parts.push('⚠️ Could not extract structured data from this file. You can proceed with manual input.');
    }
  }

  return parts.join('\n');
}

export default files;
