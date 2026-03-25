import { integer, pgTable, text,timestamp  } from "drizzle-orm/pg-core";

export const videosTable = pgTable("videos", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(), // auto-generated ID
  prompt: text().notNull(),                               // video ka prompt
  videoUrl: text().notNull(),                             // video ka URL/link
});


export const WhatsAppjobsTable = pgTable("jobs", {
  id: text().primaryKey(),                        // UUID as primary key
  userPhone: text().notNull(),                    // user ka phone
  userPrompt: text().notNull(),                   // user ka diya hua prompt
  enhancedPrompt: text(),                         // AI-enhanced prompt
  status: text().notNull().default("pending"),    // pending -> processing -> completed / failed
  videoUrl: text(),                               // generated video ka URL
  createdAt: timestamp().defaultNow().notNull(),  // job creation time
    updatedAt: timestamp().defaultNow().notNull(),  // last update time
});


// New table for conversation history
export const ConversationHistoryTable = pgTable("conversation_history", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(), // auto-generated ID
  userPhone: text().notNull(),                    // user ka phone
  role: text().notNull(),                         // "user" or "assistant"
  message: text().notNull(),                      // message content
  timestamp: timestamp().defaultNow().notNull(),  // when message was sent
});