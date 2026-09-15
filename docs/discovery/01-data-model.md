# 01 — Data Model Map (fenac-inscricoes, real production system)

Source: `database/migrations/*.php`, `app/*.php` (Eloquent models), and the real production dump `database/backups/festi190_inscricoes.sql` (19 tables). Status/enum values below are **observed real values**, not just what the code implies — parsed directly from the dump.

## `users` (Candidate / participant account)
Purpose: the person who registers and submits inscriptions (musicians/composers), not the organizer.

| Column | Type | Notes |
|---|---|---|
| id | PK | |
| name | string | |
| google_id, facebook_id | string, nullable | social login, unused in practice (no OAuth controller found alongside — verify with fork B) |
| email | string, unique | |
| cpf | string(20), unique, nullable | Brazilian tax ID for individuals. **No CNPJ field exists anywhere in this schema.** |
| document_ex | string, nullable | passport/ID for foreign nationals |
| rg | string(20), nullable | |
| cep, uf, address, number, district, complement | nullable | Brazilian address |
| city_id | FK → cities, nullable | |
| city_ex, zip_code_ex, uf_ex | nullable | address fields for foreign residents |
| phone, phone_alt | nullable | |
| birthday | date, nullable | |
| how_meet | unsigned int, nullable | "how did you hear about us" — real data: 125/131 NULL, values seen: 1,3,5,11,99 (99 likely "other") |
| how_meet_outhers | string(20), nullable | free text when how_meet = other |
| address_file_id | FK → files, nullable | proof-of-address upload |
| nationality_id | FK → countries, default 1 (Brazil) | 131/131 sampled rows = 1 (all Brazilian in this dataset) |
| country_residence_id | FK → countries, default 1 | same, 131/131 = 1 |
| email_verified_at, password, remember_token | auth | |
| timestamps | | **no soft-delete** on users |

Accessors: `clear_cpf` (strips `. , - /`), `clear_birthday` (formatted). Password reset via `App\Notifications\User\ResetPasswordNotification`.

## `admins` (Organizer/staff/jury account)
Fully separate auth guard from `users` (Laravel multi-guard, not a `role` column). Fields: name, email, password, timestamps — no `role`/`status` column at all. In the real dump, 10 admins exist, all undifferentiated — meaning **jury vs. organizer permission separation is NOT modeled in the DB today**; it's either hardcoded, route-middleware based, or entirely absent (confirm with fork B reading the admin controllers/policies).

## `countries` — static reference table, 254 rows (name, name_pt, ISO initials, `bacen` code). Standard Brazilian Central Bank country list.

## `cities` — id, ibge code, name, uf, `status` (boolean, default true, purpose unclear — no observed false values in sample; likely an enable/disable toggle for city pickers).

