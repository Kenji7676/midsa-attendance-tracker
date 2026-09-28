import { createClient, type Client } from '@libsql/client';
import crypto from 'crypto';
import {
  formatScholarName,
  parseScholarName,
  formatYearProgram,
  parseYearProgram,
  formatScholarshipType,
  parseScholarshipType,
  normalizeYearLevel,
  cleanAcademicProgram,
  DEFAULT_MSUIIT_COLLEGES,
} from '../src/utils/formatters';

// A DbHandle looks like the old sql.js Database enough that call sites in
// server.ts (db.run(...)) keep working unchanged, aside from adding `await`.
export interface DbHandle extends Client {
  run(sql: string, params?: any[]): Promise<void>;
}

export function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const checkHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    const hashBuf = Buffer.from(hash, 'hex');
    const checkBuf = Buffer.from(checkHash, 'hex');
    if (hashBuf.length !== checkBuf.length) return false;
    return crypto.timingSafeEqual(hashBuf, checkBuf);
  } catch {
    return false;
  }
}

export function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

let dbInstance: DbHandle | null = null;

export async function getDb(): Promise<DbHandle> {
  if (dbInstance) {
    return dbInstance;
  }

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    throw new Error(
      'TURSO_DATABASE_URL is not set. Create a free database at turso.tech and set ' +
      'TURSO_DATABASE_URL / TURSO_AUTH_TOKEN as environment variables.'
    );
  }

  const client = createClient({ url, authToken }) as DbHandle;

  // Attach a `.run` convenience method so existing `db.run(sql, params)`
  // call sites throughout server.ts keep working with just an added `await`.
  client.run = async (sql: string, params: any[] = []) => {
    await client.execute({ sql, args: normalizeParams(params) });
  };

  dbInstance = client;

  await initSchema(dbInstance);
  return dbInstance;
}

// Turso persists every write immediately over the network, so there is
// nothing to flush to disk. Kept as a no-op so existing saveDb() call sites
// throughout server.ts don't need to be touched.
export function saveDb(): void {
  // no-op: Turso commits writes as they happen
}

function normalizeParams(params: any[]): any[] {
  // libSQL rejects `undefined`; sql.js silently treated it like NULL.
  return params.map((p) => (p === undefined ? null : p));
}

export async function queryRows(db: DbHandle, sql: string, params: any[] = []): Promise<any[]> {
  const result = await db.execute({ sql, args: normalizeParams(params) });
  return result.rows.map((row) => {
    const obj: Record<string, any> = {};
    result.columns.forEach((col, i) => {
      obj[col] = (row as any)[i];
    });
    return obj;
  });
}

