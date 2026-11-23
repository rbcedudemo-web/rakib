export const LOCALES = ["bn", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "bn";

const bn = {
  "app.name": "সবার জন্য ডিজিটাল দূরশিক্ষণ",
  "app.org": "রূপসী বাংলা টেলিভিশন",
  "app.tagline": "ষষ্ঠ থেকে দ্বাদশ শ্রেণির জন্য ঘরে বসে পড়াশোনা",

  "nav.home": "হোম",
  "nav.live": "লাইভ ক্লাস",
  "nav.live.classes": "লাইভ ক্লাস",
  "nav.live.prep": "এসএসসি/এইচএসসি প্রস্তুতি",
  "nav.reports": "রিপোর্টস",
  "nav.community": "কমিউনিটি",
  "nav.terms": "ব্যবহারের নিয়ম",
  "nav.notice": "নোটিশ",
  "nav.contact": "যোগাযোগ",
  "nav.menu": "মেনু",

  "header.search": "পাঠ, বিষয় বা অধ্যায় খুঁজুন",
  "header.login": "লগইন",
  "header.language": "ভাষা",

  "profile.student.profile": "আমার প্রোফাইল",
  "profile.student.dashboard": "ড্যাশবোর্ড",
  "profile.student.courses": "আমার কোর্স",
  "profile.student.progress": "অগ্রগতি",
  "profile.student.exams": "পরীক্ষা ও ফলাফল",
  "profile.student.liveSchedule": "লাইভ সময়সূচি",
  "profile.student.subscription": "সদস্যপদ",
  "profile.student.guardian": "অভিভাবক সংযোগ",
  "profile.student.help": "সাহায্য",
  "profile.settings": "সেটিংস",
  "profile.logout": "লগআউট",
  "profile.teacher.profile": "আমার প্রোফাইল",
  "profile.teacher.dashboard": "শিক্ষক ড্যাশবোর্ড",
  "profile.teacher.classes": "আমার ক্লাস ও বিষয়",
  "profile.teacher.review": "খাতা দেখা ও নম্বর সংশোধন",
  "profile.teacher.studentProgress": "শিক্ষার্থীদের অগ্রগতি",
  "profile.teacher.liveSchedule": "লাইভ সময়সূচি",

  "role.student": "শিক্ষার্থী",
  "role.teacher": "শিক্ষক",
  "role.admin": "অ্যাডমিন",

  "version.bangla": "বাংলা ভার্সন",
  "version.english_version": "ইংলিশ ভার্সন",
  "version.english_medium": "ইংলিশ মিডিয়াম",
  "version.madrasa": "মাদ্রাসা",
  "group.science": "বিজ্ঞান",
  "group.commerce": "ব্যবসায় শিক্ষা",
  "group.arts": "মানবিক",
  "class.label": "শ্রেণি",

  "common.comingSoon": "শীঘ্রই আসছে",
  "common.comingSoon.body": "এই অংশটি তৈরি হচ্ছে। পরের ধাপে যুক্ত হবে।",
  "common.backHome": "হোমে ফিরুন",
  "common.paidOnly": "শুধু সদস্যদের জন্য",

  "home.hero.title": "প্রতিটি শিক্ষার্থীর জন্য মানসম্মত শিক্ষা",
  "home.hero.body": "ভিডিও ক্লাস, পূর্ণাঙ্গ নোট, প্রতিটি পাঠের পরে পরীক্ষা আর সাথে সাথে ফলাফল। প্রশ্ন থাকলে AI শিক্ষক সবসময় পাশে।",
  "home.hero.cta": "শুরু করুন",
  "home.hero.secondary": "নকশা দেখুন",
  "home.feature.video": "ভিডিও ক্লাস",
  "home.feature.video.body": "অভিজ্ঞ শিক্ষকের ক্লাস, পাঠ অনুযায়ী সাজানো",
  "home.feature.exam": "পাঠভিত্তিক পরীক্ষা",
  "home.feature.exam.body": "MCQ ও লিখিত প্রশ্ন, Timer আর তাৎক্ষণিক ফলাফল",
  "home.feature.tutor": "AI শিক্ষক",
  "home.feature.tutor.body": "যেকোনো সময় প্রশ্ন করুন, ধাপে ধাপে বুঝে নিন",

  "footer.rights": "সর্বস্বত্ব সংরক্ষিত",
} as const;

export type MessageKey = keyof typeof bn;

const en: Record<MessageKey, string> = {
  "app.name": "Digital Distance Learning for All",
  "app.org": "Ruposhi Bangla Television",
  "app.tagline": "Learn from home, Class 6 to 12",

  "nav.home": "Home",
  "nav.live": "Live Classes",
  "nav.live.classes": "Live Classes",
  "nav.live.prep": "SSC/HSC Preparation",
  "nav.reports": "Reports",
  "nav.community": "Community",
  "nav.terms": "Terms",
  "nav.notice": "Notice",
  "nav.contact": "Contact",
  "nav.menu": "Menu",

  "header.search": "Search lessons, subjects",
  "header.login": "Login",
  "header.language": "Language",

  "profile.student.profile": "My Profile",
  "profile.student.dashboard": "Dashboard",
  "profile.student.courses": "My Courses",
  "profile.student.progress": "Progress",
  "profile.student.exams": "Exams & Results",
  "profile.student.liveSchedule": "Live Schedule",
  "profile.student.subscription": "Subscription",
  "profile.student.guardian": "Guardian Link",
  "profile.student.help": "Help",
  "profile.settings": "Settings",
  "profile.logout": "Logout",
  "profile.teacher.profile": "My Profile",
  "profile.teacher.dashboard": "Teacher Dashboard",
  "profile.teacher.classes": "My Classes & Subjects",
  "profile.teacher.review": "Review Scripts & Marks",
  "profile.teacher.studentProgress": "Student Progress",
  "profile.teacher.liveSchedule": "Live Schedule",

  "role.student": "Student",
  "role.teacher": "Teacher",
  "role.admin": "Admin",

  "version.bangla": "Bangla Version",
  "version.english_version": "English Version",
  "version.english_medium": "English Medium",
  "version.madrasa": "Madrasa",
  "group.science": "Science",
  "group.commerce": "Business Studies",
  "group.arts": "Humanities",
  "class.label": "Class",

  "common.comingSoon": "Coming soon",
  "common.comingSoon.body": "This section is being built and will arrive in a later stage.",
  "common.backHome": "Back to Home",
  "common.paidOnly": "Members only",

  "home.hero.title": "Quality education for every student",
  "home.hero.body": "Video classes, full notes, an exam after every lesson and instant results. An AI tutor is always there when you have a question.",
  "home.hero.cta": "Get started",
  "home.hero.secondary": "See the design",
  "home.feature.video": "Video classes",
  "home.feature.video.body": "Classes by experienced teachers, ordered lesson by lesson",
  "home.feature.exam": "Lesson exams",
  "home.feature.exam.body": "MCQ and written questions, a timer and instant results",
  "home.feature.tutor": "AI tutor",
  "home.feature.tutor.body": "Ask any time and understand step by step",

  "footer.rights": "All rights reserved",
};

export const messages: Record<Locale, Record<MessageKey, string>> = { bn, en };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function translate(locale: Locale, key: MessageKey): string {
  return messages[locale][key] ?? messages[DEFAULT_LOCALE][key];
}
