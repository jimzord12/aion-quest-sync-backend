# PRD: LegionSync — AION Classic EU Clan Coordination Tool

**Version:** 2.0
**Type:** Hobby / Internal Legion Tool
**Author:** jimzord
**Last Updated:** February 2026

---

## 1. The Problem

Playing AION Classic EU with friends should be fun. Instead, every evening turns into a mini-project: "Who has what quests today? Who is free? At what time? Is it worth grouping or should I just solo?" By the time you've figured it out over Discord messages, 30 minutes are gone before you've even logged in.

Specifically, we play the **Tiamaranta Mesa** map and farm **Watching Eye Garrison Orders** daily. These are randomly assigned quests per character, per day. Completing them solo takes up to 2 hours. A well-matched group of 3–4 players with overlapping quests and high DPS clears the same workload in 25–35 minutes. The bottleneck is never motivation — it's coordination friction.

---

## 2. The Solution

**LegionSync** is a small web app used exclusively by our Legion. It lets each player quickly log their daily quests and availability, then automatically shows who to group with tonight for the fastest possible clear.

The experience must feel like a game tool, not a productivity app. Fast to use, visually game-themed, with zero unnecessary steps.

---

## 3. Users

- **Scope**: A single, private Legion (~10–30 members)
- **Login**: Discord OAuth only (no separate accounts — everyone is already on Discord)
- **Platform**: Desktop Web App (PWA) (Windows only, since AION itself only runs on Windows)
- **Usage Pattern**: Daily, typically in the evening before or after logging into the game

---

## 4. Core Concepts

### Characters

Each player can have multiple in-game characters. A character has:

- A name (the in-game character name)
- A class (e.g. Sorcerer, Templar, Cleric, etc.)
- A gear tier (Early Game / Mid Game / End Game)

These three properties together determine how fast that character can clear quests. **High-damage classes (Sorcerer, Luminary, Ranger) clear faster than tanky classes (Templar), regardless of gear tier.** Gear tier further amplifies this.

The app uses these inputs to calculate a **Clearing Score** — a simple numeric estimate of how much a character contributes to fast quest completion. This is used to estimate how long a potential group would take to clear together.

### Daily Quests

Each day, each character receives a random set of **Watching Eye Garrison Orders**, there will be a dedicated file for this information but to get a quick overview, there are 3 types of Watching Eye Garrisons:

- **Lesser Garrisons**
- **Medium Garrisons**
- **Greater Garrisons**

Every day you get 3 free Watching Eye Garrison Orders (aka daily quests), which can be any combination of Lesser, Medium, or Greater. There is the ability to buy additional quests from an in-game NPC, which most players do to maximize their daily rewards. A good average is around 12-16 quests per character per day.

Just to keep in mind, Lesser and Medium are generally faster to clear than Greater. The app treats all quests as equal for simplicity.

The overlap between two characters' quest lists (from different users, obviously) is the primary signal for group matching. If you and a friend have 5 of the same quests, grouping is obviously worthwhile. If you share 0 quests, grouping doesn't help.

### Availability

A player inputs a time window for when they plan to play today (e.g. 8pm–11pm). This is compared against other players' windows to find actual schedule overlaps, not just quest overlaps.

### Party Making Mode (LFG)

The "I'm online now" mode. Player activates it with one tap. The system immediately shows compatible players who are also online and looking for a group, ranked by quest overlap and projected group clear time.

---

## 5. Features

### 5.1 Must Have

**Authentication & Profile**

- Login via Discord OAuth. The user's Discord identity is their account.
- User can set a visibility level: visible to the whole Legion, visible only to specific friend groups, or private (invisible to all matching).

**Friend Groups**

- User can create a named group (e.g. "Core Squad") and add specific Legion members to it.
- When using Party Making Mode, user can choose to only see matches within a specific group.
- No complex permissions or roles — a group is simply a named list of people.

**Character Management**

- Create, edit, and delete characters.
- Fields: Character Name, Class, Gear Tier.
- The Clearing Score is calculated automatically and displayed, but the user does not set it manually.
- At any time the user can go back and update a character's gear tier as they progress.

**Daily Quest Input (The Core Flow)**
This is the most important UX in the entire app. It must be fast, visual, and feel like a game menu.

> Note that the User should have open AION and picked up their quests for the day before they do this flow. The app does not need to integrate with the game or automate quest retrieval — it's purely manual input. The goal is to make that manual input as quick and painless as possible.

The flow is a **5-step wizard**:

1. Select which character you're playing today
2. Tap the **Lesser** Garrison quests you received (visual button grid)
3. Tap the **Medium** Garrison quests you received
4. Tap the **Greater** Garrison quests you received
5. Set your availability window for today (e.g. 8pm–11pm)

That's it. Submit. The whole thing should take under 2 minutes.

**Corrections are always allowed.** After submitting, the user can come back and modify any step at any time during the day. The form re-opens in its current state, not blank. This is non-negotiable — people make mistakes.

**Availability Input**

- User sets one or more time windows for today (start time → end time).
- Quick-tap presets: "1 hour", "2 hours", "3 hours", starting from now.
- Manual entry also available.
- Future Feature: Ability to set recurring availability (e.g. "every weekday from 9pm–11pm") with an easy override for exceptions.

