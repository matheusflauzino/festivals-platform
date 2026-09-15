# 02 — Business Rules & Functional Requirements (fenac-inscricoes, real code)

Source: `fenac-inscricoes` Laravel app — routes (`web.php`, `admin.php`, `api.php`), all controllers under `app/Http/Controllers/{User,Admin}`, `app/Inscription.php` constants, `config/util.php`, validated against the real production dump `festi190_inscricoes.sql`.

## 1. Auth & Registration

- Two independent guards: `user` (candidate) and `admin` (organizer/jury), each with its own login, password-reset, and `Auth::routes()` under separate namespaces. No shared users table.
- Participant registration (`User/Auth/RegisterController@validator`): `name` required max 255; `email` required unique; `cpf` **required**, max 14 (`000.000.000-00` format, string, not validated as a real CPF checksum — just presence/uniqueness), unique across users; `password` min 6, confirmed. No CNPJ field anywhere in this legacy system — CPF only, always required at registration regardless of nationality.
- Extra CPF-based password reset flow: `password/reset-cpf` + `password/cpf` (`Auth\ResetPasswordCpfController`) — lets a user reset password by CPF, not just email.
- Social login stubs exist for Google and Facebook (`SocialAuthGoogleController`, `SocialAuthFacebookController`) — present in routes but worth checking adoption/actual use before porting.
- Profile completion gate: `is_complete_data_user($user)` helper blocks access to `inscription/create` and `inscription/index` until the user completes extended profile data (address, phone, nationality docs) via `UserController@update`.
- **Nationality/residence conditional validation** (`UserController@update`): if `nationality_id == 1` (Brazilian) → `cpf` required+unique, `document_ex` cleared; else → `document_ex` required, `cpf`/`rg` cleared. Independently, if `country_residence_id == 1` (resides in Brazil) → `cep`/`city_id` required, foreign-residence fields cleared; else → foreign fields required, `cep`/`uf`/`city_id` cleared. These two axes (nationality vs. residence country) are orthogonal and both drive which fields are required — this dual-axis logic must be preserved in the new system's dynamic form validation.

## 2. Inscription Submission (`User\InscriptionController@store`)

- Gated by `isDateInscription()`: compares `now()` (America/Sao_Paulo) against `festival.registration_begin`/`registration_end`; outside window → "deadline" view, no submission allowed.
- Must pass `validTokenFestival($festival_id, $festival_token)` — a signed token check (`token_festival()` helper) to ensure the form was generated for the currently active festival (anti-tampering for stale/cached forms).
- Two inscription **types** (`config('util.type_inscriptions')`): `1` = "Presencial (Arquivo MP3)", `2` = "Online (Vídeo do Youtube)".
  - Type `1`: `audio_music` file required implicitly (max 10000 KB, no mime restriction enforced in the active validator — a commented-out line shows `mimetypes:audio/mpeg,audio/mp3` was disabled), and the inscription attaches to `impediments` (blocked presentation cities).
  - Type `2`: `url_music_youtube` required + must be a valid URL. No impediments attached (only relevant when performing live in a specific city).
- Always required: `name` (song name, max 255), `interpreter` (max 1024), `composers_letter` (max 1024), `letter_music` file (PDF only, max 1000 KB), `how_meet` (how they heard about the festival).
- `composers_music` is optional but defaults to `'.'` (a placeholder dot) if empty — a real data-quality smell to fix in the new system (should be nullable, not `.`).
- `others_instruments` free text max 100; `instruments` is a many-to-many (`inscription_instrument` pivot) but not required by validation (commented out).
- **Payment**: `type_payment` — constants `PAYMENT_DEPOSIT=1`, `PAYMENT_CREDIT=2`, `PAYMENT_DEBIT=3`, `PAYMENT_FREE=9`. A `payment` (proof-of-deposit image, jpeg/png max 300KB) is required only when: user's `country_residence_id != BRAZILIAN` AND `type == 2` is false, i.e. effectively when paying by bank deposit and not the online-video-international case — the exact boolean is inverted/confusing in the source (`Auth::user()->country_residence_id != User::BRAZILIAN && $request->type == 2 || $request->type_payment != Inscription::PAYMENT_DEPOSIT ? '' : 'required...'`) — **flag as fragile, re-derive intent with the user rather than port literally**.
- On success: creates `File` rows for letter/audio/payment (not the file directly — indirection through a `File` model + `origin` tag), creates the `Inscription`, attaches instruments and (for type 1) impediments, all inside a DB transaction with manual rollback on exception.
- If `type_payment != PAYMENT_DEPOSIT`: generates an encrypted payment token (`Crypt::encrypt(['inscription_id','user_id','date_inscription'])`) and a random MD5 `reference_payment`, then redirects to the online payment flow instead of the "done" page.
- Sends `InscriptionConfirmedNotification` to the user always (best-effort — wrapped in try/catch, logs but never fails the request), and additionally emails `OrderShipped` (payment link) when an online payment is required.

