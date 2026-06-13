import { applyAnswersToDriveData, mergeDriveData } from '../lib/merge.js';
import { chatRepository } from '../repositories/chat.repository.js';
import { fileRepository } from '../repositories/file.repository.js';
import { messageRepository } from '../repositories/message.repository.js';
import {
  generateClarificationQuestions,
  generateFinalDriveData,
  verifyClarificationQuestions,
  verifyFinalDriveData,
  parseDriveDetailsFromTextMessage,
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
      const extractedData = await parseDriveDetailsFromTextMessage(message, currentDriveData);
      currentDriveData = mergeDriveData(currentDriveData, extractedData);
    }

    if (fileIds && fileIds.length > 0) {
      currentDriveData = await this.mergeFileData(chat.id, currentDriveData, fileIds);
    }

    // Save drive data and the cumulative answer tracking
    await chatRepository.updateDriveData(chat.id, currentDriveData);

    // Build the list of fields NOT to ask about
    const answeredFields = this._getAnsweredFields(currentDriveData, allAnswers);

    const { questions: proposedQuestions, summary: proposedSummary } = await generateClarificationQuestions(
      currentDriveData,
      answeredFields,
      answers // pass only the latest answers for dependency resolution
    );

    // Retrieve message history for verification
    const messages = await messageRepository.list(chat.id, 100);

    let { questions, summary } = await verifyClarificationQuestions(
      currentDriveData,
      answeredFields,
      proposedQuestions,
      proposedSummary,
      messages
    );

    // CRITICAL: Double check if any required fields are missing but questions list is empty
    if (questions.length === 0) {
      const missingRequired: { field: string; name: string }[] = [];
      if (!currentDriveData.setupDetails?.candidateType) missingRequired.push({ field: 'setupDetails.candidateType', name: 'candidate type' });
      if (!currentDriveData.setupDetails?.positionTitle) missingRequired.push({ field: 'setupDetails.positionTitle', name: 'position title' });
      if (!currentDriveData.setupDetails?.numberOfVacancies) missingRequired.push({ field: 'setupDetails.numberOfVacancies', name: 'number of vacancies' });
      if (!currentDriveData.setupDetails?.driveTitle) missingRequired.push({ field: 'setupDetails.driveTitle', name: 'drive title' });
      if (!currentDriveData.positionDetails?.employmentType) missingRequired.push({ field: 'positionDetails.employmentType', name: 'employment type' });
      if (!currentDriveData.positionDetails?.locationType || currentDriveData.positionDetails.locationType.length === 0) {
        missingRequired.push({ field: 'positionDetails.locationType', name: 'work location type' });
      }
      if (!currentDriveData.positionDetails?.jobDescription) missingRequired.push({ field: 'positionDetails.jobDescription', name: 'job description' });
      if (!currentDriveData.eligibilityCriteria?.eligibleCourses || currentDriveData.eligibilityCriteria.eligibleCourses.length === 0) {
        missingRequired.push({ field: 'eligibilityCriteria.eligibleCourses', name: 'eligible courses' });
      }
      if (currentDriveData.eligibilityCriteria?.academicCriteria?.graduationMarks === undefined || currentDriveData.eligibilityCriteria.academicCriteria.graduationMarks === null) {
        missingRequired.push({ field: 'eligibilityCriteria.academicCriteria.graduationMarks', name: 'graduation marks cutoff' });
      }
      if (currentDriveData.interviewConfig?.numberOfRounds === undefined || currentDriveData.interviewConfig.numberOfRounds === null) {
        missingRequired.push({ field: 'interviewConfig.numberOfRounds', name: 'interview rounds count' });
      }

      if (missingRequired.length > 0) {
        console.log(`[Verifier] Missing required fields: ${missingRequired.map(m => m.field).join(', ')}. Generating fallback questions.`);
        
        const fallbackQuestions: Question[] = missingRequired.map((m) => {
          const id = `fallback-${m.field.replace('.', '-')}`;
          let qText = '';
          let qType: Question['type'] = 'text';
          let options: Question['options'] = null;
          let suggestedOptions: Question['suggestedOptions'] = null;
          let warning: string | null = null;
          
          if (m.field === 'setupDetails.candidateType') {
            qText = 'What type of candidates are you looking for?';
            qType = 'single_select';
            options = [
              { value: 'fresh_graduates', label: 'Fresh Graduates' },
              { value: 'experienced', label: 'Experienced Professionals' }
            ];
          } else if (m.field === 'setupDetails.positionTitle') {
            qText = 'What is the position title for this drive?';
            qType = 'text';
            suggestedOptions = ['Software Engineer', 'Frontend Developer', 'Backend Developer'];
          } else if (m.field === 'setupDetails.numberOfVacancies') {
            qText = 'How many vacancies are available for this position?';
            qType = 'number';
            suggestedOptions = ['1', '5', '10'];
          } else if (m.field === 'setupDetails.driveTitle') {
            qText = 'What is the title of this recruitment drive?';
            qType = 'text';
            warning = 'This detail can only be specified at the time of creating a drive and cannot be changed later.';
            suggestedOptions = ['Campus Recruitment Event 2026', 'Experienced Hiring Drive 2026'];
          } else if (m.field === 'positionDetails.employmentType') {
            qText = 'What is the employment type for this position?';
            qType = 'single_select';
            options = [
              { value: 'full_time', label: 'Full Time' },
              { value: 'internship', label: 'Internship' },
              { value: 'full_time_internship', label: 'Full Time + Internship' }
            ];
          } else if (m.field === 'positionDetails.locationType') {
            qText = 'What are the location types for this position?';
            qType = 'multi_select';
            options = [
              { value: 'remote', label: 'Remote' },
              { value: 'onsite', label: 'Onsite' },
              { value: 'hybrid', label: 'Hybrid' }
            ];
          } else if (m.field === 'positionDetails.jobDescription') {
            qText = 'Please provide the job description for this position.';
            qType = 'text';
          } else if (m.field === 'eligibilityCriteria.eligibleCourses') {
            qText = 'What degrees or courses are eligible for this recruitment drive?';
            qType = 'tag_input';
            suggestedOptions = ['B.Tech (CSE)', 'B.Tech (ECE)', 'MCA', 'M.Tech (CSE)', 'B.Sc (CS)', 'BCA'];
          } else if (m.field === 'eligibilityCriteria.academicCriteria.graduationMarks') {
            qText = 'What is the minimum aggregate marks/CGPA required in Graduation?';
            qType = 'number';
            suggestedOptions = ['60%', '65%', '70%', '7.0 CGPA', '8.0 CGPA'];
          } else if (m.field === 'interviewConfig.numberOfRounds') {
            qText = 'How many interview/assessment rounds are there? (Enter 0 if there are none)';
            qType = 'number';
            suggestedOptions = ['0', '2', '3', '4'];
          }
          
          return {
            id,
            field: m.field,
            question: qText,
            type: qType,
            required: true,
            options,
            suggestedOptions,
            warning,
            description: `Required field: ${m.name}`
          };
        });

        questions = fallbackQuestions;
        summary = `Some required parameters (such as ${missingRequired.map(m => m.name).join(', ')}) are still missing. Please configure them to complete the drive creation.`;
      }
    }

    if (questions.length > 0) {
      await messageService.createQuestionsMessage(chat.id, summary, questions);
      return { type: 'questions', summary, questions, currentDriveData };
    }

    // All data complete — finalize
    const proposedFinalDriveData = await generateFinalDriveData(currentDriveData);
    
    // Verify finalized drive data
    const finalDriveData = await verifyFinalDriveData(
      currentDriveData,
      proposedFinalDriveData,
      messages
    );

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
