import { Tutor } from './types';

export const calculateTutorRating = (tutor: { rating?: number; reviews?: { rating: number }[] }): number => {
  if (tutor.reviews && tutor.reviews.length > 0) {
    const total = tutor.reviews.reduce((sum, r) => sum + (typeof r.rating === 'number' ? r.rating : 5), 0);
    return Number((total / tutor.reviews.length).toFixed(1));
  }
  return typeof tutor.rating === 'number' ? tutor.rating : 5.0;
};

export const INITIAL_TUTORS: Tutor[] = [];

export const SUBJECTS_LIST = [
  'מתמטיקה',
  'אנגלית',
  'מדעי המחשב',
  'פיזיקה',
  'כימיה',
  'לשון ועברית'
];
