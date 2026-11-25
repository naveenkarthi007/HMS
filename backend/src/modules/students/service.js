const bcrypt = require('bcrypt');
const env = require('../../config/env');
const { pool, withTransaction } = require('../../config/db');
const AppError = require('../../utils/AppError');
const { getPagination, getSort, likeParam, Where } = require('../../utils/pagination');
const { parseCsv } = require('../../utils/csv');
const { unguard } = require('../../utils/importer');
const { formatZodError } = require('../../middleware/validate');
const { getManagedGender } = require('../../utils/roles');
const { wardenRoomMatchSql } = require('../hostels/service');
const { logAudit } = require('../audit/service');
const { importRowSchema } = require('./validation');

const SORTS = {
  name: 'u.name',
  registerNo: 's.register_no',
  department: 's.department',
  year: 's.year',
  createdAt: 's.created_at',
};

// A student's hostel/room always comes from the active allocation (never stored on the student).
const FROM = `
    FROM students s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN allocations a ON a.student_id = s.id AND a.status = 'active'
    LEFT JOIN rooms r ON r.id = a.room_id
    LEFT JOIN hostels h ON h.id = r.hostel_id`;

const SELECT = `
  SELECT s.id, s.user_id AS userId, u.name, u.email, u.gender, u.phone, u.is_active AS isActive,
         s.register_no AS registerNo, s.department, s.year, s.guardian_name AS guardianName,
         s.guardian_phone AS guardianPhone, s.address, s.date_of_birth AS dateOfBirth,
         s.created_at AS createdAt,
         a.id AS allocationId, a.start_date AS allocatedOn,
         r.id AS roomId, r.room_number AS roomNumber, h.id AS hostelId, h.name AS hostelName
  ${FROM}`;

function normalise(row) {
  return row && { ...row, isActive: Boolean(row.isActive) };
}

function studentScope(user, where) {
  where.add('s.organisation_id = ?', user.organisationId);
  if (user.role === 'warden') {
    where.add(wardenRoomMatchSql('r'), user.id);
  } else {
    const managedGender = getManagedGender(user);
    where.addIf(managedGender, 'u.gender = ?', managedGender);
  }
  return where;
}

