CREATE TABLE "api_keys" (
	"id" varchar PRIMARY KEY,
	"user_id" varchar NOT NULL,
	"prefix" varchar NOT NULL,
	"key_hash" varchar(64) NOT NULL UNIQUE,
	"label" varchar DEFAULT 'Goog... No label set :(' NOT NULL,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_token" (
	"id" varchar PRIMARY KEY,
	"user_id" varchar NOT NULL,
	"provider" varchar NOT NULL,
	"token" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" varchar PRIMARY KEY,
	"user_id" varchar,
	"oauth_state" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY,
	"slack_id" varchar UNIQUE,
	"hca_id" varchar UNIQUE,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"admin" boolean DEFAULT false NOT NULL,
	"banned" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workers" (
	"id" varchar PRIMARY KEY,
	"prefix" varchar NOT NULL,
	"key_hash" varchar(64) NOT NULL UNIQUE,
	"label" varchar DEFAULT 'Goog... No label set :(' NOT NULL,
	"connected" boolean DEFAULT false NOT NULL,
	"last_connected_at" timestamp,
	"versionSHA" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "worker_stats" (
	"id" varchar PRIMARY KEY,
	"worker_id" varchar NOT NULL,
	"scraper" varchar NOT NULL,
	"latency_ms" integer,
	"last_hit" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "api_keys_user_idx" ON "api_keys" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_token_user_provider_unique" ON "oauth_token" ("user_id","provider");--> statement-breakpoint
CREATE INDEX "users_admin_idx" ON "users" ("admin");--> statement-breakpoint
CREATE INDEX "users_banned_idx" ON "users" ("banned");--> statement-breakpoint
CREATE INDEX "workerstats_path_worker_idx" ON "worker_stats" ("scraper","worker_id","last_hit");--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "oauth_token" ADD CONSTRAINT "oauth_token_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "worker_stats" ADD CONSTRAINT "worker_stats_worker_id_workers_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "workers"("id") ON DELETE CASCADE;