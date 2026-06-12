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
  options: z.array(QuestionOptionSchema).optional(),
  required: z.boolean(),
  defaultValue: z.unknown().optional(),
  validation: QuestionValidationSchema.optional(),
});

export type Question = z.infer<typeof QuestionSchema>;
