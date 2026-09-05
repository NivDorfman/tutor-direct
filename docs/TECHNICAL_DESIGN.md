# Technical Design & Architecture Specification
## TutorDirect - Full-Stack Next.js Application Architecture

---

### 1. Architecture Overview

TutorDirect is built with **Next.js 15+ (App Router)**, **TypeScript**, and **Tailwind CSS**. It follows a modular full-stack pattern with a clean separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                       Client Browser                        │
│   (React Server Components + Interactive Client Islands)   │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
        Client State / Cache             REST / API Calls
        (LocalStorage / Offline Sync)   (/api/ai-consult, /api/send-otp)
               │                               │
┌──────────────▼───────────────────────────────▼──────────────┐
│                    Next.js Server Backend                   │
│        - API Route Handlers (Edge & Node.js Runtime)        │
│        - Server-Side Gemini AI Integration (@google/genai)  │
│        - Server-Side SMTP OTP Dispatcher (nodemailer)       │
│        - Supabase / Database & Storage Integration Layer    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                ┌──────────────┴──────────────┐
                │   External Cloud Services   │
                │   - Google GenAI (Gemini)   │
                │   - Supabase PostgreSQL DB  │
                │   - Supabase Object Storage │
                │   - Jitsi WebRTC (Meet)     │
                └─────────────────────────────┘
```

---

### 2. Frontend Component Hierarchy & State Management

#### 2.1. Component Tree
- `src/app/page.tsx`: Root dashboard orchestrator mounting `src/App.tsx`.
  - `TutorDirectLogo.tsx`: Brand vector logo with dynamic size and theme styling.
  - `TutorCard.tsx`: Responsive tutor listing card displaying rating, hourly rate, subjects, levels, and review metrics.
  - `TutorDetailDrawer.tsx`: Sliding detail drawer with complete tutor qualifications, student reviews, interactive weekly calendar booking, and peer-teacher restrictions.
  - `AiConsultantModal.tsx`: Floating AI chatbot ("Aiden") powered by Gemini with subject filtering and direct "View Profile" actions.
  - `ChatWidget.tsx`: Real-time direct messaging between students and tutors with slot booking links, unread counters, and peer-teacher guards.
  - `AuthScreen.tsx`: Unified authentication supporting login with username or email, 2-step registration (student/tutor wizard), role selection, and forgot-password trigger.
  - `ResetPasswordModal.tsx`: 6-digit OTP email verification and secure password update dialog.
  - `UserProfileModal.tsx`: Unified profile manager with strict role-based isolation (personal settings for students, professional rates and bio for tutors).
  - `StudyMaterialsSection.tsx`: Repository for uploading, previewing, and downloading course documents, summaries, and formula sheets.
  - `LiveLessonModal.tsx`: WebRTC interactive video classroom powered by Jitsi React SDK with whiteboard, camera/audio controls, and screen sharing.
  - `ManageSlotsModal.tsx`: Tutor availability scheduler for creating and removing weekly time slots.
  - `TeacherSettingsModal.tsx`: Granular tutor profile configuration (rates, subjects, teaching levels).
  - `ForceCompleteProfileModal.tsx`: Required onboarding modal ensuring tutors complete mandatory fields (phone, bio, education) before appearing in the marketplace.
  - `MyBookingsModal.tsx`: Student and tutor lesson management tracking pending, confirmed, completed, and cancelled bookings with direct live classroom links.

#### 2.2. State Flow & Business Logic Layer
- **Client Cache Strategy:** Uses resilient local persistence (`src/lib/storageUtils.ts` & `src/lib/slotUtils.ts`) initialized with rich sample data to ensure immediate, zero-latency interactions alongside Supabase background synchronization.
- **Pure Business Logic Layer (`src/lib/businessLogic.ts`):**
  - `validateLoginInput`: Validates user login credentials, verifying presence of identifier and password and flagging whether input is an email address.
  - `matchUserByIdentifier`: Case-insensitive and whitespace-trimmed search matching user records by email or username (`name`).
  - `validateRegistration`: Form schema validation for student and teacher flows with duplicate username and Israeli phone collision checks.
  - `normalizePhoneNumber`: Normalizes various phone representations (`+972 5X`, `05X-XXXXXXX`) to uniform numeric strings for collision detection.
  - `filterTutors`: Multi-criteria search engine (search query, subjects, levels, price slider, minimum rating, and sorting).
  - `simulateBooking`: Conflict detection, double-booking prevention, and booking state transitions.
  - `calculateTutorRating`: Floating-point dynamic recalculation of tutor review averages.
  - `validateReviewEligibility`: Strictly restricts review permissions to authenticated students with completed or confirmed lessons.

---

### 3. Server-Side APIs & Cloud Architecture

#### 3.1. AI Consultation Engine (`/api/ai-consult`)
The AI consultation engine is executed entirely server-side to safeguard API credentials and ensure deterministic recommendations:

```typescript
// System prompt and context pipeline
1. Receive request with: { messages, studentName, tutorsList, subjects, language }
2. Format complete tutor catalog as structured JSON context.
3. Apply system prompt with strict sorting & boundary rules.
4. Execute multi-model fallback:
   - Primary: gemini-3.5-flash
   - Secondary: gemini-2.5-flash / gemini-2.0-flash
