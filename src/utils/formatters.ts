import { Scholar } from '../types';

/**
 * Utility functions for formatting scholar names, academic programs, and student identities.
 * Ensures consistent "Last Name, First Name M.I." display format across the entire MIDSA application.
 */

const SURNAME_PREFIXES = ['de la', 'dela', 'del', 'de', 'la', 'san', 'santa', 'dos', 'van', 'von'];

export interface ScholarNameInput {
  name?: string;
  last_name?: string;
  first_name?: string;
  middle_initial?: string;
}

/**
 * Formats scholar name strictly into:
 * Last Name, First Name M.I. (e.g., "La Cruz, Juan D.")
 */
export function formatScholarName(
  input: ScholarNameInput | string | null | undefined
): string {
  if (!input) return '';

  if (typeof input === 'object') {
    const lastName = (input.last_name || '').trim();
    const firstName = (input.first_name || '').trim();
    const mi = (input.middle_initial || '').trim();

    if (lastName && firstName) {
      let miFormatted = '';
      if (mi) {
        miFormatted = mi.endsWith('.') ? mi : `${mi}.`;
      }
      return `${lastName}, ${firstName}${miFormatted ? ' ' + miFormatted : ''}`;
    }

    if (input.name) {
      return formatScholarNameString(input.name);
    }

    return lastName || firstName || '';
  }

  return formatScholarNameString(input);
}

/**
 * Formats a single string into "Last Name, First Name M.I."
 */
export function formatScholarNameString(rawName: string): string {
  if (!rawName) return '';
  const trimmed = rawName.trim();

  // If already in "Last Name, First Name..." format
  if (trimmed.includes(',')) {
    const parts = trimmed.split(',');
    const lastName = parts[0].trim();
    const rest = parts.slice(1).join(',').trim();

    // Check if rest has M.I. without trailing dot e.g. "Juan D" -> "Juan D."
    const miMatch = rest.match(/^(.*?)\s+([A-Za-z])$/);
    if (miMatch) {
      return `${lastName}, ${miMatch[1].trim()} ${miMatch[2].toUpperCase()}.`;
    }
    return `${lastName}, ${rest}`;
  }

  // Convert legacy "First Name [M.I.] Last Name" into "Last Name, First Name M.I."
  const parsed = parseLegacyFullName(trimmed);
  let miFormatted = '';
  if (parsed.middleInitial) {
    miFormatted = parsed.middleInitial.endsWith('.')
      ? parsed.middleInitial
      : `${parsed.middleInitial}.`;
  }
  return `${parsed.lastName}, ${parsed.firstName}${miFormatted ? ' ' + miFormatted : ''}`;
}

/**
 * Parses full name into separate components: lastName, firstName, middleInitial
 */
export function parseScholarName(rawName: string): {
  lastName: string;
  firstName: string;
  middleInitial: string;
} {
  if (!rawName) {
    return { lastName: '', firstName: '', middleInitial: '' };
  }

  const trimmed = rawName.trim();

  if (trimmed.includes(',')) {
    const parts = trimmed.split(',');
    const lastName = parts[0].trim();
    const rest = parts.slice(1).join(',').trim();

    // Check if middle initial exists at the end of rest: e.g. "Juan D." or "Juan D"
    const miMatch = rest.match(/^(.*?)\s+([A-Za-z]\.?)$/);
    if (miMatch) {
      const mi = miMatch[2].replace(/\./g, '').toUpperCase() + '.';
      return {
        lastName,
        firstName: miMatch[1].trim(),
        middleInitial: mi,
      };
    }

    return {
      lastName,
      firstName: rest,
      middleInitial: '',
    };
  }

  return parseLegacyFullName(trimmed);
}

/**
 * Handles parsing unformatted names like "Juan D. La Cruz", "Maria Clara Santos", or "Sophia Nicole Del Rosario"
 */