## 3. Payment (PagSeguro integration, `User\InscriptionController@checkout` + `PagseguroController`)

- Uses the legacy `artistas/pagseguro` package for credit-card tokenized checkout (`senderHash`, `creditCardToken` supplied client-side by PagSeguro JS).
- Status constants mirror PagSeguro's own status codes: `PAGSEGURO_STATUS_PENDING=0, AWAITING=1, REVIEW=2, PAID=3, AVAILABLE=4, IN_DISPUTE=5, RETURNED=6, CANCELED=7`. These are stored verbatim in `inscriptions.status_payment` — i.e. the domain model is coupled directly to a specific gateway's vocabulary. **The new system should introduce its own gateway-agnostic payment-status enum** and map provider statuses onto it.
- `fee_amount`, `net_amount`, `extra_amount` captured directly from PagSeguro's response.
- A webhook endpoint exists (`POST pagseguro/notification`) for async status updates from PagSeguro.
- Payment token URL is time-unbounded (encrypted token, no expiry check) but ownership-checked (`Auth::user()->id != decrypted['user_id']` → 403).

## 4. Document Verification (Admin)

- `doc_is_verified` states: `DOC_STATUS_NOT_VERIFY=0`, `DOC_STATUS_VERIFY=1`, `DOC_STATUS_IRREGULAR=9`.
- `Admin\InscriptionController@verifyDocs`: admin flips this status; if set to `VERIFY`, **also force-sets `status_payment = PAGSEGURO_STATUS_PAID`** as a side effect — i.e. verifying documents for a deposit-payment inscription is how the admin manually marks it paid. This coupling (doc verification → payment status) is a hidden but important rule.
- A code comment in `vote()` shows this rule evolved: *"foi removido a verificação em 2021 para não precisar validar as docs"* (doc-verification gating on jury voting was removed in 2021) — the check is now hardcoded to always pass (`if (true)`). The new system should make this an explicit configurable policy per festival, not a hardcoded bypass.

## 5. Jury Voting & Grading (`Admin\InscriptionController@vote`)

- A jury member (any `admin` guard user — no separate "jurado" role/permission enforced in code beyond the shared `auth:admin` middleware) posts a `festival_grade_id` for an inscription. This creates an `InscriptionVote` row (`admin_id`, `festival_grade_id`) **and** overwrites `inscriptions.festival_grade_id` with the same value — so only the *latest* vote is reflected on the inscription itself; historical votes live only in `inscription_votes`.
- `FestivalGrade` here is **not** a scoring criterion/rubric — it's a simple named+weighted outcome tag per festival (e.g., a classification label), created via plain CRUD (`name`, `weight` integer). This is materially different from `festival-cultural`'s `FestivalGradeType`/`InscriptionVoteGradeType` (multi-criteria rubric scoring) — confirms these are genuinely different feature sets between the two clients, not just versions of the same thing.
- `category()` action (misleadingly named) sets `inscription.award_id` from `request->awards` — awarding is a single free-standing field, no `InscriptionAward` table in this codebase (that only exists in `festival-cultural`).
- `semifinalist(Request, Inscription)`: boolean toggle + `defined_semifinalist_at` timestamp, admin-only, no validation beyond auth.

## 6. Classification / Final Ranking (`Admin\InscriptionClassifiedController`)

- **Not** a computed/automatic ranking. The "list" (`index`) is a raw hand-written SQL query (not query-builder) that joins inscriptions to their *latest* vote (`order by inscription_votes.created_at desc limit 1` correlated subquery) and to their assigned `classified_city_id` — i.e. it's an admin worklist, not a scoring engine.
- Classifying an inscription (`classify()`) is a **manual admin action**: pick a `city_id` from the festival's available presentation cities (filtered by that inscription's own impediments — a candidate cannot be classified into a city they're impeded from), sets `classified=true` and `classified_city_id`. No automatic tie-breaking, no score-threshold logic in code — ranking/selection is entirely an editorial decision made by staff using the vote list as reference, not an algorithm. This is an important finding: **do not build an automatic ranking algorithm unless the user explicitly wants one** — the legacy behavior is manual curation.
- `deleteClassify()` requires the request's `city` param to match the currently-set `classified_city_id` before allowing removal — a defensive check against stale UI state.
- `Inscription` model has a `classified` relationship/flag checked before deletion (`Admin\InscriptionController@destroy` refuses to delete a classified inscription).

## 7. Public/Online Voting (`User\OnlineVotingController`)

