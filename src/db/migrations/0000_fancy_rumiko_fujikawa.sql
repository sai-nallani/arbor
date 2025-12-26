CREATE TABLE "ai_error_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"model" text,
	"input_messages" jsonb,
	"error_type" text,
	"raw_output" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "boards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text DEFAULT 'Untitled Board' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"board_id" uuid NOT NULL,
	"title" text DEFAULT 'New Chat' NOT NULL,
	"model" text DEFAULT 'anthropic/claude-opus-4-5' NOT NULL,
	"position_x" double precision NOT NULL,
	"position_y" double precision NOT NULL,
	"is_expanded" boolean DEFAULT false,
	"has_image" boolean DEFAULT false,
	"parent_id" uuid,
	"branch_context" jsonb,
	"branch_source_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "context_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_block_id" uuid NOT NULL,
	"target_block_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_block_id" uuid NOT NULL,
	"file_node_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"board_id" uuid NOT NULL,
	"name" text NOT NULL,
	"mime_type" text NOT NULL,
	"url" text NOT NULL,
	"extracted_content" text,
	"position_x" double precision NOT NULL,
	"position_y" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "image_context_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"image_node_id" uuid NOT NULL,
	"target_block_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_message_id" uuid NOT NULL,
	"target_block_id" uuid NOT NULL,
	"quote_start" double precision NOT NULL,
	"quote_end" double precision NOT NULL,
	"quote_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_block_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"hidden_context" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sticky_context_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sticky_note_id" uuid NOT NULL,
	"target_block_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sticky_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"board_id" uuid NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"color" text DEFAULT 'yellow' NOT NULL,
	"position_x" double precision NOT NULL,
	"position_y" double precision NOT NULL,
	"width" double precision DEFAULT 200,
	"height" double precision DEFAULT 200,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "boards" ADD CONSTRAINT "boards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_blocks" ADD CONSTRAINT "chat_blocks_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_blocks" ADD CONSTRAINT "chat_blocks_parent_id_chat_blocks_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."chat_blocks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "context_links" ADD CONSTRAINT "context_links_source_block_id_chat_blocks_id_fk" FOREIGN KEY ("source_block_id") REFERENCES "public"."chat_blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "context_links" ADD CONSTRAINT "context_links_target_block_id_chat_blocks_id_fk" FOREIGN KEY ("target_block_id") REFERENCES "public"."chat_blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_links" ADD CONSTRAINT "file_links_chat_block_id_chat_blocks_id_fk" FOREIGN KEY ("chat_block_id") REFERENCES "public"."chat_blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_links" ADD CONSTRAINT "file_links_file_node_id_file_nodes_id_fk" FOREIGN KEY ("file_node_id") REFERENCES "public"."file_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_nodes" ADD CONSTRAINT "file_nodes_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_context_links" ADD CONSTRAINT "image_context_links_image_node_id_file_nodes_id_fk" FOREIGN KEY ("image_node_id") REFERENCES "public"."file_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_context_links" ADD CONSTRAINT "image_context_links_target_block_id_chat_blocks_id_fk" FOREIGN KEY ("target_block_id") REFERENCES "public"."chat_blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_links" ADD CONSTRAINT "message_links_source_message_id_messages_id_fk" FOREIGN KEY ("source_message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_links" ADD CONSTRAINT "message_links_target_block_id_chat_blocks_id_fk" FOREIGN KEY ("target_block_id") REFERENCES "public"."chat_blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_chat_block_id_chat_blocks_id_fk" FOREIGN KEY ("chat_block_id") REFERENCES "public"."chat_blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sticky_context_links" ADD CONSTRAINT "sticky_context_links_sticky_note_id_sticky_notes_id_fk" FOREIGN KEY ("sticky_note_id") REFERENCES "public"."sticky_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sticky_context_links" ADD CONSTRAINT "sticky_context_links_target_block_id_chat_blocks_id_fk" FOREIGN KEY ("target_block_id") REFERENCES "public"."chat_blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sticky_notes" ADD CONSTRAINT "sticky_notes_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "context_links_unique_idx" ON "context_links" USING btree ("source_block_id","target_block_id");--> statement-breakpoint
CREATE UNIQUE INDEX "file_links_unique_idx" ON "file_links" USING btree ("chat_block_id","file_node_id");--> statement-breakpoint
CREATE UNIQUE INDEX "image_context_links_unique_idx" ON "image_context_links" USING btree ("image_node_id","target_block_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sticky_context_links_unique_idx" ON "sticky_context_links" USING btree ("sticky_note_id","target_block_id");