async function list(user, query) {
  const pagination = getPagination(query);
  const where = studentScope(user, new Where());
  if (query.search) {
    const like = likeParam(query.search);
    where.add(
      '(u.name LIKE ? OR u.email LIKE ? OR s.register_no LIKE ? OR s.department LIKE ? OR u.phone LIKE ?)',
      like,
      like,
      like,
      like,
      like,
    );
  }
  where.addIf(query.gender, 'u.gender = ?', query.gender);
  where.addIf(query.hostelId, 'h.id = ?', query.hostelId);
  where.addIf(query.department, 's.department = ?', query.department);
  if (query.status === 'allocated') where.add('a.id IS NOT NULL');
  if (query.status === 'unallocated') where.add('a.id IS NULL AND u.is_active = 1');
  if (query.status === 'inactive') where.add('u.is_active = 0');

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total ${FROM} ${where.toSql()}`, where.params);
  const [rows] = await pool.query(
    `${SELECT} ${where.toSql()} ORDER BY ${getSort(query.sort, SORTS, 'u.name ASC')} LIMIT ? OFFSET ?`,
    [...where.params, pagination.limit, pagination.offset],
  );
  return { rows: rows.map(normalise), total, pagination };
}

async function getById(user, id) {
  const where = studentScope(user, new Where()).add('s.id = ?', id);
  const [rows] = await pool.query(`${SELECT} ${where.toSql()}`, where.params);
  if (!rows[0]) throw AppError.notFound('Student not found');
  return normalise(rows[0]);
}

async function getOwnProfile(user) {
  const [rows] = await pool.query(`${SELECT} WHERE s.user_id = ? AND s.organisation_id = ?`, [
    user.id,
    user.organisationId,
  ]);
  const student = rows[0];
  if (!student) throw AppError.notFound('Student profile not found');

  let room = null;
  if (student.roomId) {
    const [[occupancy]] = await pool.query(
      `SELECT v.room_number AS roomNumber, v.floor, v.room_type AS roomType, v.capacity, v.occupied,
              v.hostel_name AS hostelName, v.gender
         FROM v_room_occupancy v WHERE v.room_id = ?`,
      [student.roomId],
    );
    const [roommates] = await pool.query(
      `SELECT s.id, u.name, s.register_no AS registerNo, s.department, s.year, u.phone
         FROM allocations a
         JOIN students s ON s.id = a.student_id
         JOIN users u ON u.id = s.user_id
        WHERE a.room_id = ? AND a.status = 'active' AND s.id <> ?
        ORDER BY u.name`,
      [student.roomId, student.id],
    );
    const [wardens] = await pool.query(
      `SELECT u.id, u.name, u.phone, u.email
         FROM users u
         JOIN rooms r ON r.id = ?
        WHERE u.role = 'warden' AND u.is_active = 1 AND ${wardenRoomMatchSql('r', 'u.id')}
        ORDER BY u.name`,
      [student.roomId],
    );
    room = { ...occupancy, roommates, wardens };
  }
  return { ...normalise(student), room };
}

async function updateOwnProfile(user, body) {
  const [rows] = await pool.query('SELECT id FROM students WHERE user_id = ? AND organisation_id = ?', [
    user.id,
    user.organisationId,
  ]);
  if (!rows[0]) throw AppError.notFound('Student profile not found');
  await withTransaction(async (conn) => {
    if (body.phone !== undefined) await conn.query('UPDATE users SET phone = ? WHERE id = ?', [body.phone, user.id]);
    const sets = [];
    const params = [];
    for (const [key, column] of [
      ['guardianName', 'guardian_name'],
      ['guardianPhone', 'guardian_phone'],
      ['address', 'address'],
    ]) {
      if (body[key] !== undefined) {
        sets.push(`${column} = ?`);
        params.push(body[key]);
      }
    }
    if (sets.length) await conn.query(`UPDATE students SET ${sets.join(', ')} WHERE id = ?`, [...params, rows[0].id]);
    await logAudit(
      {
        organisationId: user.organisationId,
        userId: user.id,
        action: 'update_profile',
        entity: 'students',
        entityId: rows[0].id,
      },
      conn,
    );
  });
  return getOwnProfile(user);
}

function duplicateError(err) {
  if (err.code !== 'ER_DUP_ENTRY') return err;
  if (err.message.includes('uq_users_email')) {
    return AppError.conflict('A user with this email already exists', { email: 'Email already in use' });
  }
  if (err.message.includes('uq_students_org_register')) {
    return AppError.conflict('Register number already exists', { registerNo: 'Register number already in use' });
  }
  return err;
}

async function insertStudent(conn, organisationId, data, passwordHash) {
  const [userResult] = await conn.query(
    `INSERT INTO users (organisation_id, name, email, password_hash, role, gender, phone)
     VALUES (?, ?, ?, ?, 'student', ?, ?)`,
    [organisationId, data.name, data.email, passwordHash, data.gender, data.phone ?? null],
  );
  const [studentResult] = await conn.query(
    `INSERT INTO students (user_id, organisation_id, register_no, department, year, guardian_name, guardian_phone, address, date_of_birth)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userResult.insertId,
      organisationId,
      data.registerNo,
      data.department,
      data.year,
      data.guardianName ?? null,
      data.guardianPhone ?? null,
      data.address ?? null,
      data.dateOfBirth ?? null,
    ],
  );
  return studentResult.insertId;
}

async function create(user, body) {
  const managedGender = getManagedGender(user);
  if (managedGender && body.gender !== managedGender) {
    throw AppError.forbidden(`You can only create ${managedGender} students`);
  }
  const hash = await bcrypt.hash(body.password, env.BCRYPT_ROUNDS);
  const id = await withTransaction(async (conn) => {
    const studentId = await insertStudent(conn, user.organisationId, body, hash).catch((err) => {
      throw duplicateError(err);
    });
    await logAudit(
      {
        organisationId: user.organisationId,
        userId: user.id,
        action: 'create',
        entity: 'students',
        entityId: studentId,
      },
      conn,
    );
    return studentId;
  });
  return getById(user, id);
}

