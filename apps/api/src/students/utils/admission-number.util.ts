/**
 * Admission Number Formatting and Token Derivation Utilities
 * Formula: [CENTRE]-[YEAR]-[COURSE]-[CLASS][BATCH]-[NUMBER]
 * Example: KL-26-NEET-11A-001
 */

export interface AdmissionTokenInputs {
  centreCode?: string | null;
  centreName?: string | null;
  academicYearName?: string | null;
  trackName?: string | null;
  courseName?: string | null;
  standardName?: string | null;
  standardLevel?: number | null;
  batchName?: string | null;
}

/**
 * Extracts a concise 2-4 uppercase alphanumeric centre code.
 * Prefers `centreCode` if present, falls back to cleaning `centreName`.
 */
export function extractCentreCode(centreCode?: string | null, centreName?: string | null): string {
  if (centreCode && centreCode.trim()) {
    const cleaned = centreCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleaned.length >= 2) return cleaned.slice(0, 5);
  }

  if (centreName && centreName.trim()) {
    const raw = centreName.trim().toUpperCase();
    // Remove common prefixes/suffixes like "EDUCARE", "CENTRE", "BRANCH", "INSTITUTE"
    const words = raw
      .replace(/\b(EDUCARE|CENTRE|CENTER|BRANCH|INSTITUTE|LEARNING|ACADEMY)\b/g, '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (words.length > 0) {
      if (words.length === 1) {
        return words[0].replace(/[^A-Z0-9]/g, '').slice(0, 4);
      }
      // Form acronym from words (e.g. "Kaloor North" -> "KN", "Kalathipady" -> "KL")
      const acronym = words.map(w => w[0]).join('').slice(0, 4);
      if (acronym.length >= 2) return acronym;
      return words[0].slice(0, 3);
    }
  }

  return 'ADM';
}

/**
 * Extracts 2-digit academic year code.
 * e.g., "2025-26" -> "26", "2026-2027" -> "26", "2026" -> "26", "25-26" -> "26"
 */
export function extractYearCode(academicYearName?: string | null): string {
  if (!academicYearName || !academicYearName.trim()) {
    return new Date().getFullYear().toString().slice(-2);
  }

  const clean = academicYearName.trim();
  // Match range formats like "2025-26", "2025-2026", "25-26"
  const rangeMatch = clean.match(/\b(?:\d{2}(\d{2}))\s*[-/]\s*(\d{2,4})\b/);
  if (rangeMatch) {
    // If second part is 2 digits: "26" -> "26"
    // If second part is 4 digits: "2026" -> "26"
    const secondPart = rangeMatch[2];
    return secondPart.length === 4 ? secondPart.slice(-2) : secondPart.slice(-2);
  }

  // Match 4-digit single year e.g. "2026"
  const single4Match = clean.match(/\b\d{2}(\d{2})\b/);
  if (single4Match) {
    return single4Match[1];
  }

  // Fallback: extract any digits
  const anyDigits = clean.replace(/\D/g, '');
  if (anyDigits.length >= 2) {
    return anyDigits.slice(-2);
  }

  return new Date().getFullYear().toString().slice(-2);
}

/**
 * Extracts 3-4 uppercase course/track abbreviation.
 * e.g., "NEET" -> "NEET", "JEE (Main & Adv)" -> "JEE", "Tuition" -> "TUI", "Foundation" -> "FND"
 */
export function extractCourseCode(trackName?: string | null, courseName?: string | null): string {
  const name = (trackName || courseName || '').trim().toUpperCase();
  if (!name) return 'GEN';

  if (name.includes('BOTH')) return 'BOTH';
  if (name.includes('NEET')) return 'NEET';
  if (name.includes('JEE')) return 'JEE';
  if (name.includes('KEAM')) return 'KEAM';
  if (name.includes('FOUNDATION')) return 'FND';
  if (name.includes('TUITION') || name.includes('REGULAR')) return 'TUI';
  if (name.includes('ENTRANCE')) return 'ENT';
  if (name.includes('CRASH')) return 'CRSH';
  if (name.includes('REPEAT')) return 'RPT';

  // Alphanumeric sanitization
  const cleaned = name.replace(/[^A-Z0-9]/g, '');
  if (cleaned.length <= 4) return cleaned || 'GEN';
  return cleaned.slice(0, 4);
}

