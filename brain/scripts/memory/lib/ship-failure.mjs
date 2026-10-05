// ship-failure.mjs — a `memory ship` failure that is a repository-identity refusal (#1273).
// The thrown ProjectSlugError carries an English message; the operator reads it in their own
// language with the named fix, like every other verb that needs the slug. Any other failure is
// not this module's: memory/cli.mjs keeps its own keyed mapping.

import { ProjectSlugError, describeSlugRefusal } from "../../lib/project-slug.mjs";

/** @returns {Promise<string|null>} the localized refusal, or null when `err` is not a slug refusal */
export async function slugRefusalText(err, { locale } = {}) {
  return err instanceof ProjectSlugError ? describeSlugRefusal(err, { locale }) : null;
}
