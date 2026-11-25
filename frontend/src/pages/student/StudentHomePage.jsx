import { Link } from 'react-router-dom';
import { BedDouble, CalendarDays, DoorOpen, Megaphone, MessageSquareWarning, Phone, Pin, Users } from 'lucide-react';
import { useMyProfile } from '../../hooks/useStudents';
import { useNotices } from '../../hooks/useNotices';
import { useComplaints } from '../../hooks/useComplaints';
import { useLeaves } from '../../hooks/useLeaves';
import Card, { CardHeader, PageHeader } from '../../components/ui/Card';
import StatCard from '../../components/ui/StatCard';
import EmptyState from '../../components/ui/EmptyState';
import { GenderBadge } from '../../components/ui/Badge';
import OccupancyBar from '../../components/ui/OccupancyBar';
import { formatDate, labelize } from '../../lib/format';

export default function StudentHomePage() {
  const { data: profile, isLoading } = useMyProfile();
  const { data: notices } = useNotices({ limit: 3 });
  const { data: openComplaints } = useComplaints({ status: 'open', limit: 1 });
  const { data: pendingLeaves } = useLeaves({ status: 'pending', limit: 1 });
  const room = profile?.room;

  return (
    <div>
      <PageHeader
        title={profile ? `Hello, ${profile.name.split(' ')[0]}` : 'My room'}
        description={profile ? `${profile.registerNo} · ${profile.department} · Year ${profile.year}` : undefined}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Room"
          value={room ? room.roomNumber : 'Not allocated'}
          icon={DoorOpen}
          tone="indigo"
          hint={room?.hostelName}
          loading={isLoading}
        />
        <StatCard
          label="Open complaints"
          value={openComplaints?.meta?.total ?? 0}
          icon={MessageSquareWarning}
          tone="red"
          loading={!openComplaints}
        />
        <StatCard
          label="Pending leaves"
          value={pendingLeaves?.meta?.total ?? 0}
          icon={CalendarDays}
          tone="yellow"
          loading={!pendingLeaves}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="My room" description="Your current allocation" />
          {isLoading ? (
            <div className="space-y-3">
              <div className="skeleton h-5 w-1/2" />
              <div className="skeleton h-5 w-1/3" />
              <div className="skeleton h-16 w-full" />
            </div>
          ) : !room ? (
            <EmptyState
              icon={BedDouble}
              title="No room allocated yet"
              description="Your hostel office will allocate a room in a hostel for your gender. Check back soon."
            />
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                  <BedDouble className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-gray-900">
                    {room.hostelName} · Room {room.roomNumber}
                  </p>
                  <p className="text-sm text-gray-500">
                    Floor {room.floor} · {labelize(room.roomType)} · since {formatDate(profile.allocatedOn)}
                  </p>
                </div>
                <GenderBadge gender={room.gender} />
              </div>
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Occupancy</p>
                <OccupancyBar occupied={room.occupied} capacity={room.capacity} gender={room.gender} />
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                    <Users className="h-4 w-4" /> Roommates
                  </p>
                  {room.roommates.length === 0 ? (
                    <p className="text-sm text-gray-500">You have the room to yourself.</p>
                  ) : (
                    <ul className="space-y-2">
                      {room.roommates.map((m) => (
                        <li key={m.id} className="text-sm">
                          <p className="font-medium text-gray-800">{m.name}</p>
                          <p className="text-xs text-gray-500">
                            {m.department} · Year {m.year}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                    <Phone className="h-4 w-4" /> Wardens
                  </p>
                  {room.wardens.length === 0 ? (
                    <p className="text-sm text-gray-500">No warden assigned.</p>
                  ) : (
                    <ul className="space-y-2">
                      {room.wardens.map((w) => (
                        <li key={w.id} className="text-sm">
                          <p className="font-medium text-gray-800">{w.name}</p>
                          <p className="text-xs text-gray-500">{w.phone || w.email}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Latest notices"
            action={
              <Link to="/student/notices" className="text-sm font-medium text-primary-600 hover:text-primary-700">
                View all
              </Link>
            }
          />
          {notices?.data?.length ? (
            <ul className="space-y-4">
              {notices.data.map((n) => (
                <li key={n.id}>
                  <p className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                    {n.isPinned && <Pin className="h-3.5 w-3.5 text-primary-600" aria-label="Pinned" />}
                    {n.title}
                  </p>
                  <p className="line-clamp-2 text-sm text-gray-500">{n.body}</p>
                  <p className="mt-1 text-xs text-gray-400">{formatDate(n.createdAt)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Megaphone} title="No notices" description="You're all caught up." />
          )}
        </Card>
      </div>
    </div>
  );
}
