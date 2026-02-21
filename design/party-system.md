# Party System Design Document

**Project:** LegionSync — AION Classic EU Clan Coordination Tool
**Version:** 1.0
**Last Updated:** February 2026
**Author:** jimzord

---

## 1. Overview

The Party System enables players to form groups for coordinated daily quest clearing in AION Classic EU's Tiamaranta Mesa. It mirrors AION's in-game party mechanics to maintain intuitive UX for players already familiar with the game.

A **Party** is a live group of 2–6 players who have agreed to run together for a specific session. **Invites** are asynchronous one-way requests that allow players to join existing parties. The two systems are loosely coupled, allowing flexible social dynamics without rigid state machines.

---

## 2. Core Principles

1. **Copy the game, don't invent**: AION players already understand how parties work. The app should match that mental model exactly.

2. **Loose coupling**: Invites and parties are separate entities. A player can have multiple pending invites while in a party, while not in a party, or while considering their options.

3. **Flat privilege model**: All party members have equal rights. Any member can invite others. No member can remove another. Social conflicts are resolved by leaving and reforming.

4. **Minimal state**: The party is "alive" if it exists and has 2–6 members. No status enums. All business rules are derived from member count and timestamps.

5. **Transparent visibility**: When a player is in a party, they're visible to others as "In Party" but hidden from the LFG matching pool.

---

## 3. Player States

A player can be in exactly one of these states at any given time:

| State           | Meaning                        | Visible in LFG Board? | Can Receive Invites?         |
| --------------- | ------------------------------ | --------------------- | ---------------------------- |
| `available`     | In LFG pool, looking for group | Yes                   | Yes                          |
| `in-party`      | Currently in an active party   | No                    | Yes (with warning on accept) |
| `not-available` | Private mode or offline        | No                    | No                           |

**State transitions:**

- `available` → `in-party`: When player accepts an invite and joins a party
- `in-party` → `available`: When player leaves party or party disbands
- Any state → `not-available`: When player sets privacy mode or goes offline
- `not-available` → `available`: When player returns and re-enters LFG mode

---

## 4. Domain Model

### 4.1 Parties Table

```typescript
export const parties = pgTable('parties', {
  id: uuid('id').defaultRandom().primaryKey(),
  createdBy: uuid('created_by')
    .references(() => users.id)
    .notNull(), // Audit only
  sharedQuestIds: integer('shared_quest_ids').array().notNull(),
  scheduledStart: timestamp('scheduled_start').notNull(),
  scheduledEnd: timestamp('scheduled_end').notNull(),
  estimatedClearTime: integer('estimated_clear_time'), // Minutes, nullable
  createdAt: timestamp('created_at').defaultNow().notNull(),
  disbandedAt: timestamp('disbanded_at'), // Null = active, timestamp = disbanded
});
```

**Field Explanations:**

- `createdBy`: The user who initially formed the party. Has no special privileges — purely for audit/history.
- `sharedQuestIds`: Array of Quest IDs that all members plan to complete together. This is the intersection of quests when the party is formed.
- `scheduledStart` / `scheduledEnd`: The agreed time window for this session. Derived from overlapping availability of initial members.
- `estimatedClearTime`: Projected minutes to complete all shared quests, calculated from the group's combined clearing scores.
- `disbandedAt`: Soft delete. Null means party is active. Non-null means party no longer exists but history is preserved.

### 4.2 Party Members Table

```typescript
export const partyMembers = pgTable(
  'party_members',
  {
    partyId: uuid('party_id')
      .references(() => parties.id)
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id)
      .notNull(),
    characterId: uuid('character_id')
      .references(() => characters.id)
      .notNull(),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
  },
  t => ({
    pk: primaryKey({ columns: [t.partyId, t.userId] }),
  })
);
```

**Field Explanations:**