function parseLegacyFullName(name: string): {
  lastName: string;
  firstName: string;
  middleInitial: string;
} {
  const words = name.trim().split(/\s+/);
  if (words.length === 0) return { lastName: '', firstName: '', middleInitial: '' };
  if (words.length === 1) return { lastName: words[0], firstName: '', middleInitial: '' };

  // Check for multi-word surname with known prefixes (e.g. "La Cruz", "Del Rosario", "De La Cruz")
  for (let prefixLen = 3; prefixLen >= 1; prefixLen--) {
    if (words.length > prefixLen + 1) {
      const candidatePrefix = words.slice(words.length - prefixLen - 1, words.length - 1).join(' ').toLowerCase();
      if (SURNAME_PREFIXES.includes(candidatePrefix)) {
        const lastName = words.slice(words.length - prefixLen - 1).join(' ');
        const firstPart = words.slice(0, words.length - prefixLen - 1);
        return extractFirstAndMiddle(firstPart, lastName);
      }
    }
  }

  // Standard case: last word is surname
  const lastName = words[words.length - 1];
  const firstPart = words.slice(0, words.length - 1);
  return extractFirstAndMiddle(firstPart, lastName);
}

function extractFirstAndMiddle(
  firstPart: string[],
  lastName: string
): { lastName: string; firstName: string; middleInitial: string } {
  if (firstPart.length === 0) {
    return { lastName, firstName: '', middleInitial: '' };
  }

  // Check if the last word in firstPart is a middle initial e.g. "D." or "D"
  const lastFirstPartWord = firstPart[firstPart.length - 1];
  if (/^[A-Za-z]\.?$/.test(lastFirstPartWord)) {
    const middleInitial = lastFirstPartWord.replace(/\./g, '').toUpperCase() + '.';
    const firstName = firstPart.slice(0, -1).join(' ');
    return {
      lastName,
      firstName: firstName || lastFirstPartWord,
      middleInitial: firstName ? middleInitial : '',
    };
  }

  return {
    lastName,
    firstName: firstPart.join(' '),
    middleInitial: '',
  };
}

/**
 * Normalizes any year level input ("1", "1st", "1st Year", "Year 1", "1st Yearth Year", 1)
 * into a single clean digit string: "1", "2", "3", "4", or "5".
 */
export function normalizeYearLevel(rawYear: string | number | null | undefined, studentId?: string): string {
  if (rawYear !== null && rawYear !== undefined) {
    const str = String(rawYear).trim();
    if (str) {
      // Look for digit 1-5 with optional ordinal (1st, 2nd, 3rd, 4th, 5th, or just 1, 2, 3, 4, 5)
      const match = str.match(/\b([1-5])(?:st|nd|rd|th)?\b/i) || str.match(/\b([1-5])\b/) || str.match(/([1-5])/);
      if (match) {
        return match[1];
      }
      // Word numbers
      if (/first|freshman/i.test(str)) return '1';
      if (/second|sophomore/i.test(str)) return '2';
      if (/third|junior/i.test(str)) return '3';
      if (/fourth|senior/i.test(str)) return '4';
      if (/fifth/i.test(str)) return '5';
    }
  }

  // Deduce from student ID prefix if provided (e.g. 2023-xxxx -> 4, 2024-xxxx -> 3, 2025-xxxx -> 2, 2026-xxxx -> 1)
  if (studentId) {
    const sId = String(studentId).trim();
    if (sId.startsWith('2023-')) return '4';
    if (sId.startsWith('2024-')) return '3';
    if (sId.startsWith('2025-')) return '2';
    if (sId.startsWith('2026-')) return '1';
  }

  return '1';
}

/**
 * Returns clean display string for year level: e.g. "1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year"
 */
export function formatYearLevelDisplay(rawYear: string | number | null | undefined, studentId?: string): string {
  const y = normalizeYearLevel(rawYear, studentId);
  const suffix = y === '1' ? '1st' : y === '2' ? '2nd' : y === '3' ? '3rd' : `${y}th`;
  return `${suffix} Year`;
}

/**
 * Strips any stray year prefixes like "1st Year - ", "1st Yearth Year - ", "1st Year ", "Year 1 - ", etc.
 * and trims known programs properly (including preserving BS Biology (Biodiversity), etc.)
 */
