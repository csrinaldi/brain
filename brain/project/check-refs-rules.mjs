// check-refs-rules.mjs — Project-specific rules for the repo:check validator.
//
// EDIT THIS FILE to define your own prohibited references and structural rules.
// The motor (brain/scripts/check-refs.mjs) loads these rules at runtime.
//
// Format:
//   prohibitedRefs — array of rule objects; each rule is checked against every
//                    tracked file (respecting onlyExt and exempt filters).
//   globalExempt   — paths (relative to repo root) that are NEVER checked.
//                    Useful for historical/immutable documents.
//
// Rule object shape:
//   {
//     id: string,           // short identifier shown in error output
//     pattern: RegExp,      // tested against each line of each file
//     reason: string,       // human-readable explanation of the violation
//     onlyExt?: string[],   // optional: restrict to these file extensions
//     exempt?: string[],    // optional: paths exempt from this specific rule
//   }
//
// Example rules below are generic starters. Replace or extend them.

export const prohibitedRefs = [
  {
    id: 'hardcoded-secret',
    // Catches common patterns: password="abc123", secret: "xyz", token=literal
    // Excludes shell command substitutions (token="$(...)") and variable references (token="$VAR").
    pattern: /(?:password|secret|api_key|token)\s*[=:]\s*["'][^"'$({]{8,}["']/i,
    reason: 'Hardcoded secret detected — use environment variables instead.',
    onlyExt: ['.js', '.mjs', '.ts', '.sh', '.yaml', '.yml', '.json'],
    exempt: ['.env.example'],
  },
  {
    id: 'todo-without-ticket',
    // Enforce that inline TODO comments reference a ticket number.
    // Valid forms: "TODO(#42)" or "TODO: #42"
    pattern: /\/\/\s*TODO(?!\s*[:(]\s*#\d)/,
    reason: 'TODO without a ticket reference — add a ticket number, e.g. // TODO(#42): description.',
    onlyExt: ['.js', '.mjs', '.ts'],
    exempt: ['brain/project/check-refs-rules.mjs'],
  },
  {
    id: 'no-verify-bypass',
    // Prohibit --no-verify and `git commit -n` in tracked scripts.
    // These flags bypass the client-hook floor (commit-msg, pre-commit, pre-push),
    // silencing governance enforcement locally.  brain's own scripts must NEVER
    // use them — violations are detected here (pre-push / CI) and caught again by
    // brain:audit on the merged history.  See ADR-0014 §9 (--no-verify policy).
    //
    // Hook files (brain/scripts/hooks/pre-commit, pre-push) are intentionally extensionless
    // and therefore excluded by onlyExt — they document the bypass option to users,
    // which is legitimate self-documentation, not an invocation.
    pattern: /--no-verify|\bgit commit\b[^"'\n]*\s+-n\b/,
    reason:
      'Use of --no-verify or git commit -n bypasses governance hooks — strictly prohibited. See ADR-0014 §9.',
    onlyExt: ['.mjs', '.js', '.ts', '.sh'],
    // Exempt files that legitimately reference --no-verify without invoking it:
    //   • check-refs-rules.mjs — defines the pattern as a regex literal
    //   • check-refs.test.mjs  — holds fixture strings testing the rule itself
    //   • installer.test.mjs   — fixture mirrors brain's settings.json hook that
    //                            DETECTS --no-verify (the guard, not a bypass)
    exempt: [
      'brain/project/check-refs-rules.mjs',
      'brain/scripts/check-refs.test.mjs',
      'brain/scripts/lib/installer.test.mjs',
    ],
  },
];

// Paths (relative to repo root) that are globally exempt from ALL rules.
// Examples: historical documents, immutable audit logs, the checker itself.
export const globalExempt = [
  // 'brain/project/decisions/',   // uncomment to exempt all ADRs
  // 'openspec/',                  // uncomment to exempt all SDD artifacts
  'brain/scripts/check-refs.mjs',        // the checker itself is always exempt
];
