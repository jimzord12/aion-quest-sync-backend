import { relations } from "drizzle-orm";
import {
	boolean,
	integer,
	pgEnum,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";

// --- ENUMS ---
// Define these first so we can use them in tables
export const visibilityEnum = pgEnum("visibility", [
	"public",
	"legion",
	"friends",
	"private",
]);
export const classEnum = pgEnum("class", [
	"gladiator",
	"templar",
	"ranger",
	"assassin",
	"spiritmaster",
	"sorcerer",
	"cleric",
	"chanter",
	"gunner",
	"aethertech",
	"songweaver",
]);
export const gearTierEnum = pgEnum("gear_tier", ["early", "mid", "end"]);
export const questTierEnum = pgEnum("quest_tier", [
	"lesser",
	"medium",
	"greater",
	"major",
]);
export const questFactionEnum = pgEnum("quest_faction", [
	"elyos",
	"asmodian",
	"both",
]);

// --- TABLES ---

export const users = pgTable("users", {
	id: uuid("id").defaultRandom().primaryKey(),
	discordId: text("discord_id").notNull().unique(),
	username: text("username").notNull(),
	avatarUrl: text("avatar_url"),
	visibility: visibilityEnum("visibility").default("legion").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const friendGroups = pgTable("friend_groups", {
	id: uuid("id").defaultRandom().primaryKey(),
	ownerId: uuid("owner_id")
		.references(() => users.id)
		.notNull(),
	name: text("name").notNull(),
});

export const friendGroupMembers = pgTable(
	"friend_group_members",
	{
		groupId: uuid("group_id")
			.references(() => friendGroups.id)
			.notNull(),
		userId: uuid("user_id")
			.references(() => users.id)
			.notNull(),
	},
	(t) => ({
		pk: primaryKey({ columns: [t.groupId, t.userId] }),
	}),
);

export const characters = pgTable("characters", {
	id: uuid("id").defaultRandom().primaryKey(),
	userId: uuid("user_id")
		.references(() => users.id)
		.notNull(),
	name: text("name").notNull(),
	gameClass: classEnum("class").notNull(),
	gearTier: gearTierEnum("gear_tier").default("mid").notNull(),
	clearingScore: integer("clearing_score").default(0).notNull(), // Pre-calculated
});

// Static Data Table (Seeded)
export const questDefinitions = pgTable("quest_definitions", {
	id: integer("id").primaryKey(), // Manual ID to match game ID if known, or 1,2,3...
	name: text("name").notNull(),
	zone: text("zone").default("Tiamaranta").notNull(),
	tier: questTierEnum("tier").notNull(),
	faction: questFactionEnum("faction").default("both").notNull(),
});

// The "Daily Input" Log
export const dailyQuestLogs = pgTable("daily_quest_logs", {
	id: uuid("id").defaultRandom().primaryKey(),
	characterId: uuid("character_id")
		.references(() => characters.id)
		.notNull(),
	date: text("date").notNull(), // YYYY-MM-DD string is often safer than Date objects for "days"
	questIds: integer("quest_ids").array().notNull(), // Array of QuestDefinition IDs
	isCompleted: boolean("is_completed").default(false).notNull(),
	notes: text("notes"),
});

export const availabilitySlots = pgTable("availability_slots", {
	id: uuid("id").defaultRandom().primaryKey(),
	userId: uuid("user_id")
		.references(() => users.id)
		.notNull(),
	startTime: timestamp("start_time").notNull(),
	endTime: timestamp("end_time").notNull(),
	isRecurring: boolean("is_recurring").default(false).notNull(),
});

// --- RELATIONS ---

export const usersRelations = relations(users, ({ many }) => ({
	characters: many(characters),
	ownedGroups: many(friendGroups),
}));

export const charactersRelations = relations(characters, ({ one, many }) => ({
	owner: one(users, { fields: [characters.userId], references: [users.id] }),
	questLogs: many(dailyQuestLogs),
}));

export const dailyQuestLogsRelations = relations(dailyQuestLogs, ({ one }) => ({
	character: one(characters, {
		fields: [dailyQuestLogs.characterId],
		references: [characters.id],
	}),
}));

//-- Party Making System

export const inviteStatusEnum = pgEnum("invite_status", [
	"pending",
	"accepted",
	"declined",
]);

export const parties = pgTable("parties", {
	id: uuid("id").defaultRandom().primaryKey(),
	createdBy: uuid("created_by")
		.references(() => users.id)
		.notNull(), // Audit only, no special privileges
	sharedQuestIds: integer("shared_quest_ids").array().notNull(),
	scheduledStart: timestamp("scheduled_start").notNull(),
	scheduledEnd: timestamp("scheduled_end").notNull(),
	estimatedClearTime: integer("estimated_clear_time"), // Minutes, nullable
	createdAt: timestamp("created_at").defaultNow().notNull(),
	disbandedAt: timestamp("disbanded_at"), // Null = still active. Soft delete.
});

export const partyMembers = pgTable(
	"party_members",
	{
		partyId: uuid("party_id")
			.references(() => parties.id)
			.notNull(),
		userId: uuid("user_id")
			.references(() => users.id)
			.notNull(),
		characterId: uuid("character_id")
			.references(() => characters.id)
			.notNull(),
		joinedAt: timestamp("joined_at").defaultNow().notNull(),
		// No 'role' column. All members are equal.
	},
	(t) => [primaryKey({ columns: [t.partyId, t.userId] })],
);

export const partyInvites = pgTable("party_invites", {
	id: uuid("id").defaultRandom().primaryKey(),
	partyId: uuid("party_id")
		.references(() => parties.id)
		.notNull(),
	senderId: uuid("sender_id")
		.references(() => users.id)
		.notNull(),
	recipientId: uuid("recipient_id")
		.references(() => users.id)
		.notNull(),
	status: inviteStatusEnum("status").default("pending").notNull(),
	sentAt: timestamp("sent_at").defaultNow().notNull(),
	expiresAt: timestamp("expires_at").notNull(),
	respondedAt: timestamp("responded_at"),
});