/**
 * Extracts numeric or concise class code from standard name/level.
 * e.g., "Class 11" -> "11", "10th" -> "10", "Plus One" -> "11", "Plus Two" -> "12"
 */
export function extractClassCode(standardName?: string | null, standardLevel?: number | null): string {
  const name = (standardName || '').trim().toUpperCase();

  if (name.includes('PLUS ONE') || name.includes('+1') || name.includes('PLUS 1')) return '11';
  if (name.includes('PLUS TWO') || name.includes('+2') || name.includes('PLUS 2')) return '12';

  const digitMatch = name.match(/\b(\d{1,2})(?:ST|ND|RD|TH)?\b/);
  if (digitMatch) {
    return digitMatch[1];
  }

  const anyDigit = name.replace(/\D/g, '');
  if (anyDigit) {
    return anyDigit.slice(0, 2);
  }

  if (standardLevel && standardLevel > 0) {
    return String(standardLevel);
  }

  return '10';
}

/**
 * Extracts concise 1-2 character batch/division code.
 * e.g., "Division A" -> "A", "Batch 1" -> "B1", "Morning" -> "M", "A" -> "A"
 */
export function extractBatchCode(batchName?: string | null): string {
  if (!batchName || !batchName.trim()) return 'A';
  const clean = batchName.trim().toUpperCase();

  // "Division A", "Div A", "Section B" -> "A", "B"
  const divMatch = clean.match(/(?:DIVISION|DIV|SECTION|SEC|BATCH)\s*([A-Z0-9]+)/);
  if (divMatch && divMatch[1]) {
    return divMatch[1].slice(0, 2);
  }

  // Single letter e.g. "A", "B", "C"
  if (/^[A-Z0-9]{1,2}$/.test(clean)) {
    return clean;
  }

  // First letter of each word or first 2 characters
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).replace(/[^A-Z0-9]/g, '') || 'A';
  }

  const alphanumeric = clean.replace(/[^A-Z0-9]/g, '');
  return (alphanumeric.slice(0, 2) || 'A');
}

/**
 * Builds the standardized cohort prefix:
 * `[CENTRE]-[YEAR]-[COURSE]-[CLASS][BATCH]`
 * e.g., `KL-26-NEET-11A`
 */
export function buildAdmissionPrefix(inputs: AdmissionTokenInputs): string {
  const centre = extractCentreCode(inputs.centreCode, inputs.centreName);
  const year = extractYearCode(inputs.academicYearName);
  const course = extractCourseCode(inputs.trackName, inputs.courseName);
  const classCode = extractClassCode(inputs.standardName, inputs.standardLevel);
  const batchCode = extractBatchCode(inputs.batchName);

  return `${centre}-${year}-${course}-${classCode}${batchCode}`;
}

/**
 * Appends the 3-digit zero-padded sequential number to the prefix.
 * e.g. ("KL-26-NEET-11A", 1) -> "KL-26-NEET-11A-001"
 */
export function formatAdmissionNumber(prefix: string, sequence: number): string {
  const padded = String(Math.max(1, sequence)).padStart(3, '0');
  return `${prefix}-${padded}`;
}

/**
 * Extracts sequence number from an existing admission number given its prefix.
 * e.g. ("KL-26-NEET-11A-042", "KL-26-NEET-11A") -> 42
 */
export function extractSequenceFromAdmissionNumber(admissionNo: string, prefix: string): number | null {
  if (!admissionNo.startsWith(prefix)) return null;
  const remaining = admissionNo.slice(prefix.length).replace(/^-/, '');
  const parsed = parseInt(remaining, 10);
  return isNaN(parsed) ? null : parsed;
}
