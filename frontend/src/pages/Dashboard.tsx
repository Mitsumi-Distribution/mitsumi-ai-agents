import { Activity, CalendarCheck, MessagesSquare, Star } from "lucide-react";
import { AgentStatusBar } from "../components/dashboard/AgentStatusBar";
import { RecentSessionsTable } from "../components/dashboard/RecentSessionsTable";
import { StatCard } from "../components/dashboard/StatCard";
import { TaskManager } from "../components/dashboard/TaskManager";
import { UpcomingBookings } from "../components/dashboard/UpcomingBookings";
import { TopBar } from "../components/layout/TopBar";

export function Dashboard() {
  return (
    <>
      <TopBar title="Dashboard" />
      <div className="flex-1 flex justify-center">
        <div className="w-full max-w-7xl px-6 md:px-10 py-8 space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 stagger">
            <StatCard
              label="Total Conversations"
              value="2,841"
              icon={<MessagesSquare className="w-4 h-4" />}
              delta={12.4}
              deltaLabel=" vs last week"
              accent="brand"
            />
            <StatCard
              label="Active Sessions"
              value="36"
              icon={<Activity className="w-4 h-4" />}
              delta={4.8}
              deltaLabel=" vs yesterday"
              accent="success"
            />
            <StatCard
              label="Avg. Rating"
              value="4.6"
              icon={<Star className="w-4 h-4" />}
              delta={-1.2}
              deltaLabel=" vs last week"
              accent="warning"
            />
            <StatCard
              label="Bookings This Week"
              value="12"
              icon={<CalendarCheck className="w-4 h-4" />}
              delta={22.1}
              deltaLabel=" vs last week"
              accent="accent"
            />
          </div>

          <AgentStatusBar />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <RecentSessionsTable />
              <TaskManager />
            </div>
            <div>
              <UpcomingBookings />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
