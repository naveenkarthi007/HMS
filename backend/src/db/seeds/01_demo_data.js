/**
 * Demo data: 1 super admin, 2 organisations, and per organisation
 * 1 org admin, 2 wardens, 4 hostels (2 male + 2 female), 10 rooms per hostel,
 * 40 students (20 male + 20 female), allocations, complaints, leaves, notices and attendance.
 *
 * Every demo account uses the password: Password@123
 */
const bcrypt = require('bcrypt');
const env = require('../../config/env');

const DEMO_PASSWORD = 'Password@123';

const TABLES = [
  'audit_logs',
  'notice_target_values',
  'mess_menus',
  'outing_requests',
  'hostel_applications',
  'refresh_tokens',
  'attendance',
  'notices',
  'leave_requests',
  'complaints',
  'allocations',
  'students',
  'rooms',
  'warden_assignments',
  'hostel_wardens',
  'hostels',
  'users',
  'organisations',
];

const ORGANISATIONS = [
  {
    name: 'Greenfield Institute of Technology',
    code: 'GIT',
    domain: 'git.edu',
    address: '12 Lake View Road, Bengaluru',
    contact_phone: '+91 80 4000 1000',
  },
  {
    name: 'Riverside College of Engineering',
    code: 'RCE',
    domain: 'rce.edu',
    address: '45 Riverside Avenue, Chennai',
    contact_phone: '+91 44 4000 2000',
  },
];

const HOSTELS = [
  { name: 'Aryabhata Hall', code: 'BH1', gender: 'male' },
  { name: 'Raman Hall', code: 'BH2', gender: 'male' },
  { name: 'Sarojini Hall', code: 'GH1', gender: 'female' },
  { name: 'Kalpana Hall', code: 'GH2', gender: 'female' },
];

// 10 rooms per hostel: [room_number, floor, capacity, type, status]
const ROOM_LAYOUT = [
  ['101', 1, 2, 'double', 'active'],
  ['102', 1, 2, 'double', 'active'],
  ['103', 1, 2, 'double', 'active'],
  ['104', 1, 4, 'quad', 'active'],
  ['105', 1, 4, 'quad', 'active'],
  ['201', 2, 1, 'single', 'active'],
  ['202', 2, 2, 'double', 'active'],
  ['203', 2, 4, 'quad', 'active'],
  ['204', 2, 4, 'quad', 'active'],
  ['205', 2, 2, 'double', 'maintenance'],
];

const MALE_NAMES = [
  'Aarav',
  'Vihaan',
  'Arjun',
  'Rohan',
  'Karthik',
  'Aditya',
  'Nikhil',
  'Rahul',
  'Siddharth',
  'Varun',
  'Pranav',
  'Harish',
  'Manoj',
  'Suresh',
  'Kiran',
  'Deepak',
  'Abhishek',
  'Gautam',
  'Yash',
  'Tarun',
];
const FEMALE_NAMES = [
  'Ananya',
  'Diya',
  'Ishita',
  'Kavya',
  'Meera',
  'Priya',
  'Sneha',
  'Pooja',
  'Nisha',
  'Riya',
  'Aditi',
  'Shreya',
  'Lakshmi',
  'Divya',
  'Swathi',
  'Neha',
  'Tanvi',
  'Bhavya',
  'Keerthi',
  'Sanjana',
];
const LAST_NAMES = ['Sharma', 'Iyer', 'Reddy', 'Nair', 'Patel', 'Gupta', 'Menon', 'Rao', 'Das', 'Kulkarni'];
const DEPARTMENTS = ['Computer Science', 'Electronics', 'Mechanical', 'Civil', 'Information Technology', 'Electrical'];

