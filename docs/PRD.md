# Product Requirements Document (PRD)
## TutorDirect - Private Tutoring Marketplace & AI Academic Advisor Platform

---

### 1. Executive Summary & Vision
**TutorDirect** is an end-to-end marketplace connecting students with verified, top-tier private tutors across a wide variety of subjects (Mathematics, Computer Science, English, Physics, Chemistry, Languages, and more).

The platform bridges modern scheduling convenience, secure lesson booking, real-time messaging, and comprehensive administrative oversight with an **AI Academic Advisor ("Aiden")** powered by Google Gemini. The advisor analyzes student needs, budgets, and subject matter to recommend the best tutors instantly.

---

### 2. User Roles & Personas

| Role | Target Audience | Primary Needs & Workflows |
| :--- | :--- | :--- |
| **Student** | High school, university students, and parents | Search/filter tutors, consult AI advisor, book calendar slots, make simulated credit card payments, join video lessons, review tutors after completed lessons, manage student profile (avatar, password, language). |
| **Tutor** | Professional educators, teaching assistants | Manage weekly availability slots, configure hourly rates and study levels, manage study materials, accept/reject booking requests, view earned revenue, host lessons, manage student communications, browse and view peer tutor profiles (with communication and review restrictions). |
| **Admin** | Platform operations team | Monitor revenue metrics, approve/manage users and tutors, track system health, oversee lessons, send platform-wide announcements. |

---

### 3. Core Functional Requirements

#### 3.1. Tutor Discovery & Marketplace
- **Dynamic Search & Filtering:** Filter by subject, price range (hourly rate slider), minimum star rating, lesson format (Online / In-Person), and verified badges.
- **Sorting Options:** Highest rated, lowest price, highest price, most reviews.
- **Detailed Tutor Profiles:** Biography, education background, hourly rate, lesson location, experience years, verified reviews, and interactive booking calendar.
- **Peer Tutor Profile Viewing:** Tutors are permitted to view full profiles of peer tutors across the marketplace (to observe subjects, levels, materials, and credentials) with an informative peer-tutor banner, while peer messaging and reviewing controls remain strictly disabled.

#### 3.2. Booking Engine & Availability Management
- **Weekly Schedule Matrix:** Tutors configure granular daily time slots (e.g., Sunday 16:00, Tuesday 18:00).
- **Conflict Prevention:** Instant booking locks prevent double-booking.
- **Booking Flow:** Select lesson format, choose date/time, add student notes, confirm simulated payment.
- **Status Lifecycle:** `Pending` → `Confirmed` → `Completed` / `Cancelled`.

#### 3.3. AI Academic Advisor ("Aiden")
- **Intelligent Consultation:** AI chatbot powered by Gemini with custom system prompt and full real-time database context.
- **Accurate Mathematical Queries:** Correctly sorts and recommends tutors for queries like "most expensive math tutor", "cheapest computer science teacher", or "highest rated physics educator".
- **One-Click Profile Access:** Direct "View Profile" action buttons embedded for each recommended tutor.
- **Resilient Fallback Engine:** Multi-model fallback (`gemini-3.5-flash`, `gemini-2.5-flash`) + local rule-based sorting fallback in case of API rate limits or network issues.

#### 3.4. Simulated Secure Checkout & Financial Ledger
- **Payment Processing:** Integrated modal supporting simulated credit card payments with validation.
- **Student Balance / Wallet:** Credit system for instant booking debit and refund processing upon cancellation.
- **Tutor Earnings Tracking:** Clear visibility into net earnings, platform commission rates, and pending payouts.

#### 3.5. Real-Time Chat & Communications
- **Direct Messaging:** Live chat interface between students and tutors with real-time updates.
- **Student-Tutor Interaction Exclusivity:** Chat initiating and message sending are reserved strictly for student-tutor interactions. Peer tutors cannot initiate chats or send direct messages to other tutors.
- **Quick Actions:** Tutors and students can discuss lesson objectives, share homework files, and send video meeting links directly within the chat.

#### 3.6. Rating & Review System
- **Verified Student Reviews Only:** Only authenticated students with an actual completed/confirmed lesson (`Completed` / `Confirmed` - `הושלם` / `מאושר`) with the tutor are eligible to submit reviews (1 to 5 stars + written feedback).
- **Anti-Collusion & Peer Protection:** Tutors are strictly prohibited from submitting reviews for themselves or for any peer tutors on the platform, preventing conflicts of interest and review tampering.
- **Single Review Limit:** Each student is permitted one review per tutor.
- **Automatic Rating Calculation:** Tutor average score and total review counter recalculate dynamically in real time.

