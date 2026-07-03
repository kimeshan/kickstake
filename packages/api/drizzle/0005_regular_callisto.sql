CREATE TABLE "scorer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"player_name" text NOT NULL,
	"team_id" uuid,
	"goals" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scorer" ADD CONSTRAINT "scorer_tournament_id_tournament_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournament"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scorer" ADD CONSTRAINT "scorer_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scorer_tournament_idx" ON "scorer" USING btree ("tournament_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scorer_tournament_player_idx" ON "scorer" USING btree ("tournament_id","player_name");