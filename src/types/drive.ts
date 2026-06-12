import { z } from 'zod';

// ==========================================
// Setup Details
// ==========================================

export const CandidateTypeSchema = z.enum(['freshers', 'experienced']);
export type CandidateType = z.infer<typeof CandidateTypeSchema>;

export const SetupDetailsSchema = z.object({
  candidateType: CandidateTypeSchema.nullable().optional(),
  experience: z.string().nullable().optional(),
  positionTitles: z.array(z.string()).nullable().optional(),
  numberOfVacancies: z.number().nullable().optional(),
  jobTitle: z.string().nullable().optional(),
  preferredYearOfGraduation: z.number().nullable().optional(),
  targetJoiningDate: z.string().nullable().optional(),
});

export type SetupDetails = z.infer<typeof SetupDetailsSchema>;

// ==========================================
// Position Details
// ==========================================

export const EmploymentTypeSchema = z.enum(['full_time', 'internship_full_time', 'internship']);
export type EmploymentType = z.infer<typeof EmploymentTypeSchema>;

export const LocationTypeSchema = z.enum(['remote', 'onsite', 'hybrid']);
export type LocationType = z.infer<typeof LocationTypeSchema>;

export const PositionDetailsSchema = z.object({
  employmentType: EmploymentTypeSchema.nullable().optional(),
  locationType: LocationTypeSchema.nullable().optional(),
  locationDetails: z.string().nullable().optional(),
  jobDescription: z.string().nullable().optional(),
  requiredSkills: z.array(z.string()).nullable().optional(),
  goodToHaveSkills: z.array(z.string()).nullable().optional(),
  salaryPackage: z.string().nullable().optional(),
  probationPeriod: z.string().nullable().optional(),
  bondPeriod: z.string().nullable().optional(),
  bondAmount: z.string().nullable().optional(),
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
// College Selection
// ==========================================

export const CollegeSelectionSchema = z.object({
  locations: z.array(z.string()).nullable().optional(),
  universityTypes: z.array(z.string()).nullable().optional(),
});

export type CollegeSelection = z.infer<typeof CollegeSelectionSchema>;

// ==========================================
// Full Drive Data
// ==========================================

export const DriveDataSchema = z.object({
  setupDetails: SetupDetailsSchema.nullable().optional(),
  positionDetails: PositionDetailsSchema.nullable().optional(),
  eligibilityCriteria: EligibilityCriteriaSchema.nullable().optional(),
  collegeSelection: CollegeSelectionSchema.nullable().optional(),
  schedulingDetails: z.record(z.unknown()).nullable().optional(),
  customFields: z.record(z.unknown()).nullable().optional(),
});

export type DriveData = z.infer<typeof DriveDataSchema>;
