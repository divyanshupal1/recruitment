import type { Part, Schema } from '@google/generative-ai';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import type { DriveData } from '../types/drive.js';
import type { Question } from '../types/question.js';
import {
  DOCUMENT_PARSING_PROMPT,
  QUESTION_GENERATION_PROMPT,
  DRIVE_FINALIZATION_PROMPT,
  QUESTIONS_VERIFICATION_PROMPT,
  DRIVE_VERIFICATION_PROMPT,
} from '../lib/prompts.js';

const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) {
  throw new Error('GOOGLE_API_KEY environment variable is required');
}

const genAI = new GoogleGenerativeAI(apiKey);
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

// ==========================================
// Gemini Response Schemas
// ==========================================

const DRIVE_DATA_RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    setupDetails: {
      type: SchemaType.OBJECT,
      properties: {
        candidateType: { type: SchemaType.STRING, nullable: true },
        positionTitle: { type: SchemaType.STRING, nullable: true },
        numberOfVacancies: { type: SchemaType.NUMBER, nullable: true },
        driveTitle: { type: SchemaType.STRING, nullable: true },
        preferredYearOfGraduation: { type: SchemaType.ARRAY, items: { type: SchemaType.NUMBER }, nullable: true },
        targetJoiningTimeframe: {
          type: SchemaType.OBJECT,
          properties: {
            hasTarget: { type: SchemaType.BOOLEAN, nullable: true },
            format: { type: SchemaType.STRING, nullable: true },
            value: { type: SchemaType.STRING, nullable: true },
          },
          nullable: true,
        },
      },
      nullable: true,
    },
    positionDetails: {
      type: SchemaType.OBJECT,
      properties: {
        employmentType: { type: SchemaType.STRING, nullable: true },
        internshipDuration: { type: SchemaType.STRING, nullable: true },
        locationType: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, nullable: true },
        locationCities: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, nullable: true },
        jobDescription: { type: SchemaType.STRING, nullable: true },
        requiredSkills: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, nullable: true },
        goodToHaveSkills: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, nullable: true },
        salaryType: { type: SchemaType.STRING, nullable: true },
        salaryFixed: { type: SchemaType.STRING, nullable: true },
        salaryMin: { type: SchemaType.STRING, nullable: true },
        salaryMax: { type: SchemaType.STRING, nullable: true },
        salaryBreakdown: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              component: { type: SchemaType.STRING },
              value: { type: SchemaType.STRING },
            },
            required: ['component', 'value'],
          },
          nullable: true,
        },
        probationPeriod: { type: SchemaType.STRING, nullable: true },
        bondPeriod: { type: SchemaType.STRING, nullable: true },
        bondAmount: { type: SchemaType.STRING, nullable: true },
        additionalDetails: { type: SchemaType.STRING, nullable: true },
      },
      nullable: true,
    },
    eligibilityCriteria: {
      type: SchemaType.OBJECT,
      properties: {
        eligibleCourses: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, nullable: true },
        academicCriteria: {
          type: SchemaType.OBJECT,
          properties: {
            postGraduationMarks: { type: SchemaType.NUMBER, nullable: true },
            graduationMarks: { type: SchemaType.NUMBER, nullable: true },
            twelfthMarks: { type: SchemaType.NUMBER, nullable: true },
            diplomaMarks: { type: SchemaType.NUMBER, nullable: true },
            tenthMarks: { type: SchemaType.NUMBER, nullable: true },
            backpaperAllowed: { type: SchemaType.BOOLEAN, nullable: true },
            backpaperType: { type: SchemaType.STRING, nullable: true },
            maxBackpapers: { type: SchemaType.NUMBER, nullable: true },
          },
          nullable: true,
        },
        eligibilityDate: { type: SchemaType.STRING, nullable: true },
        maxAge: { type: SchemaType.NUMBER, nullable: true },
      },
      nullable: true,
    },
    interviewConfig: {
      type: SchemaType.OBJECT,
      properties: {
        numberOfRounds: { type: SchemaType.NUMBER, nullable: true },
        rounds: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              roundNumber: { type: SchemaType.NUMBER },
              roundType: { type: SchemaType.STRING, nullable: true },
              roundTitle: { type: SchemaType.STRING, nullable: true },
              duration: { type: SchemaType.STRING, nullable: true },
              venue: { type: SchemaType.STRING, nullable: true },
              description: { type: SchemaType.STRING, nullable: true },
            },
            required: ['roundNumber'],
          },
          nullable: true,
        },
      },
      nullable: true,
    },
    customFields: {
      type: SchemaType.OBJECT,
      description: 'Any additional fields extracted that do not fit standard categories',
      nullable: true,
    },
  },
};

