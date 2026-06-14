import { Hono } from 'hono';
import { predictColleges, hydrateDriveData } from '../services/prediction.service.js';
import { chatRepository } from '../repositories/chat.repository.js';
import { collegeRepository } from '../repositories/college.repository.js';
import type { PredictionConstraints } from '../types/college.js';
import type { DriveData } from '../types/drive.js';
import { AppError, NotFoundError } from '../lib/errors.js';
import { requireChat } from '../middleware/require-chat.js';

import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const predict = new Hono();

// ── Gemini setup for constraint normalization ──────────────────────────

const gApiKey = process.env.GOOGLE_API_KEY;
const constraintGenAI = gApiKey ? new GoogleGenerativeAI(gApiKey) : null;
const CONSTRAINT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// Valid values that exist in the college database
const VALID_BRANCHES = ['CSE', 'IT', 'ECE', 'ME', 'EE'] as const;
const VALID_DEGREES = ['B.Tech'] as const;
const VALID_REGIONS = ['North India', 'South India', 'East India', 'West India', 'Central India', 'North East India'] as const;

// ── Standalone prediction (no chat context) ─────────────────────────────

predict.post('/predict-colleges', async (c) => {
  const body: Partial<PredictionConstraints> = (await c.req.json<Partial<PredictionConstraints>>().catch(() => ({})) || {});

  const constraints: PredictionConstraints = {};
  if (body.required_branch) constraints.required_branch = body.required_branch;
  if (body.job_type) constraints.job_type = body.job_type as PredictionConstraints['job_type'];
  if (body.ctc != null) constraints.ctc = Number(body.ctc);
  if (body.ctc_min != null) constraints.ctc_min = Number(body.ctc_min);
  if (body.ctc_max != null) constraints.ctc_max = Number(body.ctc_max);
  if (body.region_query) constraints.region_query = body.region_query;
  if (body.required_degree) constraints.required_degree = body.required_degree;

  const results = await predictColleges(constraints);

  return c.json({
    status: 'success',
    total_campuses_found: results.length,
    data: results,
  });
});

// ── Chat-scoped: Predict colleges for a drive ───────────────────────────

predict.post('/chats/:chatId/predict-colleges', requireChat, async (c) => {
  const chatId = c.req.param('chatId');
  const chat = await chatRepository.findByIdOrThrow(chatId);
  const dd: DriveData = chat.driveData || {};

  // Check if predictions already exist
  if (dd.predictedColleges && dd.predictedColleges.length > 0) {
    const hydratedDd = await hydrateDriveData(dd);
    const hydratedColleges = hydratedDd.predictedColleges || [];

    return c.json({
      status: 'success',
      total_campuses_found: hydratedColleges.length,
      predictedColleges: hydratedColleges,
      invitedColleges: dd.invitedColleges || [],
      data: hydratedColleges,
    });
  }

  // Derive constraints from driveData via LLM normalization
  const constraints = await deriveConstraintsFromDrive(dd);
  console.log('[Predict] LLM-derived constraints:', JSON.stringify(constraints));
  const results = await predictColleges(constraints);

  // Store lightweight references and the single briefing text in driveData
  const aiStrategicBriefing = results[0]?.ai_strategic_briefing || null;
  const lightweightRefs = results.map(r => ({
    id: r.id,
    match_probability: r.match_probability,
    category: r.category,
  }));

  await chatRepository.updateDriveData(chatId, {
    ...dd,
    predictedColleges: lightweightRefs,
    aiStrategicBriefing,
  });

  return c.json({
    status: 'success',
    total_campuses_found: results.length,
    predictedColleges: results,
    invitedColleges: dd.invitedColleges || [],
    data: results,
  });
});

// ── Chat-scoped: Invite a college to a drive ────────────────────────────

predict.post('/chats/:chatId/invite-college', requireChat, async (c) => {
  const chatId = c.req.param('chatId');
  const { collegeId } = await c.req.json<{ collegeId: string }>();

  if (!collegeId) {
    throw new AppError('collegeId is required', 400);
  }

  const chat = await chatRepository.findByIdOrThrow(chatId);
  const dd: DriveData = chat.driveData || {};
  const invitedColleges = dd.invitedColleges || [];

  if (invitedColleges.includes(collegeId)) {
    return c.json({ status: 'already_invited', invitedColleges });
  }

  invitedColleges.push(collegeId);
  await chatRepository.updateDriveData(chatId, {
    ...dd,
    invitedColleges,
  });

  return c.json({ status: 'invited', invitedColleges });
});

// ── Helper: Derive prediction constraints from drive data (LLM-powered) ─

/**
 * Uses Gemini to intelligently map free-form drive details (courses, skills,
 * locations) into the exact branch, degree, and region values that exist in
 * the college database. CTC and job_type are derived deterministically since
 * they're simple numeric/enum mappings.
 */
