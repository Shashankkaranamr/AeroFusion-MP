import {
  CloudSun,
  Database,
  FileChartColumn,
  FlaskConical,
  Info,
  LayoutDashboard,
  MapPinned,
  SlidersHorizontal,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
}

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Monitor",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard, description: "National snapshot & alerts" },
      { href: "/forecast", label: "Forecast", icon: CloudSun, description: "Hourly PM2.5 forecast, up to 4 days" },
      { href: "/live-map", label: "Live Map", icon: MapPinned, description: "NASA satellite map, PM2.5, winds & fires" },
    ],
  },
  {
    label: "Model",
    items: [
      { href: "/model-lab", label: "Model Lab", icon: FlaskConical, description: "Training data, inputs & readiness" },
      { href: "/explainability", label: "Explainability", icon: Sparkles, description: "What drives PM2.5, measured live" },
      { href: "/simulator", label: "What-if Simulator", icon: SlidersHorizontal, description: "Test policy & weather scenarios" },
    ],
  },
  {
    label: "Data",
    items: [
      { href: "/data-sources", label: "Data Sources", icon: Database, description: "6 live sources, NASA imagery & unified tensor" },
      { href: "/reports", label: "Reports", icon: FileChartColumn, description: "Trends, rankings & downloads" },
    ],
  },
];

export const NAV_FOOTER: NavItem[] = [{ href: "/about", label: "About", icon: Info, description: "Team, method & integrity" }];

export const ALL_NAV = [...NAV_GROUPS.flatMap((g) => g.items), ...NAV_FOOTER];

