# Spec — delta requirements (#1384)

- **REQ-1384-1** `package.json` reads `1.13.0`; no README or adoption pin outside history names `1.12.1`.
- **REQ-1384-2** The CHANGELOG's 1.13.0 entry puts "Manual step: read before upgrading, first." before everything else, and its first item states the deletion with the measured count.
- **REQ-1384-3** Every behavioural sentence of the entry and of the changed doc lines is traced to code in `claim-sweep.md`; an untraceable sentence is fixed or deleted and listed under "Corrected".
- **REQ-1384-4** The saved 1.12.1 upgrader, run against the 1.13.0 tarball on a 1.12.1 consumer, removes the retired files, leaves no test file under `brain/scripts`, and leaves all four axes resolving rc=0 with `.env` aside.
- **REQ-1384-5** The 1.12.0 upgrader, run against the tarball on a consumer 1.12.0 stamped without the axis shape, repairs it: all four axes resolve rc=0 with `.env` aside.
- **REQ-1384-6** `docs/KNOWN-LIMITATIONS.md` lists #1352, #1353, #1355, #1362 and #1374, each open when the file was written, and states 1.13.0.
