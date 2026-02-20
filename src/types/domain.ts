import type { InferSelectModel } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { characters, dailyQuestLogs, users } from "@/drizzle/schema";

// --- 1. Pure Types (for internal backend logic) ---
export type User = InferSelectModel<typeof users>;
export type Character = InferSelectModel<typeof characters>;
export type DailyQuestLog = InferSelectModel<typeof dailyQuestLogs>;

// --- 2. Zod Schemas (for API Validation) ---

// User Registration / Update
export const insertUserSchema = createInsertSchema(users, {
	username: z.string().min(3).max(30), // Add custom rules!
});

// Character Creation
export const insertCharacterSchema = createInsertSchema(characters, {
	name: z
		.string()
		.min(2)
		.max(20)
		.regex(/^[a-zA-Z]+$/, "Name must be letters only"),
	// Drizzle-Zod automatically uses the Enum values for 'class' and 'gearTier'
});

// Daily Quest Submission (The complex form)
export const insertDailyLogSchema = createInsertSchema(dailyQuestLogs, {
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
	questIds: z.array(z.number()).min(1, "Must select at least one quest"),
}).omit({
	id: true,
	isCompleted: true,
}); // We don't let users set ID or completion status on create

// --- 3. Combined Types for Frontend ---
export type CreateCharacterDTO = z.infer<typeof insertCharacterSchema>;
export type SubmitDailyLogDTO = z.infer<typeof insertDailyLogSchema>;
