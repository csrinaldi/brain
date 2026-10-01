# Proposal (#1214)
Follow-up of #1205 / PR #1209. Three corrections to the no-default memory backend prompt in `brain/scripts/bootstrap.sh`:
1. Keep a valid answer read without a trailing newline (read returns non-zero at EOF while filling the variable).
2. Pin the Spanish prompt like the English one (no bracketed default, names both backends).
3. Test the caller block (undeclared path and `config/cli.mjs set` path).
