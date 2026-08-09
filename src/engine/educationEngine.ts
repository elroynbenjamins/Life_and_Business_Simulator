import { GameState, CompletedCourse } from '../types/game';
import coursesData from '../data/courses.json';

/**
 * Step 5: Education Progress
 * Advances current course by 1 week. Completes if duration reached.
 */
export interface EducationResult {
  currentCourseId: string | null;
  courseWeeksCompleted: number;
  completedCourses: CompletedCourse[];
  courseProgress: string | null;
  justCompleted: boolean;
  completedCourseData: { skillRewards?: Record<string, number>; knowledgeRewards?: Record<string, number> } | null;
}

/**
 * Check if a player meets experience requirements for a course.
 * Advanced (level 2) requires 75 weeks working experience.
 * Expert (level 3) requires 150 weeks working experience.
 */
export function meetsExperienceRequirement(courseLevel: number, totalWeeksWorked: number): boolean {
  if (courseLevel >= 3) return totalWeeksWorked >= 150;
  if (courseLevel >= 2) return totalWeeksWorked >= 75;
  return true;
}

export function processEducation(state: GameState, currentWeek: number, partTimeJob?: boolean): EducationResult {
  let courseId = state?.currentCourseId ?? null;
  let weeksCompleted = state?.courseWeeksCompleted ?? 0;
  let completed = [...(state?.completedCourses ?? [])];
  let courseProgress: string | null = null;
  let justCompleted = false;
  let completedCourseData: EducationResult['completedCourseData'] = null;

  if (courseId) {
    weeksCompleted += 1;
    const courseData = (coursesData as any[]).find((c) => c?.id === courseId);
    const baseDuration = courseData?.duration ?? 1;
    // Part-time job increases study time by 50%
    const duration = partTimeJob ? Math.ceil(baseDuration * 1.5) : baseDuration;
    const courseName = courseData?.name ?? 'Course';

    if (weeksCompleted >= duration) {
      completed.push({ courseId, name: courseName, completedWeek: currentWeek });
      courseProgress = `${courseName} completed!`;
      justCompleted = true;
      completedCourseData = {
        skillRewards: courseData?.skillRewards ?? undefined,
        knowledgeRewards: courseData?.knowledgeRewards ?? undefined,
      };
      courseId = null;
      weeksCompleted = 0;
    } else {
      courseProgress = `${courseName}: Week ${weeksCompleted}/${duration}`;
    }
  }

  return {
    currentCourseId: courseId,
    courseWeeksCompleted: weeksCompleted,
    completedCourses: completed,
    courseProgress,
    justCompleted,
    completedCourseData,
  };
}