async function update(user, id, body) {
  const student = await getById(user, id);
  const managedGender = getManagedGender(user);
  if (managedGender && body.gender && body.gender !== managedGender) {
    throw AppError.forbidden(`You can only manage ${managedGender} students`);
  }
  if (body.gender && body.gender !== student.gender && student.allocationId) {
    throw AppError.conflict('Vacate the current room before changing the gender of this student', {
      gender: 'Student has an active allocation',
    });
  }
  const passwordHash = body.password ? await bcrypt.hash(body.password, env.BCRYPT_ROUNDS) : null;

  await withTransaction(async (conn) => {
    const userSets = [];
    const userParams = [];
    for (const [key, column] of [
      ['name', 'name'],
      ['email', 'email'],
      ['gender', 'gender'],
      ['phone', 'phone'],
      ['isActive', 'is_active'],
    ]) {
      if (body[key] !== undefined) {
        userSets.push(`${column} = ?`);
        userParams.push(body[key]);
      }
    }
    if (passwordHash) {
      userSets.push('password_hash = ?');
      userParams.push(passwordHash);
    }
    if (userSets.length) {
      await conn
        .query(`UPDATE users SET ${userSets.join(', ')} WHERE id = ?`, [...userParams, student.userId])
        .catch((err) => {
          throw duplicateError(err);
        });
    }
    if (body.isActive === false || passwordHash) {
      await conn.query(
        'UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL',
        [student.userId],
      );
    }

    const sets = [];
    const params = [];
    for (const [key, column] of [
      ['registerNo', 'register_no'],
      ['department', 'department'],
      ['year', 'year'],
      ['guardianName', 'guardian_name'],
      ['guardianPhone', 'guardian_phone'],
      ['address', 'address'],
      ['dateOfBirth', 'date_of_birth'],
    ]) {
      if (body[key] !== undefined) {
        sets.push(`${column} = ?`);
        params.push(body[key]);
      }
    }
    if (sets.length) {
      await conn.query(`UPDATE students SET ${sets.join(', ')} WHERE id = ?`, [...params, id]).catch((err) => {
        throw duplicateError(err);
      });
    }
    await logAudit(
      { organisationId: user.organisationId, userId: user.id, action: 'update', entity: 'students', entityId: id },
      conn,
    );
  });
  return getById(user, id);
}

async function remove(user, id) {
  const student = await getById(user, id);
  if (student.allocationId) {
    throw AppError.conflict('Vacate the student from their room before deleting the record');
  }
  await withTransaction(async (conn) => {
    // Application and allocation history are RESTRICTed by the schema; remove them explicitly first.
    await conn.query('DELETE FROM hostel_applications WHERE student_id = ?', [id]);
    await conn.query('DELETE FROM allocations WHERE student_id = ?', [id]);
    // Deleting the user cascades to students, complaints, leave requests and attendance.
    await conn.query('DELETE FROM users WHERE id = ? AND organisation_id = ?', [student.userId, user.organisationId]);
    await logAudit(
      {
        organisationId: user.organisationId,
        userId: user.id,
        action: 'delete',
        entity: 'students',
        entityId: id,
        meta: { registerNo: student.registerNo, email: student.email },
      },
      conn,
    );
  });
}

const REQUIRED_HEADERS = ['name', 'email', 'gender', 'register_no', 'department', 'year'];
const MAX_IMPORT_ROWS = 1000;

