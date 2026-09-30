CREATE TYPE "public"."activity_challenge_reminder_kind" AS ENUM('automatic', 'organiser');--> statement-breakpoint
CREATE TABLE "activity_challenge_reminder" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"week_number" integer NOT NULL,
	"kind" "activity_challenge_reminder_kind" NOT NULL,
	"sent_by" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_challenge_member" ADD COLUMN "locale" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "activity_challenge_member" ADD COLUMN "reminders_opt_out" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "activity_challenge_reminder" ADD CONSTRAINT "activity_challenge_reminder_member_id_activity_challenge_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."activity_challenge_member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_challenge_reminder" ADD CONSTRAINT "activity_challenge_reminder_sent_by_user_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "activity_challenge_reminder_auto_idx" ON "activity_challenge_reminder" USING btree ("member_id","week_number") WHERE "activity_challenge_reminder"."kind" = 'automatic';--> statement-breakpoint
CREATE INDEX "activity_challenge_reminder_member_idx" ON "activity_challenge_reminder" USING btree ("member_id");