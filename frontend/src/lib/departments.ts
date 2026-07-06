import { LineChart, LucideIcon, Megaphone, Settings2, Wallet } from "lucide-react";
import type { DepartmentKey } from "../types";

export type DepartmentMeta = {
  key: DepartmentKey;
  label: string;
  tagline: string;
  accent: "brand" | "accent" | "success" | "warning";
  icon: LucideIcon;
  module: string;
};

export const DEPARTMENTS: DepartmentMeta[] = [
  {
    key: "sales",
    label: "Sales",
    tagline: "Pipeline, quotes and booked revenue across East Africa accounts.",
    accent: "brand",
    icon: LineChart,
    module: "agent:sales"
  },
  {
    key: "marketing",
    label: "Marketing",
    tagline: "Campaign performance, lead generation and channel ROI.",
    accent: "accent",
    icon: Megaphone,
    module: "agent:marketing"
  },
  {
    key: "finance",
    label: "Finance",
    tagline: "Revenue, accounts receivable, aging and credit health.",
    accent: "success",
    icon: Wallet,
    module: "agent:finance"
  },
  {
    key: "ops",
    label: "Operations",
    tagline: "Support tickets, shipments, inventory and SLA coverage.",
    accent: "warning",
    icon: Settings2,
    module: "agent:ops"
  }
];

export function findDepartment(key: string | undefined): DepartmentMeta | undefined {
  return DEPARTMENTS.find((d) => d.key === key);
}
