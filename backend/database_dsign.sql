CREATE TABLE "User"(
    "id" BIGINT NOT NULL,
    "native_language" BIGINT NOT NULL,
    "telegram_id" VARCHAR(255) NOT NULL UNIQUE,
    "full_name" VARCHAR(255) NOT NULL,
    "profile_image" VARCHAR(255) NULL,
    "created_at" TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(0) WITHOUT TIME ZONE NULL
);
ALTER TABLE "User" ADD PRIMARY KEY("id");

CREATE TABLE "Language"(
    "id" BIGINT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(0) WITHOUT TIME ZONE NULL
);
ALTER TABLE "Language" ADD PRIMARY KEY("id");

CREATE TABLE "Word"(
    "id" BIGINT NOT NULL,
    "language_id" BIGINT NOT NULL,
    "text" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(0) WITHOUT TIME ZONE NULL
);
ALTER TABLE "Word" ADD PRIMARY KEY("id");

CREATE TABLE "Media"(
    "id" BIGINT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "language_id" BIGINT NOT NULL,
    "video_url" TEXT NOT NULL,
    "level" VARCHAR(50) NOT NULL,
    "category_id" BIGINT NOT NULL,
    "thumbnail_url" TEXT NOT NULL,
    "durational_minutes" INTEGER NULL,
    "is_film" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(0) WITHOUT TIME ZONE NULL
);
ALTER TABLE "Media" ADD PRIMARY KEY("id");

CREATE TABLE "LearningLanguage"(
    "id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "language_id" BIGINT NOT NULL,
    "level" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(0) WITHOUT TIME ZONE NULL
);
ALTER TABLE "LearningLanguage" ADD CONSTRAINT "learninglanguage_user_id_language_id_unique" UNIQUE("user_id", "language_id");
ALTER TABLE "LearningLanguage" ADD PRIMARY KEY("id");

CREATE TABLE "GrammarContext"(
    "id" BIGINT NOT NULL,
    "language_id" BIGINT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(0) WITHOUT TIME ZONE NULL
);
ALTER TABLE "GrammarContext" ADD PRIMARY KEY("id");
ALTER TABLE "GrammarContext" ADD CONSTRAINT "grammarcontext_name_unique" UNIQUE("name");

CREATE TABLE "Subtitle"(
    "id" BIGINT NOT NULL,
    "media_id" BIGINT NOT NULL,
    "episode_id" BIGINT NULL,
    "index" INTEGER NOT NULL,
    "start_time" TIME(0) WITHOUT TIME ZONE NOT NULL,
    "end_time" TIME(0) WITHOUT TIME ZONE NOT NULL,
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(0) WITHOUT TIME ZONE NULL
);
ALTER TABLE "Subtitle" ADD PRIMARY KEY("id");

CREATE TABLE "Gap"(
    "id" BIGINT NOT NULL,
    "text" VARCHAR(255) NOT NULL,
    "grammar_context_id" BIGINT NOT NULL,
    "subtitle_id" BIGINT NOT NULL,
    "index" INTEGER NOT NULL,
    "created_at" TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(0) WITHOUT TIME ZONE NULL
);
ALTER TABLE "Gap" ADD PRIMARY KEY("id");

CREATE TABLE "WordTranslate"(
    "id" BIGINT NOT NULL,
    "word_id" BIGINT NOT NULL,
    "translate_text" VARCHAR(255) NOT NULL,
    "language_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(0) WITHOUT TIME ZONE NULL
);
ALTER TABLE "WordTranslate" ADD PRIMARY KEY("id");

CREATE TABLE "UserWord"(
    "id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "word_id" BIGINT NOT NULL,
    "repeated_count" INTEGER NOT NULL DEFAULT 0,
    "end_repeated_datetime" TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
    "status" VARCHAR(50) CHECK ("status" IN('new', 'active', 'old')) NOT NULL DEFAULT 'new',
    "created_at" TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(0) WITHOUT TIME ZONE NULL
);
ALTER TABLE "UserWord" ADD PRIMARY KEY("id");

CREATE TABLE "UserGrammar"(
    "id" BIGINT NOT NULL,
    "grammar_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "repeated_count" INTEGER NOT NULL DEFAULT 0,
    "end_repeated_datetime" TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
    "created_at" TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(0) WITHOUT TIME ZONE NULL
);
ALTER TABLE "UserGrammar" ADD CONSTRAINT "usergrammar_user_id_grammar_id_unique" UNIQUE("user_id", "grammar_id");
ALTER TABLE "UserGrammar" ADD PRIMARY KEY("id");

CREATE TABLE "Category"(
    "id" BIGINT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(0) WITHOUT TIME ZONE NULL
);
ALTER TABLE "Category" ADD PRIMARY KEY("id");

