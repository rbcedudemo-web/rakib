# Test Report

## 24 Nov 2026 — D2
| Check | Result |
| --- | --- |
| Database security tests, now run with hosted-style privileges (no automatic grants) | 50 / 50 passed: adds website server access, lesson reorder (swap, first/last unchanged), Math teacher cannot reorder Bangla lessons, admin creates chapter + draft lesson + exam settings, no publishing without a video |
| Unit tests: YouTube link formats, video length parse/format (Bangla digits), .srt/.vtt to text, Video Upload validation | 61 / 61 passed (47 shared + 14 web) |
| Typecheck, production build (20 routes) | Passed |
| Screens: Video Upload form desktop and phone, error messages | Checked with Playwright on a mock catalogue |
| Live login (student + admin) on rakib-azure.vercel.app | Passed (checked by Rakib, 23 Nov) |
| Upload to real storage, YouTube length auto-fill | Not run here (supabase.co and YouTube unreachable from the build environment); Rakib checks with the sample lesson |


## 23 Nov 2026 — D1
| Check | Result |
| --- | --- |
| Database security tests (`npm run db:test`, Postgres 17 Supabase image): enrolment rules, student ID, profile guard, subject visibility by class/version/group, question bank hidden from students, ordered unlocking at 50%, storage folders, teacher scope, admin access, visitor access | 42 / 42 passed |
| Seed runs twice without errors | Passed |
| Unit tests: phone numbers (BD formats, Bangla digits), translations, demo OTP, wrong-code limiter, login action branches (new student, enrolled student, phone-only teacher, disabled account, server error) | 38 / 38 passed |
| Typecheck, production build | Passed |
| Screens: login (mobile), enrolment form, `/me` redirects to login when signed out | Checked |
| Login against the real Supabase project | Not run: this build environment cannot reach supabase.co; runs once the site is online |

## 23 Nov 2026 — D0
| Check | Result |
| --- | --- |
| Unit tests (`npm test`): i18n completeness, menu order, academic rules | 7 / 7 passed |
| Typecheck (shared + web) | Passed |
| Production build (`next build`) | Passed, 12 routes |
| Visual check (Playwright screenshots): home BN/EN, mobile menu, design page, profile dropdown | Passed after fixing dropdown overlap on `/design` and logo |

## Issue register
| # | Issue | Status |
| --- | --- | --- |
| 1 | Student dropdown hidden behind second header on `/design` | Fixed |
| 2 | Live site: login failed with 42501 "permission denied for table profiles"; new hosted Supabase projects give API roles no automatic table grants | Fixed: migration `20261123000400_api_grants.sql`, test harness now reproduces hosted defaults |