5. Catch block: Intelligent rule-based fallback (deterministic sorting for price/rating).
6. Return structured response to client.
```

#### 3.2. Transactional OTP Dispatcher (`/api/send-otp`)
- **Route Handler:** Next.js server route using `nodemailer` to dispatch transactional emails.
- **Security:** Reads server secrets (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`) strictly isolated from the client bundle.
- **Dual Email Templates:** Supports both 6-digit OTP verification codes and password-changed security confirmations in Hebrew and English.

#### 3.3. WebRTC Video Lesson Infrastructure (`LiveLessonModal`)
- **Engine:** `@jitsi/react-sdk` embedded dynamically on the client.
- **Room Isolation:** Deterministic room naming based on `TutorDirect-[tutorId]-[slot]` ensuring collision-free private rooms.
- **Capabilities:** Full-duplex video, audio, in-lesson chat, screen sharing, and collaborative whiteboard.

---

### 4. Database Schema Design (PostgreSQL / Supabase)

```sql
-- Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    password TEXT,
    role VARCHAR(50) NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
    avatar TEXT,
    avatar_url TEXT,
    wallet_balance NUMERIC(10, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tutors Table
CREATE TABLE tutors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    subject VARCHAR(100) NOT NULL,
    levels TEXT,
    price_per_hour NUMERIC(10, 2) NOT NULL CHECK (price_per_hour >= 0),
    rating NUMERIC(3, 2) DEFAULT 5.00,
    review_count INT DEFAULT 0,
    bio TEXT,
    education TEXT,
    experience TEXT,
    location VARCHAR(255),
    avatar TEXT,
    avatar_url TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    available_days JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bookings Table
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    student_name VARCHAR(255) NOT NULL,
    student_email VARCHAR(255) NOT NULL,
    tutor_id UUID REFERENCES tutors(id) ON DELETE CASCADE,
    tutor_name VARCHAR(255) NOT NULL,
    subject VARCHAR(100) NOT NULL,
    lesson_date DATE,
    lesson_time VARCHAR(50) NOT NULL,
    lesson_format VARCHAR(50) DEFAULT 'online' CHECK (lesson_format IN ('online', 'in_person')),
    price NUMERIC(10, 2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ממתין' CHECK (status IN ('ממתין', 'מאושר', 'הושלם', 'בוטל')),
    note TEXT,
    meeting_link TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reviews Table
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tutor_id UUID REFERENCES tutors(id) ON DELETE CASCADE,
    reviewer_name VARCHAR(255) NOT NULL,
    reviewer_email VARCHAR(255) NOT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    date VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Study Materials Table
CREATE TABLE study_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tutor_id UUID REFERENCES tutors(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('formula_sheet', 'summary', 'presentation', 'worksheet', 'other')),
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size VARCHAR(50) NOT NULL,
    file_url TEXT NOT NULL,
    description TEXT,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Supabase Storage Buckets
1. `study-materials`: Publicly readable bucket for course materials, summaries, and formula sheets.
2. `avatars`: Publicly readable bucket for user and tutor profile photos with compressed JPEG uploads.

---

### 5. Directory Structure
```
tutor-direct/
├── docs/                               # Comprehensive engineering specifications
│   ├── PRD.md                          # Product requirements & user journeys
│   ├── TECHNICAL_DESIGN.md             # Full-Stack Next.js architecture & database schemas
│   ├── SECURITY.md                     # RBAC matrix, secret isolation & threat mitigation
│   ├── TESTING.md                      # Vitest test suite matrix & validation criteria
│   └── SCALABILITY.md                  # Indexing strategy, token pruning & CDN caching
├── src/
│   ├── app/                            # Next.js App Router
│   │   ├── api/
│   │   │   ├── ai-consult/route.ts     # Server-side Gemini AI consultation
│   │   │   └── send-otp/route.ts       # Server-side SMTP OTP email dispatcher
│   │   ├── reset-password/page.tsx     # Dedicated password reset page
│   │   ├── globals.css                 # Tailwind CSS v4 styling
│   │   ├── layout.tsx                  # Root layout (RTL & typography)
│   │   └── page.tsx                    # Client SPA entry point mounting App.tsx
│   ├── components/                     # Modular React 19 UI components
│   │   ├── AiConsultantModal.tsx       # Gemini AI consultant modal ("Aiden")
│   │   ├── AuthScreen.tsx              # Authentication & role selection
│   │   ├── BecomeTutorModal.tsx        # 2-step tutor registration wizard
│   │   ├── ChatWidget.tsx              # Direct student-tutor live chat
│   │   ├── ForceCompleteProfileModal.tsx # Mandatory tutor onboarding guard
│   │   ├── LiveLessonModal.tsx         # Jitsi WebRTC video classroom
│   │   ├── ManageSlotsModal.tsx        # Availability calendar slot editor
│   │   ├── MyBookingsModal.tsx         # Booking history & status tracker
│   │   ├── ResetPasswordModal.tsx      # OTP verification & password reset dialog
│   │   ├── StudyMaterialsSection.tsx   # Study materials upload & download repository
│   │   ├── TeacherSettingsModal.tsx    # Rates, subjects & teaching levels editor
│   │   ├── TutorCard.tsx               # Marketplace tutor presentation card
│   │   ├── TutorDetailDrawer.tsx       # Tutor profile drawer & booking flow
│   │   ├── TutorDirectLogo.tsx         # Brand logo component
│   │   └── UserProfileModal.tsx        # Role-isolated user profile manager
│   ├── lib/                            # Business logic & external clients
│   │   ├── businessLogic.ts            # Pure validation, filtering & booking algorithms
│   │   ├── i18n.ts                     # Bilingual localization dictionary (HE / EN)
│   │   ├── slotUtils.ts                # Date formatting & slot collision utilities
│   │   ├── storageUtils.ts             # Supabase storage & image compression helpers
│   │   └── supabase.ts                 # Supabase client & UUID resolvers
│   ├── __tests__/                      # Automated test suites
│   │   └── businessLogic.test.ts       # 45 Vitest unit & integration tests
│   ├── initialData.ts                  # Default sample tutors and subjects list
│   ├── types.ts                        # TypeScript interfaces & data contracts
│   └── App.tsx                         # Main client orchestrator
├── package.json                        # Dependencies and scripts
└── tsconfig.json                       # TypeScript compiler configuration
```
