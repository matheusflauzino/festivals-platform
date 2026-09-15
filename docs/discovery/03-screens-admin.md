# 03 - Screens Inventory: Admin Portal (fenac-inscricoes)

Source: `fenac-inscricoes` — `routes/admin.php`, `app/Http/Controllers/Admin/**`, `resources/views/admin/**`.
Auth guard: `auth:admin` (single `Admin` role — there is no separate Jury/Organizer role in the DB; `admins` table has no `role` column in this system, unlike `festival-cultural`'s draft assumption). All admin screens operate on a single "current festival" selected via `session('festival_adm')`.

---

## Auth

### Admin Login
- Route: `GET/POST admin/login` (Laravel `Auth::routes()` under `admin.` prefix)
- Controller/Method: `Admin\Auth\LoginController`
- View: `admin/auth/login.blade.php`
- Purpose: Authenticate an admin user.
- Fields/Inputs: email, password, "manter conectado" (remember) checkbox.
- Actions: Login.
- Conditional behavior: Standard Laravel validation error display.

### Admin Forgot Password
- Route: `GET/POST admin/password/email`
- Controller/Method: `Admin\Auth\ForgotPasswordController`
- View: `admin/auth/passwords/email.blade.php`
- Purpose: Request a password-reset email.
- Fields/Inputs: email.
- Actions: Send reset link.

### Admin Reset Password
- Route: `GET/POST admin/password/reset/{token}`
- Controller/Method: `Admin\Auth\ResetPasswordController`
- View: `admin/auth/passwords/reset.blade.php`
- Purpose: Set new password from emailed token.
- Fields/Inputs: email, password, password confirmation, hidden token.
- Actions: Reset password.

### Admin Register
- Route: `GET/POST admin/register`
- Controller/Method: `Admin\Auth\RegisterController`
- View: `admin/auth/register.blade.php`
- Purpose: Self-service admin account creation (no invite flow — open registration, no role assignment field).
- Fields/Inputs: name, email, password, password confirmation.
- Actions: Register.
- Note: no email verification enforced in the view logic seen (verify.blade.php exists but is generic Laravel scaffolding, likely unused/legacy since `VerificationController` route isn't wired in `admin.php`).

---

## Dashboard

### Dashboard / Home
- Route: `GET admin/home` (`admin.home`)
- Controller/Method: `Admin\HomeController@index`
- View: `admin/dashboard/home.blade.php` (composes `summary.blade.php`, `summary_votes.blade.php`, `admin/inscriptions/inscriptions.blade.php`)
- Purpose: Landing page after login — KPI summary + recent inscriptions table.
- Fields/Inputs: none (read-only).
- Widgets/Actions:
  - Total inscriptions (links to inscriptions index)
  - "Documentação não verificada" count (links to inscriptions filtered `unaudited=unaudited`)
  - "Inscrições sem Avaliação" count (links filtered `notgrade=not&audited=audited`)
  - "Inscrições com Avaliações" count (links filtered `grade=yes`)
  - Per-grade vote-count breakdown (`summary_votes` partial), one tile per `FestivalGrade`, links to inscriptions filtered by that grade
  - Embeds the same inscriptions table/preview used on the Inscriptions screen
- Conditional behavior: vote summary tiles only render if votes exist (`@forelse`), else shows "Nenhuma votação foi realizada".

---

## Festivals

### Festivals List
- Route: `GET admin/festivals` (`admin.festivals.index`)
- Controller/Method: `Admin\FestivalController@index`
- View: `admin/festivals/index.blade.php`
- Purpose: List all festival editions (by year/number).
- Fields/Inputs: none (list only).
- Table columns: número, ano, período de inscrição, contagem de cidades (tooltip with city names), situação (color-coded label), ações.
- Actions: Add new, Edit, Delete (AJAX).

### Festival Create / Edit
- Route: `GET/POST admin/festivals/create`, `GET/PUT admin/festivals/{id}/edit` (resource)
- Controller/Method: `Admin\FestivalController@create/store/edit/update`
- View: `admin/festivals/form.blade.php` (shared create/edit partial)
- Purpose: Configure one festival edition — this is effectively the only "festival settings" screen; there is no separate dynamic-fields/settings entity in this codebase (contrary to the discarded SaaS draft).
- Fields/Inputs: number, year, name, registration_begin, registration_end, voting_date_begin, voting_date_end, value_inscription, banner (image upload, required if none exists yet), url_regulation, situation (status select), and a repeatable "Agenda do Evento" sub-form: UF + city (AJAX-populated by `CityController@getCities`) + presentation date, added/removed client-side then submitted as `calendar_city[]` pairs on save.
- Actions: Save; remove banner (`festivals/remove-file`); add/remove city-date row (client-side only until submit).
- Conditional behavior: banner upload field hidden if a banner already exists (shows current image + "Remove" button instead).

---

## Categories (per festival)

### Categories List
- Route: `GET admin/categories` (`admin.categories.index`)
- Controller/Method: `Admin\FestivalCategoryController@index`
- View: `admin/categories/index.blade.php`
- Purpose: List competition categories for the currently-selected festival (`session('festival_adm.id')`).
- Fields/Inputs: none.
- Table columns: nome da categoria, ações.
- Actions: Add, Edit, Delete.

### Category Create / Edit
- Route: resource `admin/categories/{create,edit}`
- Controller/Method: `Admin\FestivalCategoryController`
- View: `admin/categories/form.blade.php`
- Fields/Inputs: name (description). Hidden festival_id tied to session-selected festival; label shows which festival it belongs to.
- Actions: Save.

---

## Grades / Judging Criteria (per festival)

### Grades List
- Route: `GET admin/grades` (`admin.grades.index`)
- Controller/Method: `Admin\FestivalGradeController@index`
- View: `admin/grades/index.blade.php`
- Purpose: List judging criteria ("notas") for the current festival, e.g. "Melodia", "Afinação".
- Table columns: nome, peso (weight), ações.
- Actions: Add, Edit, Delete.

### Grade Create / Edit
- View: `admin/grades/form.blade.php`
- Fields/Inputs: name, weight (integer, min 1). Same festival-scoping pattern as Categories.
- Actions: Save.

---

## Instruments (global, not per-festival)

### Instruments List
- Route: `GET admin/instruments` (`admin.instruments.index`)
- View: `admin/instruments/index.blade.php`
- Table columns: id, name, ações.
- Actions: Add, Edit, Delete.

### Instrument Create / Edit
- View: `admin/instruments/form.blade.php`
- Fields/Inputs: name.

---

## Inscriptions — the core workflow

### Inscriptions List / Triage
- Route: `GET admin/inscriptions` (`admin.inscriptions.index`)
- Controller/Method: `Admin\InscriptionController@index`
- View: `admin/inscriptions/index.blade.php` + partial `inscriptions.blade.php`
- Purpose: Main triage/search screen for all inscriptions of the current festival.
- Filters (GET form): ano, nº de inscrição, data inicial/final, candidato (name), nome da música, nome do compositor, nome do intérprete, UF, cidade, nota/grade (select), tipo de pagamento (select), checkboxes: "documento verificado" (audited), "não auditados" (notgrade), "documento não verificado" (unaudited), "semi-finalistas".
- Table columns: expand icon (opens `inscriptions.blade.php`'s hidden detail row via `admin.inscriptions.info` AJAX — shows interpreter, composers, instruments, palco-mp3 partner URL, email, phone, classification status, "how did you hear about us"), #, ano/número do festival, data de inscrição, tipo (áudio/vídeo icon), candidato, "aceita mensagens" flag, CPF or foreign document, nome da música, status de verificação de documentos, cidade/UF, tipo de pagamento badge, status de pagamento badge (PagSeguro), contagem de votos, nota atribuída, ícone de comentário (tooltip with admin observation), ações (preview player [audio or embedded YouTube], "Avaliar" button → edit screen).
- Actions: Buscar (search), Limpar (clear filters), Preview (modal audio/video player), Avaliar (go to detail/evaluate screen).
- Conditional behavior: shows CPF vs "document_ex" depending on nationality; shows Brazilian city vs foreign city_ex depending on residence country.

### Inscription Detail / Evaluate
- Route: `GET admin/inscriptions/{id}/edit` (resource edit)
- Controller/Method: `Admin\InscriptionController@edit`
- View: `admin/inscriptions/edit.blade.php`
- Purpose: The single most complex admin screen — full candidate + submission review, document verification, audio upload fallback, voting, classification and history.
- Sections/Fields:
  - **Candidate info** (read-only): avatar (Gravatar), name, nationality, CPF/RG or foreign document, address, city/UF or foreign city, CEP/zip, phone(s), email.
  - **Música**: data de inscrição, tipo, nome da música, intérprete, compositor(es) da música/letra, instrumentos (+ "outros instrumentos" free text), "como conheceu o festival".
  - **Document verification**: "Verificar Documentos" button opens an AJAX modal (`GET admin/inscriptions/{id}/docs` → `docs.blade.php`) showing: tipo de inscrição, tipo/status de pagamento (PagSeguro), transação hash, valor pago, comprovante de pagamento image, comprovante de residência image; modal has "Verificado" / "Problema" decision buttons that call `GET admin/inscriptions/{id}/verify/{1|9}`.
  - **Audio/Video da música**: plays uploaded MP3 if present, else shows an upload form (`POST admin.inscriptions.audioUpload`, field `audio_music`, required, filesize/type constrained client-side) — this is the admin-side fallback for uploading audio on the candidate's behalf. For video-type inscriptions, embeds the YouTube URL.
  - **Letra Música**: embedded PDF viewer of uploaded lyrics document, or "fazer upload.." placeholder text (no upload control wired here — likely a gap/incomplete feature).
  - **Histórico**: table of the same candidate's inscriptions across festival editions — festival, data, música, compositores (icon tooltips), observação, semifinalista (yes/no icon), prêmio, ação (view).
  - **Cidades aptas para Apresentação**: read-only table of cities/dates the candidate marked as available/eligible (`InscriptionImpediment` relation, inverted meaning — likely "available cities" not "impediments").
  - **Classificados** (only shown if `$inscription->classified`): Apresentação (assigned city/date), Semifinalista (shows yes/no badge if decided, else embeds `formsemifinalist.blade.php` to set it), Premiação (embeds `formcategory.blade.php` to assign an award/category if semifinalist and not yet awarded, else shows assigned award name, else message "precisa ser semifinalista").
  - **Votação**: embeds `formvote.blade.php` (select a `FestivalGrade` + submit vote) plus a history table of votes (grade, admin who voted, timestamp); free-text "Observação" textarea with its own AJAX save button (`admin.inscriptions.obs`).
  - Delete inscription button (top-right) — blocked client-side with an alert if already classified.
- Actions: verify docs (approve/reject), upload audio, save observation (AJAX), cast vote (`admin.inscriptions.vote`), set semifinalist (`admin.inscriptions.semifinalist`), assign award/category (`admin.inscriptions.category`), delete inscription.
- Sub-views used only via AJAX/include (not standalone routes): `formcategory.blade.php`, `formsemifinalist.blade.php`, `formvote.blade.php`, `info.blade.php` (expandable row detail), `docs.blade.php` (verification modal content).

---

## Classification ("Classificados")

### Classifieds List
- Route: `GET admin/classifieds` (`admin.classifieds.index`)
- Controller/Method: `Admin\InscriptionClassifiedController@index`
- View: `admin/classifieds/index.blade.php` + partial `inscriptions.blade.php`
- Purpose: Bulk-assign semifinalist inscriptions to a presentation city, i.e. finalize the "classification" step separately from the per-inscription detail screen.
- Filters: quantidade (amount, default 120), tipo (categoria/tipo de inscrição select).
- Table columns: checkbox (mark/unmark as classified), #, nota (grade), ano/número, data, tipo, candidato, CPF/doc, música, intérprete, docs verificados, cidade de apresentação (dropdown of available cities once checked, or existing assignment with a delete icon), ações (preview, avaliar, "Classificar" button — disabled until a city is chosen).
- Actions:
  - Check candidate → AJAX-loads available cities for that inscription's festival (`GET classifieds/{inscription}/available-cities`) into a per-row select.
  - "Classificar" → `POST classifieds/{inscription}/classify` with chosen `city_id`.
  - Trash icon on an existing city assignment → `POST classifieds/{inscription}/delete-classify`.
- Conditional behavior: city select and "Classificar" button only become active once the row checkbox is checked.

---

## Reports

### Report: Inscriptions (Datatable/export)
- Route: `GET admin/reports/inscriptions` (view) + `GET admin/reports/inscriptions/data` (server-side JSON for DataTables)
- Controller/Method: `Admin\Reports\InscriptionController@index / anyData`
- View: `admin/reports/inscriptions.blade.php`
- Purpose: Exportable (Excel/CSV/PDF via DataTables buttons) full listing of inscriptions with contact/composer details for offline use.
- Columns: id, festival number, data de inscrição, música, tipo, candidato, intérprete, compositor, "Palco MP3" (partner URL), email, CPF, cidade, UF.
- Actions: Export to Excel/CSV/PDF; paginate/search client-side via DataTables server-side mode.

### Report: Online Voting
- Route: `GET admin/reports/online-voting` (`admin.reports.onlineVoting`)
- Controller/Method: `Admin\Reports\OnlineVotingController@index`
- View: `admin/reports/onlinevoting/index.blade.php`
- Purpose: Read-only listing of inscriptions with their public/online vote counts.
- Columns: #, ano/número, data, tipo, candidato, CPF/doc, música, cidade, contagem de votos online.
- Note: contains a large commented-out PDF-export form (`admin.reports.create`, filtering by city_id + candidate) — feature appears half-removed/disabled, worth flagging as a candidate to either restore or drop.

### Report: Users
- Route: `GET admin/reports/users` (view) + `GET admin/reports/users/data` (DataTables JSON)
- Controller/Method: `Admin\Reports\UsersController@index / anyData`
- View: `admin/reports/users.blade.php`
- Columns: id, nome, email, telefone, data de registro, cidade, "como conheceu" (+free text "outros").
- Actions: Export Excel/CSV/PDF.

### Report: Subscribers List (PDF)
- Route: `GET admin/reports/subscribers-list` (view), `POST admin/reports/subscribers-list/pdf` (generate)
- Controller/Method: `Admin\Reports\SubscribersListController@index / create`
- View: `admin/reports/subscribers/index.blade.php` (form), `subscribers/pdf.blade.php` (PDF template, not directly browsed)
- Purpose: Generate a printable PDF list of subscribers/candidates, filterable by presentation city and candidate name, opened in a new tab.
- Fields/Inputs: city_id (select, required), candidate (text).
- Actions: "Gerar PDF" (opens `target="_blank"` PDF response).
- Note: a `GET reports/subscribers-list/pdf` route exists but is hard-coded to `abort(404)` — dead route.

---

## Users (candidate account administration)

### Admin: Users List
- Route: `GET admin/users` (`admin.users.index`)
- Controller/Method: `Admin\UserController@index`
- View: `admin/users/index.blade.php`
- Purpose: Search/manage candidate (participant) accounts from the admin side.
- Filters: candidato (name), CPF, email.
- Table columns: id, nome, email, CPF, cidade/UF or foreign city, data de registro, contagem de inscrições, ações (edit).
- Actions: Buscar, Limpar, Edit.
- Additional undocumented route: `GET admin/users/duplicate` (`UserController@duplicate`) — no menu link found pointing to it; likely an internal/maintenance tool to find duplicate candidate records. Flag for the interview as a "hidden" admin feature.

### Admin: Edit User
- Route: `GET admin/users/{user}/edit`
- View: `admin/users/edit.blade.php`
- Purpose: Admin-assisted account recovery/correction for a candidate — this is a support tool, not a general profile editor.
- Sections: read-only summary (name, email, CPF, cidade/UF); a form to reset the user's **email** (`PUT admin/users/{user}/email`); a form to reset the user's **CPF** (`PUT admin/users/{user}/cpf`, blank clears it); a delete-user form (`DELETE admin/users/{id}`) — blocked (message only, not enforced client-side) if the user has existing inscriptions.
- Actions: Redefinir Email, Redefinir CPF, Deletar Usuário.

### Admin: Password Reset (self, not per-user)
- Route: `GET/POST admin/users/pass` (`admin.users.pass` / `admin.users.reset`)
- View: `admin/users/pass.blade.php`
- Purpose: appears to be the logged-in admin's own password change screen (route name suggests generic "users" but form posts to `admin.users.reset` with no user id param — likely operates on the authenticated admin).
- Fields/Inputs: password, password confirmation, show/hide toggle.
- Actions: Redefinir Senha.
- Flag: route naming (`users.pass`/`users.reset`) is ambiguous with the candidate-management "Users" section above — worth clarifying/renaming in the new system.

---

## Backups

### Backups List
- Route: `GET admin/backups` (`admin.backups.index`)
- Controller/Method: `Admin\BackupController@index`
- View: `admin/backups/index.blade.php`
- Purpose: Trigger and download full application/DB backups (this is the mechanism that produced `festi190_inscricoes.sql`).
- Table columns: data do backup (parsed from filename), ação (download link, served as a static `/backups/{file}` path rather than through the named `backups.download` route — inconsistency to note).
- Actions: "Realizar Backup" (`admin/backups/create`), "Limpar Antigos" (`admin/backups/clear` — deletes old backup files), download.
- Note: contains a large dead `@section('content2')` block (old pre-refactor markup, unused — AdminLTE `content` section is what actually renders).

---

## Screen count summary
**24 distinct admin screens/views** identified (excluding shared layouts/partials and the 2 dead/unused sections noted above): Login, Forgot Password, Reset Password, Register, Dashboard, Festivals List, Festival Form, Categories List, Category Form, Grades List, Grade Form, Instruments List, Instrument Form, Inscriptions List, Inscription Detail/Evaluate, Classifieds List, Report: Inscriptions, Report: Online Voting, Report: Users, Report: Subscribers PDF, Users List, User Edit, Admin Password Change, Backups List.

## Flags for the improvement interview
1. No role/permission distinction between "organizer" and "jury" admins — every authenticated admin can do everything (manage festivals, verify docs, vote, delete users). Confirm if role-based access is wanted in the new system.
2. "Letra Música" (lyrics PDF) viewer has no visible upload control on the admin side — possible gap.
3. Online Voting report has a large commented-out PDF export feature — decide keep/restore/drop.
4. `admin/users/duplicate` is a route with no UI entry point — undocumented/hidden tool.
5. `admin.users.pass/reset` naming collides conceptually with candidate user management; likely means "my own admin password," needs clarification.
6. Backup download link bypasses the named route (hardcoded `/backups/{file}` path) — inconsistent with `backups.download` route that exists but isn't used.
7. Dead route `reports/subscribers-list/pdf` (GET) hardcoded to 404.