export function cleanAcademicProgram(rawProgram: string | null | undefined): string {
  if (!rawProgram) return 'BS Computer Science';
  let prog = String(rawProgram).trim();

  // Strip repeated year indicators like "1st Year", "1st Yearth Year", "Year 1", etc. with or without dashes/colons
  prog = prog
    .replace(/^(?:(?:[1-5](?:st|nd|rd|th)?\s*Year(?:th\s*Year)?)|(?:Year\s*[1-5])|(?:[1-5](?:st|nd|rd|th)?))\s*[-–—:]*\s*/gi, '')
    .replace(/^(?:(?:[1-5](?:st|nd|rd|th)?\s*Year(?:th\s*Year)?)|(?:Year\s*[1-5])|(?:[1-5](?:st|nd|rd|th)?))\s*[-–—:]*\s*/gi, '')
    .trim();

  // Ensure specific Biology sub-majors are accurately recognized and not cut short
  const lower = prog.toLowerCase();
  if (lower.includes('biodiversity')) {
    return 'BS Biology (Biodiversity)';
  }
  if (lower.includes('microbiology')) {
    return 'BS Biology (Microbiology)';
  }
  if (lower.includes('animal biology')) {
    return 'BS Biology (Animal Biology)';
  }
  if (lower.includes('plant biology')) {
    return 'BS Biology (Plant Biology)';
  }
  if (lower.includes('marine biology')) {
    return 'BS Marine Biology';
  }

  // Remove any remaining stray Yearth Year fragments if any slipped in
  prog = prog.replace(/\b[1-5](?:st|nd|rd|th)?\s*Year(?:th\s*Year)?\b/gi, '').replace(/^[-–—:\s]+/, '').trim();

  return prog || 'BS Computer Science';
}

/**
 * Formats Year Level (1-5) and Academic Program into standard string
 * e.g. Year 1 - BS Computer Science -> 1st Year - BS Computer Science
 */
export function formatYearProgram(yearLevel: string | number | null | undefined, academicProgram: string, studentId?: string): string {
  const yNum = normalizeYearLevel(yearLevel, studentId);
  const prog = cleanAcademicProgram(academicProgram);
  const suffix = yNum === '1' ? '1st' : yNum === '2' ? '2nd' : yNum === '3' ? '3rd' : `${yNum}th`;
  return `${suffix} Year - ${prog}`;
}

/**
 * Extracts year level (1-5) and program text from year_program
 */
export function parseYearProgram(raw: string, studentId?: string): { yearLevel: string; academicProgram: string } {
  if (!raw) return { yearLevel: normalizeYearLevel(null, studentId), academicProgram: 'BS Computer Science' };

  // Match e.g. "3rd Year - BS Computer Science" or "3rd Yearth Year - BS Computer Science" or "Year 3 - BS Computer Science" or "3 - BS Computer Science"
  const cleaned = String(raw).trim();
  const match = cleaned.match(/^(?:(?:([1-5])(?:st|nd|rd|th)?\s*Year(?:th\s*Year)?)|(?:Year\s*([1-5]))|([1-5]))\s*(?:[-–—:]*\s*|\s+)(.*)$/i);
  if (match) {
    const yearLevel = match[1] || match[2] || match[3] || '1';
    const rawAcademic = (match[4] || '').trim();
    return {
      yearLevel: normalizeYearLevel(yearLevel, studentId),
      academicProgram: cleanAcademicProgram(rawAcademic) || 'BS Computer Science',
    };
  }

  // Fallback: search for any digit 1-5
  const digitMatch = cleaned.match(/\b([1-5])\b/);
  const yearLevel = digitMatch ? digitMatch[1] : normalizeYearLevel(null, studentId);
  const cleanProg = cleanAcademicProgram(cleaned);

  return {
    yearLevel: normalizeYearLevel(yearLevel, studentId),
    academicProgram: cleanProg || 'BS Computer Science',
  };
}

/**
 * Returns initials of the scholar's first name.
 * For example: for "La Cruz, Juan D.", it returns "J" or "JD".
 */
