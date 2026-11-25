export const COMPLAINT_CATEGORIES = ['electrical', 'plumbing', 'cleaning', 'furniture', 'internet', 'mess', 'other'];
export const COMPLAINT_PRIORITIES = ['low', 'medium', 'high'];
export const COMPLAINT_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
export const LEAVE_STATUSES = ['pending', 'approved', 'rejected'];
export const ATTENDANCE_STATUSES = ['present', 'absent', 'on_leave'];

export const NOTICE_CATEGORIES = ['general', 'maintenance', 'mess', 'event', 'academic', 'emergency'];
export const NOTICE_TARGETS = [
  { value: 'all', label: 'All Users' },
  { value: 'hostel', label: 'Hostel-wise' },
  { value: 'floor', label: 'Floor-wise' },
  { value: 'year', label: 'Year-wise' },
];
export const FLOORS = [
  { value: 0, label: 'Ground Floor' },
  { value: 1, label: 'First Floor' },
  { value: 2, label: 'Second Floor' },
  { value: 3, label: 'Third Floor' },
  { value: 4, label: 'Fourth Floor' },
  { value: 5, label: 'Fifth Floor' },
];
export const YEARS = [
  { value: 1, label: '1st Year' },
  { value: 2, label: '2nd Year' },
  { value: 3, label: '3rd Year' },
  { value: 4, label: '4th Year' },
  { value: 5, label: '5th Year' },
];

export const MEALS = [
  { key: 'breakfast', label: 'Breakfast', short: 'B' },
  { key: 'lunch', label: 'Lunch', short: 'L' },
  { key: 'snacks', label: 'Snacks', short: 'S' },
  { key: 'dinner', label: 'Dinner', short: 'D' },
];

export const OUTING_STATUSES = ['pending', 'approved', 'out', 'returned', 'rejected', 'cancelled'];
export const APPLICATION_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'];
export const ROOM_TYPES = ['single', 'double', 'quad'];
