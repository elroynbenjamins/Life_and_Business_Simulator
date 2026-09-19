import { CareerState, CompletedCourse } from '../types/game';
import coursesData from '../data/courses.json';
import careerPathsData from '../data/career_paths.json';
import { meetsExperienceRequirement } from './educationEngine';
import { inflated } from './economyEngine';

export interface EducationAvailabilityNotice {
  available: boolean;
  level: 2 | 3 | null;
  courseName: string | null;
}

export interface PromotionAssetNotice {
  blocked: boolean;
  message: string | null;
}

export function getEducationAvailabilityNotice(input: {
  currentCourseId: string | null;
  completedCourses: CompletedCourse[];
  weeksEmployed: number;
  cash: number;
  inflationMultiplier: number;
}): EducationAvailabilityNotice {
  if (input.currentCourseId) return { available: false, level: null, courseName: null };
  const completedIds = new Set((input.completedCourses ?? []).map((course) => course.courseId));
  const available = (coursesData as any[])
    .filter((course) => course.level === 2 || course.level === 3)
    .filter((course) => !completedIds.has(course.id))
    .filter((course) => !course.prerequisite || completedIds.has(course.prerequisite))
    .filter((course) => meetsExperienceRequirement(course.level, input.weeksEmployed))
    .filter((course) => inflated(course.cost ?? 0, input.inflationMultiplier) <= input.cash)
    .sort((a, b) => b.level - a.level)[0];
  return available
    ? { available: true, level: available.level, courseName: available.name }
    : { available: false, level: null, courseName: null };
}

export function getPromotionAssetNotice(input: {
  career: CareerState;
  completedCourses: CompletedCourse[];
  currentCarId: string;
  currentHousingId: string;
}): PromotionAssetNotice {
  const career = input.career;
  if (!career?.careerPathId || !career.companyId || (career.promotionProgress ?? 0) < 100) {
    return { blocked: false, message: null };
  }
  const path = (careerPathsData as any[]).find((item) => item.id === career.careerPathId);
  const nextPosition = path?.positions?.find((position: any) => position.level === (career.positionLevel ?? 0) + 1);
  if (!path || !nextPosition) return { blocked: false, message: null };

  const requiredEducationLevel = nextPosition.level >= 5 ? 3 : nextPosition.level >= 3 ? 2 : 1;
  const hasEducation = (input.completedCourses ?? []).some((completed) =>
    (coursesData as any[]).some((course) =>
      course.id === completed.courseId &&
      course.baseId === path.requiredCourseBase &&
      course.level >= requiredEducationLevel
    )
  );
  if (!hasEducation) return { blocked: false, message: null };

  const carTiers: Record<string, number> = { none: 0, used_car: 1, sedan: 2, suv: 3, sports_car: 4, luxury_car: 5 };
  const requiredCarTier = nextPosition.level >= 5 ? 3 : nextPosition.level >= 3 ? 2 : 1;
  if ((carTiers[input.currentCarId ?? 'none'] ?? 0) < requiredCarTier) {
    const requiredCar = nextPosition.level >= 5 ? 'an SUV' : nextPosition.level >= 3 ? 'a Sedan' : 'a Used Car';
    return { blocked: true, message: `Promotion to ${nextPosition.title} is ready. Buy ${requiredCar} or better.` };
  }

  const housingTiers: Record<string, number> = { cheap_apartment: 0, studio_apartment: 1, small_house: 2, family_house: 3, luxury_villa: 4, mansion: 5 };
  const requiredHousingTier = nextPosition.level >= 7 ? 4 : nextPosition.level >= 6 ? 3 : nextPosition.level >= 5 ? 2 : nextPosition.level >= 3 ? 1 : 0;
  if ((housingTiers[input.currentHousingId ?? 'cheap_apartment'] ?? 0) < requiredHousingTier) {
    const requiredHousing = nextPosition.level >= 7 ? 'a Luxury Villa' : nextPosition.level >= 6 ? 'a Family House' : nextPosition.level >= 5 ? 'a Small House' : 'a Studio Apartment';
    return { blocked: true, message: `Promotion to ${nextPosition.title} is ready. Move into ${requiredHousing} or better.` };
  }
  return { blocked: false, message: null };
}
