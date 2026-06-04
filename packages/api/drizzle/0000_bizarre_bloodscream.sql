CREATE TYPE "public"."tournament_format" AS ENUM('international_cup', 'club_competition');--> statement-breakpoint
CREATE TYPE "public"."tournament_status" AS ENUM('upcoming', 'active', 'completed');--> statement-breakpoint
CREATE TYPE "public"."prize_result_status" AS ENUM('pending_approval', 'approved', 'manual_override');--> statement-breakpoint
CREATE TYPE "public"."remainder_policy" AS ENUM('spread_fairly', 'to_pot');--> statement-breakpoint
CREATE TYPE "public"."rule_type" AS ENUM('winner', 'runner_up', 'third_place', 'group_top', 'group_bottom', 'player_of_tournament', 'golden_boot', 'most_cards', 'least_conceded', 'most_possession', 'least_possession', 'biggest_loss', 'custom');--> statement-breakpoint
CREATE TYPE "public"."sweepstake_status" AS ENUM('draft', 'open', 'drawn', 'live', 'settled');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"name" text NOT NULL,
	"group_label" text NOT NULL,
	"flag_code" text
);
--> statement-breakpoint
CREATE TABLE "tournament" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"year" integer NOT NULL,
	"group_count" integer NOT NULL,
	"team_count" integer NOT NULL,
	"format" "tournament_format" DEFAULT 'international_cup' NOT NULL,
	"data_source_id" text,
	"status" "tournament_status" DEFAULT 'upcoming' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sweepstake_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"email" text,
	"paid" boolean DEFAULT false NOT NULL,
	"amount_due" integer DEFAULT 0 NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prize_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sweepstake_id" uuid NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"rule_type" "rule_type" NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"per_group" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prize_result" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prize_category_id" uuid NOT NULL,
	"group_label" text,
	"winning_team_id" uuid,
	"winning_participant_id" uuid,
	"status" "prize_result_status" DEFAULT 'pending_approval' NOT NULL,
	"approved_by" text,
	"approved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "sweepstake" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organiser_id" text NOT NULL,
	"tournament_id" uuid NOT NULL,
	"name" text NOT NULL,
	"currency" text DEFAULT 'ZAR' NOT NULL,
	"buy_in" integer DEFAULT 0 NOT NULL,
	"donation" integer DEFAULT 0 NOT NULL,
	"designed_pot" integer DEFAULT 0 NOT NULL,
	"status" "sweepstake_status" DEFAULT 'draft' NOT NULL,
	"join_token" text NOT NULL,
	"draw_seed" text,
	"draw_algo_version" integer,
	"remainder_policy" "remainder_policy" DEFAULT 'spread_fairly' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sweepstake_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"participant_id" uuid
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_tournament_id_tournament_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournament"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant" ADD CONSTRAINT "participant_sweepstake_id_sweepstake_id_fk" FOREIGN KEY ("sweepstake_id") REFERENCES "public"."sweepstake"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prize_category" ADD CONSTRAINT "prize_category_sweepstake_id_sweepstake_id_fk" FOREIGN KEY ("sweepstake_id") REFERENCES "public"."sweepstake"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prize_result" ADD CONSTRAINT "prize_result_prize_category_id_prize_category_id_fk" FOREIGN KEY ("prize_category_id") REFERENCES "public"."prize_category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prize_result" ADD CONSTRAINT "prize_result_winning_team_id_team_id_fk" FOREIGN KEY ("winning_team_id") REFERENCES "public"."team"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prize_result" ADD CONSTRAINT "prize_result_winning_participant_id_participant_id_fk" FOREIGN KEY ("winning_participant_id") REFERENCES "public"."participant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prize_result" ADD CONSTRAINT "prize_result_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sweepstake" ADD CONSTRAINT "sweepstake_organiser_id_user_id_fk" FOREIGN KEY ("organiser_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sweepstake" ADD CONSTRAINT "sweepstake_tournament_id_tournament_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournament"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_assignment" ADD CONSTRAINT "team_assignment_sweepstake_id_sweepstake_id_fk" FOREIGN KEY ("sweepstake_id") REFERENCES "public"."sweepstake"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_assignment" ADD CONSTRAINT "team_assignment_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_assignment" ADD CONSTRAINT "team_assignment_participant_id_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "team_tournament_idx" ON "team" USING btree ("tournament_id");--> statement-breakpoint
CREATE INDEX "participant_sweepstake_idx" ON "participant" USING btree ("sweepstake_id");--> statement-breakpoint
CREATE INDEX "prize_category_sweepstake_idx" ON "prize_category" USING btree ("sweepstake_id");--> statement-breakpoint
CREATE INDEX "prize_result_category_idx" ON "prize_result" USING btree ("prize_category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sweepstake_join_token_idx" ON "sweepstake" USING btree ("join_token");--> statement-breakpoint
CREATE INDEX "sweepstake_organiser_idx" ON "sweepstake" USING btree ("organiser_id");--> statement-breakpoint
CREATE INDEX "assignment_sweepstake_idx" ON "team_assignment" USING btree ("sweepstake_id");--> statement-breakpoint
CREATE UNIQUE INDEX "assignment_unique_team_idx" ON "team_assignment" USING btree ("sweepstake_id","team_id");