- Scope: only inscriptions with `doc_is_verified == 1` on the currently active festival (`festivals.situation == 1`, latest by year/number) are votable — pulled fresh on every request, not cached.
- **Dedup enforcement is a DB-level unique constraint** `unique(festival_id, email)` on `online_inscription_votes` — *not* CPF, not IP, not session. The controller relies on catching `QueryException` from the constraint violation to show "you already voted" — there is no pre-check query, so this is enforced entirely by the database, which is easy to accidentally lose in a migration if the unique index isn't carried over.
- A secondary UX-only guard: a cookie (`OnlineInscriptionVote::COOKIE_NAME` = festival id) is set after a successful vote and checked to visually disable the form — **not a security control**, trivially bypassed by clearing cookies (real enforcement is the DB constraint above).
- A per-request anti-tamper "key" is validated: `$request->key != md5($id . date('dmY'))` — this is a same-day, predictable token (no server secret involved beyond the inscription id and today's date), effectively obscurity, not real integrity. **Flag as insecure — do not port as a real security control.** Replace with a signed token (HMAC with server secret) or drop it in favor of proper CSRF + the DB constraint.
- Basic bot filtering via `Jenssegers\Agent` (`$agent->isRobot()`) checked against the User-Agent string only — trivially spoofable, best-effort only.
- Vote payload also stores `ip`, `platform`, `browser`, `is_desktop` for audit/analytics, no further use found.

## 8. Admin CRUD & Festival Management

- Standard resourceful CRUD for `festivals`, `instruments`, `categories` (`FestivalCategory`), `grades` (`FestivalGrade`) — no special business rules beyond required-field validation, all scoped by `session('festival_adm.id')` (the admin's currently-selected festival, stored in session, **not** a request-scoped tenant/festival parameter — this session-based "current festival" pattern is how single-tenant assumptions are baked into the whole admin area and needs to be replaced by explicit route/context scoping in the multi-tenant redesign).
- `Admin\InscriptionController@index` is a large ad-hoc filter builder (11+ optional filters: id, payment type, music name, semifinalist flag, candidate name, composer, interpreter, city, date range, grade, UF, doc-verification state) built with `->when()` chains directly on the Eloquent query — a good candidate for the new system's structured filter/query-object pattern instead of chained conditionals.
- Users report/admin (`Admin\UserController`) allows admin to directly reset a user's password (`users/pass`), and directly overwrite a user's `email` or `cpf` (`PUT users/{user}/email`, `/cpf`) — support/backoffice operations with no extra confirmation step or audit log found beyond `AccessLog`/`TransactionLog` (those tables only exist in `festival-cultural`, not here) — i.e. **fenac-inscricoes has no audit trail for these sensitive admin overwrites**. Worth deciding deliberately whether the new system adds one (recommended).
- Backups (`Admin\BackupController`): manual DB backup create/download/clear from the admin panel — a legacy ops convenience, likely replaced by proper automated backups in the new infra rather than an in-app feature.

## 9. Email Triggers

- `InscriptionConfirmedNotification` (queued Notification) → sent to the user immediately after any successful inscription (best-effort, failures logged not surfaced).
- `OrderShipped` (Mailable) → sent when an online payment link is generated (i.e. `type_payment != PAYMENT_DEPOSIT`), contains the payment link.
- `OrderPaymentConfirmed`, `OrderPaymentNotApproved` (Mailables) exist but were **not** found wired to a controller call in the files read — likely triggered from the PagSeguro webhook (`PagseguroController@notification`, not yet inspected in depth) or a queued job; needs a follow-up check before assuming they're dead code.
- `ResetPasswordNotification` (custom, User) → overrides Laravel's default reset email, presumably for branding/copy.

## 10. File Storage

- All uploads (`letter_music`, `audio_music`, `payment` receipt, `vouchers`) go through a duplicated private `upload()` method (copy-pasted across 3 controllers — a clear extract-and-reuse candidate) that: generates a random filename (`uniqid(date('HisYmd')) + original extension`), stores under `{type}/{Y}/{m}/{d}/` via `Storage::storeAs`, then persists a `File` row (`path`, `origin` tag) rather than storing the path directly on `Inscription`/`User` — file identity is always indirected through the `File` model. The new local-storage-now/S3-later abstraction should preserve this indirection (a `File`/asset entity with a storage-key, not raw paths on the owning entity) since it already matches a clean-architecture-friendly shape.

## Flags for the user (surprising / fragile / worth deciding explicitly)

1. **Online-voting anti-tamper "key" is a predictable MD5(id+date), not real security** — recommend replacing, not porting as-is.
2. **Payment file-required validation boolean is confusing/likely buggy** (`InscriptionController@store`) — needs the user's intent re-confirmed rather than literal translation.
3. **Classification/ranking is 100% manual curation by staff**, not an algorithm — confirm this is still the desired behavior before building anything automatic.
4. **Doc-verification → payment-status coupling** and the **2021 removal of doc-verification gating on jury voting** are both undocumented-outside-code business decisions — worth confirming they still hold.
5. **No audit log** on admin's direct email/CPF/password overwrites for users in this codebase (unlike `festival-cultural`, which has `AccessLog`/`TransactionLog`) — recommend adding one.
6. **"Current festival" is session-based global state** in the admin area, not scoped per-request — this pattern cannot carry over as-is into a multi-tenant design and needs an explicit replacement (e.g. festival/tenant in the URL or JWT claim).
7. `composers_music` defaulting to the string `'.'` when empty is a data-quality smell from the legacy DB worth cleaning up during migration, not preserving.