#### 3.7. User Profile & Role Isolation
- **Student Profile View:** Students access only personal user settings (avatar, username, password change, language preferences). Teacher profile editing sections are cleanly suppressed and protected.
- **Teacher Profile View:** Tutors access complete profile editing controls (hourly rate, teaching levels, subjects, bio, education, experience, study materials) alongside user credentials.

#### 3.8. Comprehensive Admin Dashboard
- **Business KPI Metrics:** Total platform revenue, active bookings, registered tutors, student retention rates.
- **User Management:** View, search, activate, or suspend tutor and student accounts.
- **System Announcements:** Broadcast platform-wide messages to all active sessions.

#### 3.9. Internationalization & Localization (i18n)
- Seamless toggle between **Hebrew (RTL)** and **English (LTR)**.
- Complete translation coverage for all UI components, buttons, error messages, and currency formatting (₪ ILS / $ USD).

#### 3.10. Study Materials Repository (ספריית חומרי לימוד וקבצים)
- **Categorized Educational Content:** Tutors can upload and manage materials categorized into Formula Sheets (`דף נוסחאות`), Lesson Summaries (`סיכום שיעור`), Presentations (`מצגת`), Worksheets (`דף עבודה`), and General Documents.
- **Rich Metadata & Download Flow:** Instant preview of file format (PDF, PPT, DOC, XLS, images), file size badge, title, and descriptive overview.
- **Dual-Layer Persistence:** Files are uploaded to Supabase Storage (`study-materials` bucket) with immediate sync to the relational `study_materials` table. In offline or unconfigured environments, falls back gracefully to client-side data URLs without blocking user productivity.

#### 3.11. Interactive Live Classroom & Whiteboard (חדר שיעור חי בווידאו ולוח שיתופי)
- **WebRTC Video Conferencing:** Seamless, low-latency live video and audio powered by the integrated Jitsi React SDK (`LiveLessonModal`).
- **Interactive Collaborative Tools:** Built-in shared whiteboard, screen sharing, and meeting chat accessible directly from confirmed booking items.
- **Deterministic Room Security:** Unique room generation based on tutor identifier and booking slot prevents collision and unauthorized eavesdropping.
- **Completion Trigger:** Completing a live session automatically updates booking status to `Completed` (`הושלם`), instantly qualifying the student for review submission.

#### 3.12. Secure Password Recovery & OTP Verification (איפוס סיסמה מאובטח)
- **Transactional OTP Dispatch:** Server-side Route Handler (`/api/send-otp`) integrates with `nodemailer` to dispatch a cryptographically generated 6-digit one-time code to the user's verified email.
- **Dedicated Recovery Interface:** Dedicated `/reset-password` page and modal supporting code verification, new password complexity checks (minimum 8 characters), and immediate database credential update.
- **Confirmation Alert:** Automated email notification dispatched upon successful password change to protect against account takeover.

#### 3.13. Flexible Authentication via Username or Email (התחברות גמישה באמצעות שם משתמש או אימייל)
- **Dual Identifier Login:** Users (students, tutors, and administrators) can sign in using either their registered email address or their username (`name`).
- **Adaptive Input Field:** Text input interface with responsive icons, autocomplete (`username`), and clear labeling ("שם משתמש או כתובת אימייל" / "Username or Email") removing restrictive browser email syntax blocks on login.
- **Intelligent Account Resolution:** Automatically detects whether an identifier is an email (presence of `@`) to query by email, or matches against registered user names (`name`) using case-insensitive search (`ilike`).
- **Resilient Fallback Matching:** Operates synchronously across Supabase PostgreSQL, offline local user caches (`registered_users`), and pre-seeded marketplace tutors.
- **Password Reset Flow Continuity:** Seamlessly bridges username entries into the OTP password reset workflow by resolving associated email addresses automatically.

---

### 4. Non-Functional Requirements
- **Performance:** Initial page load under 1.5s; client search filtering response under 50ms; image avatar compression to < 40KB before network transit.
- **Availability:** 99.9% uptime with offline resilience via dual-layer client-side storage cache and Supabase cloud sync.
- **Security:** Strict separation of client/server secrets, XSS sanitization, role-based route protection, Israeli phone format normalization, and SMTP credential isolation.
