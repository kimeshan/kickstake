CREATE TYPE "public"."activity_challenge_update_source" AS ENUM('participant', 'organiser');--> statement-breakpoint
CREATE TABLE "activity_challenge" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"organiser_id" text NOT NULL,
	"start_date" date NOT NULL,
	"week_count" integer NOT NULL,
	"time_zone" text NOT NULL,
	"final_edit_cutoff" timestamp with time zone NOT NULL,
	"scoring_version" text NOT NULL,
	"join_token" text NOT NULL,
	"joining_closed" boolean DEFAULT false NOT NULL,
	"participant_editing_locked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activity_challenge_week_count_check" CHECK ("activity_challenge"."week_count" > 0)
);
--> statement-breakpoint
CREATE TABLE "activity_challenge_member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"display_name" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "activity_challenge_week" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"week_number" integer NOT NULL,
	"minutes" integer,
	"version" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone,
	"updated_by" text,
	"update_source" "activity_challenge_update_source",
	CONSTRAINT "activity_challenge_week_minutes_check" CHECK ("activity_challenge_week"."minutes" IS NULL OR ("activity_challenge_week"."minutes" >= 0 AND "activity_challenge_week"."minutes" <= 10080)),
	CONSTRAINT "activity_challenge_week_number_check" CHECK ("activity_challenge_week"."week_number" > 0),
	CONSTRAINT "activity_challenge_week_version_check" CHECK ("activity_challenge_week"."version" >= 0)
);
--> statement-breakpoint
CREATE TABLE "activity_challenge_week_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"week_id" uuid NOT NULL,
	"actor_user_id" text,
	"old_minutes" integer,
	"new_minutes" integer,
	"old_version" integer NOT NULL,
	"new_version" integer NOT NULL,
	"source" "activity_challenge_update_source" NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_challenge" ADD CONSTRAINT "activity_challenge_organiser_id_user_id_fk" FOREIGN KEY ("organiser_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_challenge_member" ADD CONSTRAINT "activity_challenge_member_challenge_id_activity_challenge_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."activity_challenge"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_challenge_member" ADD CONSTRAINT "activity_challenge_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_challenge_week" ADD CONSTRAINT "activity_challenge_week_member_id_activity_challenge_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."activity_challenge_member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_challenge_week" ADD CONSTRAINT "activity_challenge_week_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_challenge_week_audit" ADD CONSTRAINT "activity_challenge_week_audit_week_id_activity_challenge_week_id_fk" FOREIGN KEY ("week_id") REFERENCES "public"."activity_challenge_week"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_challenge_week_audit" ADD CONSTRAINT "activity_challenge_week_audit_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "activity_challenge_slug_idx" ON "activity_challenge" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "activity_challenge_join_token_idx" ON "activity_challenge" USING btree ("join_token");--> statement-breakpoint
CREATE INDEX "activity_challenge_organiser_idx" ON "activity_challenge" USING btree ("organiser_id");--> statement-breakpoint
CREATE UNIQUE INDEX "activity_challenge_member_unique_idx" ON "activity_challenge_member" USING btree ("challenge_id","user_id");--> statement-breakpoint
CREATE INDEX "activity_challenge_member_user_idx" ON "activity_challenge_member" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "activity_challenge_week_unique_idx" ON "activity_challenge_week" USING btree ("member_id","week_number");--> statement-breakpoint
CREATE INDEX "activity_challenge_week_audit_week_idx" ON "activity_challenge_week_audit" USING btree ("week_id");