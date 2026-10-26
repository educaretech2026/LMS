export interface ModulePermissionDefinition {
  key: string;
  label: string;
  category: 'Academic & Learning' | 'Administration & Finance' | 'System Configuration';
  description: string;
  aliases: string[];
}

export const MODULE_PERMISSIONS: ModulePermissionDefinition[] = [
  // ─── Academic & Learning ───
  {
    key: 'STUDENTS',
    label: 'Students & Admissions',
    category: 'Academic & Learning',
    description: 'Manage student enrollments, profiles, admissions, and ID cards',
    aliases: ['Student Management', 'students.view', 'students.create', 'students.update', 'students.delete', 'Students'],
  },
  {
    key: 'ATTENDANCE',
    label: 'Attendance Tracking',
    category: 'Academic & Learning',
    description: 'Mark daily attendance, manage QR checks, and export attendance records',
    aliases: ['Attendance', 'attendance.view', 'attendance.manage'],
  },
  {
    key: 'ASSIGNMENTS',
    label: 'Assignments & Homework',
    category: 'Academic & Learning',
    description: 'Create, distribute, submit, and evaluate student assignments',
    aliases: ['Assignments', 'assignments.manage'],
  },
  {
    key: 'DOUBTS',
    label: 'Doubt Clearance',
    category: 'Academic & Learning',
    description: 'Teacher-student doubt discussion channels and ticket resolution',
    aliases: ['Doubt Clearance', 'doubts.manage'],
  },
  {
    key: 'LIVE_CLASSES',
    label: 'Live Classes & Webinars',
    category: 'Academic & Learning',
    description: 'Schedule, host, and manage live cohorts, webinars, and public registrations',
    aliases: ['Live Classes', 'Live Class', 'live_classes.manage'],
  },
  {
    key: 'EXAMS',
    label: 'Examinations & Quizzes',
    category: 'Academic & Learning',
    description: 'Design MCQ questions, manage mock exams, and generate grade sheets',
    aliases: ['Academics (Exams/Classes)', 'Exams', 'exams.manage'],
  },
  {
    key: 'ESTUDY',
    label: 'eStudy & Course Materials',
    category: 'Academic & Learning',
    description: 'Upload video lectures, reference PDFs, notes, and curriculum assets',
    aliases: ['courses.view', 'courses.manage', 'eStudy', 'Study Materials'],
  },
  {
    key: 'SYLLABUS',
    label: 'Syllabus Tracker',
    category: 'Academic & Learning',
    description: 'Track chapter completion, syllabus configuration, and faculty progress',
    aliases: ['Syllabus', 'syllabus.manage'],
  },
  {
    key: 'CERTIFICATES',
    label: 'Certificate Issuance',
    category: 'Academic & Learning',
    description: 'Generate, issue, and verify student course completion certificates',
    aliases: ['Certificates', 'certificates.manage'],
  },

  // ─── Administration & Finance ───
  {
    key: 'FEES',
    label: 'Fee Collection',
    category: 'Administration & Finance',
    description: 'Collect student fees, issue receipts, set fee heads, and dispatch reminders',
    aliases: ['Fee Collection', 'fees.manage', 'Fee'],
  },
  {
    key: 'STAFF',
    label: 'Staff & User Management',
    category: 'Administration & Finance',
    description: 'Staff directory, teacher assignments, user creation, and access roles',
    aliases: ['Staff Management', 'staff.view', 'staff.create', 'staff.update', 'staff.delete', 'Staff'],
  },
  {
    key: 'ENQUIRY',
    label: 'Enquiry & CRM Leads',
    category: 'Administration & Finance',
    description: 'Capture student enquiries, assign counseling follow-ups, and convert leads',
    aliases: ['Enquiry', 'Enquiries', 'Leads', 'CRM'],
  },
  {
    key: 'FORMS',
    label: 'Dynamic Custom Forms',
    category: 'Administration & Finance',
    description: 'Build registration forms, publish public surveys, and collect responses',
    aliases: ['Forms', 'Custom Forms', 'forms.manage'],
  },
  {
    key: 'SMS',
    label: 'SMS Communications',
    category: 'Administration & Finance',
    description: 'Send broadcast alerts, student notices, and view delivery history',
    aliases: ['SMS', 'SMS Communications', 'sms.send'],
  },
  {
    key: 'FINANCE',
    label: 'Expense & Income',
    category: 'Administration & Finance',
    description: 'Record operating expenses, center revenues, and cash flow ledger',
    aliases: ['Expense & Income', 'Finance', 'Expense', 'finance.manage'],
  },
  {
    key: 'REPORTS',
    label: 'Reports & Analytics',
    category: 'Administration & Finance',
    description: 'Comprehensive academic, financial, attendance, and audit metrics',
    aliases: ['Reports & Analytics', 'reports.view', 'Reports'],
  },
  {
    key: 'AUDIT_LOGS',
    label: 'Audit & Security Logs',
    category: 'Administration & Finance',
    description: 'Enterprise immutable audit trail, administrative mutations, and error traces',
    aliases: ['Audit Logs', 'Security Logs', 'Audit & Security Logs', 'audit.view'],
  },

  // ─── System Configuration ───
  {
    key: 'SETUP',
    label: 'Academic Setup & Master Data',
    category: 'System Configuration',
    description: 'Configure academic years, boards, standards, batches, courses, and centers',
    aliases: ['Setup', 'System Setup', 'setup.manage'],
  },
  {
    key: 'SETTINGS',
    label: 'System Settings',
    category: 'System Configuration',
    description: 'Institute branding, Cloudflare R2 storage, SMS gateways, and system parameters',
    aliases: ['System Settings', 'Settings', 'settings.manage'],
  },
];

/**
 * Checks if a collection of granted permission strings grants access to a target module key.
 * Resolves both canonical module keys and legacy action aliases.
 */
export function checkModulePermission(grantedActions: string[], targetKey: string): boolean {
  if (!grantedActions || grantedActions.length === 0) return false;

  const normalizedTarget = targetKey.toUpperCase().trim();
  const definition = MODULE_PERMISSIONS.find(m => m.key === normalizedTarget);

  const acceptableKeys = new Set<string>();
  acceptableKeys.add(normalizedTarget);

  if (definition) {
    acceptableKeys.add(definition.label.toLowerCase());
    for (const alias of definition.aliases) {
      acceptableKeys.add(alias.toLowerCase());
      acceptableKeys.add(alias.toUpperCase().replace(/\s+/g, '_'));
    }
  }

  for (const granted of grantedActions) {
    if (!granted) continue;
    const gLower = granted.toLowerCase().trim();
    const gUpper = granted.toUpperCase().replace(/\s+/g, '_').trim();
    if (acceptableKeys.has(gLower) || acceptableKeys.has(gUpper) || acceptableKeys.has(granted)) {
      return true;
    }
  }

  return false;
}