async function deriveConstraintsFromDrive(dd: DriveData): Promise<PredictionConstraints> {
  const setup = dd.setupDetails || {};
  const pos = dd.positionDetails || {};
  const elig = dd.eligibilityCriteria || {};

  // ── Deterministic fields ──────────────────────────────────────────────

  // Job type: straightforward enum mapping
  let jobType: PredictionConstraints['job_type'] = 'fresher';
  if (setup.candidateType === 'experienced') jobType = 'lateral';
  if (pos.employmentType === 'internship') jobType = 'intern';

  // CTC: parse fixed salary or salary range
  let ctc: number | undefined;
  let ctcMin: number | undefined;
  let ctcMax: number | undefined;

  if (pos.salaryFixed) {
    // Fixed salary — single value comparison
    const match = pos.salaryFixed.match(/(\d+(?:\.\d+)?)/);
    if (match) ctc = parseFloat(match[1]);
  } else if (pos.salaryMin && pos.salaryMax) {
    // Salary range — both bounds provided
    const minMatch = pos.salaryMin.match(/(\d+(?:\.\d+)?)/);
    const maxMatch = pos.salaryMax.match(/(\d+(?:\.\d+)?)/);
    if (minMatch) ctcMin = parseFloat(minMatch[1]);
    if (maxMatch) ctcMax = parseFloat(maxMatch[1]);
  } else if (pos.salaryMax) {
    // Only max — treat as fixed upper bound
    const match = pos.salaryMax.match(/(\d+(?:\.\d+)?)/);
    if (match) ctc = parseFloat(match[1]);
  } else if (pos.salaryMin) {
    // Only min — treat as fixed lower bound
    const match = pos.salaryMin.match(/(\d+(?:\.\d+)?)/);
    if (match) ctc = parseFloat(match[1]);
  }

  // Default to 10 LPA if nothing was provided
  if (ctc == null && ctcMin == null && ctcMax == null) {
    ctc = 10;
  }

  // ── LLM-normalized fields (branch, degree, region) ────────────────────

  const llmResult = await normalizeDriveFiltersViaLLM({
    eligibleCourses: elig.eligibleCourses || [],
    requiredSkills: pos.requiredSkills || [],
    goodToHaveSkills: pos.goodToHaveSkills || [],
    locationCities: pos.locationCities || [],
    locationType: pos.locationType || [],
    positionTitle: setup.positionTitle || '',
    jobDescription: pos.jobDescription || '',
  });

  const result: PredictionConstraints = {
    required_branch: llmResult.branch,
    job_type: jobType,
    region_query: llmResult.region,
    required_degree: llmResult.degree,
  };

  // Set CTC: either fixed or range
  if (ctcMin != null && ctcMax != null) {
    result.ctc_min = ctcMin;
    result.ctc_max = ctcMax;
  } else {
    result.ctc = ctc;
  }

  return result;
}

// ── LLM normalization call ──────────────────────────────────────────────

interface DriveContext {
  eligibleCourses: string[];
  requiredSkills: string[];
  goodToHaveSkills: string[];
  locationCities: string[];
  locationType: string[];
  positionTitle: string;
  jobDescription: string;
}

interface NormalizedFilters {
  branch: string;
  degree: string;
  region: string;
}

const NORMALIZATION_RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    branch: {
      type: SchemaType.STRING,
      description: 'The best-matching branch code from the valid list',
      enum: [...VALID_BRANCHES],
    },
    degree: {
      type: SchemaType.STRING,
      description: 'The best-matching degree from the valid list',
      enum: [...VALID_DEGREES],
    },
    region: {
      type: SchemaType.STRING,
      description: 'The best-matching Indian region, or "any" if remote/no preference',
      enum: [...VALID_REGIONS, 'any'],
    },
  },
  required: ['branch', 'degree', 'region'],
} as const;

