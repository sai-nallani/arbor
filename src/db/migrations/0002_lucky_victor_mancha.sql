ALTER TABLE "context_links" ADD COLUMN "source_handle" text DEFAULT 'right';--> statement-breakpoint
ALTER TABLE "context_links" ADD COLUMN "target_handle" text DEFAULT 'left';