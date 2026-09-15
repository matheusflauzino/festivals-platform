# 04 — festival-cultural Extras (Diff vs. fenac-inscricoes)

Scope note: `festival-cultural` is a **different client's installation**, forked from the same
original codebase as `fenac-inscricoes` (FENAC's real system) but evolved further and
independently. This document only catalogs what `festival-cultural` has that
`fenac-inscricoes` does **not** — features common to both are documented in `02-business-rules.md`
/ `01-data-model.md`, not here. Nothing in this file is assumed to be in scope for FENAC's
launch; each item ends with a recommendation tag for the user to confirm.

---

## 1. Multi-criteria, multi-stage weighted grading
**Tables/models:** `festival_grade_types` (`FestivalGradeType`), `inscription_vote_grade_types`
(replaces the simpler `inscription_votes` single-grade model for this evolved flow).

`fenac-inscricoes` grades an inscription with one vote/grade per judge (`InscriptionVote` +
`FestivalGrade`). `festival-cultural` generalizes this: a festival defines multiple named grading
**criteria** (`FestivalGradeType`, e.g. "Melodia", "Afinação"), each with a decimal `weight` and a
`stage` (`QUALIFYING_STAGE=1`, `JUDGING_STAGE=2`, `SEMIFINAL_STAGE=3`). Each judge then casts one
`vote` (decimal) per criterion per inscription (`inscription_vote_grade_types`, unique per
inscription+criterion+admin), with an optional free-text `observations`. A `reuse_next` flag on
the grade type lets criteria carry over to the next festival edition instead of being recreated.

This is a meaningfully more sophisticated judging model — multi-stage (heat → semifinal →
final) with weighted multi-criteria scoring — vs. FENAC's current flat single-score-per-judge.

**Recommendation:** unclear, ask user — a national song festival plausibly *wants* multi-stage
weighted judging; worth explicitly asking rather than assuming it's out of scope for FENAC v1.

## 2. Judge assignment & distribution tracking
**Fields/models:** `inscriptions.judged`, `judged_admin_id`, `judged_order`, `judged_city_id`;
controllers `InscriptionJudgedController`, `UnjudgedsInscription`.

Tracks, per inscription, which judge (`judged_admin_id`) evaluated it, in what order
(`judged_order`), whether it's done (`judged` boolean), and which presentation city
(`judged_city_id`) it was judged in. `UnjudgedsInscription` controller surfaces inscriptions still
pending judgment — an operational "queue" screen for organizers to track judging completion by
city/judge.

**Recommendation:** defer — only useful for future multi-tenant sale, unless FENAC's judging
already spans multiple cities/stops (worth a quick confirm since FENAC does have `festival_cities`
in its own schema too).

## 3. Judging/classification commission roles
**Fields:** `admins.classification_commission`, `admins.judging_commission` (booleans).

Splits admin users into two committee roles: one that handles classification/ranking decisions,
another that handles judging/scoring. Purely a permission-flag distinction on top of the existing
`Admin` role system.

**Recommendation:** defer — future tenant feature, unless FENAC's real org structure already
separates these two committees informally (worth a quick confirm).

## 4. Dual/secondary awards + award ceremony records
**Fields/models:** `inscriptions.second_award_id`, `inscriptions.second_final_score` (both
festivals share a base `award_id` field already), plus new table `inscription_awards`
(`InscriptionAward`: `inscription_id`, `festival_category_id`, `final_score`).

`fenac-inscricoes` supports one `award_id` per inscription. `festival-cultural` adds a second
award slot (`second_award_id`/`second_final_score` — e.g. winning two categories at once) and a
separate `inscription_awards` table that records, per category, the final score at award time —
effectively a durable "awards ceremony" ledger decoupled from the live ranking calculation.

**Recommendation:** defer — only useful for future multi-tenant sale, unless FENAC allows a single
song to place in more than one category.

## 5. Per-festival "Types" with classification amount
**Table/model:** `types` (`Type`): `festival_id`, `name`, `classification_amount`.

A festival-scoped lookup entity naming a "type" (purpose unclear from schema alone — likely a
round/phase label, e.g. "Semifinal", "Final") that carries a `classification_amount`: how many
inscriptions advance past that type/phase. No controller found directly wiring this into the
classification algorithm within the routes/controllers grepped — needs a closer read if pursued.

**Recommendation:** unclear, ask user — schema suggests a "how many advance per phase" config,
which could matter for FENAC's classification logic depending on how it currently decides
semifinalist counts.

## 6. Saved custom reports
**Table/model:** `saved_reports` (`SavedReport`): `admin_id`, `route`, `query` (JSON). Controller:
`Admin/SavedReportController`.

Lets an admin save a filtered/parameterized report view (the route + its query-string filters) for
quick recall later, rather than re-entering filters each time.

**Recommendation:** defer — a nice-to-have admin UX feature, not core FENAC functionality; easy to
add later once the new admin dashboard's report/filter UI exists.

## 7. Access & transaction audit logs
**Tables/models:** `access_logs` (`AccessLog`: `user_id`, `admin_id`, `logs` text) and
`transaction_logs` (`TransactionLog`: `method`, `uri`, `admin_id`, `logs` text). Wired via
`app/Http/Middleware/LogRoute.php` on login (`User/Auth/LoginController`,
`Admin/Auth/LoginController`) and mutating admin requests, with dedicated viewer controllers
(`AccessLogController`, `TransactionLogController`, plus a root-level `TransactionLogController`).

General-purpose audit trail: who logged in, and which admin hit which HTTP method+URI and when.

**Recommendation:** relevant to FENAC now (as a general architectural concern) — not because FENAC
needs this exact feature, but because clean-architecture + accountability for an admin panel
usually wants *some* audit log; worth folding into the new system's cross-cutting design rather
than treated as a tenant-specific feature.

## 8. Citizenship proof documents on inscriptions
**Fields:** `inscriptions.interpreter_citizen_proof_id`, `composer_citizen_proof_id` (both FK →
`files`), added 2026-03-08 — the most recent migration in the repo.

Lets an inscription attach a proof-of-(Brazilian?)-citizenship document separately for the
interpreter and the composer roles on a song entry, stored via the existing generic `File` model
(same mechanism as other document uploads).

**Recommendation:** unclear, ask user — this is the newest change in the whole codebase and
resembles a compliance/eligibility requirement (proving citizenship per role) that a *national*
song festival like FENAC plausibly also needs; worth confirming explicitly rather than assuming
it's client-specific.

## 9. Cpf validation rule class
**File:** `app/Rules/Cpf.php` — a Laravel `Rule` class wrapping the existing `is_cpf_valid()`
helper (which both repos already share as a plain helper function).

Not a new capability, just a different code-organization pattern (formal Rule class vs. inline
helper call) for the same CPF validation both systems already do.

**Recommendation:** not a feature — a code-style note only, irrelevant to scope decisions.

---

## Summary for FENAC v1 scoping
Flagged as **worth explicitly asking about** (items 1, 5, 8) rather than deferred outright, since
they plausibly apply to FENAC's actual judging/eligibility rules rather than being specific to the
other client. Item 7 (audit logging) is flagged as a general architecture concern, not a
tenant-specific feature. Everything else (2, 3, 4, 6) is tagged defer/future-tenant.
