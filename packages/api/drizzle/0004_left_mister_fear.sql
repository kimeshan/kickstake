CREATE TYPE "public"."match_stage" AS ENUM('group', 'round_of_32', 'round_of_16', 'quarter_final', 'semi_final', 'third_place', 'final');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('scheduled', 'in_play', 'finished');--> statement-breakpoint
CREATE TABLE "match" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"stage" "match_stage" NOT NULL,
	"group_label" text,
	"kickoff_at" timestamp,
	"home_team_id" uuid,
	"away_team_id" uuid,
	"home_score" integer,
	"away_score" integer,
	"home_penalties" integer,
	"away_penalties" integer,
	"winner_team_id" uuid,
	"status" "match_status" DEFAULT 'scheduled' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team" ADD COLUMN "external_ref" text;--> statement-breakpoint
ALTER TABLE "match" ADD CONSTRAINT "match_tournament_id_tournament_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournament"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match" ADD CONSTRAINT "match_home_team_id_team_id_fk" FOREIGN KEY ("home_team_id") REFERENCES "public"."team"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match" ADD CONSTRAINT "match_away_team_id_team_id_fk" FOREIGN KEY ("away_team_id") REFERENCES "public"."team"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match" ADD CONSTRAINT "match_winner_team_id_team_id_fk" FOREIGN KEY ("winner_team_id") REFERENCES "public"."team"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "match_tournament_idx" ON "match" USING btree ("tournament_id");--> statement-breakpoint
CREATE UNIQUE INDEX "match_external_idx" ON "match" USING btree ("tournament_id","external_id");