export function getFirstNameInitials(scholar: ScholarNameInput | string | null | undefined): string {
  if (!scholar) return 'S';

  let firstName = '';
  if (typeof scholar === 'object') {
    if (scholar.first_name) {
      firstName = scholar.first_name.trim();
    } else if (scholar.name) {
      const parsed = parseScholarName(scholar.name);
      firstName = parsed.firstName;
    }
  } else if (typeof scholar === 'string') {
    const parsed = parseScholarName(scholar);
    firstName = parsed.firstName;
  }

  if (!firstName) return 'S';

  const words = firstName.split(/[\s\-]+/).filter(Boolean);
  if (words.length === 0) return 'S';
  if (words.length === 1) return words[0].slice(0, 1).toUpperCase();

  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Official MSU-IIT Colleges sorted alphabetically
 */
export const DEFAULT_MSUIIT_COLLEGES: string[] = [
  'College of Arts and Social Sciences',
  'College of Computer Studies',
  'College of Economics, Business, and Accountancy',
  'College of Education',
  'College of Engineering',
  'College of Health Sciences',
  'College of Science and Mathematics',
];

export type ScholarshipCategory = 'UGS' | 'JLSS' | 'MOST';
export type ScholarshipSubcategory = 'RA 7687' | 'MERIT' | 'RA 10612' | '';

/**
 * Formats scholarship type for display:
 * - UGS: display just the subcategory directly (e.g., 'RA 7687' or 'MERIT')
 * - JLSS: display with JLSS prefix and parentheses (e.g., 'JLSS (MERIT)', 'JLSS (RA 7687)', 'JLSS (RA 10612)')
 * - MOST: display just 'MOST'
 */
export function formatScholarshipType(
  category?: string | null,
  subcategory?: string | null
): string {
  const cat = (category || 'UGS').toString().trim().toUpperCase();
  const sub = (subcategory || '').toString().trim();

  if (cat === 'MOST') {
    return 'MOST';
  }

  if (cat === 'JLSS') {
    let cleanSub = sub.toUpperCase();
    if (cleanSub.includes('10612')) cleanSub = 'RA 10612';
    else if (cleanSub.includes('MERIT')) cleanSub = 'MERIT';
    else cleanSub = 'RA 7687';
    return `JLSS (${cleanSub})`;
  }

  // UGS by default: display subcategory directly (e.g. RA 7687 or MERIT)
  let cleanSub = sub.toUpperCase();
  if (cleanSub.includes('MERIT')) cleanSub = 'MERIT';
  else cleanSub = 'RA 7687';
  return cleanSub;
}

/**
 * Parses raw text input into structured category, subcategory, and formatted scholarship type.
 */
export function parseScholarshipType(raw?: string | null): {
  category: ScholarshipCategory;
  subcategory: ScholarshipSubcategory;
  formatted: string;
} {
  if (!raw || !raw.toString().trim()) {
    return { category: 'UGS', subcategory: 'RA 7687', formatted: 'RA 7687' };
  }

  const str = raw.toString().trim();

  if (/^most$/i.test(str)) {
    return { category: 'MOST', subcategory: '', formatted: 'MOST' };
  }

  const jlssMatch = str.match(/^jlss\s*(?:\((.*?)\))?$/i);
  if (jlssMatch) {
    let sub = (jlssMatch[1] || '').trim().toUpperCase();
    let subcategory: ScholarshipSubcategory = 'RA 7687';
    if (sub.includes('10612')) subcategory = 'RA 10612';
    else if (sub.includes('MERIT')) subcategory = 'MERIT';
    return { category: 'JLSS', subcategory, formatted: `JLSS (${subcategory})` };
  }

  if (/10612/i.test(str)) {
    return { category: 'JLSS', subcategory: 'RA 10612', formatted: 'JLSS (RA 10612)' };
  }

  if (/merit/i.test(str)) {
    return { category: 'UGS', subcategory: 'MERIT', formatted: 'MERIT' };
  }

  return { category: 'UGS', subcategory: 'RA 7687', formatted: 'RA 7687' };
}

/**
 * Safely resolves formatted scholarship type from a scholar object.
 */
export function resolveScholarScholarshipType(scholar?: any): string {
  if (!scholar) return 'RA 7687';
  if (scholar.scholarship_type) {
    return scholar.scholarship_type;
  }
  if (scholar.scholarship_category) {
    return formatScholarshipType(scholar.scholarship_category, scholar.scholarship_subcategory);
  }
  return 'RA 7687';
}

export interface EmailTokenDef {
  tag: string;
  label: string;
  category: 'name' | 'academic' | 'id' | 'system';
  description: string;
  example: (scholar?: any) => string;
}

/**
 * Standard example scholar model for previews, empty states, and template testing:
 * Juan D. La Cruz, 2024-0001, 3rd Year - BS Computer Science, RA 7687 scholar
 */
export const EXAMPLE_SCHOLAR: Scholar = {
  id: 'example-scholar-juan',
  student_id: '2024-0001',
  name: 'La Cruz, Juan D.',
  last_name: 'La Cruz',
  first_name: 'Juan',
  middle_initial: 'D.',
  year_level: '3',
  academic_program: 'BS Computer Science',
  year_program: '3rd Year - BS Computer Science',
  college: 'College of Computer Studies',
  scholarship_category: 'UGS',
  scholarship_subcategory: 'RA 7687',
  scholarship_type: 'RA 7687',
  email: 'juan.lacruz@g.msuiit.edu.ph',
  qr_code: 'MIDSA-SCHOLAR-2024-0001-9X2L',
  created_at: new Date('2026-08-15').toISOString(),
};

export const EMAIL_PERSONALIZATION_TOKENS: EmailTokenDef[] = [
  {
    tag: '{{first_name}}',
    label: 'First Name',
    category: 'name',
    description: 'Scholar’s given first name (e.g. Juan)',
    example: (s) => (s?.first_name ? s.first_name : s?.name ? parseScholarName(s.name).firstName : 'Juan'),
  },
  {
    tag: '{{last_name}}',
    label: 'Last Name',
    category: 'name',
    description: 'Scholar’s family surname (e.g. La Cruz)',
    example: (s) => (s?.last_name ? s.last_name : s?.name ? parseScholarName(s.name).lastName : 'La Cruz'),
  },
  {
    tag: '{{name}}',
    label: 'Full Formatted Name',
    category: 'name',
    description: 'Standardized Last Name, First Name M.I. (e.g. La Cruz, Juan D.)',
    example: (s) => (s ? formatScholarName(s) : 'La Cruz, Juan D.'),
  },
  {
    tag: '{{middle_initial}}',
    label: 'Middle Initial',
    category: 'name',
    description: 'Scholar’s middle initial with period (e.g. D.)',
    example: (s) => (s?.middle_initial ? s.middle_initial : s?.name ? parseScholarName(s.name).middleInitial : 'D.'),
  },
  {
    tag: '{{student_id}}',
    label: 'Student ID',
    category: 'id',
    description: 'Official Student ID number (e.g. 2024-0001)',
    example: (s) => (s?.student_id || '2024-0001'),
  },
  {
    tag: '{{scholarship_type}}',
    label: 'Scholarship Type',
    category: 'academic',
    description: 'Scholarship program type (e.g. RA 7687, JLSS (MERIT), MOST)',
    example: (s) => (s ? resolveScholarScholarshipType(s) : 'RA 7687'),
  },
  {
    tag: '{{program}}',
    label: 'Year & Program',
    category: 'academic',
    description: 'Combined academic standing and degree (e.g. 3rd Year - BS Computer Science)',
    example: (s) => (s?.year_program || '3rd Year - BS Computer Science'),
  },
  {
    tag: '{{academic_program}}',
    label: 'Degree Program',
    category: 'academic',
    description: 'Specific degree curriculum without year level (e.g. BS Computer Science)',
    example: (s) => (s?.academic_program ? s.academic_program : s?.year_program ? parseYearProgram(s.year_program).academicProgram : 'BS Computer Science'),
  },
  {
    tag: '{{year_level}}',
    label: 'Year Level',
    category: 'academic',
    description: 'Academic standing with suffix (e.g. 3rd Year)',
    example: (s) => formatYearLevelDisplay(s?.year_level, s?.student_id),
  },
  {
    tag: '{{college}}',
    label: 'College',
    category: 'academic',
    description: 'Official MSU-IIT College name (e.g. College of Computer Studies)',
    example: (s) => (s?.college || 'College of Computer Studies'),
  },
  {
    tag: '{{email}}',
    label: 'Email Address',
    category: 'id',
    description: 'Scholar registered email address (e.g. juan.lacruz@g.msuiit.edu.ph)',
    example: (s) => (s?.email || 'juan.lacruz@g.msuiit.edu.ph'),
  },
  {
    tag: '{{qr_code}}',
    label: 'QR Code Token',
    category: 'id',
    description: 'Unique digital attendance check-in token',
    example: (s) => (s?.qr_code || 'MIDSA-SCHOLAR-2024-0001-9X2L'),
  },
  {
    tag: '{{organization}}',
    label: 'Organization',
    category: 'system',
    description: 'MIDSA Association identifier',
    example: () => 'MIDSA',
  },
];

/**
 * Replaces dynamic personalization tokens inside template string (subject, body, etc.)
 * with the exact, up-to-date attributes of the specified scholar.
 * Handles both standard tokens ({{name}}, {{student_id}}, etc.) and granular scholar fields
 * ({{first_name}}, {{last_name}}, {{middle_initial}}, {{academic_program}}, {{year_level}}, {{scholarship_type}}).
 */
export function personalizeEmailTemplate(template: string, scholar?: any): string {
  if (!template) return '';
  if (!scholar) return template;

  const formattedName = formatScholarName(scholar);

  let firstName = (scholar.first_name || '').trim();
  let lastName = (scholar.last_name || '').trim();
  let mi = (scholar.middle_initial || '').trim();

  // If first or last name is not directly on scholar object, parse from scholar.name
  if (!firstName || !lastName) {
    const parsed = parseScholarName(scholar.name || '');
    if (!firstName) firstName = parsed.firstName;
    if (!lastName) lastName = parsed.lastName;
    if (!mi && parsed.middleInitial) mi = parsed.middleInitial;
  }

  if (mi && !mi.endsWith('.')) {
    mi = `${mi}.`;
  }

  const studentId = (scholar.student_id || '').trim();
  const college = (scholar.college || '').trim();
  const email = (scholar.email || '').trim();
  const qrCode = (scholar.qr_code || '').trim();
  const scholarshipType = resolveScholarScholarshipType(scholar);

  let yearNum = normalizeYearLevel(scholar.year_level, studentId);
  let academicProg = cleanAcademicProgram(scholar.academic_program);
  let yearProgram = (scholar.year_program || '').trim();

  if (!academicProg || !scholar.year_level) {
    const parsedProg = parseYearProgram(yearProgram, studentId);
    if (!scholar.year_level) yearNum = parsedProg.yearLevel;
    if (!academicProg) academicProg = parsedProg.academicProgram;
  }

  yearProgram = formatYearProgram(yearNum, academicProg, studentId);
  const yearLevelLabel = formatYearLevelDisplay(yearNum, studentId);

  return template
    .replace(/\{\{(?:name|full_name|scholar_name)\}\}/gi, formattedName)
    .replace(/\{\{(?:first_name|firstname)\}\}/gi, firstName || formattedName)
    .replace(/\{\{(?:last_name|lastname|surname)\}\}/gi, lastName || '')
    .replace(/\{\{(?:middle_initial|mi|middle_name)\}\}/gi, mi || '')
    .replace(/\{\{(?:student_id|id|student_number)\}\}/gi, studentId)
    .replace(/\{\{(?:scholarship_type|scholarship|scholarship_program|scholarship_category)\}\}/gi, scholarshipType)
    .replace(/\{\{(?:program|year_program)\}\}/gi, yearProgram)
    .replace(/\{\{(?:academic_program|degree|course)\}\}/gi, academicProg)
    .replace(/\{\{year_level\}\}/gi, yearLevelLabel)
    .replace(/\{\{year\}\}/gi, yearLevelLabel)
    .replace(/\{\{year_num\}\}/gi, yearNum)
    .replace(/\{\{(?:college|department)\}\}/gi, college)
    .replace(/\{\{email\}\}/gi, email)
    .replace(/\{\{(?:qr_code|qr|qr_token)\}\}/gi, qrCode)
    .replace(/\{\{(?:organization|org)\}\}/gi, 'MIDSA');
}

