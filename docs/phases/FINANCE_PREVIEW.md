# Development finance preview

The member finance screen previously reported whether group costs existed; individual charge/payment accounting is not implemented yet. Adding group cost rows cannot demonstrate a member payment view.

This UI review adds a deliberately fictional preview, without writing ledger entries or assigning actual obligations. Files: finance controller/DTO/service, generated API contract, `features/finance-demo.tsx`, member finance page and Persian translations. No tables or migrations.

`GET /api/v1/finance/me` advertises `demoAvailable` only in development for eligible authenticated member scopes with an active membership. `GET /api/v1/finance/demo` goes through PolicyGuard and central self `member_finance/read` access; production/test return 404. Parent, external and technical manager actors cannot use the preview. Existing group finance permissions remain unchanged.

Samples demonstrate a settled camp (1,200,000 toman), a partially paid cultural program (850,000 total / 350,000 paid), and an unpaid book package (280,000). Totals are computed on the API: 2,330,000 share, 1,550,000 paid, 780,000 remaining. Each sample offers an expense breakdown and dated payment history. There are no payment or mutation actions. All amounts are explicitly marked fictional. Production preserves the existing personal finance status screen.

Validation: API and UI typecheck; changed-file lint; 34 PostgreSQL integration tests including preview access, production denial and calculations; Playwright real local API login, three statuses, payment dialog and no horizontal overflow; four screenshots at 390/1440 in light/dark under docs/screens/finance-demo-* inspected.
