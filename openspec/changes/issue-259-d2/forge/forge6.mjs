// forge6 — F-4: attacker-controlled diff RENDERING via in-repo .gitattributes / env config.
// Measures the attack AND each mitigation. Nothing assumed.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const sh = (d, c) => execFileSync('bash', ['-c', c], { cwd: d, encoding: 'utf8' });
const rev = (d, r) => sh(d, `git rev-parse ${r}`).trim();
function repo() { const d = mkdtempSync(join(tmpdir(), 'f6-')); sh(d, 'git init -q -b main && git config user.email a@b.c && git config user.name t && git config commit.gpgsign false && echo base>README.md && git add -A && git commit -q -m base'); return d; }

// two different payloads at same path, as two independent offenders
function buildTwoPayloads(d) {
  sh(d, 'echo PAYLOAD_AAA > secret.md && git add -A && git commit -q -m o1'); const O1 = rev(d, 'HEAD');
  sh(d, 'echo PAYLOAD_BBB > secret.md && git add -A && git commit -q -m o2'); const O2 = rev(d, 'HEAD');
  return { O1, O2 };
}
const strip = (raw) => raw.split('\n').filter(l => !/^@@ /.test(l) && !/^index /.test(l)).join('\n');
function normDiff(d, a, b, cmd) { return strip(sh(d, `${cmd} ${a} ${b}`)); }

console.log('F-4a — .gitattributes "*.md -diff" planted at TIP hides md content?');
{
  const d = repo(); const { O1, O2 } = buildTwoPayloads(d);
  // attacker lands .gitattributes AFTER the offenders
  sh(d, 'printf "*.md -diff\\n" > .gitattributes && git add -A && git commit -q -m "chore: attributes"');
  const naive = `git diff --binary`;
  const hardened = `git -c core.attributesFile=/dev/null diff --no-textconv --no-ext-diff --no-renames --binary -U3`;
  const rawNaive1 = sh(d, `${naive} ${O1}^1 ${O1}`);
  console.log(`  raw naive diff(O1) render: ${JSON.stringify(rawNaive1.split('\n').find(l=>/Binary|PAYLOAD|differ/.test(l)))}`);
  const nD1 = normDiff(d, `${O1}^1`, O1, naive), nD2 = normDiff(d, `${O2}^1`, O2, naive);
  console.log(`  NAIVE  : normDiff(O1)==normDiff(O2)? ${nD1 === nD2}  ${nD1===nD2?'← FAIL-OPEN (content hidden, collapse)':'ok'}`);
  // does .git/info/attributes override help? force "* diff"
  writeFileSync(join(d, '.git', 'info', 'attributes'), '* diff\n');
  const hD1 = normDiff(d, `${O1}^1`, O1, hardened), hD2 = normDiff(d, `${O2}^1`, O2, hardened);
  console.log(`  HARDENED+info/attrs: normDiff(O1)==normDiff(O2)? ${hD1 === hD2}  ${hD1===hD2?'← still collapsing':'✓ distinguished (content exposed)'}`);
  rmSync(d, { recursive: true, force: true });
}

console.log('\nF-4b — textconv driver rendering payload as constant?');
{
  const d = repo(); const { O1, O2 } = buildTwoPayloads(d);
  sh(d, 'printf "*.md diff=hide\\n" > .gitattributes && git add -A && git commit -q -m attrs');
  // simulate a runner that has the driver configured (attacker cannot set config, but measure the mitigation)
  const withConv = `git -c diff.hide.textconv=true -c diff.hide.cachetextconv=false diff --binary`;
  const c1 = normDiff(d, `${O1}^1`, O1, withConv), c2 = normDiff(d, `${O2}^1`, O2, withConv);
  console.log(`  WITH textconv (echo-constant): normDiff collapse? ${c1 === c2}  ${c1===c2?'(payload hidden by textconv)':'(not collapsed)'}`);
  const noConv = `git -c diff.hide.textconv=true diff --no-textconv --no-ext-diff --binary`;
  const n1 = normDiff(d, `${O1}^1`, O1, noConv), n2 = normDiff(d, `${O2}^1`, O2, noConv);
  console.log(`  --no-textconv neutralizes?     normDiff collapse? ${n1 === n2}  ${n1===n2?'← STILL hidden':'✓ --no-textconv exposes content'}`);
  rmSync(d, { recursive: true, force: true });
}

console.log('\nF-4c — rename rendered as "rename from/to" (hides content) vs delete+add (exposes)?');
{
  const d = repo();
  sh(d, 'printf "SECRET_PAYLOAD\\nmore\\n" > p.md && git add -A && git commit -q -m o'); const O = rev(d, 'HEAD');
  sh(d, 'git mv p.md q.md && git commit -q -m rn'); const R = rev(d, 'HEAD');
  const withRenames = sh(d, `git -c diff.renames=true diff --binary -M ${R}^1 ${R}`);
  const noRenames = sh(d, `git -c diff.renames=true diff --binary --no-renames ${R}^1 ${R}`);
  console.log(`  diff.renames=true, -M   : ${JSON.stringify(withRenames.split('\n').filter(l=>/^(rename|diff --git)/.test(l)))}`);
  console.log(`  --no-renames (explicit) : ${JSON.stringify(noRenames.split('\n').filter(l=>/^(rename|diff --git)/.test(l)))}`);
  console.log(`  --no-renames exposes both paths (delete+add)? ${/q\.md/.test(noRenames) && /p\.md/.test(noRenames) ? '✓' : 'NO'}`);
  rmSync(d, { recursive: true, force: true });
}