async function normalizeDriveFiltersViaLLM(ctx: DriveContext): Promise<NormalizedFilters> {
  // Fallback if Gemini is not configured
  if (!constraintGenAI) {
    console.warn('[Predict] GOOGLE_API_KEY not set — using deterministic fallback');
    return deterministicFallback(ctx);
  }

  const prompt = `You are a data normalizer for a college recruitment platform.

Given a recruitment drive's details, map them to the EXACT filter values used in our college database.

## Valid Values

**Branches** (academic departments at colleges):
${VALID_BRANCHES.join(', ')}

Branch meanings:
- CSE = Computer Science / IT / Software roles
- IT = Information Technology
- ECE = Electronics & Communication
- ME = Mechanical Engineering
- EE = Electrical Engineering

**Degrees** (degree programs offered):
${VALID_DEGREES.join(', ')}

**Regions** (geographic regions of India):
${VALID_REGIONS.join(', ')}

Region mapping guide:
- Delhi, Noida, Gurugram, Gurgaon, Chandigarh, Jaipur, Lucknow, UP, Haryana, Punjab, Rajasthan, J&K → North India
- Mumbai, Pune, Ahmedabad, Gujarat, Maharashtra, Goa → West India
- Bangalore, Bengaluru, Chennai, Hyderabad, Kerala, Karnataka, Tamil Nadu, Andhra Pradesh, Telangana → South India
- Kolkata, Bhubaneswar, Patna, West Bengal, Bihar, Odisha, Jharkhand → East India
- Bhopal, Nagpur, Indore, Madhya Pradesh, Chhattisgarh → Central India
- Guwahati, Assam, Meghalaya, Manipur, Tripura, Sikkim, Mizoram, Nagaland, Arunachal Pradesh → North East India
- If location is "remote" or no cities specified → "any"

## Drive Details

Position Title: ${ctx.positionTitle || 'Not specified'}
Eligible Courses: ${ctx.eligibleCourses.length > 0 ? ctx.eligibleCourses.join(', ') : 'Not specified'}
Required Skills: ${ctx.requiredSkills.length > 0 ? ctx.requiredSkills.join(', ') : 'Not specified'}
Good-to-have Skills: ${ctx.goodToHaveSkills.length > 0 ? ctx.goodToHaveSkills.join(', ') : 'Not specified'}
Location Cities: ${ctx.locationCities.length > 0 ? ctx.locationCities.join(', ') : 'Not specified'}
Location Type: ${ctx.locationType.length > 0 ? ctx.locationType.join(', ') : 'Not specified'}
Job Description (first 500 chars): ${ctx.jobDescription ? ctx.jobDescription.substring(0, 500) : 'Not specified'}

## Instructions

1. **Branch**: Determine the primary engineering branch this role targets. Software/web/app/data roles → CSE. Hardware/embedded/VLSI → ECE. Mechanical/manufacturing → ME. Power/electrical → EE. If ambiguous, default to CSE.
2. **Degree**: Map the eligible courses to the closest match. Currently only B.Tech is in our database.
3. **Region**: Map the location cities to the corresponding Indian region. If remote or no city preference, return "any".

Return the normalized filters.`;

  try {
    const model = constraintGenAI.getGenerativeModel({
      model: CONSTRAINT_MODEL,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: NORMALIZATION_RESPONSE_SCHEMA as any,
      },
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const parsed = JSON.parse(text) as NormalizedFilters;

    // Validate the returned values
    if (!VALID_BRANCHES.includes(parsed.branch as typeof VALID_BRANCHES[number])) {
      parsed.branch = 'CSE';
    }
    if (!VALID_DEGREES.includes(parsed.degree as typeof VALID_DEGREES[number])) {
      parsed.degree = 'B.Tech';
    }
    if (![...VALID_REGIONS, 'any'].includes(parsed.region)) {
      parsed.region = 'any';
    }

    console.log(`[Predict] LLM normalized: branch=${parsed.branch}, degree=${parsed.degree}, region=${parsed.region}`);
    return parsed;
  } catch (err) {
    console.error('[Predict] LLM normalization failed, using deterministic fallback:', err);
    return deterministicFallback(ctx);
  }
}

/**
 * Deterministic fallback when Gemini is unavailable. Uses simple keyword
 * matching — less accurate but always available.
 */
function deterministicFallback(ctx: DriveContext): NormalizedFilters {
  // Branch from skills
  let branch = 'CSE';
  const allSkills = [...ctx.requiredSkills, ...ctx.goodToHaveSkills].map(s => s.toLowerCase());
  if (allSkills.some(s => s.includes('mechanical') || s.includes('autocad') || s.includes('solidworks'))) {
    branch = 'ME';
  } else if (allSkills.some(s => s.includes('electronics') || s.includes('vlsi') || s.includes('embedded') || s.includes('verilog'))) {
    branch = 'ECE';
  } else if (allSkills.some(s => s.includes('electrical') || s.includes('power system'))) {
    branch = 'EE';
  }

  // Region from location cities
  let region = 'any';
  if (ctx.locationCities.length > 0) {
    const city = ctx.locationCities[0].toLowerCase();
    const regionMap: Record<string, string> = {
      'delhi': 'North India', 'noida': 'North India', 'gurugram': 'North India', 'gurgaon': 'North India',
      'chandigarh': 'North India', 'jaipur': 'North India', 'lucknow': 'North India',
      'mumbai': 'West India', 'pune': 'West India', 'ahmedabad': 'West India',
      'bangalore': 'South India', 'bengaluru': 'South India', 'chennai': 'South India',
      'hyderabad': 'South India', 'kochi': 'South India',
      'kolkata': 'East India', 'bhubaneswar': 'East India', 'patna': 'East India',
      'bhopal': 'Central India', 'indore': 'Central India', 'nagpur': 'Central India',
      'guwahati': 'North East India',
    };
    for (const [key, val] of Object.entries(regionMap)) {
      if (city.includes(key)) { region = val; break; }
    }
  }

  return { branch, degree: 'B.Tech', region };
}

export default predict;
