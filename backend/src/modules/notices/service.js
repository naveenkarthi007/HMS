const { pool, withTransaction } = require('../../config/db');
const AppError = require('../../utils/AppError');
const { getPagination, getSort, likeParam, Where } = require('../../utils/pagination');
const { getManagedGender } = require('../../utils/roles');
const { logAudit } = require('../audit/service');

const SORTS = { createdAt: 'n.created_at', title: 'n.title', expiresAt: 'n.expires_at', startsAt: 'n.starts_at' };

const FROM = `
    FROM notices n
    LEFT JOIN hostels h ON h.id = n.hostel_id
    LEFT JOIN users p ON p.id = n.published_by`;

const SELECT = `
  SELECT n.id, n.title, n.body, n.category, n.target_type AS targetType,
         n.hostel_id AS hostelId, h.name AS hostelName, n.audience_gender AS audienceGender,
         n.is_pinned AS isPinned, n.starts_at AS startsAt, n.expires_at AS expiresAt,
         n.created_at AS createdAt, n.updated_at AS updatedAt,
         n.published_by AS publishedBy, p.name AS publishedByName,
         (SELECT GROUP_CONCAT(tv.value ORDER BY tv.value SEPARATOR ',')
            FROM notice_target_values tv WHERE tv.notice_id = n.id) AS targetValueList,
         (n.expires_at IS NOT NULL AND n.expires_at < UTC_TIMESTAMP()) AS isExpired,
         (n.starts_at IS NOT NULL AND n.starts_at > UTC_TIMESTAMP()) AS isScheduled
  ${FROM}`;

const LIVE =
  '(n.starts_at IS NULL OR n.starts_at <= UTC_TIMESTAMP()) AND (n.expires_at IS NULL OR n.expires_at >= UTC_TIMESTAMP())';

function normalise(row) {
  if (!row) return row;
  const { targetValueList, ...rest } = row;
  return {
    ...rest,
    isPinned: Boolean(row.isPinned),
    isExpired: Boolean(row.isExpired),
    isScheduled: Boolean(row.isScheduled),
    targetValues: targetValueList ? targetValueList.split(',').map(Number) : [],
  };
}

/** Where the signed-in student lives (hostel, floor) and their year, used for targeting. */
async function studentContext(user) {
  const [rows] = await pool.query(
    `SELECT u.gender, s.year, r.hostel_id, r.floor
       FROM users u
       JOIN students s ON s.user_id = u.id
       LEFT JOIN allocations a ON a.student_id = s.id AND a.status = 'active'
       LEFT JOIN rooms r ON r.id = a.room_id
      WHERE u.id = ?`,
    [user.id],
  );
  return rows[0] || {};
}

async function scopeWhere(user) {
  const where = new Where().add('n.organisation_id = ?', user.organisationId);
  const managedGender = getManagedGender(user);
  if (managedGender) {
    where.add("(h.gender = ? OR (n.hostel_id IS NULL AND n.audience_gender IN ('all', ?)))", managedGender, managedGender);
  }
  if (user.role === 'warden') {
    where.add(
      '(n.hostel_id IS NULL OR n.hostel_id IN (SELECT hw.hostel_id FROM hostel_wardens hw WHERE hw.user_id = ?))',
      user.id,
    );
  }
  if (user.role === 'student') {
    const me = await studentContext(user);
    const hostelId = me.hostel_id ?? null;
    where.add(LIVE);
    where.add("n.audience_gender IN ('all', ?)", me.gender || 'all');
    where.add(
      `(n.target_type = 'all'
        OR (n.target_type = 'hostel' AND n.hostel_id = ?)
        OR (n.target_type = 'floor' AND n.hostel_id = ?
            AND EXISTS (SELECT 1 FROM notice_target_values tv WHERE tv.notice_id = n.id AND tv.value = ?))
        OR (n.target_type = 'year' AND (n.hostel_id IS NULL OR n.hostel_id = ?)
            AND EXISTS (SELECT 1 FROM notice_target_values tv WHERE tv.notice_id = n.id AND tv.value = ?)))`,
      hostelId,
      hostelId,
      me.floor ?? -1,
      hostelId,
      me.year ?? -1,
    );
  }
  return where;
}

