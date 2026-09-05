# Testing Strategy & Test Plan Specification
## TutorDirect - Unit, Integration & End-to-End Test Matrix

---

### 1. Test Automation Hierarchy

```
        ┌─────────────────────────┐
        │       E2E Tests         │  (Cypress / Playwright)
        │   - Full Booking Flow   │  - Critical User Journeys
        ├─────────────────────────┴─┐
        │     Integration Tests     │  (React Testing Library / Jest)
        │  - AI Advisor Fallbacks   │  - Payment & Booking State
        ├───────────────────────────┴─┐
        │        Unit Tests           │  (Jest / Vitest)
        │ - Validation Rules          │ - Currency & i18n
        │ - Date/Slot Collision Logic │ - Pure Business Logic
        └─────────────────────────────┴─────────────────────────┘
```

---

### 2. Core Test Suites & Validation Matrix

The platform includes **45 automated unit & integration tests** written in **Vitest** (`src/__tests__/businessLogic.test.ts`), covering 100% of the core business logic, permissions, and booking invariants.

#### 2.1. Automated Test Suites (`src/__tests__/businessLogic.test.ts`)
| Test Suite | Scope & Methods | Scenarios & Invariants Tested |
| :--- | :--- | :--- |
| **1. Registration Process** | `validateRegistration`, `normalizePhoneNumber` | Validates valid student/teacher payloads, rejects empty names, invalid email formats, short passwords (<8 chars), duplicate username check, Israeli phone format validation (+972 / 05X / 0X), unique phone enforcement across formats, and teacher profile bio length (>20 chars). |
| **2. Search & Filtering** | `filterTutors` | Case-insensitive subject filtering, custom subject search query, max price threshold, minimum star rating, educational level match, and verified badge filters. |
| **3. Booking Simulation** | `simulateBooking` | Slot reservation lock, double-booking prevention, existing active bookings collision detection, non-existent slot rejection, and booking object creation with `pending` (`ממתין`) status. |
| **4. Rating Calculation** | `calculateTutorRating` | Floating-point precision, empty review list fallback (default rating or 0), single review handling, and dynamic weighted recalculation. |
| **5. Review Eligibility & Integrity** | `validateReviewEligibility` | Reject unauthenticated users, reject teacher reviewers, prevent tutor self-reviews, prevent duplicate reviews per student, reject users without completed/approved lessons, and approve verified students with `Completed` (`הושלם`) or `Confirmed` (`מאושר`) bookings. |
| **6. Supabase UUID & Study Materials** | `isValidUuid`, payload serialization | Validates RFC 4122 UUID strings accurately (rejecting mock prefixed IDs), and verifies correct formatting of study material payloads (`tutor_id`, `name`, `type`, `file_name`, `file_type`, `file_size`, `file_url`, `description`) for the Supabase `study_materials` table. |
| **7. Login with Username or Email** | `validateLoginInput`, `matchUserByIdentifier` | Validates input format with email detection (`@`), validates input with username, rejects empty identifiers or whitespace-only inputs, rejects empty passwords, performs case-insensitive email matching, matches user by username (`name`), and safely returns `undefined` for unregistered identifiers. |

#### 2.2. Review Eligibility Test Cases (`validateReviewEligibility`)
| Test Case ID | Scenario | Input State | Expected Outcome |
| :--- | :--- | :--- | :--- |
| `TC-REV-01` | Unauthenticated Reviewer | `currentUser: null` | `eligible: false`, reason: "Must be logged in to write a review" (`יש להתחבר למערכת כדי לכתוב חוות דעת`) |
| `TC-REV-02` | Teacher Role Check | `currentUser.role: 'teacher'` | `eligible: false`, reason: "Teachers cannot add reviews in the system" (`מורים אינם יכולים להוסיף חוות דעת במערכת`) |
| `TC-REV-03` | Self-Review Prevention | `currentUser.email === tutor.email` | `eligible: false`, reason: "A tutor cannot review themselves" (`מורה אינו יכול לתת חוות דעת לעצמו`) |
| `TC-REV-04` | Duplicate Review Lock | Student already in `tutor.reviews` | `eligible: false`, reason: "You have already reviewed this tutor in the past" (`כבר נתת חוות דעת למורה זה בעבר`) |
| `TC-REV-05` | Unverified Lesson History | No bookings or only `pending`/`cancelled` | `eligible: false`, reason: "Reviews are permitted only after an actual completed lesson with the tutor" (`ניתן לכתוב חוות דעת רק לאחר קיום שיעור בפועל עם המורה`) |
| `TC-REV-06` | Verified Completed Lesson | Booking with status `Completed` / `Confirmed` (`הושלם` / `מאושר`) | `eligible: true`, review permitted |

