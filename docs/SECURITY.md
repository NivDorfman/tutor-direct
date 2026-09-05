# Security Specification & Threat Model
## TutorDirect - Security Model, Role-Based Access Control (RBAC) & Key Protection

---

### 1. Security Architecture Principles

1. **Defense in Depth:** Multi-layered security checks spanning client-side form validation, server-side payload sanitation, and database constraint enforcement.
2. **Principle of Least Privilege:** Users access only the endpoints, data models, and mutation operations explicitly permitted for their role.
3. **Secret Isolation:** Zero exposure of private API credentials (Gemini API keys, database connection secrets) to client browser bundles.

---

### 2. Role-Based Access Control (RBAC) Matrix

| Resource / Action | Student | Tutor | Admin | Public / Guest |
| :--- | :---: | :---: | :---: | :---: |
| Browse & Search Tutors | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed |
| View Tutor Profiles | ✅ Allowed | ✅ Allowed (Peer Mode) | ✅ Allowed | ✅ Allowed |
| Direct Chat with Tutors | ✅ Allowed | ❌ Restricted (Peer Chat Blocked) | ✅ Allowed | ❌ Requires Login |
| Interact with AI Advisor ("Aiden") | ✅ Allowed | ❌ Restricted | ✅ Allowed | ✅ Allowed |
| Book Lessons & Pay | ✅ Allowed | ❌ Restricted | ✅ Allowed | ❌ Requires Login |
| Edit Tutor Profile & Calendar Slots | ❌ Forbidden (Hidden) | ✅ Own Profile Only | ✅ All Tutors | ❌ Forbidden |
| Accept / Reject Bookings | ❌ Forbidden | ✅ Own Bookings Only | ✅ All Bookings | ❌ Forbidden |
| View & Download Study Materials | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed |
| Upload / Delete Study Materials | ❌ Forbidden | ✅ Own Materials Only | ✅ Full Moderation | ❌ Forbidden |
| Join Live Video Lesson | ✅ Confirmed Booking Only | ✅ Confirmed Booking Only | ✅ Allowed | ❌ Forbidden |
| Request Password Reset OTP | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed |
| View Financial Platform Metrics | ❌ Forbidden | ❌ Restricted (Own earnings only) | ✅ Full Access | ❌ Forbidden |
| Broadcast System Alerts | ❌ Forbidden | ❌ Forbidden | ✅ Allowed | ❌ Forbidden |
| Submit Tutor Reviews | ✅ Verified Lessons Only | ❌ Forbidden (Self & Peer Blocked) | ✅ Moderation | ❌ Forbidden |

---

### 3. API Key & Credential Protection

```
┌────────────────────────────────────────────────────────┐
│                     Browser Client                     │
│    - ONLY public variables: NEXT_PUBLIC_*              │
│    - Never has access to server secrets                │
└──────────────┬───────────────────────────┬─────────────┘
               │ POST /api/ai-consult      │ POST /api/send-otp
               │ (No AI keys passed)       │ (No SMTP keys passed)
┌──────────────▼───────────────────────────▼─────────────┐
│                 Next.js Route Handlers                 │
│    - Reads `process.env.GEMINI_API_KEY` securely       │
│    - Reads `process.env.SMTP_*` credentials securely   │
│    - Calls external providers strictly server-side     │
└────────────────────────────────────────────────────────┘
```

- **Environment Separation:** Sensitive tokens (`GEMINI_API_KEY`, `SMTP_USER`, `SMTP_PASS`, `SUPABASE_SERVICE_ROLE_KEY`) are kept strictly within server-side environments.
- **Strict Verification:** In production builds, missing environment keys trigger controlled fallback mechanisms without exposing stack traces or raw configuration objects to clients.

---

### 4. Threat Mitigation & Input Sanitization

- **Cross-Site Scripting (XSS):** All dynamic user inputs (reviews, student notes, bios, file descriptions) are sanitized and escaped via React's virtual DOM before rendering.
- **Authentication & Credential Protection (Username & Email):**
  - **Sanitized Identifier Queries:** Login identifiers (username or email) are trimmed and normalized before querying. Database lookups use parameterized Supabase PostgREST filters (`ilike`), preventing SQL/query injection.
  - **Timing & Harvest Protection:** Generic, uniform error messages ("שם משתמש/אימייל או סיסמה שגויים" / "Invalid username/email or password") are returned indiscriminately for missing accounts, incorrect passwords, and invalid credentials, preventing username/email harvesting and user enumeration.
  - **Client & Local Cache Isolation:** Passwords stored in local state/cache are strictly validated and never transmitted in plaintext over insecure channels or exposed in public UI elements.
- **File Upload Security (Study Materials & Avatars):**
  - **Filename Sanitization:** Uploaded file names are strictly stripped of dangerous characters (`[^a-zA-Z0-9.-]`) to prevent path traversal or injection attacks.
  - **Storage Isolation:** User avatars and educational documents are stored in designated Supabase buckets (`avatars` and `study-materials`) with distinct path hierarchies per user UUID.
  - **Payload Compression:** User profile pictures are compressed client-side to max 512x512 JPEG (~40KB) via HTML5 Canvas before transmission, preventing denial-of-service via massive image uploads.
- **OTP & Password Recovery Security:**
  - **Single-Use Verification Codes:** 6-digit OTP codes are dynamically generated and verified against the user's registered email.
  - **Password Complexity Enforcement:** Passwords must meet a strict minimum length of 8 characters.
  - **Security Notification:** Whenever a password is reset, an automated alert email is immediately sent to notify the user of the change.
- **Video Classroom Privacy (Live Lessons):**
  - **Isolated Room Names:** Video rooms are deterministically seeded using booking IDs and timestamps (`TutorDirect-[seed]`), preventing uninvited attendees or accidental collisions.
- **Peer Integrity & Anti-Collusion:**
  - **Review Manipulation Prevention:** Tutors cannot submit reviews or assign star ratings to themselves or to competitor tutors. Review submission is restricted to authenticated students with an actual completed or confirmed booking.
  - **Peer Messaging Isolation:** Tutors cannot initiate direct chat sessions or send messages to other tutors.
  - **Profile Configuration Privilege Separation:** Students cannot view, edit, or submit teacher profile settings (hourly price, subjects, levels, study materials). The teacher editing section is completely hidden and guarded in `UserProfileModal`.
- **Prompt Injection Defense:** AI requests are wrapped in an immutable `systemInstruction` boundary, with structured JSON schema inputs preventing adversarial override of system directives.
- **SQL / Query Injection:** Database access relies on parameterized queries and ORM object mapping, eliminating raw string concatenation.
- **Rate Limiting & DoS Protection:** Maximum input string lengths are strictly enforced (e.g., bio capped at 500 chars, notes capped at 300 chars, passwords validated before submission).