**Party Making Mode (LFG)**

> Note that in the other mode, the Users also need to updatet their status as "online" in the app, so that they can be matched with other scheduled online users. This is needed so the app knows they are actually online and ready to group, as something might have come up and they are no longer available during their stated availability window."

- One-tap activation: "I'm online, find me a group."
- Displays a live list of other players currently in LFG mode, filtered by visibility settings.
- Each match shows: player name, character name/class, number of shared quests, time overlap, and projected group clear time estimate.
- User can copy-paste a ready-made Discord message to invite the matched players.
- Auto-deactivates when the user's stated availability window expires, or when they manually stop.

**World Event Conflict Warnings**

- The app knows the fixed weekly schedule of major world events (Fortress Sieges, Dredgion windows).
- If a user sets an availability window that overlaps a major event, a soft warning is shown: "Your window overlaps Balaurea Siege at 21:00." This is informational only — it never blocks them.

**Notifications (Windows Desktop)**

- When a new LFG match is found while the user has the app open or minimized, a **Windows desktop notification** is pushed.
- A Discord DM is also sent via the Legion bot as a fallback: "New match found! Open LegionSync to view."

**Social Panel / Game-like Presence View**

- A persistent panel showing Legion members who are currently online / in LFG / scheduled to play tonight.
- Shows each person's character, class icon, and status (online, in LFG, scheduled later, offline).
- Visually inspired by in-game party/friend UIs — not a table or a list of text.

### 5.2 Explicitly Out of Scope

- Raid planning, event management, DKP/loot tracking
- Any quests outside of Watching Eye Garrison Orders
- Mobile app or mobile-responsive design (Windows only tool)
- Automated import of quests from the game (no public Gameforge API exists)
- Full weekly schedule generation or calendar-style views
- Garrison state tracking (current owner: Elyos/Asmodian) — ignored in v1
- Guild management features (ranks, applications, announcements)

---

## 6. Player Routine

In the morning before work, quickly open AION and the app. Go and pick up your daily quests from the in-game NPC. Then open the app and enter your quests and availability for the day.

On a later note, you can see if you have good matches for grouping tonight. If you see a good match, you can hop into Discord and coordinate with your friends to group up.

## 7. UX Principles

These are not suggestions — they define how every screen should be designed.

1. **Zero friction for daily actions.** The daily quest input is a task people do every single day. Every unnecessary tap or load is a dropout risk. The path from "open app" to "submitted for today" must take under 60 seconds.

2. **Always resumable and editable.** Submitted data is never locked. Any input can be updated at any time. Forms re-open showing the current saved state, not blank.

3. **Game-themed, not corporate.** The visual language should feel like AION's UI — dark theme, clean panels, icon-heavy, ambient. Not a SaaS dashboard.

4. **Mistakes are expected.** Build undo/edit into every action. No "are you sure?" confirmations for simple edits. Reserve confirmation dialogs only for destructive actions like deleting a character.

5. **Show value immediately.** As soon as the user submits their quests, show them something useful — even if it's "no matches yet, check back at 8pm." Never show a blank result state without context.

---

## 8. Information Architecture

```
App
├── Dashboard (Home)
│   ├── My Characters + Today's Status (quests entered? availability set?)
│   ├── Social Panel (who's online, in LFG, scheduled tonight)
│   └── Quick action: "Enter Today's Quests" / "I'm Online Now"
│
├── Daily Quest Flow (Wizard)
│   ├── Step 1: Select Character
│   ├── Step 2: Lesser Garrisons
│   ├── Step 3: Medium Garrisons
│   ├── Step 4: Greater Garrisons + Availability
│   └── Result: Matches for Tonight
│
├── LFG Board
│   └── Live view of all active LFG users + match quality
│
├── Characters
│   ├── List of my characters
│   └── Create / Edit Character
│
├── Groups
│   ├── My friend groups
│   └── Create / Edit Group
│
└── Settings
    ├── Visibility
    ├── Recurring Availability
    └── Notification Preferences
```

---

## 9. Open Questions (Decide Before Building)

1. **Quest List Source**: Does someone need to manually compile the full list of Watching Eye Garrison Order names into the app's seed data? Yes. Who does this and when? It's a fixed list that doesn't change often, but it needs to be accurate for the quest selection UI to work properly. This is a one-time setup task before launch.

2. **Daily Reset Time**: What is the exact AION Classic EU daily quest reset time (likely 09:00 CET)? This determines when today's logs expire.

3. **Clearing Score Constants**: The DPS tier multipliers (Sorcerer vs Templar etc.) and gear tier multipliers are empirical guesses. Who validates these from real play experience before launch?

4. **Discord Bot Scope**: The Discord bot is only for notifications (DMs + channel embeds). It does not need slash commands or any data entry. Confirm this is the correct scope before building the bot layer. Yes — the bot is only for outbound notifications, no user commands. The User can choose which channel receives the notifications in the app settings (Windows native notfications or Discord).

5. **Invite / Onboarding**: How does a new Legion member get access? Invite link from an existing member? Auto-approve anyone in the Legion Discord server? This affects auth design. For answer see: [Discord Auth Design](design/discord-auth.md)
