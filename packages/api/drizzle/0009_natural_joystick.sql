CREATE TYPE "public"."activity_challenge_digest_cadence" AS ENUM('off', 'weekly', 'twice_weekly');--> statement-breakpoint
CREATE TYPE "public"."activity_challenge_send_trigger" AS ENUM('scheduled', 'organiser');--> statement-breakpoint
CREATE TABLE "activity_challenge_digest" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"slot" text NOT NULL,
	"trigger" "activity_challenge_send_trigger" NOT NULL,
	"sent_by" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_challenge" ADD COLUMN "digest_cadence" "activity_challenge_digest_cadence" DEFAULT 'twice_weekly' NOT NULL;--> statement-breakpoint
ALTER TABLE "activity_challenge_member" ADD COLUMN "digest_opt_out" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "activity_challenge_digest" ADD CONSTRAINT "activity_challenge_digest_member_id_activity_challenge_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."activity_challenge_member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_challenge_digest" ADD CONSTRAINT "activity_challenge_digest_sent_by_user_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "activity_challenge_digest_slot_idx" ON "activity_challenge_digest" USING btree ("member_id","slot") WHERE "activity_challenge_digest"."trigger" = 'scheduled';--> statement-breakpoint
CREATE INDEX "activity_challenge_digest_member_idx" ON "activity_challenge_digest" USING btree ("member_id");