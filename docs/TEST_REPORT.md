# Test Report

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
