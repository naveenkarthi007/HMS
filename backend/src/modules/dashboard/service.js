const { pool } = require('../../config/db');
const { Where } = require('../../utils/pagination');
const { getManagedGender, isAdminRole } = require('../../utils/roles');
const { hostelScope, studentActiveRoomScope, wardenRoomMatchSql } = require('../hostels/service');

const COMPLAINT_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

/**
 * Builds the WHERE clause applied to the `hostels h` alias for every dashboard query.
 * super_admin sees the whole platform; org_admin the organisation; warden assigned hostels.
 */
function hostelWhere(user, { gender, hostelId }) {
  const where = new Where();
  if (user.role !== 'super_admin') {
    const scope = hostelScope(user);
    where.add(scope.sql, ...scope.params);
  }
  where.addIf(gender, 'h.gender = ?', gender);
  where.addIf(hostelId, 'h.id = ?', hostelId);
  return where;
}

async function summary(user, query) {
  const where = hostelWhere(user, query);
  const sql = where.toSql();
  const params = where.params;

  const roomWardenJoin =
    user.role === 'warden' ? `AND ${wardenRoomMatchSql('v')}` : '';

  const [[hostelStats]] = await pool.query(
    `SELECT COUNT(DISTINCT h.id) AS hostels,
            COUNT(v.room_id) AS rooms,
            COALESCE(SUM(CASE WHEN v.room_status = 'active' THEN v.capacity ELSE 0 END), 0) AS beds,
            COALESCE(SUM(v.occupied), 0) AS occupied,
            COALESCE(SUM(CASE WHEN v.room_status = 'maintenance' THEN 1 ELSE 0 END), 0) AS maintenanceRooms
       FROM hostels h
       LEFT JOIN v_room_occupancy v ON v.hostel_id = h.id ${roomWardenJoin}
       ${sql}`,
    user.role === 'warden' ? [user.id, ...params] : params,
  );

  const activeRoomWhere = new Where();
  if (user.role !== 'super_admin') {
    const arScope = studentActiveRoomScope(user, 's', 'h');
    activeRoomWhere.add(arScope.sql, ...arScope.params);
  }
  activeRoomWhere.addIf(query.gender, 'h.gender = ?', query.gender);
  activeRoomWhere.addIf(query.hostelId, 'h.id = ?', query.hostelId);
  const arSql = activeRoomWhere.toSql();
  const arParams = activeRoomWhere.params;

  const [[complaintStats]] = await pool.query(
    `SELECT COALESCE(SUM(c.status IN ('open', 'in_progress')), 0) AS openComplaints
       FROM complaints c JOIN students s ON s.id = c.student_id JOIN hostels h ON h.id = c.hostel_id ${arSql}`,
    arParams,
  );

  const leaveWhere = hostelWhere(user, query);
  if (user.role === 'warden') leaveWhere.add(wardenRoomMatchSql('r'), user.id);
  leaveWhere.add("l.status = 'pending'");
  const [[leaveStats]] = await pool.query(
    `SELECT COUNT(*) AS pendingLeaves
       FROM leave_requests l
       JOIN students s ON s.id = l.student_id
       JOIN allocations a ON a.student_id = s.id AND a.status = 'active'
       JOIN rooms r ON r.id = a.room_id
       JOIN hostels h ON h.id = r.hostel_id
       ${leaveWhere.toSql()}`,
    leaveWhere.params,
  );

  const [[outingStats]] = await pool.query(
    `SELECT COALESCE(SUM(o.status = 'pending'), 0) AS pendingOutings,
            COALESCE(SUM(o.status = 'out'), 0) AS studentsOut
       FROM outing_requests o JOIN students s ON s.id = o.student_id JOIN hostels h ON h.id = o.hostel_id ${arSql}`,
    arParams,
  );

  // Booking applications come from students without a room, so they are scoped by organisation.
  const managedGender = getManagedGender(user);
  const applicationWhere = new Where().add("ap.status = 'pending'");
  if (user.role !== 'super_admin') applicationWhere.add('s.organisation_id = ?', user.organisationId);
  applicationWhere.addIf(managedGender, 'u.gender = ?', managedGender);
  applicationWhere.addIf(query.gender, 'u.gender = ?', query.gender);
  const [[applicationStats]] = await pool.query(
    `SELECT COUNT(*) AS pendingApplications
       FROM hostel_applications ap JOIN students s ON s.id = ap.student_id JOIN users u ON u.id = s.user_id
       ${applicationWhere.toSql()}`,
    applicationWhere.params,
  );

  // Students are counted by organisation (allocated or not), filtered by gender.
  const studentWhere = new Where();
  if (isAdminRole(user.role)) {
    studentWhere.add('s.organisation_id = ?', user.organisationId);
    studentWhere.addIf(managedGender, 'u.gender = ?', managedGender);
  }
  if (user.role === 'warden') {
    studentWhere.add(
      `s.id IN (SELECT a.student_id FROM allocations a JOIN rooms r ON r.id = a.room_id
                 WHERE a.status = 'active' AND ${wardenRoomMatchSql('r')})`,
      user.id,
    );
  }
  studentWhere.addIf(query.gender, 'u.gender = ?', query.gender);
  const [[studentStats]] = await pool.query(
    `SELECT COUNT(*) AS students,
            COALESCE(SUM(EXISTS (SELECT 1 FROM allocations a WHERE a.student_id = s.id AND a.status = 'active')), 0) AS allocatedStudents
       FROM students s JOIN users u ON u.id = s.user_id ${studentWhere.toSql()}`,
    studentWhere.params,
  );

  const [occupancyByHostel] = await pool.query(
    `SELECT h.id, h.name, h.code, h.gender,
            COALESCE(SUM(CASE WHEN v.room_status = 'active' THEN v.capacity ELSE 0 END), 0) AS beds,
            COALESCE(SUM(v.occupied), 0) AS occupied
       FROM hostels h
       LEFT JOIN v_room_occupancy v ON v.hostel_id = h.id ${roomWardenJoin}
       ${sql}
      GROUP BY h.id, h.name, h.code, h.gender
      ORDER BY h.gender, h.name
      LIMIT 30`,
    user.role === 'warden' ? [user.id, ...params] : params,
  );

  const [genderRows] = await pool.query(
    `SELECT h.gender,
            COALESCE(SUM(CASE WHEN v.room_status = 'active' THEN v.capacity ELSE 0 END), 0) AS beds,
            COALESCE(SUM(v.occupied), 0) AS occupied
       FROM hostels h
       LEFT JOIN v_room_occupancy v ON v.hostel_id = h.id ${roomWardenJoin}
       ${sql}
      GROUP BY h.gender`,
    user.role === 'warden' ? [user.id, ...params] : params,
  );
  const effectiveGender = query.gender || managedGender;
  const genders = effectiveGender ? [effectiveGender] : ['male', 'female'];
  const genderOccupancy = genders.map((g) => {
    const row = genderRows.find((r) => r.gender === g) || { beds: 0, occupied: 0 };
    return { gender: g, beds: row.beds, occupied: row.occupied, available: Math.max(0, row.beds - row.occupied) };
  });

  const [complaintRows] = await pool.query(
    `SELECT c.status, COUNT(*) AS count
       FROM complaints c JOIN students s ON s.id = c.student_id JOIN hostels h ON h.id = c.hostel_id ${arSql}
      GROUP BY c.status`,
    arParams,
  );
  const complaintsByStatus = COMPLAINT_STATUSES.map((status) => ({
    status,
    count: complaintRows.find((r) => r.status === status)?.count || 0,
  }));

  let organisations = null;
  if (user.role === 'super_admin') {
    const [[orgStats]] = await pool.query(
      'SELECT COUNT(*) AS total, COALESCE(SUM(is_active), 0) AS active FROM organisations',
    );
    organisations = orgStats;
  }

  return {
    stats: {
      hostels: hostelStats.hostels,
      rooms: hostelStats.rooms,
      maintenanceRooms: hostelStats.maintenanceRooms,
      beds: hostelStats.beds,
      occupied: hostelStats.occupied,
      available: Math.max(0, hostelStats.beds - hostelStats.occupied),
      occupancyRate: hostelStats.beds ? Math.round((hostelStats.occupied / hostelStats.beds) * 100) : 0,
      openComplaints: complaintStats.openComplaints,
      pendingLeaves: leaveStats.pendingLeaves,
      pendingOutings: outingStats.pendingOutings,
      studentsOut: outingStats.studentsOut,
      pendingApplications: user.role === 'warden' ? 0 : applicationStats.pendingApplications,
      students: studentStats.students,
      allocatedStudents: studentStats.allocatedStudents,
    },
    organisations,
    occupancyByHostel: occupancyByHostel.map((h) => ({ ...h, available: Math.max(0, h.beds - h.occupied) })),
    genderOccupancy,
    complaintsByStatus,
  };
}

