/**
 * College document schema — matches the structure in mock_db.py (LARGE_COLLEGES_DATA).
 */
export interface CollegeLocation {
  city: string;
  state: string;
  region: string;
}

export interface CollegePlacement {
  avg_package_lpa: number;
  highest_package_lpa: number;
  placement_rate_percent: number;
  top_recruiters: string[];
}

export interface CollegeDriveSupport {
  fresher: boolean;
  intern: boolean;
  lateral: boolean;
}

export interface CollegeStudentStrength {
  total_students: number;
  eligible_per_year: number;
}

export interface College {
  id: string;
  name: string;
  type: string;           // "IIT", "NIT", "Private", "State", "Deemed"
  tier: string;           // "Tier-1", "Tier-2", "Tier-3", "Tier-4"
  location: CollegeLocation;
  degrees: string[];
  branches: string[];
  placement: CollegePlacement;
  drive_support: CollegeDriveSupport;
  student_strength: CollegeStudentStrength;
  accreditation: string;
  website: string;
}

/**
 * Constraints for the college prediction endpoint.
 */
export interface PredictionConstraints {
  required_branch: string;
  job_type: 'fresher' | 'intern' | 'lateral';
  ctc: number;
  region_query: string;
  required_degree: string;
}

/**
 * A single predicted college result with scoring metadata.
 */
export interface PredictedCollege extends College {
  match_probability: number;
  category: string;          // "High-Yield Tier", "Balanced Tier", "Reach Tier (Budget Deficit)"
  ai_strategic_briefing?: string;
}
