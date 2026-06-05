ALTER TABLE "sweepstake" ADD COLUMN "join_closed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sweepstake" ADD COLUMN "finalized" boolean DEFAULT false NOT NULL;