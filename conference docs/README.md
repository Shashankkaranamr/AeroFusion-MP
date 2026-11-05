# Conference docs: shortlist for the MW-AeroFusion-Net paper

Checked on the official sites on **5 Nov 2026**. Re-check the dates before submitting, because conferences often extend them.

We submit to **one** conference only. All three forbid simultaneous submission elsewhere. Each file below gives that
conference's submission process, format rules, a title and abstract tailored to its scope, and the changes needed
from our IEEE draft (`docs/paper/main.tex`).

| | [ICICC-2027](ICICC-2027.md) | [NEXAI 2027](NEXAI-2027.md) | [IEEE ICRCICN 2027](IEEE-ICRCICN-2027.md) |
|---|---|---|---|
| Publisher | Springer LNNS (approved) | Springer LNNS (approved) | IEEE Xplore (record #73691) |
| Host | SSCBS, University of Delhi | The NorthCap University, Gurugram | Kalyani Govt. Engg. College, WB |
| Conference | 5–6 Feb 2027 (hybrid) | 4–5 Mar 2027 (hybrid) | 27–28 Feb 2027 (hybrid) |
| **Full paper due** | **25 Nov 2026** | **22 Nov 2026** | **30 Nov 2026** |
| Acceptance | 25 Dec 2026 (first review 10 Dec) | by 1 Jan 2027 (rolling) | 1 Feb 2027 |
| Length | ≤ 10 pages, Springer A4 | 10–12 pages, LNNS single column (min 4) | ≤ 6 pages IEEE 2-column (+2 paid) |
| Review | double-blind | double-blind | not blind (authors on paper) |
| Student fee | ₹12,000 early / ₹13,000 late | ₹7,500 early / ₹8,500 regular | ₹8,000 (IEEE member) / ₹8,500 early |
| Format work from our draft | convert to Springer LaTeX | convert to Springer LaTeX (NEXAI template) | almost none (already IEEE) |

## How "abstract submission" works at these three
None of them has a separate abstract-only round. All three take the **full paper** through **Microsoft CMT**:
1. Create a CMT account at https://cmt3.research.microsoft.com (one per author is best).
2. Choose the conference and **Create new submission**. Enter the title, abstract and keywords in the form (text below)
   and pick a track or subject area. Then add the authors (for ICICC and NEXAI they are entered in CMT but removed from the PDF).
3. Upload the PDF before the deadline. In CMT a submission can usually be created early and the PDF
   replaced until the deadline, so the title and abstract can be registered first and the final PDF uploaded when the
   results are in.

## Integrity rules for every version (from CLAUDE.md / PROGRESS §0)
- Every number in the abstract or paper comes from `ml/runs/<run_id>/metrics.json` via `make_tables.py`.
  The `[RESULTS …]` slots stay empty until the frozen-test evaluation (`final_eval.py`) has run.
- Write "learned attribution" or "source-group attribution gating", never "causal attribution" or "% source contribution".
  No "first"/"novel" claims.
- Keep the AI-assistance disclosure in the Acknowledgment. Springer also asks for it.

## Suggested order
1. **ICICC-2027.** It is the only one with a decision in December and an approved Springer series.
2. **IEEE ICRCICN 2027.** It is the backup if results slip past 25 Nov, since it has the latest deadline and no format conversion.
3. **NEXAI 2027.** It fits the topic well (AI/GNN/explainability tracks), but its 22 Nov deadline is the tightest.