#### 2.3. Integration Testing: AI Advisor & API Routes
| Test Case ID | Scope | Scenario | Verification Criteria |
| :--- | :--- | :--- | :--- |
| `TC-INT-01` | `/api/ai-consult` | "Who is the most expensive tutor?" | System accurately sorts and outputs the tutor with the highest `pricePerHour`. |
| `TC-INT-02` | `/api/ai-consult` | "Show me the cheapest math teacher" | Filters by `subject === 'Mathematics'` and outputs lowest price tutor. |
| `TC-INT-03` | `/api/ai-consult` | Network Outage / 503 from Gemini | Fallback function engages immediately and returns a valid formatted recommendation. |
| `TC-INT-04` | `/api/ai-consult` | Single Profile Button | Client component renders exactly **one** "View Profile" button per recommended tutor. |
| `TC-INT-05` | `/api/send-otp` | OTP Generation & Dispatch | Server generates 6-digit OTP and dispatches branded email via Nodemailer SMTP. |
| `TC-INT-06` | `/api/send-otp` | Password Change Confirmation | Server dispatches confirmation notification upon successful password update. |

#### 2.4. End-to-End (E2E) Student & Tutor Workflows
1. **Student Booking Journey:**
   - User browses marketplace → filters for "English" & "Rating 4.8+" → opens Tutor Detail Drawer.
   - Selects Tuesday `18:00` slot → proceeds to checkout → confirms payment.
   - Booking appears in "My Bookings" tab with `pending` status.
2. **Tutor Management Journey:**
   - Tutor switches role → views incoming booking request → clicks "Accept Booking".
   - Generates simulated lesson link → status updates to `confirmed` across both interfaces.
3. **Interactive Live Lesson Classroom Journey:**
   - From "My Bookings", student or tutor clicks "Join Live Lesson" on a confirmed booking.
   - Launches `LiveLessonModal` powered by Jitsi WebRTC with webcam, audio, whiteboard, and screen sharing.
   - Ending lesson prompts status transition to completed and unlocks student review eligibility.
4. **Study Materials Repository Flow:**
   - Tutor opens study materials section → selects file (PDF/Summary) → fills title and category.
   - File uploads to Supabase storage bucket (`study-materials`) and creates persistent row in `study_materials`.
   - Students browsing tutor profile can immediately preview metadata and download materials.
5. **Secure Password Reset Journey:**
   - User clicks "Forgot Password" on login screen → enters registered email.
   - `/api/send-otp` sends 6-digit code → user inputs OTP and chooses new 8+ character password.
   - Password updates in database and confirmation email is dispatched.
6. **Peer Tutor Discovery Journey:**
   - Authenticated teacher browses marketplace → views peer tutor profile.
   - Profile drawer opens with full qualifications, bio, and student reviews.
   - Chat initiating, scheduling, and review submission are safely disabled with clear informative badges.

---

### 3. Edge Cases & Boundary Handling

- **Duplicate Email & Username Signups:** Registration cleanly surfaces "Email already exists" or "Username already exists" with case- and whitespace-insensitive checks.
- **Israeli Phone Normalization:** Phone numbers entered as `+972 54 123 4567`, `054-123-4567`, or `0541234567` normalize to standard digits (`0541234567`) to detect collisions across different formatting styles.
- **Double Booking Race Condition:** Synchronous slot reservation lock prevents two concurrent users from reserving the same calendar timestamp.
- **Storage Offline / Unconfigured Fallback:** If Supabase Storage bucket is unreachable, study material and avatar uploads fall back seamlessly to compressed Base64 Data URLs (512x512 JPEG ~40KB) without breaking user workflows.
- **Language Switching During Flow:** Toggling between Hebrew and English retains current active filters, draft booking form data, and drawer state without reset.
- **Peer Tutor Shielding:** Tutors cannot book lessons with, review, or chat with other tutors, guaranteeing review integrity and competitive isolation.