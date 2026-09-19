const careerPaths = require('../src/data/career_paths.json');

const milestones = [
  { weeks: 20, year: 1, level: 1 },
  { weeks: 100, year: 5, level: 3 },
  { weeks: 200, year: 10, level: 5 },
  { weeks: 500, year: 25, level: 6 },
  { weeks: 1000, year: 50, level: 7 },
];

const inflationRates = [0.01, 0.03, 0.05];
const raisesAtLevel = 2; // Typical case: two of the five available 3% performance raises.

function tax(earnings, inflationMultiplier = 1) {
  if (earnings <= 0) return 0;
  const lowerThreshold = 5000 * Math.max(1, inflationMultiplier);
  const upperThreshold = 15000 * Math.max(1, inflationMultiplier);
  if (earnings <= lowerThreshold) return Math.round(earnings * 0.15);
  if (earnings <= upperThreshold) return Math.round(lowerThreshold * 0.15 + (earnings - lowerThreshold) * 0.25);
  return Math.round(lowerThreshold * 0.15 + (upperThreshold - lowerThreshold) * 0.25 + (earnings - upperThreshold) * 0.35);
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function positionFor(path, requestedLevel) {
  return path.positions.find((position) => position.level === requestedLevel) ?? path.positions[path.positions.length - 1];
}

function scenario(path, milestone, annualInflation, salaryIncrease) {
  const position = positionFor(path, milestone.level);
  const inflation = Math.pow(1 + annualInflation, milestone.year);
  const weeklySalary = Math.round((position.baseSalary + salaryIncrease) * (1 + raisesAtLevel * 0.03) * inflation);
  const food = 50 + (position.level - 1) * 25;
  const housing = position.level >= 7 ? 3000 : position.level >= 6 ? 1400 : position.level >= 5 ? 900 : position.level >= 3 ? 500 : 300;
  const car = position.level >= 5 ? 350 : position.level >= 3 ? 200 : 150;
  const weeklyExpenses = Math.round(housing * inflation)
    + Math.round(housing * inflation) * 0.15
    + Math.round(car * inflation)
    + Math.round(food * inflation);
  const taxPerWeek = tax(weeklySalary * 20, inflation) / 20;
  const disposable = weeklySalary - taxPerWeek - weeklyExpenses;
  return { position, inflation, weeklySalary, weeklyExpenses, taxPerWeek, disposable };
}

const summary = [];
for (const rate of inflationRates) {
  for (const milestone of milestones) {
    const current = careerPaths.map((path) => scenario(path, milestone, rate, 50));
    const previous = careerPaths.map((path) => scenario(path, milestone, rate, 0));
    const salaries = current.map((row) => row.weeklySalary);
    const disposable = current.map((row) => row.disposable);
    const oldDisposable = previous.map((row) => row.disposable);
    summary.push({
      year: milestone.year,
      weeks: milestone.weeks,
      inflation: `${Math.round(rate * 100)}%`,
      multiplier: current[0].inflation.toFixed(2),
      level: milestone.level,
      medianSalary: Math.round(median(salaries)),
      salaryRange: `${Math.min(...salaries)}–${Math.max(...salaries)}`,
      medianExpenses: Math.round(median(current.map((row) => row.weeklyExpenses))),
      medianTax: Math.round(median(current.map((row) => row.taxPerWeek))),
      medianDisposable: Math.round(median(disposable)),
      minimumDisposable: Math.round(Math.min(...disposable)),
      previousMedianDisposable: Math.round(median(oldDisposable)),
    });
  }
}

console.table(summary);

console.log('\n3% inflation path by career:');
const careerRows = [];
for (const milestone of milestones) {
  for (const path of careerPaths) {
    const row = scenario(path, milestone, 0.03, 50);
    careerRows.push({
      year: milestone.year,
      career: path.name,
      level: row.position.level,
      title: row.position.title,
      salary: row.weeklySalary,
      expenses: Math.round(row.weeklyExpenses),
      tax: Math.round(row.taxPerWeek),
      disposable: Math.round(row.disposable),
    });
  }
}
console.table(careerRows);
