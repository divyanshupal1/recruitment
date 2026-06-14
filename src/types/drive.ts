import { z } from 'zod';

// ==========================================
// Setup Details
// ==========================================

export const CandidateTypeSchema = z.enum(['fresh_graduates', 'experienced']);
export type CandidateType = z.infer<typeof CandidateTypeSchema>;

export const JoiningTimeframeFormatSchema = z.enum(['date', 'month_year', 'year']);
export type JoiningTimeframeFormat = z.infer<typeof JoiningTimeframeFormatSchema>;

export const TargetJoiningTimeframeSchema = z.object({
  hasTarget: z.boolean().nullable().optional(),
  format: JoiningTimeframeFormatSchema.nullable().optional(),
  value: z.string().nullable().optional(), // ISO date, MM-YYYY, or YYYY
});

export type TargetJoiningTimeframe = z.infer<typeof TargetJoiningTimeframeSchema>;

export const SetupDetailsSchema = z.object({
  candidateType: CandidateTypeSchema.nullable().optional(),
  positionTitle: z.string().nullable().optional(),
  numberOfVacancies: z.number().nullable().optional(),
  driveTitle: z.string().nullable().optional(),
  preferredYearOfGraduation: z.array(z.number()).nullable().optional(),
  targetJoiningTimeframe: TargetJoiningTimeframeSchema.nullable().optional(),
});

export type SetupDetails = z.infer<typeof SetupDetailsSchema>;

// ==========================================
// Position Details
// ==========================================

export const EmploymentTypeSchema = z.enum(['full_time', 'internship', 'full_time_internship']);
export type EmploymentType = z.infer<typeof EmploymentTypeSchema>;

export const SalaryTypeSchema = z.enum(['fixed', 'range', 'not_decided']);
export type SalaryType = z.infer<typeof SalaryTypeSchema>;

export const SalaryBreakdownItemSchema = z.object({
  component: z.string(),
  value: z.string(), // e.g. "80%", "₹10,000", "Fixed"
});

export type SalaryBreakdownItem = z.infer<typeof SalaryBreakdownItemSchema>;

export const PositionDetailsSchema = z.object({
  employmentType: EmploymentTypeSchema.nullable().optional(),
  internshipDuration: z.string().nullable().optional(), // e.g. "3 months", "6 months"
  locationType: z.array(z.string()).nullable().optional(), // ["remote", "onsite", "hybrid"]
  locationCities: z.array(z.string()).nullable().optional(), // ["Bangalore", "Gurugram"]
  jobDescription: z.string().nullable().optional(),
  requiredSkills: z.array(z.string()).nullable().optional(),
  goodToHaveSkills: z.array(z.string()).nullable().optional(),
  salaryType: SalaryTypeSchema.nullable().optional(),
  salaryFixed: z.string().nullable().optional(), // e.g. "12 LPA"
  salaryMin: z.string().nullable().optional(),
  salaryMax: z.string().nullable().optional(),
  salaryBreakdown: z.array(SalaryBreakdownItemSchema).nullable().optional(),
  probationPeriod: z.string().nullable().optional(),
  bondPeriod: z.string().nullable().optional(),
  bondAmount: z.string().nullable().optional(),
  additionalDetails: z.string().nullable().optional(),
});

export type PositionDetails = z.infer<typeof PositionDetailsSchema>;

// ==========================================
// Eligibility Criteria
// ==========================================

export const BackpaperTypeSchema = z.enum(['live', 'total']);
export type BackpaperType = z.infer<typeof BackpaperTypeSchema>;

export const AcademicCriteriaSchema = z.object({
  postGraduationMarks: z.number().nullable().optional(),
  graduationMarks: z.number().nullable().optional(),
  twelfthMarks: z.number().nullable().optional(),
  diplomaMarks: z.number().nullable().optional(),
  tenthMarks: z.number().nullable().optional(),
  backpaperAllowed: z.boolean().nullable().optional(),
  backpaperType: BackpaperTypeSchema.nullable().optional(),
  maxBackpapers: z.number().nullable().optional(),
});

export type AcademicCriteria = z.infer<typeof AcademicCriteriaSchema>;

export const EligibilityCriteriaSchema = z.object({
  eligibleCourses: z.array(z.string()).nullable().optional(),
  academicCriteria: AcademicCriteriaSchema.nullable().optional(),
  eligibilityDate: z.string().nullable().optional(),
  maxAge: z.number().nullable().optional(),
});

export type EligibilityCriteria = z.infer<typeof EligibilityCriteriaSchema>;

// ==========================================
// Interview Rounds
// ==========================================

export const RoundTypeSchema = z.enum([
  'online_aptitude',
  'coding_assessment',
  'technical_interview',
  'group_discussion',
  'system_design',
  'managerial_interview',
  'hr_interview',
  'custom',
]);
export type RoundType = z.infer<typeof RoundTypeSchema>;

export const RoundVenueSchema = z.enum(['online', 'onsite', 'hybrid_tbd']);
export type RoundVenue = z.infer<typeof RoundVenueSchema>;

export const InterviewRoundSchema = z.object({
  roundNumber: z.number(),
  roundType: RoundTypeSchema.nullable().optional(),
  roundTitle: z.string().nullable().optional(),
  duration: z.string().nullable().optional(), // e.g. "60 minutes", "TBD"
  venue: RoundVenueSchema.nullable().optional(),
  description: z.string().nullable().optional(),
});

export type InterviewRound = z.infer<typeof InterviewRoundSchema>;

export const InterviewConfigSchema = z.object({
  numberOfRounds: z.number().nullable().optional(),
  rounds: z.array(InterviewRoundSchema).nullable().optional(),
});

export type InterviewConfig = z.infer<typeof InterviewConfigSchema>;

// ==========================================
// Full Drive Data
// ==========================================

export const DriveDataSchema = z.object({
  setupDetails: SetupDetailsSchema.nullable().optional(),
  positionDetails: PositionDetailsSchema.nullable().optional(),
  eligibilityCriteria: EligibilityCriteriaSchema.nullable().optional(),
  interviewConfig: InterviewConfigSchema.nullable().optional(),
  customFields: z.record(z.unknown()).nullable().optional(),
  predictedColleges: z.array(z.any()).nullable().optional(),   // stored full college objects or lightweight refs
  invitedColleges: z.array(z.string()).nullable().optional(),     // college IDs invited to the drive
  aiStrategicBriefing: z.string().nullable().optional(),         // deduplicated AI briefing text
});

export type DriveData = z.infer<typeof DriveDataSchema>;
