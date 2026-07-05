import { SENIOR_CITIZEN_AGE_THRESHOLD } from '@/config/constants';

export function calculateAge(dob: Date, at: Date = new Date()): number {
  let age = at.getFullYear() - dob.getFullYear();
  const monthDiff = at.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && at.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}

export function isSeniorCitizen(dob: Date, at: Date = new Date()): boolean {
  return calculateAge(dob, at) >= SENIOR_CITIZEN_AGE_THRESHOLD;
}

export function isMinor(dob: Date, at: Date = new Date()): boolean {
  return calculateAge(dob, at) < 18;
}

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
