// check-refs-rules.mjs — Project-specific rules for the repo:check validator.
//
// EDIT THIS FILE to define your own prohibited references and structural rules.
// The motor (scripts/check-refs.mjs) loads these rules at runtime.
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
];

// Paths (relative to repo root) that are globally exempt from ALL rules.
// Examples: historical documents, immutable audit logs, the checker itself.
export const globalExempt = [
  // 'brain/project/decisions/',   // uncomment to exempt all ADRs
  // 'openspec/',                  // uncomment to exempt all SDD artifacts
  'scripts/check-refs.mjs',        // the checker itself is always exempt
];
