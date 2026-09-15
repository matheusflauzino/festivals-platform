# 03 - Screens Inventory: Participant Portal (fenac-inscricoes)

Source: `fenac-inscricoes` — `routes/web.php`, `app/Http/Controllers/User/**`, `resources/views/user/**`.
Auth guard: `auth:user` for most screens (candidate accounts, table `users`). Public/unauthenticated: login, register, password reset, online voting.

---

## Auth

### Login
- Route: `GET/POST login` (`user.login`, Laravel `Auth::routes()` under `user.` prefix)
- Controller/Method: `User\Auth\LoginController`
- View: `user/auth/login.blade.php`
- Purpose: Candidate authentication.
- Fields/Inputs: single "user" field accepting **email OR CPF** (custom auth, not stock Laravel), password, "permanecer logado" checkbox.
- Actions: Acessar (login), link to Register, link to "Esqueceu a senha?".
- Conditional behavior: a commented-out (`@if(false)`) FAQ accordion exists in the markup — dead content, candidate for revival or removal.
- Also present (routed but not read in detail): Google and Facebook social login (`SocialAuthGoogleController`, `SocialAuthFacebookController`) — buttons not found in this login view, so likely wired elsewhere or currently unused/orphaned routes. Flag for the interview.

### Register
- Route: `GET/POST register` (`user.register`)
- View: `user/auth/register.blade.php`
- Fields/Inputs: name, email, CPF, password, password confirmation.
- Actions: Registrar.
- Note: registration here only collects identity basics; the full profile (address, nationality, phone, birthday, etc.) is completed later on the "Meus Dados" edit screen — registration and profile completion are two separate steps.

### Forgot Password (by email)
- Route: `GET/POST password/reset` (`user.password.email`)
- View: `user/auth/passwords/email.blade.php`
- Fields/Inputs: email.
- Actions: Enviar link; link to CPF-based alternative flow ("Não lembra o email?").

### Forgot Password (by CPF) — custom, non-stock Laravel
- Route: `GET password/reset-cpf`, `POST password/cpf` (`user.password.requestcpf` / `user.password.cpf`)
- Controller: `User\Auth\ResetPasswordCpfController` (custom controller, not framework-provided)
- View: `user/auth/passwords/cpf.blade.php`
- Purpose: Recover access via CPF when the candidate doesn't remember which email they registered with — a FENAC-specific UX addition to stock Laravel auth. Important candidate for the new system since CPF is a first-class login identifier here.
- Fields/Inputs: CPF (client-side masked `000.000.000-00`).
- Actions: Enviar link de redefinição.

### Reset Password (token)
- Route: `GET/POST password/reset/{token}` (`user.password.update`)
- View: `user/auth/passwords/reset.blade.php`
- Fields/Inputs: email, password, confirmation, hidden token.

### Email Verification
- Route: standard Laravel `verification.*` (registered via `Auth::routes()`, not explicitly listed in `web.php` but view exists)
- View: `user/auth/verify.blade.php`
- Purpose: stock "check your email" notice. Unclear if actually enforced (no visible middleware gate found in the routes read) — flag as possibly vestigial, same as the admin-side equivalent.

---

## Home / Dashboard

### Home
- Route: `GET home` (`user.home`)
- Controller/Method: `User\HomeController@index`
- View: `user/home.blade.php`
- Purpose: Minimal post-login landing page — currently just a placeholder ("You are logged in!"). Effectively unused as a real dashboard; the real "home" experience is the Inscriptions list.
- Flag: candidate for a real dashboard redesign (status of current festival, deadline countdown, CTA to inscribe).

---

## Profile ("Meus Dados")

