import {
  Activity,
  BarChart3,
  Bot,
  FileClock,
  FileText,
  FlaskConical,
  Gauge,
  KeyRound,
  Radar,
  ScrollText,
  Server,
  Settings,
  ShieldHalf,
  UserCheck,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { Dictionary } from "@/lib/i18n/ar";

export interface NavItem {
  href: string;
  key: keyof Dictionary["nav"];
  icon: LucideIcon;
}

export interface NavSection {
  key: keyof Dictionary["nav"];
  items: NavItem[];
}

export const NAV: NavSection[] = [
  {
    key: "sectionMonitor",
    items: [
      { href: "/", key: "overview", icon: Gauge },
      { href: "/approvals", key: "approvals", icon: UserCheck },
      { href: "/requests", key: "requests", icon: Activity },
      { href: "/threats", key: "threats", icon: Radar },
    ],
  },
  {
    key: "sectionGovern",
    items: [
      { href: "/engines", key: "engines", icon: ShieldHalf },
      { href: "/policies", key: "policies", icon: ScrollText },
      { href: "/agents", key: "agents", icon: Bot },
      { href: "/resources", key: "resources", icon: Wrench },
      { href: "/identities", key: "identities", icon: KeyRound },
      { href: "/audit", key: "audit", icon: FileClock },
    ],
  },
  {
    key: "sectionPlatform",
    items: [
      { href: "/gateway", key: "gateway", icon: Server },
      { href: "/lab", key: "lab", icon: FlaskConical },
      { href: "/performance", key: "performance", icon: BarChart3 },
      { href: "/reports", key: "reports", icon: FileText },
      { href: "/settings", key: "settings", icon: Settings },
    ],
  },
];

export const ALL_PAGES = NAV.flatMap((s) => s.items);
