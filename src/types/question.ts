import { z } from 'zod';

// ==========================================
// Question Types
// ==========================================

export const QuestionTypeSchema = z.enum([
  'single_select',
  'multi_select',
  'text',
  'number',
  'date',
  'toggle',    // Yes/No toggle (e.g., "Do you have a target joining date?")
  'tag_input', // Free-form tag entry with suggestions (e.g., skills, cities)
]);
export type QuestionType = z.infer<typeof QuestionTypeSchema>;

// ==========================================
// Question Option
// ==========================================

export const QuestionOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
  description: z.string().optional(),
});

export type QuestionOption = z.infer<typeof QuestionOptionSchema>;

// ==========================================
// Question Validation
// ==========================================

export const QuestionValidationSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
  pattern: z.string().optional(),
});

export type QuestionValidation = z.infer<typeof QuestionValidationSchema>;

// ==========================================
// Question
// ==========================================

export const QuestionSchema = z.object({
  id: z.string(),
  field: z.string(),
  question: z.string(),
  type: QuestionTypeSchema,
  options: z.array(QuestionOptionSchema).nullable().optional(),
  suggestedOptions: z.array(z.string()).nullable().optional(), // AI-generated suggestions for free-form fields
  required: z.boolean(),
  defaultValue: z.unknown().optional(),
  validation: QuestionValidationSchema.optional(),
  description: z.string().nullable().optional(), // Helper text shown below the question
  warning: z.string().nullable().optional(), // Immutability or important warnings
});

export type Question = z.infer<typeof QuestionSchema>;
