import type { Part, Schema } from '@google/generative-ai';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import type { DriveData } from '../types/drive.js';
import type { Question } from '../types/question.js';
import {
  JD_PARSING_PROMPT,
  QUESTION_GENERATION_PROMPT,
  DRIVE_FINALIZATION_PROMPT,
} from '../lib/prompts.js';

const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) {
  throw new Error('GOOGLE_API_KEY environment variable is required');
}

const genAI = new GoogleGenerativeAI(apiKey);
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

const DRIVE_DATA_RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    setupDetails: {
      type: SchemaType.OBJECT,
      properties: {
        candidateType: { type: SchemaType.STRING, nullable: true },
        experience: { type: SchemaType.STRING, nullable: true },
        positionTitles: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, nullable: true },
        numberOfVacancies: { type: SchemaType.NUMBER, nullable: true },
        jobTitle: { type: SchemaType.STRING, nullable: true },
        preferredYearOfGraduation: { type: SchemaType.NUMBER, nullable: true },
        targetJoiningDate: { type: SchemaType.STRING, nullable: true },
      },
      nullable: true,
    },
    positionDetails: {
      type: SchemaType.OBJECT,
      properties: {
        employmentType: { type: SchemaType.STRING, nullable: true },
        locationType: { type: SchemaType.STRING, nullable: true },
        locationDetails: { type: SchemaType.STRING, nullable: true },
        jobDescription: { type: SchemaType.STRING, nullable: true },
        requiredSkills: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, nullable: true },
        goodToHaveSkills: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, nullable: true },
        salaryPackage: { type: SchemaType.STRING, nullable: true },
        probationPeriod: { type: SchemaType.STRING, nullable: true },
        bondPeriod: { type: SchemaType.STRING, nullable: true },
        bondAmount: { type: SchemaType.STRING, nullable: true },
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
    collegeSelection: {
      type: SchemaType.OBJECT,
      properties: {
        locations: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, nullable: true },
        universityTypes: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, nullable: true },
      },
      nullable: true,
    },
    customFields: {
      type: SchemaType.OBJECT,
      description: 'Any additional fields extracted from the JD that do not fit standard categories',
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
            enum: ['single_select', 'multi_select', 'text', 'number', 'date'],
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
          required: { type: SchemaType.BOOLEAN, description: 'Whether this question must be answered' },
        },
        required: ['id', 'field', 'question', 'type', 'required'],
      },
    },
    summary: {
      type: SchemaType.STRING,
      description: 'A brief summary of what data was found and what is still missing',
    },
  },
  required: ['questions', 'summary'],
};

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

export async function parseJDFromFile(
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<{ parsedData: Partial<DriveData> }> {
  const base64Data = fileBuffer.toString('base64');

  console.log(`[Gemini] Parsing JD via inline data: ${fileName} (${(fileBuffer.length / 1024).toFixed(1)} KB)`);

  const parsedData = await generateStructuredJson<Partial<DriveData>>(
    [
      { inlineData: { mimeType, data: base64Data } } as Part,
      { text: JD_PARSING_PROMPT },
    ],
    DRIVE_DATA_RESPONSE_SCHEMA as Schema
  );

  console.log('[Gemini] JD parsed successfully');
  return { parsedData };
}

export async function generateClarificationQuestions(
  driveData: Partial<DriveData>,
  previousAnswers?: Record<string, unknown>
): Promise<{ questions: Question[]; summary: string }> {
  const contextParts: string[] = [
    QUESTION_GENERATION_PROMPT,
    '\n\n## Current Drive Data State\n```json\n' + JSON.stringify(driveData, null, 2) + '\n```',
  ];

  if (previousAnswers && Object.keys(previousAnswers).length > 0) {
    contextParts.push(
      '\n\n## Previously Provided Answers\n```json\n' +
        JSON.stringify(previousAnswers, null, 2) +
        '\n```\nDo not ask questions for fields that have already been answered above.'
    );
  }

  const parsed = await generateStructuredJson<{ questions: Question[]; summary: string }>(
    [{ text: contextParts.join('') }],
    QUESTIONS_RESPONSE_SCHEMA as Schema
  );

  console.log(`[Gemini] Generated ${parsed.questions.length} clarification questions`);
  return parsed;
}

export async function generateFinalDriveData(
  driveData: Partial<DriveData>
): Promise<Partial<DriveData>> {
  const finalData = await generateStructuredJson<Partial<DriveData>>(
    [
      {
        text:
          DRIVE_FINALIZATION_PROMPT +
          '\n\n## Current Drive Data (merge of JD parsing + user answers)\n```json\n' +
          JSON.stringify(driveData, null, 2) +
          '\n```\n\nProduce the final, complete, and clean DriveData object.',
      },
    ],
    DRIVE_DATA_RESPONSE_SCHEMA as Schema
  );

  console.log('[Gemini] Final drive data generated');
  return finalData;
}
