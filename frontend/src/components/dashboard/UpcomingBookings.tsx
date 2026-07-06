import { Calendar } from "lucide-react";
import { Badge, BadgeTone } from "../ui/Badge";

type Booking = {
  name: string;
  email: string;
  issue: string;
  time: string;
  status: "confirmed" | "pending" | "cancelled";
};

const bookings: Booking[] = [
  {
    name: "Sarah Kimani",
    email: "sarah@example.com",
    issue: "Account access problem",
    time: "Mon 09:15 EAT",
    status: "pending"
  },
  {
    name: "James Otieno",
    email: "james@dellkenya.co.ke",
    issue: "Quote approval review",
    time: "Mon 11:30 EAT",
    status: "confirmed"
  },
  {
    name: "Priya Shah",
    email: "priya@mitsumi.co.ug",
    issue: "Invoice reconciliation walkthrough",
    time: "Tue 08:00 EAT",
    status: "confirmed"
  }
];

const statusTone: Record<Booking["status"], BadgeTone> = {
  confirmed: "success",
  pending: "warning",
  cancelled: "danger"
};

export function UpcomingBookings() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl overflow-hidden shadow-sm">
      <div className="h-1 bg-gradient-to-r from-brand to-accent" />
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-display font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-brand" />
              Upcoming Bookings
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              This week · 3 scheduled
            </p>
          </div>
        </div>

        <ul className="space-y-4">
          {bookings.map((b) => (
            <li
              key={`${b.email}-${b.time}`}
              className="pt-4 first:pt-0 border-t first:border-t-0 border-slate-100 dark:border-slate-800"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-display font-semibold text-slate-900 dark:text-white truncate">
                    {b.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{b.email}</p>
                </div>
                <Badge tone={statusTone[b.status]} className="shrink-0 capitalize">
                  {b.status}
                </Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Issue</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 mt-1 truncate">{b.issue}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Local Time</p>
                  <p className="text-sm font-mono text-slate-700 dark:text-slate-300 mt-1">{b.time}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <p className="text-xs text-slate-400">This week · {bookings.length} scheduled</p>
          <button className="text-xs text-brand hover:underline font-medium">View calendar →</button>
        </div>
      </div>
    </div>
  );
}