- `characterId`: The specific character this user is bringing to the party (since users can have multiple characters).
- `joinedAt`: Timestamp when this member joined. Used for audit and for determining who gets "leadership" if that matters later (currently it doesn't).
- **No `role` field**: All members have equal privileges.

### 4.3 Party Invites Table

```typescript
export const inviteStatusEnum = pgEnum('invite_status', [
  'pending', // Sent, awaiting response
  'accepted', // Recipient joined the party
  'declined', // Recipient said no
  'expired', // Timed out (e.g. 10 min no response)
  'cancelled', // Sender retracted it, or party disbanded before response
]);

export const partyInvites = pgTable('party_invites', {
  id: uuid('id').defaultRandom().primaryKey(),
  partyId: uuid('party_id')
    .references(() => parties.id)
    .notNull(),
  senderId: uuid('sender_id')
    .references(() => users.id)
    .notNull(),
  recipientId: uuid('recipient_id')
    .references(() => users.id)
    .notNull(),
  status: inviteStatusEnum('status').default('pending').notNull(),
  sentAt: timestamp('sent_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(), // sentAt + 10 minutes default
  respondedAt: timestamp('responded_at'),
});
```

**Field Explanations:**

- `senderId`: Any current member of the party can send invites. Not restricted to party creator.
- `expiresAt`: Auto-calculated as `sentAt + 10 minutes` (configurable). After this time, status → `expired`.
- `respondedAt`: Timestamp when recipient accepted/declined. Null if still pending or expired without action.

---

## 5. Party Lifecycle

### 5.1 Forming a New Party

**Trigger:** Player A (state: `available`) sees Player B in the LFG Board and clicks **"Invite"**

**Backend actions:**

1. Create a new `parties` record:
   - `createdBy`: Player A
   - `sharedQuestIds`: Intersection of Player A and Player B's daily quests
   - `scheduledStart` / `scheduledEnd`: Overlapping time window between A and B
   - `estimatedClearTime`: Calculated from A + B's combined clearing scores
2. Insert Player A into `partyMembers` (they auto-join their own party)
3. Create a `partyInvites` record:
   - `senderId`: Player A
   - `recipientId`: Player B
   - `status`: `pending`
   - `expiresAt`: `NOW() + 10 minutes`
4. Send notification to Player B (desktop notification + Discord DM)

**Player A's state:** `available` → `in-party`

### 5.2 Accepting an Invite

**Trigger:** Player B clicks "Accept" on a pending invite

**Backend checks:**

1. Is the invite still valid? (`status = pending`, `expiresAt > NOW()`)
2. Is the party still active? (`disbandedAt IS NULL`)
3. Does the party have room? (`SELECT COUNT(*) FROM party_members WHERE party_id = X` < 6)
4. **Is Player B already in another party?**
   - YES → Show warning modal: _"You're already in a party. Joining this party will remove you from your current party. Continue?"_
   - User must explicitly confirm → removes Player B from old party, then proceeds

**If all checks pass:**

1. Insert Player B into `partyMembers`
2. Update invite: `status = accepted`, `respondedAt = NOW()`
3. Player B's state: → `in-party`
4. Send notification to all current party members: _"PlayerB joined the party"_
5. Recalculate `estimatedClearTime` with new member included

### 5.3 Declining an Invite

**Trigger:** Player B clicks "Decline" on a pending invite

**Backend actions:**

1. Update invite: `status = declined`, `respondedAt = NOW()`
2. Send notification to sender (Player A): _"PlayerB declined your invite"_

### 5.4 Invite Expiry

**Trigger:** Background job checks `expiresAt` every minute

**Backend actions:**

1. Find all invites where `status = pending` AND `expiresAt <= NOW()`
2. Update: `status = expired`
3. No notification sent (silent expiry)

### 5.5 Inviting Additional Members

**Trigger:** Any party member (Player A or Player B) sees Player C in LFG and clicks "Invite"

**Backend actions:**

1. Verify sender is a current party member
2. Verify party is not full (< 6 members)
3. Create `partyInvites` record (same flow as 5.1)
4. Send notification to Player C

**Key point:** Any member can invite. No permission check beyond "are you in this party?"

### 5.6 Party Reaches 6 Members

**Trigger:** 6th player accepts an invite

**Backend actions:**

1. Insert 6th member into `partyMembers`
2. Find all remaining `pending` invites for this party
3. Update them: `status = cancelled`
4. Send notification to those pending invitees: _"Party is now full"_
5. Party is no longer shown in the LFG invite interface for any members

### 5.7 Leaving a Party

**Trigger:** Player B clicks "Leave Party"

**Backend actions:**

1. Delete Player B's row from `partyMembers`
2. Player B's state: `in-party` → `available`
3. Send notification to remaining party members: _"PlayerB left the party"_
4. **If party now has 0 members:**
   - Set `parties.disbandedAt = NOW()` (soft delete)
   - Cancel all `pending` invites for this party

### 5.8 Party Disbands

A party disbands when:

- The last member leaves voluntarily
- All members leave (one by one)
- An admin manually disbands it (future feature, optional)

**Backend actions:**

1. Set `parties.disbandedAt = NOW()`
2. Delete all rows from `partyMembers` for this party (or leave for history)
3. Update all `pending` invites: `status = cancelled`
4. Send notification to all recipients of cancelled invites: _"Party disbanded"_

---

## 6. Business Rules

These are derived rules enforced by the backend. No state machine needed — just pure checks.

```typescript
// Party capacity
const MAX_PARTY_SIZE = 6;

const isPartyFull = (memberCount: number): boolean => memberCount >= MAX_PARTY_SIZE;

// Party existence
const isPartyActive = (party: Party): boolean => party.disbandedAt === null;

// Joinability
const isPartyJoinable = (party: Party, memberCount: number): boolean =>
  isPartyActive(party) && !isPartyFull(memberCount);

// Invite validity
const isInviteValid = (invite: PartyInvite): boolean =>
  invite.status === 'pending' && invite.expiresAt > new Date();

// Can user send invite?
const canUserInvite = (userId: UUID, partyId: UUID): boolean =>
  // User must be a current member of this party
  existsInPartyMembers(userId, partyId) &&
  // Party must not be full
  !isPartyFull(getPartyMemberCount(partyId));
```

---

## 7. Edge Cases & Handling

| Scenario                                     | Behavior                                                                                                                                                                          |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Player has multiple pending invites**      | All are shown in their inbox. Accepting one does NOT auto-decline others. Others remain valid until they expire or player accepts one (then warning modal on subsequent accepts). |
| **Invite recipient already in a party**      | Invite is still sent and valid. On accept, show warning: _"Joining will leave your current party."_ Require explicit confirmation.                                                |
| **Party disbands while invites are pending** | All `pending` invites for that party auto-set to `cancelled`. Recipients notified: _"Party disbanded."_                                                                           |
| **Invite expires (10 min no response)**      | Status → `expired`. No action required. Player stays in current state.                                                                                                            |
| **Player leaves party voluntarily**          | Removed from `partyMembers`. State → `available`. Remaining party members notified.                                                                                               |
| **Party drops to 0 members**                 | Party auto-disbands (`disbandedAt = NOW()`).                                                                                                                                      |
| **Player goes offline while in party**       | Remains in party. State → `not-available`. Party members see them as "offline" in party roster.                                                                                   |
| **Sender retracts invite before response**   | Update invite: `status = cancelled`. Recipient notified: _"Invite cancelled."_                                                                                                    |

---

## 8. UI/UX Implications

### 8.1 LFG Board

**Visibility:**

- Players with state `available` are shown
- Players with state `in-party` are **hidden** from the board
- Players with state `not-available` are **hidden** from the board

**Invite button:**

- Only shown if viewing player is either `available` OR `in-party` with a party that has < 6 members
- Disabled if target player is `not-available`

### 8.2 Social Panel

**Player status display:**

- `available`: Green dot, "Looking for Group"
- `in-party`: Blue dot, "In Party (3/6)" with member count
- `not-available`: Gray dot, "Offline" or "Private"

**Clicking on an `in-party` player:**

- Shows party roster (character names, classes, shared quests)
- If viewing player is in the same party: shows "Leave Party" button
- If viewing player is NOT in that party: shows party details (read-only)

### 8.3 Invite Inbox

**Location:** Notification bell icon in top-right corner

**Shows:**

- All `pending` invites (sorted by `sentAt` descending)
- Badge count on notification icon
- Each invite shows:
  - Sender name + character
  - Shared quests count
  - Estimated clear time
  - Time remaining until expiry
  - Accept / Decline buttons

**Auto-refresh:** Polls every 30 seconds for new invites (or use WebSocket for real-time)

### 8.4 Active Party Card (Dashboard)

**Shown when:** User state is `in-party`

**Displays:**

- Party roster (all members, characters, classes)
- Shared quests list
- Estimated clear time
- Scheduled time window
- "Invite Player" button (if < 6 members)
- "Leave Party" button

---

## 9. Notifications

All notifications are sent via **two channels simultaneously**: Windows desktop notification + Discord DM.

| Event                   | Recipient             | Message                                                                           |
| ----------------------- | --------------------- | --------------------------------------------------------------------------------- |
| **New invite received** | Invite recipient      | _"[SenderName] invited you to their party — 5 shared quests, est. clear: 28 min"_ |
| **Invite accepted**     | All party members     | _"[PlayerName] joined the party"_                                                 |
| **Invite declined**     | Invite sender         | _"[PlayerName] declined your invite"_                                             |
| **Invite cancelled**    | Invite recipient      | _"[SenderName] cancelled their invite"_                                           |
| **Party full**          | All pending invitees  | _"Party is now full"_                                                             |
| **Member left party**   | All remaining members | _"[PlayerName] left the party"_                                                   |
| **Party disbanded**     | All pending invitees  | _"Party disbanded"_                                                               |

---

## 10. Database Indexes (Performance)

```sql
-- Fast lookup: "Is user in a party?"
CREATE INDEX idx_party_members_user_id ON party_members(user_id);

-- Fast lookup: "How many members in this party?"
CREATE INDEX idx_party_members_party_id ON party_members(party_id);

-- Fast lookup: "Get all pending invites for user"
CREATE INDEX idx_party_invites_recipient_status ON party_invites(recipient_id, status);

-- Fast lookup: "Get all active parties"
CREATE INDEX idx_parties_disbanded_at ON parties(disbanded_at) WHERE disbanded_at IS NULL;

-- Background job: "Find expired invites"
CREATE INDEX idx_party_invites_expires_at ON party_invites(expires_at) WHERE status = 'pending';
```

---

## 11. Open Questions / Future Considerations

1. **Scheduled parties**: Should users be able to create a party in advance for "tomorrow night 8pm" even if they're not immediately LFG? Current design assumes parties are formed when someone is actively looking NOW.

2. **Party history / stats**: `disbandedAt` soft delete preserves history. Future feature: show a user's past parties, successful sessions, frequent teammates?

3. **Voice chat integration**: If the Legion uses a Discord voice channel, should the app auto-suggest "Join voice with your party" with a deeplink?

4. **Kick feature**: Currently no member can remove another. If abuse becomes an issue, should we add a vote-kick (requires 2/3 majority)?

5. **Auto-disband on session end**: Should parties auto-disband when `scheduledEnd` timestamp passes, or do they persist until manually disbanded? Current design: they persist (manual cleanup required).

---

## 12. Summary

The Party System is intentionally simple and mirrors AION's existing mental model. Key design wins:

- **No rigid state machine**: Party is "alive" or "disbanded" — that's it
- **Flat privileges**: All members equal, no leadership politics
- **Loose coupling**: Invites are independent entities, allowing flexibility
- **Transparent visibility**: In-party players are visible in social UI but hidden from LFG pool

This design prioritizes social flexibility and real-world messiness (people change their minds, go AFK, need to bail) over rigid "contract enforcement."
