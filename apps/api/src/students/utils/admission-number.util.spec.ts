import {
  extractCentreCode,
  extractYearCode,
  extractCourseCode,
  extractClassCode,
  extractBatchCode,
  buildAdmissionPrefix,
  formatAdmissionNumber,
  extractSequenceFromAdmissionNumber,
} from './admission-number.util';

describe('Admission Number Generation Utilities', () => {
  describe('extractCentreCode', () => {
    it('uses explicit centreCode when available', () => {
      expect(extractCentreCode('KL', 'Educare Kalathipady')).toBe('KL');
      expect(extractCentreCode('TVM', 'Trivandrum City Centre')).toBe('TVM');
      expect(extractCentreCode('KTM-01', 'Kottayam')).toBe('KTM01');
    });

    it('derives from centreName when centreCode is absent', () => {
      expect(extractCentreCode(null, 'Kalathipady Centre')).toBe('KALA');
      expect(extractCentreCode(undefined, 'Kaloor North Branch')).toBe('KN');
      expect(extractCentreCode('', 'Educare Learning Centre')).toBe('ADM');
    });
  });

  describe('extractYearCode', () => {
    it('extracts 2-digit academic year from range strings', () => {
      expect(extractYearCode('2025-26')).toBe('26');
      expect(extractYearCode('2025-2026')).toBe('26');
      expect(extractYearCode('2026-27')).toBe('27');
      expect(extractYearCode('25-26')).toBe('26');
    });

    it('extracts 2-digit from single 4-digit year', () => {
      expect(extractYearCode('2026')).toBe('26');
    });

    it('falls back to current year when empty', () => {
      const currentYear2Digit = new Date().getFullYear().toString().slice(-2);
      expect(extractYearCode('')).toBe(currentYear2Digit);
      expect(extractYearCode(null)).toBe(currentYear2Digit);
    });
  });

  describe('extractCourseCode', () => {
    it('extracts standardized abbreviations for known tracks', () => {
      expect(extractCourseCode('NEET Long Term')).toBe('NEET');
      expect(extractCourseCode('JEE (Main & Advanced)')).toBe('JEE');
      expect(extractCourseCode('KEAM Crash Course')).toBe('KEAM');
      expect(extractCourseCode('Foundation Batch')).toBe('FND');
      expect(extractCourseCode('Tuition Regular')).toBe('TUI');
      expect(extractCourseCode('Both Tuition & Entrance')).toBe('BOTH');
    });

    it('handles fallback and custom course names', () => {
      expect(extractCourseCode(null, 'Medical')).toBe('MEDI');
      expect(extractCourseCode('')).toBe('GEN');
    });
  });

  describe('extractClassCode', () => {
    it('extracts numeric standard level', () => {
      expect(extractClassCode('Class 11')).toBe('11');
      expect(extractClassCode('10th Standard')).toBe('10');
      expect(extractClassCode('Class 12')).toBe('12');
      expect(extractClassCode('Plus One')).toBe('11');
      expect(extractClassCode('Plus Two')).toBe('12');
      expect(extractClassCode('+1')).toBe('11');
      expect(extractClassCode('+2')).toBe('12');
    });

    it('uses standardLevel number fallback', () => {
      expect(extractClassCode('', 9)).toBe('9');
    });
  });

  describe('extractBatchCode', () => {
    it('extracts batch or division code', () => {
      expect(extractBatchCode('Division A')).toBe('A');
      expect(extractBatchCode('Div B')).toBe('B');
      expect(extractBatchCode('Batch 1')).toBe('1');
      expect(extractBatchCode('B')).toBe('B');
      expect(extractBatchCode('Morning Batch')).toBe('MB');
      expect(extractBatchCode('')).toBe('A');
    });
  });

  describe('buildAdmissionPrefix & formatAdmissionNumber', () => {
    it('builds full standardized prefix [CENTRE]-[YEAR]-[COURSE]-[CLASS][BATCH]', () => {
      const prefix = buildAdmissionPrefix({
        centreCode: 'KL',
        academicYearName: '2025-26',
        trackName: 'NEET Repeater',
        standardName: 'Class 11',
        batchName: 'Division A',
      });
      expect(prefix).toBe('KL-26-NEET-11A');
    });

    it('formats full admission number with 3-digit zero-padding', () => {
      expect(formatAdmissionNumber('KL-26-NEET-11A', 1)).toBe('KL-26-NEET-11A-001');
      expect(formatAdmissionNumber('KL-26-NEET-11A', 42)).toBe('KL-26-NEET-11A-042');
      expect(formatAdmissionNumber('KL-26-NEET-11A', 105)).toBe('KL-26-NEET-11A-105');
    });

    it('extracts sequence accurately', () => {
      expect(extractSequenceFromAdmissionNumber('KL-26-NEET-11A-005', 'KL-26-NEET-11A')).toBe(5);
      expect(extractSequenceFromAdmissionNumber('KL-26-NEET-11A-099', 'KL-26-NEET-11A')).toBe(99);
      expect(extractSequenceFromAdmissionNumber('OTHER-001', 'KL-26-NEET-11A')).toBeNull();
    });
  });
});

