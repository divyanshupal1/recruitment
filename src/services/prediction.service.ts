/**
 * College Prediction Engine — TypeScript port of college-predictor-ph_kk_1/engine.py
 *
 * Pipeline:
 *   Phase 1: Filtered fetch from Firestore (job_type + branch server-side, region + degree client-side)
 *   Phase 2: Budget score calculation & match probability ranking
 *   Phase 3: AI strategic briefing (optional, via Gemini)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { collegeRepository } from '../repositories/college.repository.js';
import type { College, PredictionConstraints, PredictedCollege } from '../types/college.js';

const apiKey = process.env.GOOGLE_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// ── Scoring ─────────────────────────────────────────────────────────────

function scoreAndRank(filtered: College[], offeredCtc: number): PredictedCollege[] {
  return filtered
    .map((college) => {
      const avgPkg = college.placement?.avg_package_lpa ?? 0;
      const placementRate = college.placement?.placement_rate_percent ?? 100;

      // Budget score
      const salaryDiff = offeredCtc - avgPkg;
      let budgetScore: number;
      if (salaryDiff < 0) {
        budgetScore = Math.max(0, 1.0 + salaryDiff / 10);
      } else {
        budgetScore = Math.min(1.0, 1.0 + salaryDiff / 20);
      }

      // Weighted match probability
      const placementFactor = placementRate / 100;
      const w1 = 0.6;
      const w2 = 0.4;
      const matchProbability = parseFloat(
        ((w1 * budgetScore + w2 * placementFactor) * 100).toFixed(2)
      );

      // Categorization
      let category: string;
      if (salaryDiff < -2) {
        category = 'Reach Tier (Budget Deficit)';
      } else if (matchProbability >= 65) {
        category = 'High-Yield Tier';
      } else {
        category = 'Balanced Tier';
      }

      return {
        ...college,
        match_probability: matchProbability,
        category,
      } satisfies PredictedCollege;
    })
    .sort((a, b) => b.match_probability - a.match_probability);
}

// ── AI Strategic Briefing ───────────────────────────────────────────────

async function addAiBriefing(
  results: PredictedCollege[],
  offeredCtc: number
): Promise<void> {
  if (!genAI || results.length === 0) return;

  try {
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    // Send a compact summary (top 20 max) to keep token usage reasonable
    const summarySlice = results.slice(0, 20).map((r) => ({
      name: r.name,
      tier: r.tier,
      type: r.type,
      avg_package_lpa: r.placement.avg_package_lpa,
      placement_rate_percent: r.placement.placement_rate_percent,
      match_probability: r.match_probability,
      category: r.category,
    }));

    const prompt = `
Analyze these matched campuses running on structured NIRF records for a drive offering ${offeredCtc} LPA:
${JSON.stringify(summarySlice, null, 2)}

Give a brief strategic recommendation explaining how the drive budget pairs against the average campus statistics.
    `.trim();

    const response = await model.generateContent(prompt);
    const briefing = response.response.text().trim();

    for (const result of results) {
      result.ai_strategic_briefing = briefing;
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    for (const result of results) {
      result.ai_strategic_briefing = `AI summary engine offline: ${errMsg}`;
    }
  }
}

// ── Public API ──────────────────────────────────────────────────────────

export async function predictColleges(
  constraints: PredictionConstraints
): Promise<PredictedCollege[]> {
  // Phase 1: Filtered fetch — Firestore handles job_type + branch,
  //          repository handles region + degree client-side
  const filtered = await collegeRepository.findByConstraints(constraints);
  if (filtered.length === 0) return [];

  // Phase 2: Score and rank
  const ranked = scoreAndRank(filtered, constraints.ctc);

  // Phase 3: AI briefing (async, non-blocking on failure)
  await addAiBriefing(ranked, constraints.ctc);

  return ranked;
}
