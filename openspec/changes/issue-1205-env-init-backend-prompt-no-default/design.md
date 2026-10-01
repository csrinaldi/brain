# Design (#1205)

In the lifted `memory-backend-validate` fragment, `read ... || { answer=""; break; }` handles EOF; `case` accepts only `engram|plainfiles`, ignores `''` (loop repeats, the prompt is the feedback) and rejects the rest as before. After the fragment, an empty `MEMORY_BACKEND` reuses the existing undeclared warning and `MISSING_OPTIONAL` entry (same text as the non-TTY branch); a non-empty one is declared to tracked config as before. The `:-engram` default line is deleted.