CREATE TABLE "Season"(
    "id" BIGINT NOT NULL,
    "media_id" BIGINT NOT NULL,
    "season_number" INTEGER NOT NULL,
    "title" VARCHAR(255) NULL,
    "about" TEXT NULL,
    "thumbnail_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(0) WITHOUT TIME ZONE NULL
);
ALTER TABLE "Season" ADD PRIMARY KEY("id");

CREATE TABLE "Episode"(
    "id" BIGINT NOT NULL,
    "season_id" BIGINT NOT NULL,
    "episode_number" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "video_url" TEXT NOT NULL,
    "level" VARCHAR(50) NOT NULL,
    "thumbnail_url" TEXT NOT NULL,
    "durational_minutes" INTEGER NULL,
    "created_at" TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(0) WITHOUT TIME ZONE NULL
);
ALTER TABLE "Episode" ADD PRIMARY KEY("id");

CREATE TABLE "UserSession"(
    "id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "agent" VARCHAR(255) NOT NULL,
    "ip_address" VARCHAR(255) NOT NULL,
    "device" VARCHAR(255) NOT NULL,
    "logined_datetime" TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(0) WITHOUT TIME ZONE NULL
);
ALTER TABLE "UserSession" ADD CONSTRAINT "usersession_user_id_agent_device_unique" UNIQUE("user_id", "agent", "device");
ALTER TABLE "UserSession" ADD PRIMARY KEY("id");

-- Foreign Keys
ALTER TABLE "LearningLanguage" ADD CONSTRAINT "learninglanguage_user_id_foreign" FOREIGN KEY("user_id") REFERENCES "User"("id");
ALTER TABLE "LearningLanguage" ADD CONSTRAINT "learninglanguage_language_id_foreign" FOREIGN KEY("language_id") REFERENCES "Language"("id");
ALTER TABLE "User" ADD CONSTRAINT "user_native_language_foreign" FOREIGN KEY("native_language") REFERENCES "Language"("id");
ALTER TABLE "Word" ADD CONSTRAINT "word_language_id_foreign" FOREIGN KEY("language_id") REFERENCES "Language"("id");
ALTER TABLE "WordTranslate" ADD CONSTRAINT "wordtranslate_word_id_foreign" FOREIGN KEY("word_id") REFERENCES "Word"("id");
ALTER TABLE "WordTranslate" ADD CONSTRAINT "wordtranslate_language_id_foreign" FOREIGN KEY("language_id") REFERENCES "Language"("id");
ALTER TABLE "UserWord" ADD CONSTRAINT "userword_word_id_foreign" FOREIGN KEY("word_id") REFERENCES "Word"("id");
ALTER TABLE "UserWord" ADD CONSTRAINT "userword_user_id_foreign" FOREIGN KEY("user_id") REFERENCES "User"("id");
ALTER TABLE "Media" ADD CONSTRAINT "media_language_id_foreign" FOREIGN KEY("language_id") REFERENCES "Language"("id");
ALTER TABLE "Media" ADD CONSTRAINT "media_category_id_foreign" FOREIGN KEY("category_id") REFERENCES "Category"("id");
ALTER TABLE "Season" ADD CONSTRAINT "season_media_id_foreign" FOREIGN KEY("media_id") REFERENCES "Media"("id");
ALTER TABLE "Episode" ADD CONSTRAINT "episode_season_id_foreign" FOREIGN KEY("season_id") REFERENCES "Season"("id");
ALTER TABLE "Subtitle" ADD CONSTRAINT "subtitle_media_id_foreign" FOREIGN KEY("media_id") REFERENCES "Media"("id");
ALTER TABLE "Subtitle" ADD CONSTRAINT "subtitle_episode_id_foreign" FOREIGN KEY("episode_id") REFERENCES "Episode"("id");
ALTER TABLE "GrammarContext" ADD CONSTRAINT "grammarcontext_language_id_foreign" FOREIGN KEY("language_id") REFERENCES "Language"("id");
ALTER TABLE "Gap" ADD CONSTRAINT "gap_subtitle_id_foreign" FOREIGN KEY("subtitle_id") REFERENCES "Subtitle"("id");
ALTER TABLE "Gap" ADD CONSTRAINT "gap_grammar_context_id_foreign" FOREIGN KEY("grammar_context_id") REFERENCES "GrammarContext"("id");
ALTER TABLE "UserGrammar" ADD CONSTRAINT "usergrammar_user_id_foreign" FOREIGN KEY("user_id") REFERENCES "User"("id");
ALTER TABLE "UserGrammar" ADD CONSTRAINT "usergrammar_grammar_id_foreign" FOREIGN KEY("grammar_id") REFERENCES "GrammarContext"("id");
ALTER TABLE "UserSession" ADD CONSTRAINT "usersession_user_id_foreign" FOREIGN KEY("user_id") REFERENCES "User"("id");