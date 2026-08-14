// fenced-blocks.mjs — the ONE fence splitter for declared blocks in Markdown
// FILES (issue #495, design D2). Extracted from `lib/amendment-draft.mjs` as a
// PURE MOVE: the function body below is byte-identical to the one that lived
// there, and its three cases moved verbatim into `fenced-blocks.test.mjs`.
//
// WHY IT IS SEPARATE FROM `review/lib/yaml-block.mjs`, which also reads fences.
// They answer different questions and neither subsumes the other:
//
//   yaml-block.mjs   the inverse of ONE emitter family, over a VCS COMMENT —
//                    a body that IS a single ```yaml block carrying
//                    `protocol: brain-review/2`. `extractFencedBlock` reads the
//                    FIRST fence, which is right when there is only one, and its
//                    FENCE_RE is hardened (#487) so a fence inside a VALUE cannot
//                    truncate the block.
//
//   this module      a DOCUMENT with many blocks, where the block wanted is
//                    identified by its info-string tag (```brain-amendment/1,
//                    ```amend-find, ```brain-checkpoint/1). Position is not a
//                    selector here: a checkpoint report is definitionally full of
//                    fences, because the reviewer's evidence is command output.
//
// The split is by SHAPE OF INPUT, not by taste, and it is recorded here so the
// next reader does not "unify" them into a parser that is wrong for both.

/**
 * Splits Markdown into its fenced blocks. Sequential — once inside a fence only
 * the matching closer is looked for, so a fence quoted inside another is content.
 *
 * @param {string} text
 * @returns {{blocks: {tag:string, content:string, line:number}[], unterminated: {tag:string, line:number}|null}}
 */
export function fencedBlocks(text) {
  const lines = text.split(/\r?\n/);
  const blocks = [];
  let open = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (open === null) {
      const m = line.match(/^(`{3,})\s*([^`]*?)\s*$/);
      if (m) open = { run: m[1], tag: m[2], line: i + 1, body: [] };
      continue;
    }
    if (line.trimEnd() === open.run) {
      blocks.push({ tag: open.tag, content: open.body.join('\n'), line: open.line });
      open = null;
      continue;
    }
    open.body.push(line);
  }
  // An unterminated fence is reported, never silently dropped: a contract block
  // whose closing fence is missing used to read as "this draft carries no
  // contract at all", which sends the human looking for the wrong mistake.
  return { blocks, unterminated: open === null ? null : { tag: open.tag, line: open.line } };
}
