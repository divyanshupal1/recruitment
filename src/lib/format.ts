import type { DriveData } from '../types/drive.js';

export function buildParsingSummary(data: Partial<DriveData>, parseWarning?: string): string {
  const parts: string[] = ["📄 Document parsed successfully. Here's what I found:\n"];

  const setup = data.setupDetails;
  if (setup) {
    if (setup.positionTitle) parts.push(`• **Position Title**: ${setup.positionTitle}`);
    if (setup.candidateType) parts.push(`• **Candidate Type**: ${setup.candidateType.replace(/_/g, ' ')}`);
    if (setup.driveTitle) parts.push(`• **Drive Title**: ${setup.driveTitle}`);
    if (setup.numberOfVacancies) parts.push(`• **Vacancies**: ${setup.numberOfVacancies}`);
    if (setup.preferredYearOfGraduation?.length) parts.push(`• **Graduation Year(s)**: ${setup.preferredYearOfGraduation.join(', ')}`);
  }

  const position = data.positionDetails;
  if (position) {
    if (position.employmentType) parts.push(`• **Employment**: ${position.employmentType.replace(/_/g, ' ')}`);
    if (position.internshipDuration) parts.push(`• **Internship Duration**: ${position.internshipDuration}`);
    if (position.locationType?.length) {
      const locations = position.locationType.join(', ');
      const cities = position.locationCities?.length ? ` (${position.locationCities.join(', ')})` : '';
      parts.push(`• **Location**: ${locations}${cities}`);
    }
    if (position.salaryType) {
      let salary = position.salaryType.replace(/_/g, ' ');
      if (position.salaryType === 'fixed' && position.salaryFixed) salary = position.salaryFixed;
      if (position.salaryType === 'range' && position.salaryMin && position.salaryMax) salary = `${position.salaryMin} - ${position.salaryMax}`;
      parts.push(`• **Salary**: ${salary}`);
    }
    if (position.requiredSkills?.length) parts.push(`• **Required Skills**: ${position.requiredSkills.join(', ')}`);
    if (position.goodToHaveSkills?.length) parts.push(`• **Good to Have**: ${position.goodToHaveSkills.join(', ')}`);
  }

  const eligibility = data.eligibilityCriteria;
  if (eligibility?.eligibleCourses?.length) {
    parts.push(`• **Eligible Courses**: ${eligibility.eligibleCourses.join(', ')}`);
  }

  const interview = data.interviewConfig;
  if (interview?.numberOfRounds) {
    parts.push(`• **Interview Rounds**: ${interview.numberOfRounds}`);
    if (interview.rounds?.length) {
      const types = interview.rounds.map((r) => r.roundTitle || r.roundType || `Round ${r.roundNumber}`).join(' → ');
      parts.push(`• **Round Flow**: ${types}`);
    }
  }

  if (parts.length === 1) {
    if (parseWarning) {
      parts.push(
        `⚠️ AI parsing failed: ${parseWarning}\n\nThe file was uploaded successfully. You can proceed with manual input.`
      );
    } else {
      parts.push('⚠️ Could not extract structured data from this file. You can proceed with manual input.');
    }
  }

  return parts.join('\n');
}