async function list(user, query) {
  const pagination = getPagination(query);
  const where = await scopeWhere(user);
  if (query.search) {
    const like = likeParam(query.search);
    where.add('(n.title LIKE ? OR n.body LIKE ?)', like, like);
  }
  where.addIf(query.gender, "n.audience_gender IN ('all', ?)", query.gender);
  where.addIf(query.hostelId, '(n.hostel_id = ? OR n.hostel_id IS NULL)', query.hostelId);
  where.addIf(query.category, 'n.category = ?', query.category);
  if (query.status === 'active') where.add(LIVE);
  if (query.status === 'scheduled') where.add('n.starts_at > UTC_TIMESTAMP()');
  if (query.status === 'expired') where.add('n.expires_at < UTC_TIMESTAMP()');

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total ${FROM} ${where.toSql()}`, where.params);
  const [rows] = await pool.query(
    `${SELECT} ${where.toSql()}
      ORDER BY n.is_pinned DESC, ${getSort(query.sort, SORTS, 'n.created_at DESC')}, n.id DESC
      LIMIT ? OFFSET ?`,
    [...where.params, pagination.limit, pagination.offset],
  );
  return { rows: rows.map(normalise), total, pagination };
}

async function getById(user, id) {
  const where = (await scopeWhere(user)).add('n.id = ?', id);
  const [rows] = await pool.query(`${SELECT} ${where.toSql()}`, where.params);
  if (!rows[0]) throw AppError.notFound('Notice not found');
  return normalise(rows[0]);
}

/** Checks "Send To" against the user's hostels and returns the normalised target. */
async function resolveTarget(user, body) {
  const { targetType, audienceGender } = body;
  let hostelId = targetType === 'all' ? null : (body.hostelId ?? null);
  const targetValues = targetType === 'floor' || targetType === 'year' ? [...new Set(body.targetValues)].sort() : [];

  const managedGender = getManagedGender(user);
  if (user.role === 'warden' && !hostelId) {
    throw AppError.badRequest('Wardens can only send notices to one of their hostels', { hostelId: 'Select a hostel' });
  }
  if (!hostelId) {
    if (managedGender && audienceGender !== managedGender) {
      throw AppError.badRequest(`You can only send notices to ${managedGender} students`, {
        audienceGender: `Audience must be "${managedGender}"`,
      });
    }
    return { hostelId: null, targetValues };
  }

  const params = [hostelId, user.organisationId];
  let sql = 'SELECT h.id, h.gender FROM hostels h WHERE h.id = ? AND h.organisation_id = ?';
  if (managedGender) {
    sql += ' AND h.gender = ?';
    params.push(managedGender);
  }
  if (user.role === 'warden') {
    sql += ' AND h.id IN (SELECT hw.hostel_id FROM hostel_wardens hw WHERE hw.user_id = ?)';
    params.push(user.id);
  }
  const [rows] = await pool.query(sql, params);
  if (!rows[0]) throw AppError.badRequest('Hostel not found', { hostelId: 'Unknown hostel' });
  if (audienceGender !== 'all' && audienceGender !== rows[0].gender) {
    throw AppError.badRequest(`This is a ${rows[0].gender} hostel`, {
      audienceGender: `Audience must be "all" or "${rows[0].gender}" for this hostel`,
    });
  }
  hostelId = rows[0].id;
  return { hostelId, targetValues };
}

async function saveTargetValues(conn, noticeId, values) {
  await conn.query('DELETE FROM notice_target_values WHERE notice_id = ?', [noticeId]);
  if (values.length) {
    await conn.query('INSERT INTO notice_target_values (notice_id, value) VALUES ?', [
      values.map((v) => [noticeId, v]),
    ]);
  }
}

async function create(user, body) {
  const { hostelId, targetValues } = await resolveTarget(user, body);
  const id = await withTransaction(async (conn) => {
    const [result] = await conn.query(
      `INSERT INTO notices (organisation_id, category, target_type, hostel_id, audience_gender, title, body,
                            is_pinned, published_by, starts_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.organisationId,
        body.category,
        body.targetType,
        hostelId,
        body.audienceGender,
        body.title,
        body.body,
        body.isPinned,
        user.id,
        body.startsAt,
        body.expiresAt,
      ],
    );
    await saveTargetValues(conn, result.insertId, targetValues);
    await logAudit(
      {
        organisationId: user.organisationId,
        userId: user.id,
        action: 'create',
        entity: 'notices',
        entityId: result.insertId,
      },
      conn,
    );
    return result.insertId;
  });
  return getById(user, id);
}

async function assertCanModify(user, id) {
  const notice = await getById(user, id);
  if (user.role === 'warden' && notice.publishedBy !== user.id) {
    throw AppError.forbidden('Wardens can only modify notices they published');
  }
  const managedGender = getManagedGender(user);
  if (managedGender && !notice.hostelId && notice.audienceGender !== managedGender) {
    throw AppError.forbidden(`You can only modify notices targeted to ${managedGender} students`);
  }
  return notice;
}

async function update(user, id, body) {
  await assertCanModify(user, id);
  const { hostelId, targetValues } = await resolveTarget(user, body);
  await withTransaction(async (conn) => {
    await conn.query(
      `UPDATE notices
          SET category = ?, target_type = ?, hostel_id = ?, audience_gender = ?, title = ?, body = ?,
              is_pinned = ?, starts_at = ?, expires_at = ?
        WHERE id = ? AND organisation_id = ?`,
      [
        body.category,
        body.targetType,
        hostelId,
        body.audienceGender,
        body.title,
        body.body,
        body.isPinned,
        body.startsAt,
        body.expiresAt,
        id,
        user.organisationId,
      ],
    );
    await saveTargetValues(conn, id, targetValues);
    await logAudit(
      { organisationId: user.organisationId, userId: user.id, action: 'update', entity: 'notices', entityId: id },
      conn,
    );
  });
  return getById(user, id);
}

async function remove(user, id) {
  await assertCanModify(user, id);
  await pool.query('DELETE FROM notices WHERE id = ? AND organisation_id = ?', [id, user.organisationId]);
  await logAudit({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'delete',
    entity: 'notices',
    entityId: id,
  });
}

module.exports = { list, getById, create, update, remove };
