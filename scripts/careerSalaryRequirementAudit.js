const careerPaths = require('../src/data/career_paths.json');

const inflationRates = [0.01, 0.03, 0.05];
const raiseCounts = [0, 2, 5];
const flatSalaryIncrease = 50;

function minimumCosts(level, inflation) {
  const rent = level >= 7 ? 3000 : level >= 6 ? 1400 : level >= 5 ? 900 : level >= 3 ? 500 : 300;
  const car = level >= 5 ? 350 : level >= 3 ? 200 : 150;
  const food = 50 + (level - 1) * 25;
  const inflatedRent = Math.round(rent * inflation);
  return inflatedRent
    + Math.round(inflatedRent * 0.15)
    + Math.round(car * inflation)
    + Math.round(food * inflation);
}

function tax(earnings, inflation) {
  if (earnings <= 0) return 0;
  const lower = 5000 * inflation;
  const upper = 15000 * inflation;
  if (earnings <= lower) return earnings * 0.15;
  if (earnings <= upper) return lower * 0.15 + (earnings - lower) * 0.25;
  return lower * 0.15 + (upper - lower) * 0.25 + (earnings - upper) * 0.35;
}

function audit(position, annualInflation, raises) {
  const earliestYear = Math.max(1, Math.ceil((position.reqWeeks ?? 0) / 20));
  const inflation = Math.pow(1 + annualInflation, earliestYear);
  const salary = Math.round((position.baseSalary + flatSalaryIncrease) * (1 + raises * 0.03) * inflation);
  const costs = minimumCosts(position.level, inflation);
  const weeklyTax = tax(salary * 20, inflation) / 20;
  const disposable = salary - weeklyTax - costs;
  return { earliestYear, salary, costs, weeklyTax, disposable, ratio: disposable / costs };
}

const rows = [];
for (const path of careerPaths) {
  for (const position of path.positions) {
    const baseline = audit(position, 0.03, 0);
    const typical = audit(position, 0.03, 2);
    const maximum = audit(position, 0.03, 5);
    const stress = inflationRates.flatMap((rate) => raiseCounts.map((raises) => audit(position, rate, raises)));
    rows.push({
      career: path.id,
      level: position.level,
      title: position.title,
      year: baseline.earliestYear,
      baseSalary: position.baseSalary + flatSalaryIncrease,
      fixedCosts: baseline.costs,
      noRaisesLeft: Math.round(baseline.disposable),
      twoRaisesLeft: Math.round(typical.disposable),
      fiveRaisesLeft: Math.round(maximum.disposable),
      minimumStressLeft: Math.round(Math.min(...stress.map((result) => result.disposable))),
      typicalCostMargin: `${Math.round(typical.ratio * 100)}%`,
    });
  }
}

console.table(rows);
const failing = rows.filter((row) => row.minimumStressLeft < 0);
console.log(`\nNegative stress scenarios: ${failing.length}`);
if (failing.length) console.table(failing);
