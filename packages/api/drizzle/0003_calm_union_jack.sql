CREATE TYPE "public"."draw_tiering" AS ENUM('none', 'auto');--> statement-breakpoint
ALTER TABLE "team" ADD COLUMN "strength_rank" integer;--> statement-breakpoint
ALTER TABLE "sweepstake" ADD COLUMN "draw_tiering" "draw_tiering" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "team_assignment" ADD COLUMN "tier" integer;