## `festivals` (one row per yearly edition)
| Column | Notes |
|---|---|
| number, year | e.g. number=56, year=2026 — note number/year can diverge from a simple offset (id 51 was a special "Edição Especial On-Line", id 52 "Edição Especial Minas Gerais" — **festivals aren't strictly sequential by number**, some are special editions) |
| name | free text, inconsistent formatting across years ("48º FESTIVAL...", "54º Festival...", "55 ° Festival...") |
| registration_begin/end | datetime. Model setters force begin→08:00:00, end→18:00:00 on save (business rule baked into the model, not the DB) |
| voting_date_begin/end | datetime, nullable; setters force 00:00:00 / 23:59:59 |
| url_regulation | nullable string |
| situation | smallint, default 1. **Real observed values: `3` (57 of 58 rows — all past editions) and `1` (1 row — the current 2026 edition, id 58).** No `2` observed. Likely 1=draft/open, 3=closed/archived, with an unused middle state — needs confirmation from fork B's controller read. |
| banner_id | FK → files, nullable |
| value_inscription | decimal(8,2), default 0. Real values: **0.00 for all 47 historical editions (1972–2018)**, then 1.00 (2020 special), 20–25.00 from 2021 onward. The fee model is recent. |

58 festival rows exist total, going back to **1972** — but editions before ~2019 are clearly backfilled/historical seed data with minimal fields (no banner, no registration window granularity), not live operational records. Only festivals 48+ have real operational data (files, inscriptions, votes attached).

## `festival_categories` — id, festival_id, name, old_id (nullable legacy pointer). Per-festival award/category labels (e.g. "1º LUGAR", "MELHOR INTÉRPRETE", "CLASSIFICADOS", "NÃO CLASSIFICADOS"). Reused both as **placement awards** and as **status buckets** — same table serves two different concepts depending on festival, which is a modeling smell.

## `festival_grades` — id, festival_id, name, weight (decimal 9,2)
**Important inconsistency found in real data**: for festival 49 (2019) these are clearly quality grades in descending order: `A+`(10), `A`(9), `B+`(8), `B`(7), `C++`(6)... — a jury scoring rubric. But for festival 57 (2025), the names are `On`, `On+`, `On++`, `Tira`, `Sao`, `Perd`, `Três`, `Coqu`, `Nepo`, `Boa` — these read like **abbreviated city names** (São ..., Perdões, Três Pontas, Coqueiral, Nepomuceno, Boa Esperança — small Minas Gerais towns), not quality grades. **The same table/column is being used for two semantically different things in different years.** This needs a direct product decision before design: was `festival_grades` repurposed ad hoc by an admin typing city names into a "grade name" field as a workaround? If so, the new system needs an explicit `FestivalCity`-linked semifinal/heat concept instead of overloading a generic "grade" label.

## `instruments` — static-ish catalog, 40 rows (Violão, Viola, Violino, ... "Outros"). Grew over time (Bateria added 2020).

## `festival_cities` — pivot: festival_id, city_id, date (presentation/heat date in a given city). 100 rows. `InscriptionImpediment` and `InscriptionClassified` both hang off this, not off `cities` directly — meaning "impediment"/"classification" is scoped to a specific (festival, city, date) triple, not just a city.

## `inscriptions` (the core entity — one per song/entry submitted by a user to a festival)
38 columns; key groups:
- **Identity**: festival_id, user_id, type (smallint — **100% of 166 sampled rows = 1**; a second type value is defined in code/migrations intent but not exercised in this data — confirm meaning with fork B), name, interpreter, composers_letter, composers_music (all `longtext NOT NULL`, no nullable — empty string is the "no value" sentinel, not NULL)
- **Media**: letter_music_id, audio_music_id, url_music_youtube, others_instruments, payment_receipt_id (all FK → files except the youtube URL)
- **Consent**: i_agree (boolean, default true — meaning unchecked forms still "agree"?), i_agree_message + log_user_agent (added 2022, looks like a compliance/consent-logging retrofit)
- **Payment**: type_payment (const: 1=DEPOSIT, 2=CREDIT, 3=DEBIT, 9=FREE), status_payment (PagSeguro-specific states 0–7: Pending/Awaiting/Review/Paid/Available/InDispute/Returned/Canceled), hash_link_payment, hash_payment, reference_payment, fee_amount, net_amount, extra_amount. **All 166 sampled rows have status_payment=0 (Pending) and type_payment=1 (Deposit)** — this dump snapshot is mid-cycle for festival 58, before payment reconciliation.
- **Review/classification**: doc_is_verified (0=not verified, 1=verified, 9=irregular — sample shows 165×`0`, 1×`1`), classified (boolean, 100% `0` in sample — classification hasn't run yet for this open cycle), classified_admin_id, classified_city_id, award_id (→ festival_categories), festival_grade_id (→ festival_grades, described by the model comment as "last vote" — denormalized pointer to most recent grade, not a historical log), semifinalist + defined_semifinalist_at, observation_admin
- **Soft delete**: `deleted_at` present (added as a later migration) — inscriptions can be soft-deleted, uniquely among all tables in this schema.
- **Attribution**: how_meet / how_meet_outhers duplicated here too (also on `users`) — same question asked twice, at signup and at inscription time.

Indexes: (id,name,created_at), (id,festival_id,created_at) — read-optimized for admin listing/search.

## `inscription_instrument` — pivot, inscription_id + instrument_id, unique pair. 3096 rows sampled (largest pivot table) — most inscriptions list several instruments.

## `inscription_impediments` — inscription_id, festival_city_id, impediment (boolean, default true). 1630 rows. Records which (festival_city, date) combinations a given entrant is unavailable for — used to avoid scheduling semifinalists on dates they can't attend.

## `inscription_votes` — inscription_id, festival_grade_id, admin_id (juror), observations (longtext, nullable). 713 rows — one row per juror-grade-given-to-an-entry event, i.e. an append-only vote log (not an update-in-place score). This is the real "grading" mechanism; `inscriptions.festival_grade_id` is just a cached pointer to the latest one.

## `inscription_classifieds` — inscription_id, admin_id, festival_city_id, order (smallint). **0 rows in this dump** (final ranking not yet computed for the open cycle) — structure is a simple final-order list per city, admin-assigned.

## `online_inscription_votes` — public/popular vote. name, email, ip, platform, browser, is_desktop (stored as **varchar**, not boolean — schema bug: migration declares `is_desktop` as string default '1' even though semantically boolean), festival_id, inscription_id. Unique constraint on **(festival_id, email)** — one popular vote per email per festival (not per inscription), and **no CPF check here** despite `OnlineInscriptionVote::COOKIE_NAME` suggesting a secondary cookie-based anti-duplicate mechanism layered on top in application code. 0 rows in this dump (voting not open yet in this cycle).

## `files` — id, path, origin, timestamps. 334 rows. **No FK back-reference, no mimetype, no size, no owning user_id** — it's a flat blob-registry that other tables point INTO via their own FK columns (inscriptions.letter_music_id, audio_music_id, payment_receipt_id; users.address_file_id; festivals.banner_id). `origin` is a free-text tag used as a pseudo-type enum, observed values: `ADMIN_FESTIVAL_CADASTRO`, `USER_INSCRICAO_COMPROVANTE_ENDERECO`, `USER_INSCRICAO_LETRA_DA_MUSICA`, `USER_INSCRICAO_AUDIO_DA_MUSICA`, `USER_INSCRICAO_COMPROVANTE_PAGAMENTO`. `path` is a literal relative disk path (`storage/audio/2019/02/05/...mp3`) — direct local-filesystem coupling, no storage-driver abstraction.

## `sessions`, `password_resets`, `admin_password_resets` — Laravel framework plumbing (DB session driver). Not meaningful for migration beyond "don't bother migrating session data."

---

## Notable oddities (flag for architecture design / migration planning)

1. **`festival_grades` semantic drift** (see above) — same table means "quality grade" in 2019 and looks like "city abbreviation" in 2025. Needs a direct product answer before the new schema is designed — this is the single most important thing to clarify with the user.
2. **No CNPJ field anywhere** — confirms this is a purely B2C/individual system today; CNPJ-alphanumeric support is a net-new requirement for the new system, not a migration concern for `users`.
3. **`files.origin` as a free-text pseudo-enum** with no size/mimetype/owner metadata, and raw local paths baked into the `path` column — will need a real `File` value object/entity (type enum, disk, mimetype, size, checksum) to be S3-ready as the user requested.
4. **Admins have no `role`/`status` column** — jury vs. organizer distinction isn't in the data model; likely enforced only in code/routes. Needs confirmation from fork B.
5. **Inconsistent soft-delete usage**: only `inscriptions` has `deleted_at`; `users`, `festivals`, `admins` do not — no audit trail for deleted organizer-managed data.
6. **`is_desktop` stored as varchar instead of boolean** in `online_inscription_votes` — minor but a real inconsistency.
7. **Historical festivals (1972–2018, ids 1–47) are sparse seed rows**, not full operational records — real operational history with files/votes/inscriptions only starts at festival 48 (2018/2019). Migration scope for "histórico de músicas" should likely focus on festivals 48 onward as the meaningful data set, while 1–47 are just a name/year timeline for display purposes.
8. **`inscriptions.type` and payment fields show no variance in the current open cycle's data** (type=1 always, status_payment=0 always) — can't fully validate all enum branches from this snapshot alone; business-rule confirmation should lean on fork B's controller/validation reading, not just this data sample.

Row-count caveat: counts above come from parsing the first INSERT block per table in the dump; mysqldump's extended-insert batching means some tables may have additional batches not captured by this pass — treat counts as representative samples, not exact totals.
