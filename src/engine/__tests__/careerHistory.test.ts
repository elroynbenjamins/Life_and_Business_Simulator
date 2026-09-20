import { recordCareerLevel } from '../careerEngine';
import { INITIAL_CAREER_STATE } from '../../types/game';

const career = { ...INITIAL_CAREER_STATE, companyId: 'career_employer', careerPathId: 'technology', positionLevel: 3 };
const history = [{ jobId: 'career_employer_technology_1', title: 'Old title', startWeek: 2, endWeek: null }];

test('records promoted level for reapplication without mutating original history', () => {
  const result = recordCareerLevel(history, career, 10);
  expect(result[0].jobId).toBe('career_employer_technology_3');
  expect(result[0].title).not.toBe('Old title');
  expect(result[0].startWeek).toBe(2);
  expect(history[0].jobId).toBe('career_employer_technology_1');
});

test('repairs missing history for an existing employed save', () => {
  expect(recordCareerLevel([], career, 10)[0].jobId).toBe('career_employer_technology_3');
});

test('does not lower recorded level or modify a closed employment entry', () => {
  const promoted = recordCareerLevel(history, career, 10);
  expect(recordCareerLevel(promoted, { ...career, positionLevel: 1 }, 11)).toBe(promoted);
  const closed = [{ ...history[0], endWeek: 5 }];
  expect(recordCareerLevel(closed, career, 10)).toHaveLength(2);
  expect(closed[0].endWeek).toBe(5);
});