/**
 * Super admin overview: one row per organisation, users by role and recent activity.
 */
async function platform() {
  const [organisations] = await pool.query(
    `SELECT o.id, o.name, o.code, o.is_active AS isActive,
            COALESCE(hs.hostels, 0) AS hostels, COALESCE(hs.maleHostels, 0) AS maleHostels,
            COALESCE(hs.femaleHostels, 0) AS femaleHostels,
            COALESCE(rs.rooms, 0) AS rooms, COALESCE(rs.beds, 0) AS beds, COALESCE(rs.occupied, 0) AS occupied,
            COALESCE(st.students, 0) AS students, COALESCE(st.maleStudents, 0) AS maleStudents,
            COALESCE(st.femaleStudents, 0) AS femaleStudents,
            COALESCE(us.admins, 0) AS admins, COALESCE(us.wardens, 0) AS wardens,
            (SELECT COUNT(*) FROM complaints c JOIN hostels h ON h.id = c.hostel_id
              WHERE h.organisation_id = o.id AND c.status IN ('open', 'in_progress')) AS openComplaints,
            (SELECT COUNT(*) FROM leave_requests l JOIN students s ON s.id = l.student_id
              WHERE s.organisation_id = o.id AND l.status = 'pending') AS pendingLeaves,
            (SELECT COUNT(*) FROM hostel_applications ap JOIN students s ON s.id = ap.student_id
              WHERE s.organisation_id = o.id AND ap.status = 'pending') AS pendingApplications,
            (SELECT COUNT(*) FROM outing_requests ot JOIN hostels h ON h.id = ot.hostel_id
              WHERE h.organisation_id = o.id AND ot.status = 'out') AS studentsOut,
            (SELECT MAX(al.created_at) FROM audit_logs al WHERE al.organisation_id = o.id) AS lastActivityAt
       FROM organisations o
       LEFT JOIN (SELECT organisation_id, COUNT(*) AS hostels, SUM(gender = 'male') AS maleHostels,
                         SUM(gender = 'female') AS femaleHostels
                    FROM hostels GROUP BY organisation_id) hs ON hs.organisation_id = o.id
       LEFT JOIN (SELECT organisation_id, COUNT(*) AS rooms,
                         SUM(CASE WHEN room_status = 'active' THEN capacity ELSE 0 END) AS beds, SUM(occupied) AS occupied
                    FROM v_room_occupancy GROUP BY organisation_id) rs ON rs.organisation_id = o.id
       LEFT JOIN (SELECT s.organisation_id, COUNT(*) AS students, SUM(u.gender = 'male') AS maleStudents,
                         SUM(u.gender = 'female') AS femaleStudents
                    FROM students s JOIN users u ON u.id = s.user_id GROUP BY s.organisation_id) st
              ON st.organisation_id = o.id
       LEFT JOIN (SELECT organisation_id, SUM(role = 'org_admin') AS admins, SUM(role = 'warden') AS wardens
                    FROM users WHERE organisation_id IS NOT NULL GROUP BY organisation_id) us
              ON us.organisation_id = o.id
      ORDER BY o.name`,
  );

  const [usersByRole] = await pool.query(
    `SELECT role, COUNT(*) AS total, COALESCE(SUM(is_active), 0) AS active
       FROM users GROUP BY role ORDER BY FIELD(role, 'super_admin', 'org_admin', 'boys_hostel_manager', 'girls_hostel_manager', 'warden', 'student')`,
  );

  const [recentActivity] = await pool.query(
    `SELECT al.id, al.action, al.entity, al.entity_id AS entityId, al.created_at AS createdAt,
            u.name AS userName, u.role AS userRole, o.name AS organisationName, o.code AS organisationCode
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       LEFT JOIN organisations o ON o.id = al.organisation_id
      WHERE al.action <> 'seed'
      ORDER BY al.created_at DESC, al.id DESC
      LIMIT 15`,
  );

  return {
    organisations: organisations.map((o) => ({
      ...o,
      isActive: Boolean(o.isActive),
      available: Math.max(0, o.beds - o.occupied),
      occupancyRate: o.beds ? Math.round((o.occupied / o.beds) * 100) : 0,
    })),
    usersByRole,
    recentActivity,
  };
}

module.exports = { summary, platform };
