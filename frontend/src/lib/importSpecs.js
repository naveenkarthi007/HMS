/**
 * What each CSV import expects. `columns` drive the help text and the downloadable template;
 * required columns must be present. Exported files use the same column names, so an export can be
 * edited in Excel and imported again.
 */
export const IMPORT_SPECS = {
  organisations: {
    title: 'Import organisations',
    path: '/organisations/import',
    invalidate: ['organisations', 'dashboard'],
    columns: [
      { name: 'name', required: true },
      { name: 'code', required: true, hint: '2-20 letters/digits, unique' },
      { name: 'address' },
      { name: 'contact_email' },
      { name: 'contact_phone' },
      { name: 'is_active', hint: 'yes / no (default yes)' },
    ],
    sample: [
      ['Lakeside College', 'LSC', '1 Lake Road, Mysuru', 'office@lsc.edu', '+91 80 1234 5678', 'yes'],
      ['Hillview Institute', 'HVI', '', '', '', ''],
    ],
  },
  hostels: {
    title: 'Import hostels',
    path: '/hostels/import',
    invalidate: ['hostels', 'rooms', 'dashboard'],
    columns: [
      { name: 'name', required: true },
      { name: 'code', required: true, hint: 'unique in your organisation' },
      { name: 'gender', required: true, hint: 'male / female' },
      { name: 'address' },
      { name: 'is_active', hint: 'yes / no (default yes)' },
    ],
    sample: [
      ['Tagore Hall', 'BH3', 'male', 'North campus', 'yes'],
      ['Meera Hall', 'GH3', 'female', 'South campus', ''],
    ],
  },
  rooms: {
    title: 'Import rooms',
    path: '/rooms/import',
    invalidate: ['rooms', 'hostels', 'dashboard'],
    columns: [
      { name: 'hostel_code', required: true, hint: 'e.g. BH1' },
      { name: 'room_number', required: true, hint: 'unique in the hostel' },
      { name: 'floor', required: true, hint: '0 = ground' },
      { name: 'capacity', required: true, hint: '1-6 beds' },
      { name: 'room_type', required: true, hint: 'single / double / quad' },
      { name: 'status', hint: 'active / maintenance (default active)' },
    ],
    sample: [
      ['BH1', '301', '3', '2', 'double', 'active'],
      ['BH1', '302', '3', '4', 'quad', ''],
    ],
  },
  wardens: {
    title: 'Import wardens',
    path: '/wardens/import',
    invalidate: ['wardens', 'hostels'],
    needsPassword: true,
    columns: [
      { name: 'name', required: true },
      { name: 'email', required: true, hint: 'unique' },
      { name: 'gender', required: true, hint: 'male / female' },
      { name: 'phone' },
      { name: 'hostel_codes', hint: 'separate several with ; e.g. BH1;BH2' },
    ],
    sample: [
      ['Suresh Babu', 'suresh.babu@example.edu', 'male', '+91 90000 33333', 'BH1;BH2'],
      ['Anitha Raj', 'anitha.raj@example.edu', 'female', '', 'GH1'],
    ],
  },
  students: {
    title: 'Import students',
    path: '/students/import',
    invalidate: ['students', 'dashboard'],
    needsPassword: true,
    columns: [
      { name: 'name', required: true },
      { name: 'email', required: true, hint: 'unique' },
      { name: 'gender', required: true, hint: 'male / female' },
      { name: 'register_no', required: true, hint: 'unique in your organisation' },
      { name: 'department', required: true },
      { name: 'year', required: true, hint: '1-5' },
      { name: 'phone' },
      { name: 'guardian_name' },
      { name: 'guardian_phone' },
      { name: 'address' },
      { name: 'date_of_birth', hint: 'YYYY-MM-DD' },
    ],
    sample: [
      [
        'Arun Kumar',
        'arun.kumar@example.edu',
        'male',
        'REG2026101',
        'Computer Science',
        '1',
        '+91 90000 11111',
        'Mr. Kumar',
        '+91 90000 22222',
        '12 MG Road, Pune',
        '2006-04-12',
      ],
      [
        'Bhavana Rao',
        'bhavana.rao@example.edu',
        'female',
        'REG2026102',
        'Electronics',
        '2',
        '',
        'Mrs. Rao',
        '',
        '',
        '2005-09-30',
      ],
    ],
  },
  allocations: {
    title: 'Import allocations',
    path: '/allocations/import',
    invalidate: ['allocations', 'students', 'rooms', 'hostels', 'dashboard'],
    description:
      'Each student is checked for gender, free beds and rooms under maintenance, exactly like a manual allocation.',
    columns: [
      { name: 'register_no', required: true },
      { name: 'hostel_code', required: true },
      { name: 'room_number', required: true },
      { name: 'start_date', hint: 'YYYY-MM-DD (default today)' },
    ],
    sample: [
      ['GIT26015', 'BH1', '201', ''],
      ['GIT26035', 'GH1', '101', '2026-12-01'],
    ],
  },
  mess: {
    title: 'Import mess menu',
    path: '/mess/import',
    invalidate: ['mess'],
    description:
      'Existing menus for the same hostel and date are replaced. Tip: export a month, edit it in Excel and import it back.',
    columns: [
      { name: 'hostel_code', required: true },
      { name: 'date', required: true, hint: 'YYYY-MM-DD' },
      { name: 'breakfast' },
      { name: 'lunch' },
      { name: 'snacks' },
      { name: 'dinner' },
      { name: 'notes' },
    ],
    sample: [
      ['BH1', '2026-12-01', 'Idli, sambar', 'Rice, dal, curd', 'Tea, biscuits', 'Chapati, paneer'],
      ['BH1', '2026-12-02', 'Poha', 'Veg pulao, raita', 'Coffee', 'Rice, rasam'],
    ],
  },
  attendance: {
    title: 'Import attendance',
    path: '/attendance/import',
    invalidate: ['attendance'],
    description: 'The hostel is taken from the student’s current room. Existing marks for the same day are replaced.',
    columns: [
      { name: 'register_no', required: true },
      { name: 'date', required: true, hint: 'YYYY-MM-DD, not in the future' },
      { name: 'status', required: true, hint: 'present / absent / on_leave' },
    ],
    sample: [
      ['GIT26001', '2026-11-24', 'present'],
      ['GIT26002', '2026-11-24', 'on_leave'],
    ],
  },
};
