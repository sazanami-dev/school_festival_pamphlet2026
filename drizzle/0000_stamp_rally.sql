CREATE TABLE "participants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recovery_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "participants_recovery_code_unique" UNIQUE("recovery_code")
);
--> statement-breakpoint
CREATE TABLE "redemptions" (
	"participant_id" uuid PRIMARY KEY NOT NULL,
	"stamp_count" integer NOT NULL,
	"redeemed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stamps" (
	"participant_id" uuid NOT NULL,
	"checkpoint_id" text NOT NULL,
	"acquired_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stamps_participant_id_checkpoint_id_pk" PRIMARY KEY("participant_id","checkpoint_id")
);
--> statement-breakpoint
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stamps" ADD CONSTRAINT "stamps_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;