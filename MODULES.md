# Educare LMS - Integrated Modules & Architecture Documentation

A comprehensive overview of all features, modules, sub-systems, and technical infrastructure integrated into the Educare LMS platform.

---

## 1. 📝 Examination & Assessment Engine
* **MCQ & Timed Examinations (`/exam/mcq`, `/exam/mcq/create`)**:
  * Multi-question MCQ tests with custom positive and negative marking weightages.
  * Image upload integration for question statements and individual options via presigned S3/MinIO URLs.
  * Multi-dimensional targeting hierarchy (Academic Year, Centre, Board, Class/Standard, Batch, Subject, Chapter, Topic, and Track).
* **Full Exam & Question Editing Suite (`/exam/mcq/[id]/edit`)**:
  * Complete live editing capabilities for existing exams, question statements, answer keys, explanations, marks, and negative marks.
  * Interactive question addition and deletion with database-level cascading.
* **Student Exam Interface (`/exam/mcq/[id]/take`)**:
  * Real-time countdown timer, question palette navigation, and instant attempt autosaving.
  * Automatic grading engine calculating raw score, percentage, and assigned letter grades (`A+`, `A`, `B+`, `B`, `C`, `F`).
* **Live Results & Analytics (`/exam/results`, `/exam/[id]/results`)**:
  * Real-time attempt metrics (`_count.results`), pass rates, cohort average score, and top score KPIs.
  * Searchable results table with student scorecards, percentage visualizers, and detailed question-by-question breakdown.
* **Mock Tests & Question Bank (`/exam/mock`, `/exam/questions`)**:
  * Centralized repository of reusable questions categorized by subject matter and taxonomy.

---

## 2. 👥 User, Role & Identity Management
* **Role-Based Access Control (RBAC)**:
  * Strict authorization guards across `SUPER_ADMIN`, `CENTRE_ADMIN`, `TEACHER`, and `STUDENT`.
  * Dynamic sidebar and page access filtered by active user role permissions.
* **Authentication & Session Security**:
  * JWT access authentication with refresh token strategy.
  * Redis-backed single-session enforcement, concurrency control, and active session invalidation.
* **Student Directory & Profiles (`/students`)**:
  * Complete profiles (personal details, batch enrollments, guardian information, and track assignments).
  * Digital Student ID Card generation with verifiable QR codes (`/students/[id]/id-card`).
  * Automated daily birthday tracker (`/students/birthdays/today`).
* **Staff & Faculty Management (`/staff`)**:
  * Teacher profiles, qualifications, and batch/subject mapping assignments.

---

## 3. 🏫 Academic Hierarchy & Institutional Setup (`/setup`)
* **Multi-Tier Academic Configuration**:
  * **Academic Years**: Session tracking and active year toggling.
  * **Centres / Branches**: Multi-campus institutional support.
  * **Educational Boards**: CBSE, ICSE, State Boards, etc.
  * **Classes / Standards**: Grade-level groupings.
  * **Batches / Sections**: Classroom divisions linked to academic years and centres.
  * **Syllabus Hierarchy**: Subjects, Chapters, Topics, and Subtopics.
  * **Target Tracks**: Specialized competitive coaching tracks (e.g., Medical/NEET, Engineering/JEE, Foundation).

---

## 4. 📚 E-Study & Learning Content Management (`/estudy`)
* **Digital Study Materials**:
  * Document and PDF material distribution mapped directly to chapters and topics.
  * Video lecture embedding with dedicated player views (`/estudy/video/[id]`).
  * Student study progress tracking per material item.
* **Topic Quizzes (`/estudy/quiz/[examId]`)**:
  * Topic-level self-assessment tests linked to course materials.

---

## 5. 📑 Homework & Assignments Management (`/assignments`)
* **Multi-Tier Curriculum Targeting**:
  * Assignment allocation mapped to Batches, Subjects, Chapters, and Topics with target track filtering (`TUITION`, `ENTRANCE`, `BOTH`).
* **Attachment Distribution**:
  * Multi-file document and worksheet distribution via secure presigned cloud storage uploads.
* **Student Submissions & Status Tracking**:
  * Dedicated student submission modal with file upload attachments and notes.
  * Automatic late submission evaluation (`LATE` vs `SUBMITTED`) comparing against assignment due dates.
* **Teacher Grading & Review**:
  * Submission inspection drawer with direct attachment preview and quantitative marks + qualitative feedback entry.