const QUESTIONS_RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    questions: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          id: { type: SchemaType.STRING, description: 'Unique identifier for the question' },
          field: { type: SchemaType.STRING, description: 'Dot-path to the DriveData field, e.g. setupDetails.candidateType' },
          question: { type: SchemaType.STRING, description: 'Human-readable question text' },
          type: {
            type: SchemaType.STRING,
            description: 'Question input type',
            enum: ['single_select', 'multi_select', 'text', 'number', 'date', 'toggle', 'tag_input'],
          },
          options: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                value: { type: SchemaType.STRING },
                label: { type: SchemaType.STRING },
                description: { type: SchemaType.STRING, nullable: true },
              },
              required: ['value', 'label'],
            },
            nullable: true,
            description: 'Options for single_select and multi_select types',
          },
          suggestedOptions: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            nullable: true,
            description: 'AI-generated suggestions shown as chips alongside free-form input',
          },
          required: { type: SchemaType.BOOLEAN, description: 'Whether this question must be answered' },
          description: { type: SchemaType.STRING, nullable: true, description: 'Helper text shown below the question' },
          warning: { type: SchemaType.STRING, nullable: true, description: 'Immutability or important warning text' },
        },
        required: ['id', 'field', 'question', 'type', 'required'],
      },
    },
    summary: {
      type: SchemaType.STRING,
      description: 'A brief summary of current state and what is still needed',
    },
  },
  required: ['questions', 'summary'],
};

// ==========================================
// Helper
// ==========================================

async function generateStructuredJson<T>(parts: Part[], schema: Schema): Promise<T> {
  const result = await model.generateContent({
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: schema,
    },
  });

  return JSON.parse(result.response.text()) as T;
}

// ==========================================
// Core AI Functions
// ==========================================

/**
 * Parse any uploaded document (JD, policy doc, benefits sheet, etc.) using Gemini inline data.
 */
