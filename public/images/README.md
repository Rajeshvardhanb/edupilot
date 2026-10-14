# College website image assets

All images are JPGs at the target dimensions listed in the project brief.
They were encoded with high-quality JPEG settings (quality 92, 4:4:4 chroma) to preserve detail.

## Important source note
`hostel.jpg` and `admissions.jpg` use the best available earlier assets because a matching individual high-resolution generation was not available in the current session. Replace those two with newly generated originals for a fully consistent set.

- `hero-admin.jpg` — 1920 × 640
- `hero-faculty.jpg` — 1920 × 640
- `hero-student.jpg` — 1920 × 640
- `hero-parent.jpg` — 1920 × 640
- `hero-accounts.jpg` — 1920 × 640
- `placements.jpg` — 1920 × 640
- `results.jpg` — 1920 × 640
- `library.jpg` — 1920 × 480
- `hostel.jpg` — 1920 × 480
- `transport.jpg` — 1920 × 480
- `alumni.jpg` — 1920 × 480
- `admissions.jpg` — 1920 × 480
- `calendar.jpg` — 1920 × 480
- `profile-cover.jpg` — 1920 × 400
- `dept-cse.jpg` — 800 × 400
- `dept-ece.jpg` — 800 × 400
- `dept-eee.jpg` — 800 × 400
- `dept-me.jpg` — 800 × 400
- `dept-ce.jpg` — 800 × 400
- `login.jpg` — 1600 × 1000

## Notes on the current set

- `campus-life.jpg` (canteen scene) is shown on the Notice board.
- If `admissions.jpg` is ever removed, the Admissions page borrows `login.jpg`.
- Banners are wide and short, so part of each photo's height is cropped. Which part stays in view is set per photo in `src/lib/images.ts` (`FOCUS`). If a new photo crops badly, change its entry there.
- The untouched files as supplied are kept in `assets/images-original/`.
