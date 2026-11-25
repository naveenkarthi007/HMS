import {
  BedDouble,
  Building,
  Building2,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  DoorOpen,
  Footprints,
  Home,
  LayoutDashboard,
  Megaphone,
  MessageSquareWarning,
  ShieldCheck,
  User,
  UserCog,
  Users,
  UtensilsCrossed,
} from 'lucide-react';

const ORG_ADMIN_NAV = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/hostels', label: 'Hostels', icon: Building },
  { to: '/admin/rooms', label: 'Rooms', icon: DoorOpen },
  { to: '/admin/students', label: 'Students', icon: Users },
  { to: '/admin/applications', label: 'Hostel applications', icon: ClipboardCheck },
  { to: '/admin/allocations', label: 'Allocations', icon: BedDouble },
  { to: '/admin/wardens', label: 'Wardens', icon: ShieldCheck },
  { to: '/admin/hostel-managers', label: 'Hostel managers', icon: UserCog },
  { to: '/admin/mess', label: 'Mess menu', icon: UtensilsCrossed },
  { to: '/admin/outings', label: 'Outings', icon: Footprints },
  { to: '/admin/leaves', label: 'Leaves', icon: CalendarDays },
  { to: '/admin/complaints', label: 'Complaints', icon: MessageSquareWarning },
  { to: '/admin/attendance', label: 'Attendance', icon: CalendarCheck },
  { to: '/admin/notices', label: 'Notices', icon: Megaphone },
];

const MANAGER_NAV = ORG_ADMIN_NAV.filter((item) => item.to !== '/admin/hostel-managers');

/** Sidebar menu per role. */
export const NAVIGATION = {
  super_admin: [
    { to: '/super/dashboard', label: 'Platform overview', icon: LayoutDashboard },
    { to: '/super/organisations', label: 'Organisations', icon: Building2 },
  ],
  org_admin: ORG_ADMIN_NAV,
  boys_hostel_manager: MANAGER_NAV,
  girls_hostel_manager: MANAGER_NAV,
  warden: [
    { to: '/warden/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/warden/students', label: 'Students', icon: Users },
    { to: '/warden/attendance', label: 'Attendance', icon: CalendarCheck },
    { to: '/warden/outings', label: 'Outings', icon: Footprints },
    { to: '/warden/leaves', label: 'Leaves', icon: CalendarDays },
    { to: '/warden/complaints', label: 'Complaints', icon: MessageSquareWarning },
    { to: '/warden/mess', label: 'Mess menu', icon: UtensilsCrossed },
    { to: '/warden/notices', label: 'Notices', icon: Megaphone },
  ],
  student: [
    { to: '/student/home', label: 'My Room', icon: Home },
    { to: '/student/booking', label: 'Hostel booking', icon: ClipboardCheck },
    { to: '/student/mess', label: 'Mess menu', icon: UtensilsCrossed },
    { to: '/student/outings', label: 'Outings', icon: Footprints },
    { to: '/student/leaves', label: 'Leaves', icon: CalendarDays },
    { to: '/student/complaints', label: 'Complaints', icon: MessageSquareWarning },
    { to: '/student/attendance', label: 'Attendance', icon: ClipboardList },
    { to: '/student/notices', label: 'Notices', icon: Megaphone },
    { to: '/student/profile', label: 'Profile', icon: User },
  ],
};

/** Menu sections for the signed-in user; a super admin viewing an org also gets that org's pages. */
export function getNavigation(role, viewingOrg) {
  const sections = [{ items: NAVIGATION[role] || [] }];
  if (role === 'super_admin' && viewingOrg) {
    sections.push({ title: `Viewing ${viewingOrg.code}`, items: NAVIGATION.org_admin });
  }
  return sections;
}
