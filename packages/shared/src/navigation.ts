import type { MessageKey } from "./i18n";

export type Role = "student" | "teacher" | "admin";

export interface NavItem {
  key: MessageKey;
  href: string;
  children?: NavItem[];
}

/** Header menu, in the order Rakib approved on 23 Nov 2026. */
export const MAIN_MENU: NavItem[] = [
  { key: "nav.home", href: "/" },
  {
    key: "nav.live",
    href: "/live",
    children: [
      { key: "nav.live.classes", href: "/live" },
      { key: "nav.live.prep", href: "/live/prep" },
    ],
  },
  { key: "nav.reports", href: "/reports" },
  { key: "nav.community", href: "/community" },
  { key: "nav.terms", href: "/terms" },
  { key: "nav.notice", href: "/notice" },
  { key: "nav.contact", href: "/contact" },
];

export const PROFILE_MENU: Record<Exclude<Role, "admin">, NavItem[]> = {
  student: [
    { key: "profile.student.profile", href: "/me/profile" },
    { key: "profile.student.dashboard", href: "/me" },
    { key: "profile.student.courses", href: "/me/courses" },
    { key: "profile.student.progress", href: "/me/progress" },
    { key: "profile.student.exams", href: "/me/exams" },
    { key: "profile.student.liveSchedule", href: "/live" },
    { key: "profile.student.subscription", href: "/me/subscription" },
    { key: "profile.student.guardian", href: "/me/guardian" },
    { key: "profile.student.help", href: "/help" },
    { key: "profile.settings", href: "/me/settings" },
    { key: "profile.logout", href: "/logout" },
  ],
  teacher: [
    { key: "profile.teacher.profile", href: "/teacher/profile" },
    { key: "profile.teacher.dashboard", href: "/teacher" },
    { key: "profile.teacher.classes", href: "/teacher/classes" },
    { key: "profile.teacher.review", href: "/teacher/review" },
    { key: "profile.teacher.studentProgress", href: "/teacher/students" },
    { key: "profile.teacher.liveSchedule", href: "/live" },
    { key: "profile.settings", href: "/teacher/settings" },
    { key: "profile.logout", href: "/logout" },
  ],
};
