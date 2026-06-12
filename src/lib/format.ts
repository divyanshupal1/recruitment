import type { DriveData } from '../types/drive.js';

export function buildParsingSummary(data: Partial<DriveData>, parseWarning?: string): string {
  const parts: string[] = ["📄 Job Description parsed successfully. Here's what I found:\n"];

  const setup = data.setupDetails;
  if (setup) {
    if (setup.jobTitle) parts.push(`• **Job Title**: ${setup.jobTitle}`);
    if (setup.candidateType) parts.push(`• **Candidate Type**: ${setup.candidateType}`);
    if (setup.positionTitles?.length) parts.push(`• **Positions**: ${setup.positionTitles.join(', ')}`);
    if (setup.numberOfVacancies) parts.push(`• **Vacancies**: ${setup.numberOfVacancies}`);
    if (setup.experience) parts.push(`• **Experience**: ${setup.experience}`);
  }

  const position = data.positionDetails;
  if (position) {
    if (position.employmentType) parts.push(`• **Employment**: ${position.employmentType.replace(/_/g, ' ')}`);
    if (position.locationType) {
      parts.push(
        `• **Location**: ${position.locationType}${position.locationDetails ? ` (${position.locationDetails})` : ''}`
      );
    }
    if (position.salaryPackage) parts.push(`• **Salary**: ${position.salaryPackage}`);
    if (position.requiredSkills?.length) parts.push(`• **Required Skills**: ${position.requiredSkills.join(', ')}`);
  }

  const eligibility = data.eligibilityCriteria;
  if (eligibility?.eligibleCourses?.length) {
    parts.push(`• **Eligible Courses**: ${eligibility.eligibleCourses.join(', ')}`);
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
