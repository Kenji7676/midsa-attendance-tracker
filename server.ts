import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { getDb, saveDb, queryRows, hashPassword, verifyPassword, generateSalt } from './server/db';
import crypto from 'crypto';
import {
  formatScholarName,
  parseScholarName,
  formatYearProgram,
  parseYearProgram,
  formatScholarshipType,
  parseScholarshipType,
  personalizeEmailTemplate,
  normalizeYearLevel,
  cleanAcademicProgram,
} from './src/utils/formatters';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Initialize SQLite database
  const db = await getDb();

  // 1. Health check
  app.get('/api/health', async (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // --- AUTHENTICATION ENDPOINTS ---
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }

      const cleanUser = String(username).trim();
      const rows = await queryRows(db, 'SELECT * FROM admin_auth WHERE LOWER(username) = LOWER(?);', [cleanUser]);
      if (rows.length === 0) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      const admin = rows[0];
      const isValid = verifyPassword(String(password), admin.password_hash, admin.salt);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      // Generate cryptographically secure session token
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const createdAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      await db.run(
        `INSERT INTO admin_sessions (token, user_id, username, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?)`,
        [sessionToken, admin.id, admin.username, createdAt, expiresAt]
      );
      saveDb();

      res.json({
        success: true,
        token: sessionToken,
        user: {
          id: admin.id,
          username: admin.username,
          displayName: admin.display_name || 'MIDSA Admin',
        },
      });
    } catch (err: any) {
      console.error('Error during login:', err);
      res.status(500).json({ error: 'Authentication error: ' + err.message });
    }
  });

  app.get('/api/auth/session', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ authenticated: false, error: 'No active session token provided' });
      }
      const token = authHeader.split(' ')[1];
      const sessionRows = await queryRows(db, 'SELECT * FROM admin_sessions WHERE token = ?', [token]);
      if (sessionRows.length === 0) {
        return res.status(401).json({ authenticated: false, error: 'Session expired or invalid' });
      }
      const session = sessionRows[0];
      const adminRows = await queryRows(db, 'SELECT id, username, display_name FROM admin_auth WHERE id = ?', [session.user_id]);
      const admin = adminRows[0] || { id: session.user_id, username: session.username, display_name: 'MIDSA Admin' };

      res.json({
        authenticated: true,
        user: {
          id: admin.id,
          username: admin.username,
          displayName: admin.display_name || 'MIDSA Admin',
        },
      });
    } catch (err: any) {
      res.status(500).json({ authenticated: false, error: err.message });
    }
  });

  app.post('/api/auth/logout', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        await db.run('DELETE FROM admin_sessions WHERE token = ?', [token]);
        saveDb();
      }
      res.json({ success: true, message: 'Logged out successfully' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/auth/change-account', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Session required' });
      }
      const token = authHeader.split(' ')[1];
      const sessionRows = await queryRows(db, 'SELECT * FROM admin_sessions WHERE token = ?', [token]);
      if (sessionRows.length === 0) {
        return res.status(401).json({ error: 'Session expired or invalid' });
      }
      const session = sessionRows[0];

      const { current_password, new_username, new_password, confirm_password } = req.body;
      if (!current_password) {
        return res.status(400).json({ error: 'Old password is required to change account details' });
      }

      const adminRows = await queryRows(db, 'SELECT * FROM admin_auth WHERE id = ?', [session.user_id]);
      if (adminRows.length === 0) {
        return res.status(404).json({ error: 'Admin account not found' });
      }
      const admin = adminRows[0];

      // Verify current password
      const isCurrentValid = verifyPassword(String(current_password), admin.password_hash, admin.salt);
      if (!isCurrentValid) {
        return res.status(400).json({ error: 'Old password is incorrect. Verification failed.' });
      }

      let updatedUsername = admin.username;
      let updatedHash = admin.password_hash;
      let updatedSalt = admin.salt;

      // Handle username update if provided
      if (new_username && String(new_username).trim() !== admin.username) {
        const cleanNewUser = String(new_username).trim();
        if (cleanNewUser.length < 3) {
          return res.status(400).json({ error: 'Username must be at least 3 characters long' });
        }
        // Check if username conflict
        const checkConflict = await queryRows(db, 'SELECT id FROM admin_auth WHERE LOWER(username) = LOWER(?) AND id != ?', [cleanNewUser, admin.id]);
        if (checkConflict.length > 0) {
          return res.status(409).json({ error: 'Username already in use. Please select a different username.' });
        }
        updatedUsername = cleanNewUser;
      }

      // Handle password update if provided
      if (new_password) {
        const cleanPass = String(new_password);
        if (cleanPass.length < 8) {
          return res.status(400).json({ error: 'New password must be at least 8 characters long' });
        }
        if (cleanPass !== String(confirm_password)) {
          return res.status(400).json({ error: 'New password and confirmation do not match' });
        }
        updatedSalt = generateSalt();
        updatedHash = hashPassword(cleanPass, updatedSalt);
      }

      const now = new Date().toISOString();
      await db.run(
        `UPDATE admin_auth
         SET username = ?, password_hash = ?, salt = ?, updated_at = ?
         WHERE id = ?`,
        [updatedUsername, updatedHash, updatedSalt, now, admin.id]
      );

      // Keep active session usernames synced
      await db.run('UPDATE admin_sessions SET username = ? WHERE user_id = ?', [updatedUsername, admin.id]);
      saveDb();

      res.json({
        success: true,
        message: 'Account details updated successfully',
        user: {
          id: admin.id,
          username: updatedUsername,
          displayName: admin.display_name || 'MIDSA Admin',
        },
      });
    } catch (err: any) {
      console.error('Error changing account details:', err);
      res.status(500).json({ error: 'Failed to update account details: ' + err.message });
    }
  });

  // --- API SECURITY MIDDLEWARE (Protects all other /api routes) ---
  app.use('/api', async (req, res, next) => {
    // Whitelist public endpoints
    if (
      req.path === '/health' ||
      req.path === '/auth/login' ||
      req.path === '/auth/session' ||
      req.path === '/auth/logout' ||
      req.path === '/auth/change-account'
    ) {
      return next();
    }

    // Support token via query param for SSE stream or Bearer header
    let token = '';
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query && typeof req.query.token === 'string') {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized: MIDSA Admin authentication required to access this resource',
      });
    }

    const sessionRows = await queryRows(db, 'SELECT * FROM admin_sessions WHERE token = ?', [token]);
    if (sessionRows.length === 0) {
      return res.status(401).json({
        error: 'Unauthorized: Session expired or invalid. Please log in again.',
      });
    }

    (req as any).adminSession = sessionRows[0];
    next();
  });

  // Real-time synchronization state across multiple connected devices (phones, laptops, tablets)
  const sseClients = new Set<express.Response>();

  function broadcastChange(type: 'attendance' | 'scholars' | 'events' | 'stats', data: any = {}) {
    const payload = JSON.stringify({ type, data, timestamp: Date.now() });
    const message = `event: sync\ndata: ${payload}\n\n`;
    for (const client of Array.from(sseClients)) {
      try {
        client.write(message);
      } catch {
        sseClients.delete(client);
      }
    }
  }

  // Real-Time Server-Sent Events (SSE) stream for instant auto-sync across all devices
  app.get('/api/realtime/stream', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }

    res.write(`event: connected\ndata: ${JSON.stringify({ time: Date.now(), clients: sseClients.size + 1 })}\n\n`);

    sseClients.add(res);

    const heartbeat = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch {
        clearInterval(heartbeat);
        sseClients.delete(res);
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
  });

  // Colleges Endpoints (MSU-IIT Colleges)
  app.get('/api/colleges', async (req, res) => {
    try {
      const rows = await queryRows(db, 'SELECT name FROM colleges ORDER BY name ASC;');
      const list = rows.map((r: any) => r.name);
      res.json(list);
    } catch (err: any) {
      console.error('Error fetching colleges:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/colleges', async (req, res) => {
    try {
      const { name } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'College name is required' });
      }
      const cleanName = name.trim();
      const existing = await queryRows(db, 'SELECT name FROM colleges WHERE LOWER(name) = LOWER(?);', [cleanName]);
      if (existing.length > 0) {
        const rows = await queryRows(db, 'SELECT name FROM colleges ORDER BY name ASC;');
        return res.json({ success: true, college: existing[0].name, colleges: rows.map((r: any) => r.name) });
      }
      const id = 'col-' + Date.now().toString(36);
      await db.run('INSERT INTO colleges (id, name, created_at) VALUES (?, ?, ?);', [id, cleanName, new Date().toISOString()]);
      saveDb();

      const rows = await queryRows(db, 'SELECT name FROM colleges ORDER BY name ASC;');
      res.status(201).json({ success: true, college: cleanName, colleges: rows.map((r: any) => r.name) });
    } catch (err: any) {
      console.error('Error adding college:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 2. Dashboard Statistics
  app.get('/api/dashboard/stats', async (req, res) => {
    try {
      const scholarCntRows = await queryRows(db, 'SELECT COUNT(*) as count FROM scholars;');
      const totalScholars = Number(scholarCntRows[0]?.count || 0);

      const eventCntRows = await queryRows(db, 'SELECT COUNT(*) as count FROM events;');
      const totalEvents = Number(eventCntRows[0]?.count || 0);

      const activeEventRows = await queryRows(db, "SELECT COUNT(*) as count FROM events WHERE status = 'ongoing' OR status = 'upcoming';");
      const activeEvents = Number(activeEventRows[0]?.count || 0);

      const attCntRows = await queryRows(db, 'SELECT COUNT(*) as count FROM attendance;');
      const totalAttendance = Number(attCntRows[0]?.count || 0);

      // Recent attendance logs sorted by latest action (sign_out_time, sign_in_time, or timestamp)
      const recentAttendance = await queryRows(
        db,
        `SELECT a.id, a.event_id, a.scholar_id, s.student_id as student_id, a.timestamp,
                COALESCE(a.sign_in_time, a.timestamp) as sign_in_time, a.sign_out_time, a.status,
                a.check_in_method, a.sign_out_method, a.notes,
                s.name as scholar_name, s.first_name, s.last_name, s.middle_initial, s.college, s.year_program, s.year_level, s.academic_program,
                e.name as event_name, e.venue as event_venue
         FROM attendance a
         JOIN scholars s ON a.scholar_id = s.id
         JOIN events e ON a.event_id = e.id
         ORDER BY COALESCE(a.sign_out_time, a.sign_in_time, a.timestamp) DESC
         LIMIT 8;`
      );

      // Event breakdown statistics
      const eventBreakdown = await queryRows(
        db,
        `SELECT e.id, e.name, e.date, e.time, e.venue, e.status,
                COUNT(a.id) as attendance_count
         FROM events e
         LEFT JOIN attendance a ON e.id = a.event_id
         GROUP BY e.id
         ORDER BY e.date DESC
         LIMIT 6;`
      );

      const formattedBreakdown = eventBreakdown.map((evt) => ({
        ...evt,
        attendance_count: Number(evt.attendance_count || 0),
        total_scholars: totalScholars,
        rate: totalScholars > 0 ? Math.round((Number(evt.attendance_count || 0) / totalScholars) * 100) : 0,
      }));

      res.json({
        total_scholars: totalScholars,
        total_events: totalEvents,
        active_events: activeEvents,
        total_attendance: totalAttendance,
        recent_attendance: recentAttendance,
        event_breakdown: formattedBreakdown,
      });
    } catch (err: any) {
      console.error('Error fetching dashboard stats:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 3. Events Endpoints
  app.get('/api/events', async (req, res) => {
    try {
      const events = await queryRows(
        db,
        `SELECT e.*, COUNT(a.id) as attendee_count
         FROM events e
         LEFT JOIN attendance a ON e.id = a.event_id
         GROUP BY e.id
         ORDER BY e.date DESC, e.created_at DESC;`
      );
      res.json(events);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/events', async (req, res) => {
    try {
      const { name, date, time, venue, description, status } = req.body;
      if (!name || !date || !venue) {
        return res.status(400).json({ error: 'Event name, date, and venue are required' });
      }

      const id = 'evt-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);
      const createdAt = new Date().toISOString();

      await db.run(
        `INSERT INTO events (id, name, date, time, venue, description, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, name.trim(), date, (time || '').trim(), venue.trim(), (description || '').trim(), status || 'upcoming', createdAt]
      );
      saveDb();
      broadcastChange('events', { id });
      const created = (await queryRows(db, 'SELECT * FROM events WHERE id = ?', [id]))[0];
      res.status(201).json(created);
    } catch (err: any) {
      console.error('Error creating event:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/events/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const existingRows = await queryRows(db, 'SELECT * FROM events WHERE id = ?', [id]);
      if (existingRows.length === 0) {
        return res.status(404).json({ error: 'Event not found' });
      }
      const existing = existingRows[0];
      const name = req.body.name !== undefined ? String(req.body.name).trim() : existing.name;
      const date = req.body.date !== undefined ? String(req.body.date) : existing.date;
      const time = req.body.time !== undefined ? String(req.body.time).trim() : (existing.time || '');
      const venue = req.body.venue !== undefined ? String(req.body.venue).trim() : existing.venue;
      const description = req.body.description !== undefined ? String(req.body.description).trim() : (existing.description || '');
      const status = req.body.status !== undefined ? String(req.body.status).trim().toLowerCase() : existing.status;

      await db.run(
        `UPDATE events
         SET name = ?, date = ?, time = ?, venue = ?, description = ?, status = ?
         WHERE id = ?`,
        [name, date, time, venue, description, status || 'upcoming', id]
      );
      saveDb();
      broadcastChange('events', { id });

      const updated = (await queryRows(db, 'SELECT * FROM events WHERE id = ?', [id]))[0];
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/events/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const existingRows = await queryRows(db, 'SELECT * FROM events WHERE id = ?', [id]);
      if (existingRows.length === 0) {
        return res.status(404).json({ error: 'Event not found' });
      }
      const existing = existingRows[0];
      const name = req.body.name !== undefined ? String(req.body.name).trim() : existing.name;
      const date = req.body.date !== undefined ? String(req.body.date) : existing.date;
      const time = req.body.time !== undefined ? String(req.body.time).trim() : (existing.time || '');
      const venue = req.body.venue !== undefined ? String(req.body.venue).trim() : existing.venue;
      const description = req.body.description !== undefined ? String(req.body.description).trim() : (existing.description || '');
      const status = req.body.status !== undefined ? String(req.body.status).trim().toLowerCase() : existing.status;

      await db.run(
        `UPDATE events
         SET name = ?, date = ?, time = ?, venue = ?, description = ?, status = ?
         WHERE id = ?`,
        [name, date, time, venue, description, status || 'upcoming', id]
      );
      saveDb();
      broadcastChange('events', { id });

      const updated = (await queryRows(db, 'SELECT * FROM events WHERE id = ?', [id]))[0];
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/events/:id/status', async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ error: 'Status is required' });
      }
      await db.run('UPDATE events SET status = ? WHERE id = ?', [String(status).trim().toLowerCase(), id]);
      saveDb();
      broadcastChange('events', { id });
      const updated = (await queryRows(db, 'SELECT * FROM events WHERE id = ?', [id]))[0];
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/events/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await db.run('DELETE FROM attendance WHERE event_id = ?', [id]);
      await db.run('DELETE FROM events WHERE id = ?', [id]);
      saveDb();
      broadcastChange('events', { id });
      res.json({ success: true, message: 'Event and related attendance deleted' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. Scholars Endpoints
  app.get('/api/scholars', async (req, res) => {
    try {
      const scholars = await queryRows(
        db,
        `SELECT s.*, COUNT(a.id) as attendance_count
         FROM scholars s
         LEFT JOIN attendance a ON s.id = a.scholar_id
         GROUP BY s.id
         ORDER BY s.name ASC;`
      );
      res.json(scholars);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Helper to generate unique QR code
  function generateQrCode(studentId: string): string {
    const cleanId = studentId.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    const hash = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `MIDSA-SCHOLAR-${cleanId}-${hash}`;
  }

  // Helper to validate student ID format strictly: 4 numbers, a dash, and 4 numbers (e.g. 2024-0001)
  function isValidStudentId(studentId: string): boolean {
    return /^\d{4}-\d{4}$/.test(studentId.trim());
  }

  app.post('/api/scholars', async (req, res) => {
    try {
      const {
        student_id,
        name,
        last_name,
        first_name,
        middle_initial,
        year_level,
        academic_program,
        year_program,
        college,
        email,
        scholarship_category,
        scholarship_subcategory,
        scholarship_type,
      } = req.body;

      if (!student_id || !college || !email) {
        return res.status(400).json({ error: 'All scholar fields are required' });
      }

      const formattedStudentId = student_id.trim();
      if (!isValidStudentId(formattedStudentId)) {
        return res.status(400).json({
          error: 'Student ID must follow the format: 4 digits, a dash, and 4 digits (e.g. 2024-0001)',
        });
      }

      // Resolve name fields
      let cleanLastName = (last_name || '').trim();
      let cleanFirstName = (first_name || '').trim();
      let cleanMi = (middle_initial || '').trim();
      let displayName = (name || '').trim();

      if (!cleanLastName || !cleanFirstName) {
        if (!displayName) {
          return res.status(400).json({ error: 'Scholar name fields are required' });
        }
        const parsed = parseScholarName(displayName);
        cleanLastName = parsed.lastName;
        cleanFirstName = parsed.firstName;
        cleanMi = parsed.middleInitial;
      }
      displayName = formatScholarName({
        last_name: cleanLastName,
        first_name: cleanFirstName,
        middle_initial: cleanMi,
      });

      // Resolve academic fields
      let cleanYearLevel = normalizeYearLevel(year_level, student_id);
      let resolvedProgram = cleanAcademicProgram(academic_program);
      let cleanYearProgram = (year_program || '').trim();

      if (!resolvedProgram) {
        if (cleanYearProgram) {
          const parsedYp = parseYearProgram(cleanYearProgram, student_id);
          cleanYearLevel = parsedYp.yearLevel;
          resolvedProgram = parsedYp.academicProgram;
        } else {
          return res.status(400).json({ error: 'Academic degree program is required (e.g. BS Computer Science)' });
        }
      }
      cleanYearProgram = formatYearProgram(cleanYearLevel, resolvedProgram, student_id);

      // Resolve scholarship type fields
      let cleanCategory = scholarship_category;
      let cleanSubcategory = scholarship_subcategory;
      let cleanScholarshipType = scholarship_type;

      if (!cleanCategory && !cleanScholarshipType) {
        cleanCategory = 'UGS';
        cleanSubcategory = 'RA 7687';
        cleanScholarshipType = 'RA 7687';
      } else if (cleanScholarshipType && !cleanCategory) {
        const parsedSt = parseScholarshipType(cleanScholarshipType);
        cleanCategory = parsedSt.category;
        cleanSubcategory = parsedSt.subcategory;
        cleanScholarshipType = parsedSt.formatted;
      } else {
        cleanCategory = cleanCategory || 'UGS';
        cleanSubcategory = cleanSubcategory !== undefined ? cleanSubcategory : (cleanCategory === 'MOST' ? '' : 'RA 7687');
        cleanScholarshipType = formatScholarshipType(cleanCategory, cleanSubcategory);
      }

      // Check if student_id already exists
      const existing = await queryRows(db, 'SELECT * FROM scholars WHERE student_id = ?', [formattedStudentId]);
      if (existing.length > 0) {
        return res.status(409).json({ error: `Scholar with Student ID ${formattedStudentId} already exists.` });
      }

      const id = 'sch-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);
      const qrCode = generateQrCode(formattedStudentId);
      const createdAt = new Date().toISOString();
      const rawAwardee = req.body.gawad_isko_awardee;
      const cleanAwardee = String(rawAwardee || '').trim().toLowerCase() === 'yes' || rawAwardee === true ? 'yes' : 'no';
      const rawClaimed = req.body.gawad_isko_certificate_claimed;
      const cleanClaimed = String(rawClaimed || '').trim().toLowerCase() === 'yes' || rawClaimed === true ? 'yes' : 'no';
      const certReceivedAt = cleanClaimed === 'yes' ? new Date().toISOString() : null;

      await db.run(
        `INSERT INTO scholars (id, student_id, name, last_name, first_name, middle_initial, year_level, academic_program, year_program, college, scholarship_category, scholarship_subcategory, scholarship_type, email, qr_code, gawad_isko_awardee, gawad_isko_certificate_claimed, gawad_isko_certificate_received_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          formattedStudentId,
          displayName,
          cleanLastName,
          cleanFirstName,
          cleanMi,
          cleanYearLevel,
          resolvedProgram,
          cleanYearProgram,
          college.trim(),
          cleanCategory,
          cleanSubcategory,
          cleanScholarshipType,
          email.trim().toLowerCase(),
          qrCode,
          cleanAwardee,
          cleanClaimed,
          certReceivedAt,
          createdAt,
        ]
      );
      saveDb();
      broadcastChange('scholars', { id });

      const created = (await queryRows(db, 'SELECT * FROM scholars WHERE id = ?', [id]))[0];
      res.status(201).json(created);
    } catch (err: any) {
      console.error('Error registering scholar:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Batch CSV Registration
  app.post('/api/scholars/batch', async (req, res) => {
    try {
      const { scholars: list } = req.body;
      if (!Array.isArray(list) || list.length === 0) {
        return res.status(400).json({ error: 'No scholar records provided' });
      }

      let addedCount = 0;
      let skippedCount = 0;
      const errors: string[] = [];

      // One round-trip for all existing IDs; duplicate checks happen in memory.
      const existingRows = await queryRows(db, 'SELECT student_id FROM scholars');
      const existingIds = new Set(existingRows.map((r: any) => String(r.student_id).toUpperCase()));
      const seenInThisBatch = new Set<string>();
      const insertStatements: { sql: string; args: any[] }[] = [];

      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        const rawStudentId = (item.student_id || item.studentId || item['Student ID'] || '').toString().trim().toUpperCase();

        // Support separate name fields or single name column
        let lastName = (item.last_name || item.lastName || item['Last Name'] || item['Surname'] || item['surname'] || '').toString().trim();
        let firstName = (item.first_name || item.firstName || item['First Name'] || item['firstname'] || '').toString().trim();
        let mi = (item.middle_initial || item.middleInitial || item['Middle Initial'] || item['M.I.'] || item['MI'] || item['mi'] || '').toString().trim();
        let rawName = (item.name || item.student_name || item.studentName || item['Student Name'] || item['Name'] || '').toString().trim();

        if (!lastName || !firstName) {
          if (rawName) {
            const parsed = parseScholarName(rawName);
            lastName = parsed.lastName;
            firstName = parsed.firstName;
            mi = parsed.middleInitial;
          }
        }

        const formattedName = formatScholarName({
          last_name: lastName,
          first_name: firstName,
          middle_initial: mi,
        });

        // Support separate year level and academic program or single year_program
        const rawYear = (item.year_level || item.yearLevel || item['Year Level'] || item['Year'] || item.year || '').toString().trim();
        const rawProg = (item.academic_program || item.academicProgram || item['Academic Program'] || item['Degree Program'] || item.program || '').toString().trim();
        const rawYearProgram = (item.year_program || item.yearProgram || item['Year/Program'] || '').toString().trim();

        let yearLevel = rawYear ? normalizeYearLevel(rawYear, rawStudentId) : '';
        let academicProgram = cleanAcademicProgram(rawProg);

        if (!rawYear && rawYearProgram) {
          const parsedYp = parseYearProgram(rawYearProgram, rawStudentId);
          yearLevel = parsedYp.yearLevel;
          if (!rawProg) {
            academicProgram = parsedYp.academicProgram;
          }
        }

        if (!yearLevel) {
          yearLevel = normalizeYearLevel(null, rawStudentId);
        }

        if (!rawProg && !rawYearProgram) {
          academicProgram = 'BS Computer Science';
        }

        const formattedYearProgram = formatYearProgram(yearLevel, academicProgram, rawStudentId);
        const college = (item.college || item['College'] || 'College of Computer Studies').toString().trim();
        const email = (item.email || item.email_address || item.emailAddress || item['Email Address'] || item['Email'] || '').toString().trim();

        // Scholarship Type parsing
        const rawScholarship = (
          item.scholarship_type ||
          item.scholarshipType ||
          item['Scholarship Type'] ||
          item['Scholarship'] ||
          item['scholarship'] ||
          item.scholarship_category ||
          item['Category'] ||
          item['Type'] ||
          ''
        ).toString().trim();

        const parsedSt = parseScholarshipType(rawScholarship);
        const schCat = item.scholarship_category || parsedSt.category;
        const schSub = item.scholarship_subcategory !== undefined ? item.scholarship_subcategory : parsedSt.subcategory;
        const schType = formatScholarshipType(schCat, schSub);

        if (!rawStudentId || (!lastName && !rawName)) {
          skippedCount++;
          errors.push(`Row ${i + 1}: Missing student ID or name`);
          continue;
        }

        if (!isValidStudentId(rawStudentId)) {
          skippedCount++;
          errors.push(`Row ${i + 1} (${rawStudentId}): Invalid ID format. Must follow 4 digits, a dash, and 4 digits (e.g. 2024-0001)`);
          continue;
        }

        if (existingIds.has(rawStudentId) || seenInThisBatch.has(rawStudentId)) {
          skippedCount++;
          errors.push(`Row ${i + 1} (${rawStudentId}): Already registered`);
          continue;
        }
        seenInThisBatch.add(rawStudentId);

        const id = 'sch-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);
        const qrCode = generateQrCode(rawStudentId);
        const createdAt = new Date().toISOString();
        const rawAwardee = (
          item.gawad_isko_awardee ||
          item.gawadIskoAwardee ||
          item['Gawad Isko Awardee'] ||
          item['Gawad Isko Awardee?'] ||
          item['Gawad Isko'] ||
          item['gawad_isko'] ||
          ''
        ).toString().trim().toLowerCase();
        const schAwardee = ['yes', 'y', 'true', '1'].includes(rawAwardee) ? 'yes' : 'no';

        insertStatements.push({
          sql: `INSERT INTO scholars (id, student_id, name, last_name, first_name, middle_initial, year_level, academic_program, year_program, college, scholarship_category, scholarship_subcategory, scholarship_type, email, qr_code, gawad_isko_awardee, gawad_isko_certificate_claimed, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'no', ?)`,
          args: [
            id,
            rawStudentId,
            formattedName,
            lastName,
            firstName,
            mi,
            yearLevel,
            academicProgram,
            formattedYearProgram,
            college,
            schCat,
            schSub,
            schType,
            email || `${rawStudentId.toLowerCase()}@g.msuiit.edu.ph`,
            qrCode,
            schAwardee,
            createdAt,
          ],
        });
        addedCount++;
      }

      if (insertStatements.length > 0) {
        await db.batch(insertStatements, 'write');
      }

      broadcastChange('scholars', { addedCount });

      res.json({
        success: true,
        addedCount,
        skippedCount,
        totalProcessed: list.length,
        errors: errors.slice(0, 5), // return first 5 sample errors if any
      });
    } catch (err: any) {
      console.error('Error batch registering scholars:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/scholars/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const {
        student_id,
        name,
        last_name,
        first_name,
        middle_initial,
        year_level,
        academic_program,
        year_program,
        college,
        email,
        scholarship_category,
        scholarship_subcategory,
        scholarship_type,
      } = req.body;

      const formattedStudentId = student_id ? student_id.trim() : '';
      if (formattedStudentId && !isValidStudentId(formattedStudentId)) {
        return res.status(400).json({
          error: 'Student ID must follow the format: 4 digits, a dash, and 4 digits (e.g. 2024-0001)',
        });
      }

      const existing = (await queryRows(db, 'SELECT * FROM scholars WHERE id = ?', [id]))[0];
      if (!existing) {
        return res.status(404).json({ error: 'Scholar not found' });
      }

      // Check for duplicate student ID if changing ID
      if (formattedStudentId && formattedStudentId !== existing.student_id) {
        const dup = await queryRows(db, 'SELECT id FROM scholars WHERE student_id = ? AND id != ?', [formattedStudentId, id]);
        if (dup.length > 0) {
          return res.status(409).json({ error: `Scholar with Student ID ${formattedStudentId} already exists.` });
        }
      }

      // Resolve names
      let cleanLastName = last_name !== undefined ? (last_name || '').trim() : (existing.last_name || '');
      let cleanFirstName = first_name !== undefined ? (first_name || '').trim() : (existing.first_name || '');
      let cleanMi = middle_initial !== undefined ? (middle_initial || '').trim() : (existing.middle_initial || '');
      let displayName = name !== undefined ? (name || '').trim() : existing.name;

      if (cleanLastName && cleanFirstName) {
        displayName = formatScholarName({
          last_name: cleanLastName,
          first_name: cleanFirstName,
          middle_initial: cleanMi,
        });
      } else if (displayName) {
        const parsed = parseScholarName(displayName);
        cleanLastName = parsed.lastName;
        cleanFirstName = parsed.firstName;
        cleanMi = parsed.middleInitial;
        displayName = formatScholarName({
          last_name: cleanLastName,
          first_name: cleanFirstName,
          middle_initial: cleanMi,
        });
      }

      const updatedStudentId = formattedStudentId || existing.student_id;

      // Resolve academic
      let cleanYearLevel = normalizeYearLevel(year_level !== undefined ? year_level : existing.year_level, updatedStudentId);
      let resolvedProgram = cleanAcademicProgram(academic_program !== undefined ? academic_program : existing.academic_program);
      let cleanYearProgram = year_program !== undefined ? (year_program || '').trim() : existing.year_program;

      if (cleanYearLevel && resolvedProgram) {
        cleanYearProgram = formatYearProgram(cleanYearLevel, resolvedProgram, updatedStudentId);
      } else if (cleanYearProgram) {
        const parsedYp = parseYearProgram(cleanYearProgram, updatedStudentId);
        cleanYearLevel = parsedYp.yearLevel;
        resolvedProgram = parsedYp.academicProgram;
        cleanYearProgram = formatYearProgram(cleanYearLevel, resolvedProgram, updatedStudentId);
      }

      // Resolve scholarship fields
      let updatedCat = scholarship_category !== undefined ? scholarship_category : existing.scholarship_category;
      let updatedSub = scholarship_subcategory !== undefined ? scholarship_subcategory : existing.scholarship_subcategory;
      let updatedType = scholarship_type !== undefined ? scholarship_type : existing.scholarship_type;

      if (scholarship_category !== undefined || scholarship_subcategory !== undefined) {
        updatedType = formatScholarshipType(updatedCat, updatedSub);
      } else if (scholarship_type !== undefined && !scholarship_category) {
        const parsed = parseScholarshipType(scholarship_type);
        updatedCat = parsed.category;
        updatedSub = parsed.subcategory;
        updatedType = parsed.formatted;
      } else if (!updatedType) {
        updatedCat = updatedCat || 'UGS';
        updatedSub = updatedSub || 'RA 7687';
        updatedType = formatScholarshipType(updatedCat, updatedSub);
      }

      const updatedCollege = college !== undefined ? college.trim() : existing.college;
      const updatedEmail = email !== undefined ? email.trim().toLowerCase() : existing.email;

      let updatedAwardee = existing.gawad_isko_awardee || 'no';
      if (req.body.gawad_isko_awardee !== undefined) {
        updatedAwardee = String(req.body.gawad_isko_awardee).trim().toLowerCase() === 'yes' || req.body.gawad_isko_awardee === true ? 'yes' : 'no';
      }
      let updatedCertClaimed = existing.gawad_isko_certificate_claimed || 'no';
      let updatedCertReceivedAt = existing.gawad_isko_certificate_received_at || null;
      if (req.body.gawad_isko_certificate_claimed !== undefined) {
        updatedCertClaimed = String(req.body.gawad_isko_certificate_claimed).trim().toLowerCase() === 'yes' || req.body.gawad_isko_certificate_claimed === true ? 'yes' : 'no';
        if (updatedCertClaimed === 'yes' && !updatedCertReceivedAt) {
          updatedCertReceivedAt = new Date().toISOString();
        } else if (updatedCertClaimed === 'no') {
          updatedCertReceivedAt = null;
        }
      }

      await db.run(
        `UPDATE scholars
         SET student_id = ?, name = ?, last_name = ?, first_name = ?, middle_initial = ?, year_level = ?, academic_program = ?, year_program = ?, college = ?, scholarship_category = ?, scholarship_subcategory = ?, scholarship_type = ?, email = ?, gawad_isko_awardee = ?, gawad_isko_certificate_claimed = ?, gawad_isko_certificate_received_at = ?
         WHERE id = ?`,
        [
          updatedStudentId,
          displayName,
          cleanLastName,
          cleanFirstName,
          cleanMi || '',
          cleanYearLevel,
          resolvedProgram,
          cleanYearProgram,
          updatedCollege,
          updatedCat,
          updatedSub,
          updatedType,
          updatedEmail,
          updatedAwardee,
          updatedCertClaimed,
          updatedCertReceivedAt,
          id,
        ]
      );

      // Keep attendance student_id in sync with updated scholar student ID
      if (updatedStudentId) {
        await db.run('UPDATE attendance SET student_id = ? WHERE scholar_id = ?', [updatedStudentId, id]);
      }

      saveDb();
      broadcastChange('scholars', { id });

      const updated = (await queryRows(db, 'SELECT * FROM scholars WHERE id = ?', [id]))[0];
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/scholars/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await db.run('DELETE FROM attendance WHERE scholar_id = ?', [id]);
      await db.run('DELETE FROM scholars WHERE id = ?', [id]);
      saveDb();
      broadcastChange('scholars', { id });
      res.json({ success: true, message: 'Scholar and related attendance deleted' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Dedicated endpoint to update Gawad Isko certificate status
  app.patch('/api/scholars/:id/certificate', async (req, res) => {
    try {
      const { id } = req.params;
      const { claimed } = req.body;
      const isClaimed = String(claimed || '').toLowerCase() === 'yes' || claimed === true ? 'yes' : 'no';
      const receivedAt = isClaimed === 'yes' ? new Date().toISOString() : null;

      await db.run(
        `UPDATE scholars
         SET gawad_isko_certificate_claimed = ?, gawad_isko_certificate_received_at = ?
         WHERE id = ?`,
        [isClaimed, receivedAt, id]
      );
      saveDb();
      broadcastChange('scholars', { id, action: 'certificate_update' });

      const updated = (await queryRows(db, 'SELECT * FROM scholars WHERE id = ?', [id]))[0];
      if (!updated) {
        return res.status(404).json({ error: 'Scholar not found' });
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Dedicated endpoint to toggle Gawad Isko Awardee status
  app.patch('/api/scholars/:id/gawad-isko', async (req, res) => {
    try {
      const { id } = req.params;
      const { gawad_isko_awardee } = req.body;
      const isAwardee = String(gawad_isko_awardee || '').toLowerCase() === 'yes' || gawad_isko_awardee === true ? 'yes' : 'no';

      await db.run(
        `UPDATE scholars
         SET gawad_isko_awardee = ?
         WHERE id = ?`,
        [isAwardee, id]
      );
      saveDb();
      broadcastChange('scholars', { id, action: 'gawad_isko_update' });

      const updated = (await queryRows(db, 'SELECT * FROM scholars WHERE id = ?', [id]))[0];
      if (!updated) {
        return res.status(404).json({ error: 'Scholar not found' });
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/scholars/batch-delete', async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'ids array is required and must not be empty' });
      }

      for (const id of ids) {
        await db.run('DELETE FROM attendance WHERE scholar_id = ?', [id]);
        await db.run('DELETE FROM scholars WHERE id = ?', [id]);
      }
      saveDb();
      broadcastChange('scholars', { count: ids.length });
      res.json({ success: true, count: ids.length, message: `Successfully deleted ${ids.length} scholar(s)` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4.1. Email Templates & Batch Emailing
  app.get('/api/email-templates', async (req, res) => {
    try {
      const templates = await queryRows(db, 'SELECT * FROM email_templates ORDER BY created_at DESC;');
      res.json(templates);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/email-templates', async (req, res) => {
    try {
      const { name, subject, body } = req.body;
      if (!name || !subject || !body) {
        return res.status(400).json({ error: 'Name, subject, and body are required' });
      }

      const id = 'tmpl-' + Date.now().toString(36);
      const createdAt = new Date().toISOString();

      await db.run(
        `INSERT INTO email_templates (id, name, subject, body, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [id, name.trim(), subject.trim(), body.trim(), createdAt]
      );
      saveDb();

      const created = (await queryRows(db, 'SELECT * FROM email_templates WHERE id = ?', [id]))[0];
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/email-templates/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { name, subject, body } = req.body;

      await db.run(
        `UPDATE email_templates
         SET name = ?, subject = ?, body = ?
         WHERE id = ?`,
        [name.trim(), subject.trim(), body.trim(), id]
      );
      saveDb();

      const updated = (await queryRows(db, 'SELECT * FROM email_templates WHERE id = ?', [id]))[0];
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/email-templates/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await db.run('DELETE FROM email_templates WHERE id = ?', [id]);
      saveDb();
      res.json({ success: true, message: 'Template deleted' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/scholars/batch-email', async (req, res) => {
    try {
      const { subject, body, scholar_ids, sender_name = 'MIDSA Attendance Office' } = req.body;

      if (!subject || !body) {
        return res.status(400).json({ error: 'Email subject and body are required' });
      }

      let scholarsToEmail: any[] = [];
      if (Array.isArray(scholar_ids) && scholar_ids.length > 0) {
        const placeholders = scholar_ids.map(() => '?').join(',');
        scholarsToEmail = await queryRows(
          db,
          `SELECT * FROM scholars WHERE id IN (${placeholders}) ORDER BY name ASC`,
          scholar_ids
        );
      } else {
        scholarsToEmail = await queryRows(db, 'SELECT * FROM scholars ORDER BY name ASC');
      }

      if (scholarsToEmail.length === 0) {
        return res.status(400).json({ error: 'No recipients selected to email' });
      }

      // Process personalized messages for each scholar using dynamic token engine
      const dispatchedList = scholarsToEmail.map((s) => {
        const personalizedSubject = personalizeEmailTemplate(subject, s);
        const personalizedBody = personalizeEmailTemplate(body, s);

        return {
          scholar_id: s.id,
          student_id: s.student_id,
          name: formatScholarName(s),
          first_name: s.first_name,
          last_name: s.last_name,
          email: s.email,
          qr_code: s.qr_code,
          subject: personalizedSubject,
          body: personalizedBody,
          status: 'Delivered',
          timestamp: new Date().toISOString(),
        };
      });

      // Log campaign to SQLite
      const campaignId = 'camp-' + Date.now().toString(36);
      const sentAt = new Date().toISOString();
      const details = JSON.stringify({
        sender_name,
        subject,
        recipient_count: dispatchedList.length,
        sample_recipient: dispatchedList[0]?.email,
      });

      await db.run(
        `INSERT INTO email_campaigns (id, subject, recipient_count, sent_at, status, details)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [campaignId, subject, dispatchedList.length, sentAt, 'Completed', details]
      );
      saveDb();

      res.json({
        success: true,
        campaignId,
        recipientCount: dispatchedList.length,
        sentAt,
        sender_name,
        recipients: dispatchedList,
        message: `Successfully dispatched batch QR code emails to ${dispatchedList.length} scholars!`,
      });
    } catch (err: any) {
      console.error('Error sending batch emails:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/email-campaigns', async (req, res) => {
    try {
      const campaigns = await queryRows(db, 'SELECT * FROM email_campaigns ORDER BY sent_at DESC LIMIT 20;');
      res.json(campaigns);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5. Attendance Endpoints
  app.get('/api/attendance', async (req, res) => {
    try {
      const { event_id } = req.query;
      let sql = `
        SELECT a.id, a.event_id, a.scholar_id, s.student_id as student_id, a.timestamp,
               COALESCE(a.sign_in_time, a.timestamp) as sign_in_time, a.sign_out_time, a.status,
               a.check_in_method, a.sign_out_method, a.notes,
               s.name as scholar_name, s.first_name, s.last_name, s.middle_initial, s.year_level, s.academic_program, s.year_program, s.college, s.email, s.qr_code,
               e.name as event_name, e.venue as event_venue, e.date as event_date
        FROM attendance a
        JOIN scholars s ON a.scholar_id = s.id
        JOIN events e ON a.event_id = e.id
      `;
      const params: any[] = [];
      if (event_id) {
        sql += ' WHERE a.event_id = ?';
        params.push(event_id);
      }
      sql += ' ORDER BY COALESCE(a.sign_out_time, a.sign_in_time, a.timestamp) DESC;';

      const list = await queryRows(db, sql, params);
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Check-in or Sign-out via QR code or Student ID
  // 1st scan/entry for single event = Sign In
  // 2nd scan/entry for existing sign-in record = Sign Out
  app.post('/api/attendance/check-in', async (req, res) => {
    try {
      const { event_id, qr_code, student_id, check_in_method = 'QR Scanner', status = 'Present', notes = '' } = req.body;

      if (!event_id) {
        return res.status(400).json({ error: 'Event selection is required' });
      }

      // Verify event exists
      const eventRows = await queryRows(db, 'SELECT * FROM events WHERE id = ?', [event_id]);
      if (eventRows.length === 0) {
        return res.status(404).json({ error: 'Selected event does not exist' });
      }
      const event = eventRows[0];

      // Enforce event status: scanner/check-in unavailable for upcoming, closed for completed
      if (event.status === 'upcoming') {
        return res.status(400).json({
          error: 'Attendance recording is unavailable because this event is Upcoming. Please mark the event as Ongoing first.',
        });
      }
      if (event.status === 'completed') {
        return res.status(400).json({
          error: 'Attendance recording is closed because this event is marked as Completed.',
        });
      }

      // Find scholar by QR code or student_id
      let scholarRows: any[] = [];
      if (qr_code) {
        const cleanQr = qr_code.trim();
        scholarRows = await queryRows(db, 'SELECT * FROM scholars WHERE qr_code = ? OR student_id = ?', [cleanQr, cleanQr]);
        // Also support if QR code contains raw JSON or student_id prefix
        if (scholarRows.length === 0 && cleanQr.includes('MIDSA-SCHOLAR-')) {
          const parts = cleanQr.split('-');
          if (parts.length >= 3) {
            const possibleId = parts.slice(2, parts.length - 1).join('-');
            scholarRows = await queryRows(db, 'SELECT * FROM scholars WHERE student_id = ?', [possibleId]);
          }
        }
      } else if (student_id) {
        scholarRows = await queryRows(db, 'SELECT * FROM scholars WHERE student_id = ?', [student_id.trim()]);
      }

      if (scholarRows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Scholar not found. Please verify the QR code or Student ID.',
        });
      }

      const scholar = scholarRows[0];

      // Check for existing attendance record for this scholar at this event
      const existingAtt = await queryRows(
        db,
        'SELECT * FROM attendance WHERE event_id = ? AND scholar_id = ?',
        [event_id, scholar.id]
      );

      // Existing record exists
      if (existingAtt.length > 0) {
        const existingRecord = existingAtt[0];

        // If sign_out_time is NOT yet recorded, this scan is AUTOMATICALLY for SIGN OUT!
        if (!existingRecord.sign_out_time) {
          const signOutTimestamp = new Date().toISOString();
          const signOutMethod = check_in_method || 'QR Scanner';

          await db.run(
            `UPDATE attendance
             SET sign_out_time = ?, sign_out_method = ?
             WHERE id = ?`,
            [signOutTimestamp, signOutMethod, existingRecord.id]
          );
          saveDb();
          broadcastChange('attendance', { eventId: event_id, scholarId: scholar.id, action: 'sign_out' });

          const updatedRecord = (await queryRows(
            db,
            `SELECT a.id, a.event_id, a.scholar_id, s.student_id as student_id, a.timestamp,
                    COALESCE(a.sign_in_time, a.timestamp) as sign_in_time, a.sign_out_time, a.status,
                    a.check_in_method, a.sign_out_method, a.notes,
                    s.name as scholar_name, s.first_name, s.last_name, s.middle_initial, s.year_level, s.academic_program, s.year_program, s.college, s.email, s.qr_code,
                    e.name as event_name, e.venue as event_venue, e.date as event_date
             FROM attendance a
             JOIN scholars s ON a.scholar_id = s.id
             JOIN events e ON a.event_id = e.id
             WHERE a.id = ?`,
            [existingRecord.id]
          ))[0];

          return res.status(200).json({
            success: true,
            action: 'sign_out',
            alreadyCheckedIn: false,
            message: `Successfully signed out ${scholar.name}!`,
            scholar,
            attendanceRecord: updatedRecord,
            event,
          });
        }

        // If sign_out_time IS already recorded, attendance is already complete
        const completedRecord = (await queryRows(
          db,
          `SELECT a.id, a.event_id, a.scholar_id, s.student_id as student_id, a.timestamp,
                  COALESCE(a.sign_in_time, a.timestamp) as sign_in_time, a.sign_out_time, a.status,
                  a.check_in_method, a.sign_out_method, a.notes,
                  s.name as scholar_name, s.first_name, s.last_name, s.middle_initial, s.year_level, s.academic_program, s.year_program, s.college, s.email, s.qr_code,
                  e.name as event_name, e.venue as event_venue, e.date as event_date
           FROM attendance a
           JOIN scholars s ON a.scholar_id = s.id
           JOIN events e ON a.event_id = e.id
           WHERE a.id = ?`,
          [existingRecord.id]
        ))[0] || existingRecord;

        return res.status(200).json({
          success: false,
          action: 'completed',
          alreadyCheckedIn: true,
          alreadyCompleted: true,
          message: `${scholar.name} (${scholar.student_id}) has ALREADY COMPLETED attendance (Signed In & Signed Out).`,
          scholar,
          attendanceRecord: completedRecord,
          existingRecord: completedRecord,
          event,
        });
      }

      // No record exists yet: First time recorded, placed under SIGN IN!
      const attId = 'att-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);
      const timestamp = new Date().toISOString();
      const signInTime = timestamp;

      await db.run(
        `INSERT INTO attendance (id, event_id, scholar_id, student_id, timestamp, sign_in_time, sign_out_time, status, check_in_method, sign_out_method, notes)
         VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL, ?)`,
        [attId, event_id, scholar.id, scholar.student_id, timestamp, signInTime, status, check_in_method, notes]
      );
      saveDb();
      broadcastChange('attendance', { eventId: event_id, scholarId: scholar.id, action: 'sign_in' });

      const newRecord = (await queryRows(
        db,
        `SELECT a.id, a.event_id, a.scholar_id, s.student_id as student_id, a.timestamp,
                COALESCE(a.sign_in_time, a.timestamp) as sign_in_time, a.sign_out_time, a.status,
                a.check_in_method, a.sign_out_method, a.notes,
                s.name as scholar_name, s.first_name, s.last_name, s.middle_initial, s.year_level, s.academic_program, s.year_program, s.college, s.email, s.qr_code,
                e.name as event_name, e.venue as event_venue, e.date as event_date
         FROM attendance a
         JOIN scholars s ON a.scholar_id = s.id
         JOIN events e ON a.event_id = e.id
         WHERE a.id = ?`,
        [attId]
      ))[0];

      res.status(201).json({
        success: true,
        action: 'sign_in',
        alreadyCheckedIn: false,
        message: `Successfully signed in ${scholar.name}!`,
        scholar,
        attendanceRecord: newRecord,
        event,
      });
    } catch (err: any) {
      console.error('Error during check-in/sign-out:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Explicit Sign-out Endpoint (e.g. for one-click sign out in roster)
  app.post('/api/attendance/:id/sign-out', async (req, res) => {
    try {
      const { id } = req.params;
      const { sign_out_method = 'Manual Entry' } = req.body;
      const signOutTimestamp = new Date().toISOString();

      await db.run(
        `UPDATE attendance
         SET sign_out_time = ?, sign_out_method = ?
         WHERE id = ?`,
        [signOutTimestamp, sign_out_method, id]
      );
      saveDb();
      broadcastChange('attendance', { id, action: 'sign_out' });

      const updated = (await queryRows(
        db,
        `SELECT a.id, a.event_id, a.scholar_id, s.student_id as student_id, a.timestamp,
                COALESCE(a.sign_in_time, a.timestamp) as sign_in_time, a.sign_out_time, a.status,
                a.check_in_method, a.sign_out_method, a.notes,
                s.name as scholar_name, s.first_name, s.last_name, s.middle_initial, s.year_level, s.academic_program, s.year_program, s.college, s.email, s.qr_code,
                e.name as event_name, e.venue as event_venue, e.date as event_date
         FROM attendance a
         JOIN scholars s ON a.scholar_id = s.id
         JOIN events e ON a.event_id = e.id
         WHERE a.id = ?`,
        [id]
      ))[0];

      const scholarObj = (await queryRows(db, 'SELECT * FROM scholars WHERE id = ?', [updated.scholar_id]))[0];

      res.json({
        success: true,
        action: 'sign_out',
        scholar: scholarObj,
        attendanceRecord: updated,
        message: `Successfully signed out ${updated.scholar_name || 'scholar'}!`,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/attendance/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await db.run('DELETE FROM attendance WHERE id = ?', [id]);
      saveDb();
      broadcastChange('attendance', { id });
      res.json({ success: true, message: 'Attendance record deleted' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/attendance/batch-delete', async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'ids array is required and must not be empty' });
      }

      for (const id of ids) {
        await db.run('DELETE FROM attendance WHERE id = ?', [id]);
      }
      saveDb();
      broadcastChange('attendance', { count: ids.length });
      res.json({ success: true, count: ids.length, message: `Successfully deleted ${ids.length} attendance record(s)` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', async (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MIDSA Attendance Tracker server running on http://localhost:${PORT}`);
  });
}

startServer();