function isoDate(offsetDays = 0) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function timestamp(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

const pad = (n, size = 2) => String(n).padStart(size, '0');

async function insert(knex, table, row) {
  const [id] = await knex(table).insert(row);
  return id;
}

exports.seed = async function seed(knex) {
  await knex.raw('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of TABLES) {
    await knex.raw('TRUNCATE TABLE ??', [table]);
  }
  await knex.raw('SET FOREIGN_KEY_CHECKS = 1');

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, env.BCRYPT_ROUNDS);

  await insert(knex, 'users', {
    organisation_id: null,
    name: 'Platform Super Admin',
    email: 'super@hms.dev',
    password_hash: passwordHash,
    role: 'super_admin',
    gender: null,
    phone: '+91 90000 00000',
  });

  for (const [orgIndex, org] of ORGANISATIONS.entries()) {
    const organisationId = await insert(knex, 'organisations', {
      name: org.name,
      code: org.code,
      address: org.address,
      contact_email: `office@${org.domain}`,
      contact_phone: org.contact_phone,
      is_active: true,
    });

    const adminId = await insert(knex, 'users', {
      organisation_id: organisationId,
      name: `${org.code} Administrator`,
      email: `admin@${org.domain}`,
      password_hash: passwordHash,
      role: 'org_admin',
      gender: orgIndex === 0 ? 'male' : 'female',
      phone: `+91 9100${orgIndex}0 00001`,
    });

    await insert(knex, 'users', {
      organisation_id: organisationId,
      name: orgIndex === 0 ? 'Arjun Menon' : 'Karthik Subramanian',
      email: `boys.manager@${org.domain}`,
      password_hash: passwordHash,
      role: 'boys_hostel_manager',
      gender: 'male',
      phone: `+91 9150${orgIndex}0 00001`,
    });

    await insert(knex, 'users', {
      organisation_id: organisationId,
      name: orgIndex === 0 ? 'Meera Nair' : 'Deepa Sundaram',
      email: `girls.manager@${org.domain}`,
      password_hash: passwordHash,
      role: 'girls_hostel_manager',
      gender: 'female',
      phone: `+91 9150${orgIndex}0 00002`,
    });

    const wardenIds = {
      male: await insert(knex, 'users', {
        organisation_id: organisationId,
        name: orgIndex === 0 ? 'Ramesh Kumar' : 'Venkat Raman',
        email: `warden.male@${org.domain}`,
        password_hash: passwordHash,
        role: 'warden',
        gender: 'male',
        phone: `+91 9200${orgIndex}0 00001`,
      }),
      female: await insert(knex, 'users', {
        organisation_id: organisationId,
        name: orgIndex === 0 ? 'Lalitha Devi' : 'Kamala Krishnan',
        email: `warden.female@${org.domain}`,
        password_hash: passwordHash,
        role: 'warden',
        gender: 'female',
        phone: `+91 9200${orgIndex}0 00002`,
      }),
    };

    // Hostels + rooms
    const hostels = [];
    for (const h of HOSTELS) {
      const hostelId = await insert(knex, 'hostels', {
        organisation_id: organisationId,
        name: h.name,
        code: h.code,
        gender: h.gender,
        address: `${h.name}, ${org.name} campus`,
        is_active: true,
      });
      await insert(knex, 'hostel_wardens', { hostel_id: hostelId, user_id: wardenIds[h.gender] });
      await insert(knex, 'warden_assignments', {
        hostel_id: hostelId,
        user_id: wardenIds[h.gender],
        scope_type: 'hostel',
      });

      const rooms = [];
      for (const [roomNumber, floor, capacity, roomType, status] of ROOM_LAYOUT) {
        const roomId = await insert(knex, 'rooms', {
          hostel_id: hostelId,
          room_number: roomNumber,
          floor,
          capacity,
          room_type: roomType,
          status,
        });
        rooms.push({ id: roomId, capacity, status, used: 0 });
      }
      hostels.push({ id: hostelId, gender: h.gender, rooms });
    }

    // Students: 20 male + 20 female
    const students = [];
    for (let i = 1; i <= 40; i += 1) {
      const gender = i <= 20 ? 'male' : 'female';
      const first = gender === 'male' ? MALE_NAMES[i - 1] : FEMALE_NAMES[i - 21];
      const last = LAST_NAMES[(i + orgIndex) % LAST_NAMES.length];
      const userId = await insert(knex, 'users', {
        organisation_id: organisationId,
        name: `${first} ${last}`,
        email: `student${pad(i)}@${org.domain}`,
        password_hash: passwordHash,
        role: 'student',
        gender,
        phone: `+91 98${orgIndex}${pad(i, 3)} 4${pad(i, 4)}`,
      });
      const studentId = await insert(knex, 'students', {
        user_id: userId,
        organisation_id: organisationId,
        register_no: `${org.code}26${pad(i, 3)}`,
        department: DEPARTMENTS[i % DEPARTMENTS.length],
        year: (i % 4) + 1,
        guardian_name: `${['Mr.', 'Mrs.'][i % 2]} ${last}`,
        guardian_phone: `+91 97${orgIndex}${pad(i, 3)} 5${pad(i, 4)}`,
        address: `${i} Main Street, ${['Mysuru', 'Coimbatore', 'Hyderabad', 'Pune', 'Kochi'][i % 5]}`,
        date_of_birth: `${2003 + (i % 4)}-${pad((i % 12) + 1)}-${pad((i % 27) + 1)}`,
      });
      students.push({ id: studentId, userId, gender, index: i });
    }

    // Allocations: 14 male + 14 female active, filling rooms with free beds of matching hostels.
    const allocated = [];
    const placeStudent = (student) => {
      for (const hostel of hostels.filter((h) => h.gender === student.gender)) {
        const room = hostel.rooms.find((r) => r.status === 'active' && r.used < r.capacity);
        if (room) {
          room.used += 1;
          return { hostelId: hostel.id, roomId: room.id };
        }
      }
      return null;
    };

    for (const student of students) {
      const withinGender = student.gender === 'male' ? student.index : student.index - 20;
      if (withinGender > 14) continue;
      // Alternate hostels so both hostels of each gender get residents.
      const genderHostels = hostels.filter((h) => h.gender === student.gender);
      const preferred = genderHostels[withinGender % 2];
      let slot = null;
      const room = preferred.rooms.find((r) => r.status === 'active' && r.used < r.capacity);
      if (room) {
        room.used += 1;
        slot = { hostelId: preferred.id, roomId: room.id };
      } else {
        slot = placeStudent(student);
      }
      if (!slot) continue;
      await insert(knex, 'allocations', {
        student_id: student.id,
        room_id: slot.roomId,
        allocated_by: adminId,
        start_date: isoDate(-60 + withinGender),
        end_date: null,
        status: 'active',
      });
      allocated.push({ ...student, ...slot });
    }

    // Vacated history for two currently unallocated students (one of each gender).
    for (const idx of [15, 35]) {
      const student = students[idx - 1];
      const hostel = hostels.find((h) => h.gender === student.gender);
      await insert(knex, 'allocations', {
        student_id: student.id,
        room_id: hostel.rooms[0].id,
        allocated_by: adminId,
        start_date: isoDate(-200),
        end_date: isoDate(-90),
        status: 'vacated',
      });
    }

    // Complaints
    const complaintSeeds = [
      [
        'electrical',
        'Ceiling fan not working',
        'The fan in my room stopped working since yesterday night.',
        'high',
        'open',
      ],
      [
        'plumbing',
        'Leaking tap in washroom',
        'The tap on the first floor washroom keeps leaking.',
        'medium',
        'in_progress',
      ],
      ['internet', 'Wi-Fi drops frequently', 'Wi-Fi disconnects every few minutes in the evening.', 'medium', 'open'],
      [
        'cleaning',
        'Corridor not cleaned',
        'The corridor near my room has not been cleaned for two days.',
        'low',
        'resolved',
      ],
      ['furniture', 'Broken study chair', 'The study chair in my room has a broken leg.', 'low', 'closed'],
      ['mess', 'Food quality at dinner', 'Dinner served yesterday was cold and undercooked.', 'medium', 'open'],
      ['other', 'Room door lock jammed', 'The room door lock gets stuck and is hard to open.', 'high', 'in_progress'],
      [
        'electrical',
        'Tube light flickering',
        'Tube light near the study table flickers constantly.',
        'low',
        'resolved',
      ],
    ];
    for (const [i, [category, title, description, priority, status]] of complaintSeeds.entries()) {
      const student = allocated[(i * 3) % allocated.length];
      const done = status === 'resolved' || status === 'closed';
      await insert(knex, 'complaints', {
        student_id: student.id,
        hostel_id: student.hostelId,
        category,
        title,
        description,
        priority,
        status,
        assigned_to: status === 'open' ? null : wardenIds[student.gender],
        resolved_at: done ? timestamp(-i) : null,
        created_at: timestamp(-(i + 2)),
      });
    }

    // Leave requests
    const leaveSeeds = [
      [3, 5, 'Attending sister’s wedding at home town.', 'pending'],
      [7, 9, 'Family function.', 'pending'],
      [-10, -8, 'Medical check-up at home.', 'approved'],
      [1, 2, 'Inter-college sports meet.', 'approved'],
      [-20, -18, 'Personal work.', 'rejected'],
      [10, 14, 'Semester break travel.', 'pending'],
      [-3, -1, 'Fever, going home to recover.', 'approved'],
      [5, 6, 'Passport appointment in the city.', 'pending'],
    ];
    for (const [i, [from, to, reason, status]] of leaveSeeds.entries()) {
      const student = allocated[(i * 5 + 1) % allocated.length];
      const reviewed = status !== 'pending';
      await insert(knex, 'leave_requests', {
        student_id: student.id,
        from_date: isoDate(from),
        to_date: isoDate(to),
        reason,
        status,
        reviewed_by: reviewed ? wardenIds[student.gender] : null,
        reviewed_at: reviewed ? timestamp(-1) : null,
        review_note:
          status === 'rejected' ? 'Insufficient reason provided.' : reviewed ? 'Approved. Return on time.' : null,
      });
    }

    // Notices: [category, targetType, hostelId, targetValues, audience, title, body, pinned]
    const firstMaleHostel = hostels.find((h) => h.gender === 'male');
    const firstFemaleHostel = hostels.find((h) => h.gender === 'female');
    const noticeSeeds = [
      [
        'general',
        'all',
        null,
        [],
        'all',
        'Welcome to the new semester',
        'Hostel rules and timings have been updated. Please read the handbook at the office.',
        true,
      ],
      [
        'maintenance',
        'all',
        null,
        [],
        'male',
        'Boys hostel water maintenance',
        'Water supply will be interrupted on Saturday from 10 AM to 2 PM in all boys hostels.',
        false,
      ],
      [
        'event',
        'all',
        null,
        [],
        'female',
        'Girls hostel cultural night',
        'Cultural night will be held on Friday at 7 PM in the common hall.',
        false,
      ],
      [
        'general',
        'hostel',
        firstFemaleHostel.id,
        [],
        'all',
        'Room inspection this week',
        'Wardens will inspect rooms on Wednesday. Keep your rooms tidy.',
        true,
      ],
      [
        'maintenance',
        'floor',
        firstMaleHostel.id,
        [1],
        'all',
        'First floor power shutdown',
        'Electrical work on the first floor on Sunday, 9 AM to 1 PM. Please charge your devices.',
        false,
      ],
      [
        'academic',
        'year',
        null,
        [1],
        'all',
        'First-year orientation',
        'All first-year students must attend the hostel orientation on Monday at 5 PM in the auditorium.',
        false,
      ],
      [
        'mess',
        'all',
        null,
        [],
        'all',
        'Mess feedback week',
        'Share your feedback about the mess menu with your warden this week.',
        false,
      ],
    ];
    for (const [category, targetType, hostelId, values, audience, title, body, pinned] of noticeSeeds) {
      const noticeId = await insert(knex, 'notices', {
        organisation_id: organisationId,
        category,
        target_type: targetType,
        hostel_id: hostelId,
        audience_gender: audience,
        title,
        body,
        is_pinned: pinned,
        published_by: adminId,
        starts_at: null,
        expires_at: timestamp(30),
      });
      if (values.length) {
        await knex('notice_target_values').insert(values.map((value) => ({ notice_id: noticeId, value })));
      }
    }

    // Mess menus: last month, this month and next month for every hostel (weekly rotation).
    const WEEK_MENU = [
      ['Idli, sambar, chutney', 'Rice, sambar, poriyal, curd', 'Tea, biscuits', 'Chapati, paneer butter masala'],
      ['Poha, banana', 'Veg pulao, raita, papad', 'Coffee, samosa', 'Rice, dal tadka, aloo fry'],
      ['Dosa, chutney', 'Rice, rasam, beans poriyal', 'Tea, bajji', 'Chapati, chana masala'],
      ['Upma, kesari', 'Lemon rice, curd rice, pickle', 'Milk, cookies', 'Veg biryani, onion raita'],
      ['Puri, potato masala', 'Rice, sambar, cabbage poriyal', 'Tea, vada', 'Chapati, mixed veg curry'],
      ['Pongal, vada', 'Rice, kadhi, bhindi fry', 'Coffee, sundal', 'Fried rice, gobi manchurian'],
      ['Aloo paratha, curd', 'Special meals, payasam', 'Juice, cake', 'Chapati, dal makhani'],
    ];
    const today = new Date();
    const menuStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
    const menuEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 2, 0));
    const menuRows = [];
    for (const hostel of hostels) {
      for (let d = new Date(menuStart); d <= menuEnd; d.setUTCDate(d.getUTCDate() + 1)) {
        const [breakfast, lunch, snacks, dinner] = WEEK_MENU[d.getUTCDay()];
        menuRows.push({
          hostel_id: hostel.id,
          date: d.toISOString().slice(0, 10),
          breakfast,
          lunch,
          snacks,
          dinner,
          notes: d.getUTCDay() === 0 ? 'Sunday special' : null,
          updated_by: wardenIds[hostel.gender],
        });
      }
    }
    await knex.batchInsert('mess_menus', menuRows, 200);

    // Hostel booking: first-year students without a room (16, 20, 36, 40). Two pending, one rejected.
    const firstYearUnallocated = students.filter(
      (st) => (st.index % 4) + 1 === 1 && !allocated.some((a) => a.id === st.id),
    );
    for (const [i, st] of firstYearUnallocated.entries()) {
      if (i % 2 === 1) continue; // leave one of each gender free to try the flow
      const preferred = hostels.find((h) => h.gender === st.gender);
      await insert(knex, 'hostel_applications', {
        student_id: st.id,
        preferred_hostel_id: preferred.id,
        preferred_room_type: 'double',
        student_note: 'I would like to stay with my classmates if possible.',
        status: 'pending',
      });
    }

    // Outings: one pending, one approved for later today, one currently out (late), one returned.
    const hoursFromNow = (h) => new Date(Date.now() + h * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    const outingSeeds = [
      [0, 'City market', 'Buy stationery', 4, 7, 'pending'],
      [3, 'Bookstore', 'Pick up textbooks', 2, 5, 'approved'],
      [6, 'Hospital', 'Dental appointment', -5, -1, 'out'],
      [9, 'Bank', 'Open a savings account', -28, -25, 'returned'],
    ];
    for (const [i, destination, reason, outIn, returnIn, status] of outingSeeds) {
      const st = allocated[i % allocated.length];
      const reviewed = status !== 'pending';
      await insert(knex, 'outing_requests', {
        student_id: st.id,
        hostel_id: st.hostelId,
        destination,
        reason,
        out_at: hoursFromNow(outIn),
        expected_return_at: hoursFromNow(returnIn),
        status,
        reviewed_by: reviewed ? wardenIds[st.gender] : null,
        reviewed_at: reviewed ? timestamp(-1) : null,
        checked_out_at: status === 'out' || status === 'returned' ? hoursFromNow(outIn) : null,
        returned_at: status === 'returned' ? hoursFromNow(returnIn - 0.5) : null,
      });
    }

    // Attendance for the last 3 days
    const statuses = ['present', 'present', 'present', 'present', 'absent', 'on_leave'];
    for (let day = 1; day <= 3; day += 1) {
      const rows = allocated.map((student, i) => ({
        student_id: student.id,
        hostel_id: student.hostelId,
        date: isoDate(-day),
        status: statuses[(i + day) % statuses.length],
        marked_by: wardenIds[student.gender],
      }));
      await knex('attendance').insert(rows);
    }

    await insert(knex, 'audit_logs', {
      organisation_id: organisationId,
      user_id: adminId,
      action: 'seed',
      entity: 'organisations',
      entity_id: organisationId,
      meta: JSON.stringify({ note: 'Demo data created by seed' }),
    });
  }
};
