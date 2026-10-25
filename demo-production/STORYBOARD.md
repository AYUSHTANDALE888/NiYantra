# Storyboard v2

Primary cut ≈ 4 min 45 s, 1920×1080, 30 fps. Short cut ≈ 90 s (chapters marked ★). Every app frame is a real Playwright recording on a fresh demo reset with synthetic accounts; Remotion adds only overlays (titles, chapter bar, callouts, zooms, cursor effects, subtitles, sound).

## The six editing principles, as concrete devices

| Principle | Device in the edit |
|---|---|
| 01 Guide the viewer's eyes | Smooth zoom (1.0→1.6×) toward the element about to be used, driven by the recorded click coordinates; everything else dims to 70 %; a soft spotlight ring around the target. |
| 02 Show where you are | Persistent top-left chapter chip ("3 / 9 · Return and reply"), a role badge ("Signed in as: Scrutiny officer — Priya Raman") and the URL path in a small pill; a thin progress bar of chapters along the bottom. |
| 03 Show cause and effect | After each key action: freeze 0.4 s on the click, then a labelled arrow from the button to the change it caused (badge colour, clock paused, new row), with a before/after mini split when the change is on another screen. |
| 04 Explain alongside the interface | Narration plus a side card (≤ 12 words) that slides in at the edge, never covering the field in use; on-screen text names the rule or reason the app itself shows. |
| 05 Make interactions readable | Visible cursor with click ripple and a clear click sound; typing at a human pace with soft key sounds; keystroke chips for Tab/Enter; field labels highlighted while being filled; slow-motion (0.6×) on the decisive click. |
| 06 Organise into chapters | 9 chapter cards (2 s each, number + title + one-line purpose) and the chapter bar; chapter markers in the MP4 metadata and a chapters list in the README for YouTube. |

## Scene pattern for every feature

A. Purpose (5–8 s): problem first, over a still of the starting screen with a title card.
B. Real interaction (10–25 s): navigate, fill, trigger.
C. Verified result (5–10 s): the saved record or updated screen, zoomed and labelled.
D. Takeaway (3–5 s): one sentence on why it matters; transition to the next chapter.

## Chapters

| # | Chapter | A. Purpose | B. Real interaction | C. Verified result | D. Takeaway |
|---|---|---|---|---|---|
| 0 | Cold open (8 s) | "Approving a technical institution takes many hands — and many deadlines." | Fast montage (1 s each) of 6 real screens from later chapters | Title: AICTE Demo Website · prototype disclaimer | "Here is how this prototype keeps every step visible." |
| 1 ★ | The public portal (25 s) | Anyone should see the schedule and every rule change, in their language | Home → press A+ → हिंदी → high contrast → back | Same page in three modes (split into thirds) | "Accessible before you even sign in." |
| 2 ★ | A college files (40 s) | Forms are long; mistakes found late cost weeks | Sign in as ABC Engineering College → new application → built-up area larger than land → Check my entries → omit land lease | R1 HIGH warning (advice, not a block); Submit disabled naming the missing document; then submitted with a justification | "Problems caught at the desk, not months later." |
| 3 | Assigned, with reasons (20 s) | Who handles a case, and why, is usually invisible | Priya's Action Center → open the case | "Assigned to Priya Raman … portfolio officer … utilisation … Rules 2027-28 v1" | "Every assignment explains itself." |
| 4 ★ | Return and reply (35 s) | Delays are often blamed on the wrong side | Priya returns with a deficiency → college replies with a 3-year lease | Split screen: officer and college views; the clock badge turns amber "paused" then resumes with remaining days | "The clock is fair to both sides." |
| 5 ★ | Deadlines that escalate (30 s) | Overdue work gets forgotten | Admin moves the simulated date forward 20 days | "Simulated date" clock animation; Kumar's dashboard shows the escalation exactly once; Action Center explains why | "Nothing slips quietly." |
| 6 | Leave and workload (25 s) | When someone is away, their queue stalls | Officer adds leave → Kumar reassigns with the recommendation | Tasks moved with reasons; "Recommended by system" recorded | "Work follows capacity, with a record of why." |
| 7 | Visit, decision, compliance (40 s) | Approval is not the end; conditions must be met | Expert visit scheduled → committee report → approval with conditions → 85 days later: reminders → evidence → verification | Case CLOSED | "From application to closure in one traceable thread." |
| 8 ★ | Rules change every year (40 s) | Rule changes break systems and surprise colleges | Editor drafts a corrigendum → marks it live → refused → impact preview → a different person approves and publishes → college sees the banner | Refusal text, impact sentences, maker/checker names, banner "1 change … since your last visit" | "Change is previewed, approved by two people, and announced." |
| 9 ★ | Trust and closing (25 s) | A log that can be edited proves nothing | Admin verifies integrity → (demo tool) a row is altered → verify again → South officer opens a West case | "Broken: row N" detected; access denied and logged | "Tamper-evident and scoped." Closing card: recap of 4 ideas, the live demo link, disclaimer |

## Narration delivery

- Emotional arc: curious (cold open) → reassuring (portal, filing) → concerned then relieved (return/clock, escalation) → confident (rules, trust) → warm close.
- Breath pauses: about 0.25 s at commas, 0.6 s between sentences, 0.9 s before each takeaway line; the music dips 6 dB under speech and swells slightly at chapter cards.

## Honesty rules

- The form check is shown as it really runs: on the hosted site and locally without the Python service it says "Model unavailable: rules only", and the narration then talks about the rules only.
- No claims about real AICTE rules, payments, email or SMS, or official status; the prototype disclaimer stays on the title and closing cards and is visible in every app frame.
- Time travel and the tamper step are labelled "demo tool" on screen.
