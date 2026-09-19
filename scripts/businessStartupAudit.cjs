const fs = require('fs');
const path = require('path');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }
}).outputText, filename);
const { simulateBusinessScenario } = require('../src/engine/businessSimulation.ts');
const types = require('../src/data/business_types.json');
const median = values => { const a = [...values].sort((a,b)=>a-b); return a.length % 2 ? a[(a.length-1)/2] : (a[a.length/2-1]+a[a.length/2])/2; };
const results = [];
for (const type of types) for (const weeks of [20,75,150]) for (const seed of [11,29,47,71,97]) {
  const result = simulateBusinessScenario({businessTypeId:type.id,weeks,seed,employeeQuality:'random',upgrades:'none',reputation:25,startingBalance:15000,competition:true});
  results.push({type:type.id,weeks,seed,profit:result.totalProfit,green:result.profitableWeekRate,balance:result.endingBalance,low:result.lowestBalance,rep:result.endingReputation});
}
const summaries = [20,75,150].map(weeks => { const runs=results.filter(r=>r.weeks===weeks); return {weeks,runs:runs.length,medianProfit:Math.round(median(runs.map(r=>r.profit))),greenWeeks:Math.round(median(runs.map(r=>r.green))*100),negativeCashRuns:runs.filter(r=>r.low<0).length,medianBalance:Math.round(median(runs.map(r=>r.balance)))}; });
const byType = types.map(type => { const runs = results.filter(r=>r.type===type.id&&r.weeks===75); return {type:type.name,profit:Math.round(median(runs.map(r=>r.profit))),green:Math.round(median(runs.map(r=>r.green))*100),balance:Math.round(median(runs.map(r=>r.balance)))}; });
const report={assumptions:'3 randomized employees, reputation 25, 15000 operating cash after acquisition, no upgrades, no prestige, standard pricing, no advertising, real rival simulation, fixed inflation 1. No loans, cash injections, recruitment or manual interventions.',summaries,byType,results};
const output=path.join(__dirname,'../docs',process.argv[2] === 'before' ? 'business-startup-before.json' : 'business-startup-after.json');
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({summaries,byType},null,2));
