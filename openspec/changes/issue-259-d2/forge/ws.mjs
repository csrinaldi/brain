import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const sh = (d, c) => execFileSync('bash', ['-c', c], { cwd: d, encoding: 'utf8' });
function pidAdd(line) {
  const d = mkdtempSync(join(tmpdir(), 'ws-'));
  sh(d, 'git init -q -b main && git config user.email a@b.c && git config user.name t && git config commit.gpgsign false');
  sh(d, `printf 'x\\ny\\n' > f.txt && git add -A && git commit -q -m base`);
  sh(d, `printf 'x\\n%s\\ny\\n' "${line}" > f.txt && git add -A && git commit -q -m add`);
  const c = sh(d, 'git rev-parse HEAD').trim();
  const pid = sh(d, `git diff --binary ${c}^1 ${c} | git patch-id --stable`).trim().split(/\s+/)[0];
  rmSync(d, { recursive: true, force: true });
  return pid;
}
const plain = pidAdd('INSERTED');
const indented = pidAdd('        INSERTED');   // 8 leading spaces — YAML-indent style
const tabbed = pidAdd('\\tINSERTED');
console.log(`add "INSERTED"          pid = ${plain}`);
console.log(`add "        INSERTED"   pid = ${indented}`);
console.log(`add "<TAB>INSERTED"      pid = ${tabbed}`);
console.log(`\nwhitespace-only divergence COLLIDES? ${plain === indented || plain === tabbed}  ${(plain===indented||plain===tabbed)?'← patch-id IGNORES whitespace (YAML-indent payload launderable)':'✓ whitespace-SENSITIVE → indentation payload fails closed'}`);