* **Automated Syllabus Progress Synchronization**:
  * Student submission events automatically calculate and feed into the 30% practice progress weighting in the syllabus tracker.
* **Full CRUD Management**:
  * Creation, live editing, and deletion with cascading removal of linked student submissions.

---

## 6. 📅 Attendance Management (`/attendance`)
* Batch-wise daily student attendance recording (Present, Absent, Late, Excused).
* Teacher and administrative staff attendance logging.
* Student-wise attendance percentage reporting and historical attendance logs.

---

## 7. 💰 Fee & Financial Management (`/fee`, `/expense`)
* **Student Fee Engine (`/fee`)**:
  * Customizable fee structures, scholarship/discount allocations, and installment schedules.
  * Payment collection recording, outstanding dues tracking, and receipt generation.
* **Institutional Expense Tracker (`/expense`)**:
  * Expense categorizations and transaction logging with file receipt attachments.
  * Financial cashflow overviews.

---

## 8. 📑 Dynamic Form Builder & Admissions (`/forms`, `/admission`, `/enquiry`)
* **No-Code Form Builder (`/forms/builder`, `/forms`)**:
  * Drag-and-drop form creation supporting various input types (text, numbers, dropdowns, uploads, dates).
  * Public form sharing URLs (`/f/[id]`) and live response aggregation (`/forms/[id]/responses`).
* **Enquiry & Lead Management (`/enquiry`)**:
  * Prospective student lead tracking, counselor assignment, and follow-up logging.
* **Admissions Pipeline (`/admission`)**:
  * Seamless workflow converting prospective leads into enrolled students.

---

## 9. 🔔 Communications & Notifications (`/notices`, `/sms`)
* **In-App Notification Centre**:
  * Real-time notification drawer with unread counts and read-state synchronization.
* **Notice Board & Announcements (`/notices`)**:
  * Campus-wide and batch-specific announcements with automated scheduling.
* **SMS Gateway Integration (`/sms`)**:
  * Bulk SMS broadcasting, parent alert logs, and reusable message templates.

---

## 10. 🎥 Live Classes & Virtual Classroom (`/live-class`)
* Batch and subject-wise live class scheduling.
* WebRTC / LiveKit integration layer for real-time video, audio, screen sharing, and automated room access token issuance.

---

## 11. 📜 Certificates, Reports & Help Desk
* **Certificate Generator (`/certificate`)**:
  * Templated certificate generation for course completions and student achievements.
* **Consolidated Reporting (`/report`)**:
  * Academic performance, attendance records, and financial summaries.
* **Support Help Desk (`/help`)**:
  * Internal ticketing system for student, teacher, and administrator inquiries.

---

## 12. 💬 Doubt Clearance & Academic Chat System (`/doubts`)
* **Strict Student-to-Teacher Communication**:
  * Direct 1-on-1 academic doubt asking where students can direct questions to verified teachers and faculty members only.
  * Structural boundary preventing student-to-student private messaging to protect classroom focus and prevent harassment.
* **Faculty Answering & Guidance Workflow**:
  * Dedicated teacher dashboard to review student doubt queues by priority (`LOW`, `MEDIUM`, `HIGH`, `URGENT`).
  * Structured explanations, resource linking, and status transitions (`PENDING` ➔ `IN_PROGRESS` ➔ `ANSWERED` ➔ `RESOLVED`).
* **Institutional Supervision & Administrative Oversight**:
  * Complete audit visibility across all doubt threads for `SUPER_ADMIN`, `CENTRE_ADMIN`, and `ADMIN`.
  * Official Academic Supervisor intervention badges on administrative messages.
  * Dynamic faculty reassignment tool allowing administrators to route doubts between subject specialists.
* **Interactive Live Experience**:
  * Two-column split-thread conversation layout, active thread polling, optimistic UI updates, and attachment previews.

---

## 13. ⚙️ Technology Stack & Infrastructure
* **Frontend**: Next.js 16 (App Router, React Server Components, Tailwind CSS, Lucide Icons).
* **Backend API**: NestJS (TypeScript, Modular Architecture, Guards, Interceptors, Swagger OpenAPI).
* **Database & ORM**: PostgreSQL with Prisma ORM (relational schema, relational cascades, migrations).
* **Cache & Memory Layer**: Redis (session management, rate-limiting, live socket/state tracking).
* **Object Storage**: S3-compatible cloud storage (MinIO / AWS S3) with secure presigned upload URLs.
* **Deployment & DevOps**: Monorepo structure, Nixpacks build pipeline, Coolify, and Docker containerization.
