import { Hono } from 'hono';
import { predictColleges } from '../services/prediction.service.js';
import type { PredictionConstraints } from '../types/college.js';
import { AppError } from '../lib/errors.js';

const predict = new Hono();

/**
 * POST /api/predict-colleges
 *
 * Accepts drive constraints and returns ranked college matches.
 */
predict.post('/predict-colleges', async (c) => {
  const body = await c.req.json<Partial<PredictionConstraints>>();

  // Validate required fields
  if (!body.required_branch || !body.job_type || body.ctc == null || !body.region_query || !body.required_degree) {
    throw new AppError(
      'Missing required fields: required_branch, job_type, ctc, region_query, required_degree',
      400
    );
  }

  const constraints: PredictionConstraints = {
    required_branch: body.required_branch,
    job_type: body.job_type as PredictionConstraints['job_type'],
    ctc: Number(body.ctc),
    region_query: body.region_query,
    required_degree: body.required_degree,
  };

  const results = await predictColleges(constraints);

  return c.json({
    status: 'success',
    total_campuses_found: results.length,
    data: results,
  });
});

export default predict;
