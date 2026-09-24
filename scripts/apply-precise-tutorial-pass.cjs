// One-time, fail-closed source migration used only on the implementation branch.
const fs = require('node:fs');
function edit(file, pairs) {
  let source = fs.readFileSync(file, 'utf8');
  for (const [from, to] of pairs) {
    if (source.split(from).length !== 2) throw new Error(`Expected exactly one match in ${file}: ${from.slice(0, 90)}`);
    source = source.replace(from, to);
  }
  fs.writeFileSync(file, source);
}
function scrollScreen(file, importPath) {
  edit(file, [
    ['StyleSheet, ScrollView, Pressable', 'StyleSheet, Pressable'],
    ["import React,", `import ScrollView from '${importPath}';\nimport React,`],
  ]);
}
scrollScreen('app/tabs/index.tsx', '../../src/components/TutorialScrollView');
scrollScreen('app/tabs/education.tsx', '../../src/components/TutorialScrollView');
scrollScreen('app/tabs/career.tsx', '../../src/components/TutorialScrollView');
edit('app/tabs/index.tsx', [
  ['title="Weekly cash flow"', 'title="Weekly cash flow"\n          tutorialId="home.cashflow"'],
  ["label={lifecycle?.isDead ? 'Life Complete'", "tutorialId=\"home.advance\"\n            label={lifecycle?.isDead ? 'Life Complete'"],
]);
edit('src/components/GameButton.tsx', [
  ["import { tutorialButtonTarget, TutorialTargetId }", "import { TutorialTargetId }"],
  ["import { useTutorialHighlight } from '../store/tutorialStore';", "import { useTutorialAnchor } from './TutorialScrollView';"],
  ['const highlighted = useTutorialHighlight(tutorialId ?? tutorialButtonTarget(label), disabled);', 'const { ref, onLayout, highlighted } = useTutorialAnchor(tutorialId, disabled);'],
  ['<Pressable\n      accessibilityRole=', '<Pressable\n      ref={ref}\n      collapsable={false}\n      onLayout={onLayout}\n      testID={tutorialId ? `tutorial-target-${tutorialId}` : undefined}\n      accessibilityRole='],
]);
edit('src/components/GameCard.tsx', [
  ["import { tutorialCardTarget, TutorialTargetId }", "import { TutorialTargetId }"],
  ["import { useTutorialHighlight } from '../store/tutorialStore';", "import { useTutorialAnchor } from './TutorialScrollView';"],
  ['const highlighted = useTutorialHighlight(tutorialId ?? tutorialCardTarget(title, eyebrow));', 'const { ref, onLayout, highlighted } = useTutorialAnchor(tutorialId);'],
  ['<View\n      style={[', '<View\n      ref={ref}\n      collapsable={false}\n      onLayout={onLayout}\n      testID={tutorialId ? `tutorial-target-${tutorialId}` : undefined}\n      style={['],
]);
edit('src/engine/tutorialEngine.ts', [
  ["{ id: 'student_income', route: '/tabs/career', target: null,", "{ id: 'student_income', route: '/tabs/career', target: 'career.studentWork',"],
  ['Scroll to an available Enroll button and choose a course you like.', 'The highlighted Enroll button is an example, not a required choice. Choose any eligible Basic course. Show me returns to Basics.'],
  ['Find the part-time work options on Career.', 'Compare the two highlighted student-work options on Career.'],
  ['// Adapters for the existing shared controls.', '// Legacy adapters retained for compatibility; live controls now use explicit tutorialId props.'],
]);
edit('app/tabs/education.tsx', [
  ["import React, { useState }", "import React, { useEffect, useState }"],
  ["const CATEGORIES =", "import { useTutorialFocusStore } from '../../src/store/tutorialFocusStore';\n\nconst CATEGORIES ="],
  ["const [showCompleted, setShowCompleted] = useState(false);", "const [showCompleted, setShowCompleted] = useState(false);\n  const guidedEnrollmentRequest = useTutorialFocusStore((s) => s.target === 'education.enroll' && s.status === 'locating' ? s.request : null);\n  useEffect(() => {\n    if (guidedEnrollmentRequest !== null) setCourseLevel(1);\n  }, [guidedEnrollmentRequest]);"],
  ["  return (\n    <SafeAreaView", "  const firstGuidedCourseId = CATEGORIES.flatMap((category) => groupedCourses[category] ?? []).find((course) =>\n    course.level === 1 && !currentCourseId && !completedIds.has(course.id)\n      && (!course.prerequisite || completedIds.has(course.prerequisite))\n      && meetsExperienceRequirement(course.level, weeksEmployed)\n      && (course.cost > 0 ? inflated(course.cost, inflationMultiplier) : 0) <= cash\n  )?.id;\n\n  return (\n    <SafeAreaView"],
  ['title={currentCourse.name}', 'title={currentCourse.name}\n              tutorialId="education.progress"'],
  ['label="Enroll"', 'label="Enroll"\n                          tutorialId={course.id === firstGuidedCourseId ? \'education.enroll\' : undefined}'],
  ['onPress={() => setCourseLevel(tab.level)}', "onPress={() => {\n                  const focus = useTutorialFocusStore.getState();\n                  focus.report(focus.request, 'cancelled');\n                  setCourseLevel(tab.level);\n                }}"],
]);
edit('app/tabs/career.tsx', [
  ["import React,", "import { useTutorialHighlight } from '../../src/store/tutorialStore';\nimport React,"],
  ['  const activeTier = getStudentWorkTier({ partTimeJob, studentWorkTier });', "  const activeTier = getStudentWorkTier({ partTimeJob, studentWorkTier });\n  const guidedWork = useTutorialHighlight('career.studentWork', hasFullTimeJob);"],
  ['    <GameCard>\n      <Text style={{ color: Colors.textPrimary, fontSize: 16', '    <GameCard tutorialId={hasFullTimeJob ? undefined : \'career.studentWork\'}>\n      <Text style={{ color: Colors.textPrimary, fontSize: 16'],
  ['              <Pressable\n                style={{', "              <Pressable\n                accessibilityRole=\"button\"\n                accessibilityLabel={`${active ? 'Quit' : 'Start'} ${option.name}`}\n                accessibilityState={{ disabled: hasFullTimeJob }}\n                accessibilityHint={guidedWork ? 'Optional student-work choice. Compare income and study time before choosing.' : undefined}\n                testID={`student-work-${tier}`}\n                style={{\n                  minHeight: 44,\n                  justifyContent: 'center',\n                  borderWidth: 1,\n                  borderColor: guidedWork ? Colors.warning : 'transparent',"],
]);
edit('app/housing.tsx', [
  ["import React, { useState }", "import React, { useEffect, useState }"],
  ["import { useRouter } from 'expo-router';", "import { useRouter, useLocalSearchParams } from 'expo-router';\nimport { getLifestyleTab } from '../src/engine/tutorialPresentation';"],
  ["  const [activeTab, setActiveTab] = useState<'housing' | 'transport'>('housing');", "  const { section } = useLocalSearchParams<{ section?: string | string[] }>();\n  const requestedTab = getLifestyleTab(section);\n  const [activeTab, setActiveTab] = useState<'housing' | 'transport'>(requestedTab);\n  useEffect(() => { setActiveTab(requestedTab); }, [requestedTab]);\n  const chooseTab = (tab: 'housing' | 'transport') => {\n    setActiveTab(tab);\n    router.setParams({ section: tab });\n  };"],
  ["onPress={() => setActiveTab('housing')}", "onPress={() => chooseTab('housing')}"],
  ["onPress={() => setActiveTab('transport')}", "onPress={() => chooseTab('transport')}"],
]);
edit('src/engine/firstLifeJourney.ts', [
  ["| '/housing';", "| '/housing' | '/housing?section=transport';"],
  ["actionLabel: 'Open Lifestyle',\n      route: '/housing',", "actionLabel: 'Open Transport',\n      route: '/housing?section=transport',"],
]);
edit('app/tabs/_layout.tsx', [
  ["import { Tabs } from 'expo-router';", "import { Tabs } from 'expo-router';\nimport { useTutorialFocusStore } from '../../src/store/tutorialFocusStore';"],
  ['  focused,\n}: {', '  focused,\n  tutorialRoute,\n}: {'],
  ['  focused: boolean;\n}) {', "  focused: boolean;\n  tutorialRoute?: string;\n}) {\n  const guideHighlight = useTutorialFocusStore((state) => Boolean(tutorialRoute && state.navigationRoute === tutorialRoute));"],
  ['styles.iconWrap, focused && styles.iconWrapActive', 'styles.iconWrap, focused && styles.iconWrapActive, guideHighlight && styles.iconWrapGuided'],
  ['<TabIcon name="home"', '<TabIcon tutorialRoute="/tabs" name="home"'],
  ['<TabIcon name="school"', '<TabIcon tutorialRoute="/tabs/education" name="school"'],
  ['  iconWrapActive: {', '  iconWrapGuided: { borderWidth: 1, borderColor: Colors.warning, backgroundColor: `${Colors.warning}18` },\n  iconWrapActive: {'],
]);
console.log('Applied precise tutorial targets, guided scroll views, and direct Transport routing.');
