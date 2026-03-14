# AGENTS.md

## Goal
Build a facilitator-led online board game for 3-5 players that supports career reflection, job understanding, self-awareness, and peer feedback.

## Product constraints
- Language: Japanese UI by default.
- Target session length: 60-90 minutes.
- No win/lose condition.
- Game should work as a facilitator-led workshop.
- Voice/chat is NOT built into the app; assume users talk on Zoom or ovice.
- The app should focus on board state, cards, prompts, turn order, timing aids, and reflection summary.

## MVP scope
- Create/join room
- Configure 3-5 players
- Display 40-space board
- Roll dice and move tokens
- Resolve space effects
- Deal 5 public career cards per player
- Show question prompts and event prompts
- Facilitator controls session progression
- End by time limit OR first goal OR facilitator choice
- Reflection screen for self-choice and peer-choice career matching

## Technical constraints
- Use Next.js App Router + TypeScript.
- Keep data in JSON files first.
- Avoid adding a backend unless necessary.
- Use deterministic IDs for cards/spaces.
- Write clean, readable components.
- Add basic unit tests for game progression logic if practical.

## UX constraints
- Simple, workshop-friendly UI.
- Desktop-first, tablet-friendly.
- Distinguish facilitator controls clearly.
- All player career cards are public.
- Provide timers/hints but keep facilitator override everywhere.

## Deliverables
- Working local app
- Clear README with setup instructions
- Seeded data files
- Basic validation and empty states