async function importCsv(user, { csv, defaultPassword }) {
  const { headers, records } = parseCsv(csv);
  const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  if (missing.length) {
    throw AppError.badRequest(`CSV is missing required columns: ${missing.join(', ')}`, {
      csv: `Required columns: ${REQUIRED_HEADERS.join(', ')}`,
    });
  }
  if (!records.length) throw AppError.badRequest('CSV has no data rows', { csv: 'No data rows found' });
  if (records.length > MAX_IMPORT_ROWS) {
    throw AppError.badRequest(`A single import is limited to ${MAX_IMPORT_ROWS} rows`, { csv: 'Too many rows' });
  }

  const rowErrors = [];
  const rows = [];
  const seenEmails = new Map();
  const seenRegisterNos = new Map();

  records.forEach((record, index) => {
    const line = index + 2; // +1 for header, +1 for 1-based lines
    const cleaned = Object.fromEntries(Object.entries(record).map(([key, value]) => [key, unguard(value)]));
    const result = importRowSchema.safeParse(cleaned);
    if (!result.success) {
      rowErrors.push({ line, errors: formatZodError(result.error) });
      return;
    }
    const r = result.data;
    if (seenEmails.has(r.email)) {
      rowErrors.push({ line, errors: { email: `Duplicate of line ${seenEmails.get(r.email)}` } });
      return;
    }
    if (seenRegisterNos.has(r.register_no)) {
      rowErrors.push({ line, errors: { register_no: `Duplicate of line ${seenRegisterNos.get(r.register_no)}` } });
      return;
    }
    seenEmails.set(r.email, line);
    seenRegisterNos.set(r.register_no, line);
    rows.push({
      line,
      name: r.name,
      email: r.email,
      gender: r.gender,
      registerNo: r.register_no,
      department: r.department,
      year: r.year,
      phone: r.phone,
      guardianName: r.guardian_name,
      guardianPhone: r.guardian_phone,
      address: r.address,
      dateOfBirth: r.date_of_birth,
    });
  });

  const managedGender = getManagedGender(user);
  if (managedGender) {
    for (const r of rows) {
      if (r.gender !== managedGender) {
        rowErrors.push({ line: r.line, errors: { gender: `You can only import ${managedGender} students` } });
      }
    }
  }

  if (rows.length) {
    const [existingEmails] = await pool.query('SELECT email FROM users WHERE email IN (?)', [rows.map((r) => r.email)]);
    const [existingRegs] = await pool.query(
      'SELECT register_no FROM students WHERE organisation_id = ? AND register_no IN (?)',
      [user.organisationId, rows.map((r) => r.registerNo)],
    );
    const emailSet = new Set(existingEmails.map((e) => e.email.toLowerCase()));
    const regSet = new Set(existingRegs.map((e) => e.register_no.toUpperCase()));
    for (const r of rows) {
      const errors = {};
      if (emailSet.has(r.email)) errors.email = 'Email already exists';
      if (regSet.has(r.registerNo)) errors.register_no = 'Register number already exists';
      if (Object.keys(errors).length) rowErrors.push({ line: r.line, errors });
    }
  }

  if (rowErrors.length) {
    rowErrors.sort((a, b) => a.line - b.line);
    throw new AppError(
      400,
      'IMPORT_VALIDATION_FAILED',
      `${rowErrors.length} row(s) have errors. Nothing was imported.`,
      {
        rows: rowErrors.slice(0, 100),
      },
    );
  }

  // Hash once for the whole batch: every imported student must change it after first login.
  const hash = await bcrypt.hash(defaultPassword, env.BCRYPT_ROUNDS);
  const created = await withTransaction(async (conn) => {
    for (const r of rows) {
      await insertStudent(conn, user.organisationId, r, hash).catch((err) => {
        const mapped = duplicateError(err);
        if (mapped instanceof AppError) mapped.message = `Line ${r.line}: ${mapped.message}`;
        throw mapped;
      });
    }
    await logAudit(
      {
        organisationId: user.organisationId,
        userId: user.id,
        action: 'import',
        entity: 'students',
        meta: { count: rows.length },
      },
      conn,
    );
    return rows.length;
  });
  return { imported: created };
}

module.exports = { list, getById, getOwnProfile, updateOwnProfile, create, update, remove, importCsv };