async function initSchema(db: DbHandle) {
  await db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT,
      venue TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'upcoming',
      created_at TEXT NOT NULL
    );
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS scholars (
      id TEXT PRIMARY KEY,
      student_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      last_name TEXT,
      first_name TEXT,
      middle_initial TEXT,
      year_level TEXT,
      academic_program TEXT,
      year_program TEXT NOT NULL,
      college TEXT NOT NULL,
      scholarship_category TEXT DEFAULT 'UGS',
      scholarship_subcategory TEXT DEFAULT 'RA 7687',
      scholarship_type TEXT DEFAULT 'RA 7687',
      email TEXT NOT NULL,
      qr_code TEXT UNIQUE NOT NULL,
      gawad_isko_awardee TEXT DEFAULT 'no',
      gawad_isko_certificate_claimed TEXT DEFAULT 'no',
      gawad_isko_certificate_received_at TEXT,
      created_at TEXT NOT NULL
    );
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      scholar_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      sign_in_time TEXT,
      sign_out_time TEXT,
      status TEXT DEFAULT 'Present',
      check_in_method TEXT DEFAULT 'QR Scanner',
      sign_out_method TEXT,
      notes TEXT,
      UNIQUE(event_id, scholar_id),
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
      FOREIGN KEY (scholar_id) REFERENCES scholars(id) ON DELETE CASCADE
    );
  `);

  try {
    await db.run(`ALTER TABLE attendance ADD COLUMN sign_in_time TEXT;`);
  } catch {}
  try {
    await db.run(`ALTER TABLE attendance ADD COLUMN sign_out_time TEXT;`);
  } catch {}
  try {
    await db.run(`ALTER TABLE attendance ADD COLUMN sign_out_method TEXT;`);
  } catch {}
  try {
    await db.run(`UPDATE attendance SET sign_in_time = timestamp WHERE sign_in_time IS NULL;`);
  } catch {}

  await db.run(`
    CREATE TABLE IF NOT EXISTS email_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS email_campaigns (
      id TEXT PRIMARY KEY,
      subject TEXT NOT NULL,
      recipient_count INTEGER NOT NULL,
      sent_at TEXT NOT NULL,
      status TEXT NOT NULL,
      details TEXT
    );
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS admin_auth (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      display_name TEXT DEFAULT 'MIDSA Admin',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
  `);

  // Seed default MIDSA Admin credentials if none exists
  try {
    const adminCheck = await queryRows(db, 'SELECT * FROM admin_auth LIMIT 1;');
    if (adminCheck.length === 0) {
      const defaultSalt = generateSalt();
      const defaultHash = hashPassword('kenjigwapo', defaultSalt);
      await db.run(
        `INSERT INTO admin_auth (id, username, password_hash, salt, display_name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [
          'admin-primary',
          'midsa2k26',
          defaultHash,
          defaultSalt,
          'MIDSA Admin',
          new Date().toISOString(),
          new Date().toISOString(),
        ]
      );
    }
  } catch (err) {
    console.error('Error seeding admin credentials:', err);
  }

  await db.run(`
    CREATE TABLE IF NOT EXISTS colleges (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  for (let i = 0; i < DEFAULT_MSUIIT_COLLEGES.length; i++) {
    const colName = DEFAULT_MSUIIT_COLLEGES[i];
    const existingCol = await queryRows(db, 'SELECT id FROM colleges WHERE LOWER(name) = LOWER(?);', [colName]);
    if (existingCol.length === 0) {
      await db.run('INSERT INTO colleges (id, name, created_at) VALUES (?, ?, ?);', [
        `col-${String(i + 1).padStart(2, '0')}`,
        colName,
        new Date().toISOString(),
      ]);
    }
  }

  const templateCountRows = await queryRows(db, 'SELECT COUNT(*) as cnt FROM email_templates;');
  const templateCount = Number(templateCountRows[0]?.cnt || 0);
  if (templateCount === 0) {
    await db.run(
      `INSERT INTO email_templates (id, name, subject, body, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        'tmpl-01',
        'Official MIDSA Attendance Pass & QR Code',
        'Your Official MIDSA Digital QR Pass - {{name}} ({{student_id}})',
        'Dear {{name}},\n\nWe are pleased to provide you with your official MIDSA Digital Scholar Attendance Pass.\n\nYour Scholar Profile:\n• Student ID: {{student_id}}\n• Program: {{program}}\n• College: {{college}}\n• Registered Email: {{email}}\n• Unique QR Code: {{qr_code}}\n\nYour unique QR code is attached below and ready for scanning at our attendance check-in stations. You can display this email on your smartphone or print out your pass.\n\nThank you for your active participation!\n\nBest regards,\nMIDSA Executive Committee & Secretariat',
        new Date().toISOString(),
      ]
    );

    await db.run(
      `INSERT INTO email_templates (id, name, subject, body, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        'tmpl-02',
        'Event Reminder & QR Check-In Verification',
        'MIDSA Event Pass: Bring your QR Code - {{name}}',
        'Hello {{name}},\n\nThis is a quick reminder for our upcoming MIDSA gathering. Attendance recording will be conducted seamlessly using your unique scholar QR code.\n\nQuick Verification:\n• Scholar: {{name}}\n• Student ID: {{student_id}}\n• College: {{college}}\n• QR Token: {{qr_code}}\n\nPlease have your QR code ready upon arrival for immediate contactless check-in.\n\nSee you there!\nMIDSA Operations Team',
        new Date().toISOString(),
      ]
    );
  }

  const eventCountRows = await queryRows(db, 'SELECT COUNT(*) as cnt FROM events;');
  const count = Number(eventCountRows[0]?.cnt || 0);

  if (count === 0) {
    await seedInitialData(db);
  }

  try {
    const tableInfo = await queryRows(db, 'PRAGMA table_info(scholars);');
    const colNames = tableInfo.map((c: any) => c.name);
    if (!colNames.includes('last_name')) {
      await db.run('ALTER TABLE scholars ADD COLUMN last_name TEXT;');
    }
    if (!colNames.includes('first_name')) {
      await db.run('ALTER TABLE scholars ADD COLUMN first_name TEXT;');
    }
    if (!colNames.includes('middle_initial')) {
      await db.run('ALTER TABLE scholars ADD COLUMN middle_initial TEXT;');
    }
    if (!colNames.includes('year_level')) {
      await db.run('ALTER TABLE scholars ADD COLUMN year_level TEXT;');
    }
    if (!colNames.includes('academic_program')) {
      await db.run('ALTER TABLE scholars ADD COLUMN academic_program TEXT;');
    }
    if (!colNames.includes('scholarship_category')) {
      await db.run("ALTER TABLE scholars ADD COLUMN scholarship_category TEXT DEFAULT 'UGS';");
    }
    if (!colNames.includes('scholarship_subcategory')) {
      await db.run("ALTER TABLE scholars ADD COLUMN scholarship_subcategory TEXT DEFAULT 'RA 7687';");
    }
    if (!colNames.includes('scholarship_type')) {
      await db.run("ALTER TABLE scholars ADD COLUMN scholarship_type TEXT DEFAULT 'RA 7687';");
    }
    if (!colNames.includes('gawad_isko_awardee')) {
      await db.run("ALTER TABLE scholars ADD COLUMN gawad_isko_awardee TEXT DEFAULT 'no';");
    }
    if (!colNames.includes('gawad_isko_certificate_claimed')) {
      await db.run("ALTER TABLE scholars ADD COLUMN gawad_isko_certificate_claimed TEXT DEFAULT 'no';");
    }
    if (!colNames.includes('gawad_isko_certificate_received_at')) {
      await db.run('ALTER TABLE scholars ADD COLUMN gawad_isko_certificate_received_at TEXT;');
    }
  } catch (err) {
    console.error('Column migration error:', err);
  }

  try {
    await db.run("DELETE FROM attendance WHERE scholar_id LIKE 'sch-00%' OR scholar_id = 'sch-000';");
    await db.run("DELETE FROM scholars WHERE id LIKE 'sch-00%' OR id = 'sch-000';");
  } catch (err) {
    // ignore
  }

  try {
    const scholarsList = await queryRows(db, 'SELECT id, student_id, qr_code, name, last_name, first_name, middle_initial, year_level, academic_program, year_program, college, scholarship_category, scholarship_subcategory, scholarship_type, email FROM scholars');

    for (const s of scholarsList) {
      const sId = String(s.student_id || '');
      let updatedStudentId = sId;
      let updatedQr = s.qr_code;

      if (!/^\d{4}-\d{4}$/.test(sId)) {
        let digits = sId.replace(/[^0-9]/g, '');
        if (digits.length >= 8) {
          updatedStudentId = `${digits.substring(0, 4)}-${digits.substring(4, 8)}`;
        } else {
          digits = digits.padEnd(8, '0');
          updatedStudentId = `${digits.substring(0, 4)}-${digits.substring(4, 8)}`;
        }
        updatedQr = `MIDSA-SCHOLAR-${updatedStudentId}-MIG`;
        await db.run('UPDATE attendance SET student_id = ? WHERE scholar_id = ?', [updatedStudentId, s.id]);
      }

      let lastName = s.last_name;
      let firstName = s.first_name;
      let middleInitial = s.middle_initial;
      let formattedName = s.name;
      let email = s.email;

      if (
        (s.student_id === '2024-0006' || s.student_id === '2024-0955' || s.student_id === '2025-0919') &&
        (lastName === 'Cruz' || formattedName.includes('Mateo Gabriel') || email === 'mateo.cruz@midsa.org')
      ) {
        lastName = 'Gloria';
        firstName = 'Kenneth Jerome';
        middleInitial = 'C.';
        formattedName = 'Gloria, Kenneth Jerome C.';
        email = 'kennethjerome.gloria@g.msuiit.edu.ph';
      } else if (!lastName || !firstName) {
        const parsed = parseScholarName(s.name);
        lastName = parsed.lastName;
        firstName = parsed.firstName;
        middleInitial = parsed.middleInitial;
        formattedName = formatScholarName({
          last_name: lastName,
          first_name: firstName,
          middle_initial: middleInitial,
        });
      } else {
        formattedName = formatScholarName({
          last_name: lastName,
          first_name: firstName,
          middle_initial: middleInitial,
        });
      }

      const knownPrograms = [
        'BS Biology (Biodiversity)',
        'BS Biology (Microbiology)',
        'BS Biology (Animal Biology)',
        'BS Biology (Plant Biology)',
        'BS Marine Biology',
        'BS Biology',
        'BS Computer Science',
        'BS Information Technology',
        'BS Information Systems',
        'BS Computer Engineering',
        'BS Civil Engineering',
        'BS Mechanical Engineering',
        'BS Electrical Engineering',
        'BS Electronics Engineering',
        'BS Chemical Engineering',
        'BS Metallurgical Engineering',
        'BS Mining Engineering',
        'BS Ceramic Engineering',
        'BS Environmental Engineering',
        'BS Chemistry',
        'BS Physics',
        'BS Mathematics',
        'BS Applied Mathematics',
        'BS Statistics',
        'BS Psychology',
        'BS Accountancy',
        'BS Business Administration',
        'BS Economics',
        'BS Nursing',
        'BS Secondary Education',
      ].sort((a, b) => b.length - a.length);

      let cleanProg = (s.academic_program || s.year_program || '').trim();

      const biodiversityStudentIds = new Set([
        '2023-0343',
        '2023-0372',
        '2023-0708',
        '2023-1278',
        '2023-3109',
        '2024-0955',
        '2025-1967',
        '2026-0283',
      ]);

      if (
        biodiversityStudentIds.has(s.student_id) ||
        cleanProg.toLowerCase().includes('biodiversity') ||
        (s.year_program && s.year_program.toLowerCase().includes('biodiversity'))
      ) {
        cleanProg = 'BS Biology (Biodiversity)';
      } else if (cleanProg.toLowerCase().includes('microbiology')) {
        cleanProg = 'BS Biology (Microbiology)';
      } else if (cleanProg.toLowerCase().includes('animal biology')) {
        cleanProg = 'BS Biology (Animal Biology)';
      } else if (cleanProg.toLowerCase().includes('plant biology')) {
        cleanProg = 'BS Biology (Plant Biology)';
      } else if (cleanProg.toLowerCase().includes('marine biology')) {
        cleanProg = 'BS Marine Biology';
      } else {
        const matchedProg = knownPrograms.find((kp) => cleanProg.toLowerCase().includes(kp.toLowerCase()));
        if (matchedProg) {
          cleanProg = matchedProg;
        } else {
          cleanProg = cleanProg
            .replace(/(?:[1-5](?:st|nd|rd|th)?\s*Year(?:th\s*Year)?\s*[-–—:]*\s*)+/gi, '')
            .replace(/^(?:Year\s*[1-5]\s*[-–—:]*\s*)+/gi, '')
            .replace(/\b(?:1st|2nd|3rd|[4-5]th)?\s*Year(?:th\s*Year)?\b/gi, '')
            .replace(/\b[1-5]\b/g, '')
            .trim() || 'BS Computer Science';
        }
      }

      let yearLevel = normalizeYearLevel(s.year_level, s.student_id);
      const academicProgram = cleanAcademicProgram(cleanProg);
      const formattedYearProgram = formatYearProgram(yearLevel, academicProgram, s.student_id);

      let scholarshipCategory = s.scholarship_category;
      let scholarshipSubcategory = s.scholarship_subcategory;
      let scholarshipType = s.scholarship_type;

      if (!scholarshipCategory || !scholarshipType) {
        if (s.student_id === '2024-1002') {
          scholarshipCategory = 'UGS';
          scholarshipSubcategory = 'MERIT';
          scholarshipType = 'MERIT';
        } else if (s.student_id === '2024-1084') {
          scholarshipCategory = 'JLSS';
          scholarshipSubcategory = 'MERIT';
          scholarshipType = 'JLSS (MERIT)';
        } else if (s.student_id === '2024-2019') {
          scholarshipCategory = 'JLSS';
          scholarshipSubcategory = 'RA 7687';
          scholarshipType = 'JLSS (RA 7687)';
        } else if (s.student_id === '2024-0941') {
          scholarshipCategory = 'MOST';
          scholarshipSubcategory = '';
          scholarshipType = 'MOST';
        } else if (s.student_id === '2024-2104') {
          scholarshipCategory = 'JLSS';
          scholarshipSubcategory = 'RA 10612';
          scholarshipType = 'JLSS (RA 10612)';
        } else {
          scholarshipCategory = scholarshipCategory || 'UGS';
          scholarshipSubcategory = scholarshipSubcategory || 'RA 7687';
          scholarshipType = formatScholarshipType(scholarshipCategory, scholarshipSubcategory);
        }
      } else {
        scholarshipType = formatScholarshipType(scholarshipCategory, scholarshipSubcategory);
      }

      let college = s.college;
      if (college === 'College of Information and Communications Technology') {
        college = 'College of Computer Studies';
      } else if (college === 'College of Engineering and Architecture') {
        college = 'College of Engineering';
      } else if (college === 'College of Business and Accountancy') {
        college = 'College of Economics, Business, and Accountancy';
      } else if (college === 'College of Arts and Humanities') {
        college = 'College of Arts and Social Sciences';
      } else if (college === 'College of Nursing and Allied Health Sciences') {
        college = 'College of Health Sciences';
      }

      await db.run(
        `UPDATE scholars
         SET student_id = ?, qr_code = ?, name = ?, last_name = ?, first_name = ?, middle_initial = ?, year_level = ?, academic_program = ?, year_program = ?, college = ?, scholarship_category = ?, scholarship_subcategory = ?, scholarship_type = ?, email = ?
         WHERE id = ?`,
        [updatedStudentId, updatedQr, formattedName, lastName, firstName, middleInitial || '', yearLevel, academicProgram, formattedYearProgram, college, scholarshipCategory, scholarshipSubcategory, scholarshipType, email, s.id]
      );
    }

    await db.run(`
      UPDATE attendance
      SET student_id = (SELECT student_id FROM scholars WHERE scholars.id = attendance.scholar_id)
      WHERE EXISTS (SELECT 1 FROM scholars WHERE scholars.id = attendance.scholar_id);
    `);
  } catch (err) {
    console.error('Migration error:', err);
  }
}

async function seedInitialData(db: DbHandle) {
  console.log('Seeding initial MIDSA event records into Turso...');

  const initialEvents = [
    {
      id: 'evt-01',
      name: 'MIDSA General Assembly 2026',
      date: '2026-09-25',
      time: '09:00 AM - 12:00 PM',
      venue: 'University Grand Auditorium',
      description: 'Annual gathering of all MIDSA scholars for organizational updates, committee orientations, and keynote messages.',
      status: 'upcoming',
      created_at: new Date('2026-09-01').toISOString(),
    },
    {
      id: 'evt-02',
      name: 'Tech & Leadership Bootcamp',
      date: '2026-09-22',
      time: '01:30 PM - 05:00 PM',
      venue: 'College of Computer Studies Lab 4',
      description: 'Hands-on workshop on modern full-stack development, cloud infrastructure, and community leadership.',
      status: 'ongoing',
      created_at: new Date('2026-09-05').toISOString(),
    },
    {
      id: 'evt-03',
      name: 'Scholars Orientation & Welcome Rite',
      date: '2026-08-28',
      time: '08:00 AM - 04:00 PM',
      venue: 'MIDSA Activity Hall',
      description: 'Official welcoming ceremony and pledge signing for incoming batch of scholars.',
      status: 'completed',
      created_at: new Date('2026-08-10').toISOString(),
    }
  ];

  for (const evt of initialEvents) {
    await db.run(
      `INSERT INTO events (id, name, date, time, venue, description, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [evt.id, evt.name, evt.date, evt.time, evt.venue, evt.description, evt.status, evt.created_at]
    );
  }
}
