# Plant care design

Status: confirmed implementation specification (14 October 2026). These rules are not implemented yet.

## Agreed rules

- Health uses resting, content, and thriving conditions. Inactivity never causes
  sickness, death, or loss of growth or upgrades.
- Food is earned through active editing, not change volume.
- A minute qualifies when at least one edit occurs in a workspace text file.
  Writing, deleting, pasting, and undoing qualify. Each minute counts at most once;
  reading and leaving VS Code open do not qualify.
- Five qualifying minutes earn one food. Partial progress survives sessions.
- At most 12 food can be earned per day. Earned food never expires.
- Food is shared by plants within one workspace and manually spent on a chosen plant.
- One food improves health and adds permanent growth progress. Thriving plants
  remain eligible for feeding to gain growth progress.
- Each workspace has its own garden and food balance.

- Each feeding makes a plant thriving for seven days, then content for seven more,
  then resting. Feeding refreshes the period; it does not stack extra time.
- New and existing plants begin content, without deducting food or granting growth.
  This replaces the existing placeholder health on migration.
- Stages are Seedling, Growing, and Mature. Each food adds one growth point.
  Growing begins at five total points; Mature begins at fifteen total points.
  All species initially use these thresholds.
- The daily earning allowance resets at local midnight. After the 12-food cap,
  additional edits earn no credit until the next day. Earned food and unfinished
  progress toward the next food remain saved.
- A qualifying minute is a fixed clock minute containing at least one qualifying edit.
  Edits at 10:00:59 and 10:01:01 count as two minutes; this boundary effect is accepted.

- Unfed new plants are content for seven days after addition, then resting.
  Existing plants receive seven days of content starting at the first care migration.
- Mature plants can be fed when content or resting to refresh health. Growth stays
  capped at fifteen points; the UI explains that further growth is unavailable.
  Feeding is disabled for mature, thriving plants to prevent waste.
- Thriving plants below maturity remain feedable for growth.
- Show the shared food balance beside Add. Each info card includes a
  “Feed · 1 food” action and progress toward the next growth stage.
- Without food, disable feeding and explain that five qualifying editing minutes
  earn food. Failed saves do not deduct food or change plant progress.
- Count changes within open workspace text documents regardless of source,
  including formatting, refactors, pasting, and undoing. External changes to
  unopened files do not qualify.

- Only the focused VS Code window earns credit. Multiple windows editing the same
  workspace in one clock minute must not multiply that minute's credit.
- Reset the daily earning allowance only when the local calendar date advances
  beyond the last recorded earning date. Backward clock changes do not reset it;
  forward changes can. No clock-manipulation detection is planned.
- Health uses elapsed time, treating negative elapsed time as zero.
- Editing earns food even before the first plant is added.
- Keep reward data local: balances, minute credit, and care timestamps, never code
  contents or file names. No activity telemetry.
- The blue health meter shows three discrete conditions: resting at one-third,
  content at two-thirds, thriving at full. Always include the condition text.
  Growth has a separate progress indicator.
- The first care release includes earning, feeding, health, and growth progress
  using the existing stage-one artwork. Stage-specific illustrations come later;
  release notes must explain that visual growth is pending.

- Unsaved edits qualify when the document belongs to a workspace folder, including
  code, Markdown, and configuration files. Untitled documents and documents outside
  the workspace do not qualify. Saving unchanged text earns no credit.
- Award minute credit immediately on its first qualifying edit. The fifth credited
  minute awards food immediately. Further edits in that minute earn no more credit,
  including after reload when that credit has been persisted.
- Show progress such as “3/5 editing minutes” alongside the food balance. At the cap,
  show “Daily earning limit reached”. No-food feedback explains remaining minutes
  or the daily limit. Use quiet inline feedback, not reward notification pop-ups.
- Seven health days means 168 elapsed hours, including time with VS Code closed.
  Daily earning resets remain based on local calendar dates.
- Failed feeding leaves persisted food and plant state unchanged. Failed earning
  shows a small status message and retries pending credit while the window stays open.
  Persisted credit survives restart; credit that never saved may be lost on closure.

## Delivery and confirmation

The first release covers activity credit, food earning, feeding, health transitions,
permanent stage progress, persistence and migration, and accessible inline feedback.
It retains existing plant artwork. Removal, rearranging, watering, new stages,
cosmetic rewards, and activity telemetry are outside this milestone.

All interview decisions and the first-release scope were confirmed on 14 October
2026. This document is the agreed implementation specification. Implementation
remains pending a separate request.