### View Profile
- Route: `GET users` (resource index, `user.users.index`)
- Controller/Method: `User\UserController@index`
- View: `user/users/index.blade.php`
- Purpose: Read-only profile summary.
- Fields shown: avatar (Gravatar), email, nationality, CPF+RG (if Brazilian) or foreign document, country of residence, CEP or foreign zip, address, city/UF or foreign city, phone(s), birthday.
- Actions: Edit ("Meus Dados" edit link), "Inscrever uma Música", "Histórico de Inscrições" (the latter link's `href="#"` is broken — points nowhere; should go to `user.inscription.history`).

### Edit Profile
- Route: `GET users/{user}/edit`, `PUT users/{user}` (resource edit/update)
- View: `user/users/edit.blade.php`
- Purpose: The full candidate profile form — this is where most personal-data fields actually live (not on registration).
- Fields/Inputs: name, email, nationality (select), conditional Brazilian block (CPF, RG — RG field is present but `@if(false)`-disabled/hidden), conditional foreign-document block (document_ex), country of residence (select), conditional Brazilian address block (CEP with ViaCEP autolookup button, UF, city — AJAX city list), conditional foreign address block (zip_code_ex, uf_ex, city_ex), address, number, district, complement, phone, phone_alt, birthday, "how did you hear about us" (`how_meet` select — present but `@if(false)`-disabled in current build), proof-of-residence file upload (`vouchers`, image, required if none on file) with delete option once uploaded.
- Actions: Salvar; delete uploaded voucher file (AJAX, `users/remove-file`).
- Conditional behavior: extensive show/hide logic toggling Brazilian vs. foreign fields (and their `required` attributes) based on nationality and country-of-residence selects; CEP lookup auto-fills address/city/UF via ViaCEP public API.
- Flags: RG field and "how did you hear" field are present in markup but wrapped in `@if(false)` — inactive. Decide keep/restore/remove for the new system.

---

## Inscriptions — the core candidate workflow

### My Inscriptions (current festival)
- Route: `GET inscription` (resource index, `user.inscription.index`)
- Controller/Method: `User\InscriptionController@index`
- View: `user/inscriptions/index.blade.php`
- Purpose: List the candidate's own inscriptions (scoped to the currently open festival via `session('festival')`).
- Table columns: #, tipo (áudio/vídeo), nome da música, intérprete, compositor(es), contagem de "impedimentos" (cities where the candidate is unavailable to present, see below), festival number, tipo de pagamento badge, status de pagamento (PagSeguro) badge, ações.
- Actions: "Nova Inscrição", view/print inscription (`user.inscription.show`), "Pagar" (only shown if online-payment type, hash present, and status pending/rejected — links to `inscription.paymentCreate`).
- Conditional behavior: empty state shows an alert with instructions if no inscriptions exist yet.

### New Inscription (main form)
- Route: `GET/POST inscription/create` + `POST inscription` (resource create/store, `user.inscription.create`)
- Controller/Method: `User\InscriptionController@create/store`
- View: `user/inscriptions/create.blade.php` → includes `user/inscriptions/form.blade.php`
- Purpose: The single most important participant screen — submit a song entry.
- Fields/Inputs:
  - Read-only recap of the candidate's registered data (email, CPF/RG or foreign doc, residence country, CEP/zip, address, city, phone, birthday) with a link back to profile edit if something needs correcting.
  - **Tipo** (radio): "Áudio" (type 1) vs "Vídeo" (implicitly type 2, YouTube) — toggles the rest of the form.
  - Nome da música (text, 3–255 chars).
  - Intérprete (textarea, required).
  - Compositor(es) da letra (textarea, required).
  - Compositor(es) da música (textarea, required).
  - Instrumentos (multi-select, `select2`, required unless "Outros" chosen) + "Outros instrumentos" free-text field (shown only when "Outros" selected).
  - Letra da música (PDF upload, required, max ~1MB).
  - **If tipo=Áudio**: audio file upload (mp3/ogg/wav, required, max ~10MB) with instant local preview player.
  - **If tipo=Vídeo**: YouTube URL (required) with a live embedded preview iframe.
  - "Impedimentos" (checkboxes, one per scheduled presentation city/date pulled from the festival's city calendar) — candidate marks dates/cities they are UNAVAILABLE to perform; hidden entirely when tipo=Vídeo (online mode has no live presentation).
  - Tipo de Pagamento (radio): only "Depósitos/PIX" is currently active; "Pagamento Online (PagSeguro)" and "Gratuito" options exist in markup but are `@if(false)`-disabled — i.e. online credit-card payment is coded but currently switched off, deposit/PIX-with-receipt-upload is the only live path.
  - Comprovante de pagamento (image upload, required, shown/hidden based on payment type).
  - "Como conheceu o festival" (select, required) + conditional "Seu Instagram" free-text field (appears for specific "how_meet" answers, mapped to values 4/10/99, but the field label was repurposed to "Instagram" rather than a generic "outros").
  - Regulation agreement checkbox (required, links to `url_regulation`).
  - Optional "aceita receber mensagens" checkbox (`i_agree_message`).
- Actions: "Finalizar Inscrição" (button label changes to "Finalizar Inscrição e Ir para o Pagamento" if online payment were active).
- Conditional behavior: heavy client-side JS drives nearly every section (type toggling, payment-type toggling, instrument "outros" toggling, CEP-independent since this is the inscription not profile form, live audio/video preview). A blocking "Aguarde... enviando arquivos" modal displays on submit given large file uploads.
- Flags: online/credit-card payment path is present in code (client JS, and a full checkout screen — see below) but disabled via `@if(false)` — confirm with the user whether to revive online payment or drop it entirely in the rewrite. "Instagram" repurposing of `how_meet_outhers` is a naming/semantic mismatch worth cleaning up.

### Inscription Receipt / Detail
- Route: `GET inscription/{id}` (resource show, `user.inscription.show`)
- View: `user/inscriptions/show.blade.php`
- Purpose: Printable confirmation/detail of a single inscription.
- Sections: candidate data recap, música data recap, uploaded files (lyrics PDF, audio or YouTube link, payment receipt image) with download/open links, and (if online payment type) a payment summary (transaction hash, amount, status badge).
- Actions: "Inscrever outra Música", "Minhas Inscrições".

### Inscription History (across festival editions)
- Route: `GET inscription/history` (`user.inscription.history`)
- Controller/Method: `User\InscriptionController@history`
- View: `user/inscriptions/histories.blade.php`
- Purpose: All of the candidate's inscriptions across every festival year (vs. the main index which is scoped to the current festival only).
- Table: same columns as the main index but without payment columns, plus a festival-number column; no "impediments"/payment actions.
- Note: reachable only by direct route knowledge — the broken `href="#"` link on the profile screen (noted above) means there's effectively no menu entry pointing here today.

### Deadline-closed notice
- View: `user/inscriptions/deadline.blade.php` (rendered by the create/store flow when outside the registration window, not a distinct route)
- Purpose: Blocks new inscriptions outside `registration_begin`/`registration_end`, shows the allowed window.

### Geographic-restriction notice
- View: `user/inscriptions/lockedstate.blade.php` (rendered conditionally, not a distinct route)
- Purpose: Blocks inscription for candidates outside an allowed state — message is **hardcoded to "Minas Gerais"**, i.e. this restriction is currently FENAC-specific and not data-driven from festival config. Important for multi-tenant generalization — this must become a configurable rule, not a hardcoded string.

---

## Payment (online / PagSeguro — currently disabled path, but fully implemented)

### Payment Checkout
- Route: `GET inscription/payment/{token}` (view) + `POST inscription/payment/{token}` (`user.inscription.paymentCreate` / `paymentCheckout`)
- Controller/Method: `User\InscriptionController@createPayment / checkout`; posts also handled by `User\PagseguroController@notification` (webhook)
- View: `user/inscriptions/payment/create.blade.php`
- Purpose: Full PagSeguro "transparent checkout" (credit card tokenized client-side via PagSeguro JS SDK) — disabled at the form-selection level (see above) but the entire implementation is present and would activate if the payment-type radio were re-enabled.
- Fields/Inputs: read-only recap (name, email, CPF, birthday, address — all `disabled` inputs pre-filled from the user), tipo de pagamento (fixed to "Cartão de Crédito"), CPF do titular, nome do cartão, número do cartão (masked), validade (mm/aaaa), CCV. Order summary sidebar showing festival inscription fee.
- Actions: "Finalizar Pagamento" — client JS opens a PagSeguro session, detects card brand from BIN, tokenizes the card, then submits the form.
- Backend webhook: `POST pagseguro/notification` — receives async payment status updates from PagSeguro (not a user-facing screen).

### Payment Receipt
- Route: `GET inscription/receipt` (`user.inscription.paymentReceipt`) — registered as an inline closure in `web.php` returning the literal string `'receipt'`, separate from the actual view file.
- View file present but unrouted: `user/inscriptions/payment/receipt.blade.php` — **its entire content is `<pre>{{ dd($inscription) }}</pre>`**, a raw debug dump left in the codebase. This is dead/broken code, not a functioning screen — flag clearly for the rewrite (do not carry over as-is; needs a real receipt view or removal).

---

## Public Online Voting ("Votação Popular")

### Voting List
- Route: `GET/POST votacao` (resource index, `user.votacao.index`) — under `OnlineVotingController`, NOT behind `auth:user` (public-facing, though it shares the `user.` route namespace).
- Controller/Method: `User\OnlineVotingController@index`
- View: `user/voting/index.blade.php` (own layout `user.layouts.voting`, distinct from the main app shell)
- Purpose: Public browsing of finalist/classified inscriptions open for popular vote.
- Table columns: categoria (type icon), nome da música, intérprete, compositor(es), candidato, cidade/UF, ação ("Avaliar").
- Note: vote-count display is commented out client-side (`{{-- votos --}}`), i.e. totals are intentionally hidden from the public during voting.

### Cast Vote
- Route: `GET/PUT votacao/{id}/edit` (resource edit/update, `user.votacao.edit` / `.update`)
- View: `user/voting/edit.blade.php`
- Purpose: One-vote-per-person ballot screen for a single finalist entry.
- Fields/Inputs: name, email (both required, both `disabled` — and unconditionally blocked — if `$block_voting` is true).
- Actions: "Votar".
- Conditional behavior: a hidden `key` field is computed as `md5(inscription_id . date('dmY'))` — used server-side (likely with a cookie/session check) to prevent duplicate votes from the same browser/day rather than strictly by CPF/email as the discarded SaaS draft assumed. `$block_voting` flag (server-computed, reason not visible from this view) disables the whole form and shows a warning that the candidate already voted. Confirm actual duplicate-prevention mechanism during backend/business-rules review (likely uses `OnlineInscriptionVote` table keyed by session or IP+day, not verified CPF/email as previously assumed in the discarded draft).

---

## Screen count summary
**23 distinct participant screens/views** identified (including 2 conditional-notice views that aren't separate routes but are distinct rendered states worth treating as screens for design purposes): Login, Register, Forgot Password (email), Forgot Password (CPF), Reset Password, Email Verification, Home, View Profile, Edit Profile, Inscriptions List, New Inscription Form, Inscription Receipt/Detail, Inscription History, Deadline-Closed Notice, Geographic-Restriction Notice, Payment Checkout, Payment Receipt (broken), Voting List, Cast Vote.

## Flags for the improvement interview
1. **`payment/receipt.blade.php` is a raw `dd()` debug dump** — not a real screen. Needs a proper receipt page in the rewrite.
2. Online credit-card payment (PagSeguro transparent checkout) is fully implemented but currently disabled — only bank deposit/PIX-with-uploaded-receipt is live. Decide whether to revive online payment, replace the gateway, or keep manual-receipt-only.
3. Geographic restriction ("only candidates from Minas Gerais") is **hardcoded** in a view rather than driven by festival configuration — must become configurable per festival/tenant.
4. "Histórico de Inscrições" link on the profile page is a dead `href="#"` — should point to the history screen.
5. Home/dashboard screen is a placeholder ("You are logged in!") with no real content — opportunity for a proper dashboard.
6. Google/Facebook social login controllers and routes exist but no visible UI entry point in the login view — confirm if these are live, orphaned, or planned.
7. RG field and "how did you hear about us" field on profile edit are present but disabled via `@if(false)` — decide keep/restore/remove.
8. "How did you hear about us — other" field has been repurposed in the UI to always mean "Instagram handle," which is a semantic mismatch with the underlying `how_meet_outhers` field name/intent.
9. Login accepts both email and CPF in one field, plus a separate CPF-based password-recovery flow — CPF is a first-class identity field in this system, not just a profile attribute; the new system's auth design needs to account for this (and for the equivalent alphanumeric-CNPJ requirement raised for organizations).
10. "Impedimentos" checkboxes on the inscription form mean "dates the candidate is UNAVAILABLE," not availability — naming is inverted from intuition; worth relabeling in the new UI while keeping the underlying business meaning intact for the interview.