export async function parseDocumentFromFile(
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<{ parsedData: Partial<DriveData> }> {
  const base64Data = fileBuffer.toString('base64');

  console.log(`[Gemini] Parsing document via inline data: ${fileName} (${(fileBuffer.length / 1024).toFixed(1)} KB)`);

  const parsedData = await generateStructuredJson<Partial<DriveData>>(
    [
      { inlineData: { mimeType, data: base64Data } } as Part,
      { text: DOCUMENT_PARSING_PROMPT },
    ],
    DRIVE_DATA_RESPONSE_SCHEMA as Schema
  );

  console.log('[Gemini] Document parsed successfully');
  return { parsedData };
}

/**
 * Generate clarification questions for missing fields.
 * Tracks answered fields to avoid repeating questions.
 */
export async function generateClarificationQuestions(
  driveData: Partial<DriveData>,
  answeredFields?: string[],
  previousAnswers?: Record<string, unknown>
): Promise<{ questions: Question[]; summary: string }> {
  const contextParts: string[] = [
    QUESTION_GENERATION_PROMPT,
    '\n\n## Current Drive Data State\n```json\n' + JSON.stringify(driveData, null, 2) + '\n```',
  ];

  if (answeredFields && answeredFields.length > 0) {
    contextParts.push(
      '\n\n## Already Answered/Skipped Fields (DO NOT ask about these)\n' +
        answeredFields.map((f) => `- ${f}`).join('\n') +
        '\n\nThese fields have been answered or explicitly skipped by the user. Do NOT generate questions for any of them or their dependent fields.'
    );
  }

  if (previousAnswers && Object.keys(previousAnswers).length > 0) {
    contextParts.push(
      '\n\n## Latest Answers Just Provided\n```json\n' +
        JSON.stringify(previousAnswers, null, 2) +
        '\n```\nUse these to determine which dependent fields to ask next or skip.'
    );
  }

  const parsed = await generateStructuredJson<{ questions: Question[]; summary: string }>(
    [{ text: contextParts.join('') }],
    QUESTIONS_RESPONSE_SCHEMA as Schema
  );

  console.log(`[Gemini] Generated ${parsed.questions.length} clarification questions`);
  return parsed;
}

/**
 * Generate the finalized, complete drive data.
 */
export async function generateFinalDriveData(
  driveData: Partial<DriveData>
): Promise<Partial<DriveData>> {
  const finalData = await generateStructuredJson<Partial<DriveData>>(
    [
      {
        text:
          DRIVE_FINALIZATION_PROMPT +
          '\n\n## Current Drive Data (merge of all sources + user answers)\n```json\n' +
          JSON.stringify(driveData, null, 2) +
          '\n```\n\nProduce the final, complete, and clean DriveData object.',
      },
    ],
    DRIVE_DATA_RESPONSE_SCHEMA as Schema
  );

  console.log('[Gemini] Final drive data generated');
  return finalData;
}

function serializeMessagesForVerification(messages: any[]): string {
  return messages
    .map((m) => {
      let text = `[${m.role.toUpperCase()}] (${m.type}): ${m.content}`;
      if (m.answers && Object.keys(m.answers).length > 0) {
        text += `\nAnswers provided:\n${JSON.stringify(m.answers, null, 2)}`;
      }
      if (m.questions && m.questions.length > 0) {
        text += `\nQuestions asked:\n${JSON.stringify(m.questions.map((q: any) => q.question), null, 2)}`;
      }
      return text;
    })
    .join('\n\n');
}

/**
 * Verify proposed clarification questions using a second verifier pass.
 */
export async function verifyClarificationQuestions(
  driveData: Partial<DriveData>,
  answeredFields: string[],
  proposedQuestions: Question[],
  proposedSummary: string,
  messages: any[]
): Promise<{ questions: Question[]; summary: string }> {
  const serializedHistory = serializeMessagesForVerification(messages);

  const contextParts: string[] = [
    QUESTIONS_VERIFICATION_PROMPT,
    '\n\n## Conversation History\n' + (serializedHistory || 'No previous history.'),
    '\n\n## Current Drive Data State\n```json\n' + JSON.stringify(driveData, null, 2) + '\n```',
    '\n\n## Already Answered/Skipped Fields\n' + (answeredFields.length > 0 ? answeredFields.map((f) => `- ${f}`).join('\n') : 'None.'),
    '\n\n## Proposed Clarification Questions\n```json\n' + JSON.stringify(proposedQuestions, null, 2) + '\n```',
    '\n\n## Proposed Summary\n' + proposedSummary,
  ];

  console.log('[Gemini QA Agent] Running verification call on proposed questions...');

  const verified = await generateStructuredJson<{ questions: Question[]; summary: string }>(
    [{ text: contextParts.join('') }],
    QUESTIONS_RESPONSE_SCHEMA as Schema
  );

  console.log(`[Gemini QA Agent] Verification complete. Proposed: ${proposedQuestions.length} questions. Verified: ${verified.questions.length} questions.`);
  return verified;
}

/**
 * Verify and clean up proposed final drive data using a second verifier pass.
 */
export async function verifyFinalDriveData(
  driveData: Partial<DriveData>,
  finalDriveData: Partial<DriveData>,
  messages: any[]
): Promise<Partial<DriveData>> {
  const serializedHistory = serializeMessagesForVerification(messages);

  const contextParts: string[] = [
    DRIVE_VERIFICATION_PROMPT,
    '\n\n## Conversation History\n' + (serializedHistory || 'No previous history.'),
    '\n\n## Input Drive Data State\n```json\n' + JSON.stringify(driveData, null, 2) + '\n```',
    '\n\n## Proposed Finalized Drive Data\n```json\n' + JSON.stringify(finalDriveData, null, 2) + '\n```',
  ];

  console.log('[Gemini QA Agent] Running verification call on proposed final drive data...');

  const verifiedData = await generateStructuredJson<Partial<DriveData>>(
    [{ text: contextParts.join('') }],
    DRIVE_DATA_RESPONSE_SCHEMA as Schema
  );

  console.log('[Gemini QA Agent] Final drive data verification complete');
  return verifiedData;
}
