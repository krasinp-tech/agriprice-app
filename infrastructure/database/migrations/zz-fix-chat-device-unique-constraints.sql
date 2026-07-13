-- ============================================================
-- Fix uniqueness constraints required by chat and push-token flows.
-- Safe to run repeatedly in Supabase SQL Editor.
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.chat_rooms') IS NOT NULL THEN
    IF to_regclass('public.chat_messages') IS NOT NULL THEN
      WITH normalized AS (
        SELECT
          room_id,
          CASE WHEN user1_id::text <= user2_id::text THEN user1_id ELSE user2_id END AS canonical_user1_id,
          CASE WHEN user1_id::text <= user2_id::text THEN user2_id ELSE user1_id END AS canonical_user2_id,
          created_at
        FROM public.chat_rooms
        WHERE user1_id IS NOT NULL
          AND user2_id IS NOT NULL
      ),
      ranked AS (
        SELECT
          room_id,
          FIRST_VALUE(room_id) OVER (
            PARTITION BY canonical_user1_id, canonical_user2_id
            ORDER BY created_at NULLS LAST, room_id
          ) AS keep_room_id,
          ROW_NUMBER() OVER (
            PARTITION BY canonical_user1_id, canonical_user2_id
            ORDER BY created_at NULLS LAST, room_id
          ) AS rn
        FROM normalized
      )
      UPDATE public.chat_messages AS m
      SET room_id = r.keep_room_id
      FROM ranked AS r
      WHERE r.rn > 1
        AND m.room_id = r.room_id;
    END IF;

    WITH normalized AS (
      SELECT
        room_id,
        CASE WHEN user1_id::text <= user2_id::text THEN user1_id ELSE user2_id END AS canonical_user1_id,
        CASE WHEN user1_id::text <= user2_id::text THEN user2_id ELSE user1_id END AS canonical_user2_id,
        created_at
      FROM public.chat_rooms
      WHERE user1_id IS NOT NULL
        AND user2_id IS NOT NULL
    ),
    ranked AS (
      SELECT
        room_id,
        ROW_NUMBER() OVER (
          PARTITION BY canonical_user1_id, canonical_user2_id
          ORDER BY created_at NULLS LAST, room_id
        ) AS rn
      FROM normalized
    )
    DELETE FROM public.chat_rooms AS c
    USING ranked AS r
    WHERE c.room_id = r.room_id
      AND r.rn > 1;

    UPDATE public.chat_rooms
    SET
      user1_id = CASE WHEN user1_id::text <= user2_id::text THEN user1_id ELSE user2_id END,
      user2_id = CASE WHEN user1_id::text <= user2_id::text THEN user2_id ELSE user1_id END
    WHERE user1_id IS NOT NULL
      AND user2_id IS NOT NULL
      AND user1_id::text > user2_id::text;

    EXECUTE $sql$
      CREATE UNIQUE INDEX IF NOT EXISTS chat_rooms_unordered_user_pair_idx
      ON public.chat_rooms (
        (CASE WHEN user1_id::text <= user2_id::text THEN user1_id ELSE user2_id END),
        (CASE WHEN user1_id::text <= user2_id::text THEN user2_id ELSE user1_id END)
      )
      WHERE user1_id IS NOT NULL
        AND user2_id IS NOT NULL
    $sql$;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.chat_rooms'::regclass
        AND conname = 'chat_rooms_user1_id_user2_id_key'
    ) THEN
      ALTER TABLE public.chat_rooms
        ADD CONSTRAINT chat_rooms_user1_id_user2_id_key UNIQUE (user1_id, user2_id);
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.device_sessions') IS NOT NULL THEN
    WITH ranked AS (
      SELECT
        session_id,
        ROW_NUMBER() OVER (
          PARTITION BY user_id, push_token
          ORDER BY COALESCE(last_seen, last_active, created_at) DESC NULLS LAST, session_id DESC
        ) AS rn
      FROM public.device_sessions
      WHERE user_id IS NOT NULL
        AND push_token IS NOT NULL
    )
    DELETE FROM public.device_sessions AS d
    USING ranked AS r
    WHERE d.session_id = r.session_id
      AND r.rn > 1;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.device_sessions'::regclass
        AND conname = 'unique_user_push_token'
    ) THEN
      ALTER TABLE public.device_sessions
        ADD CONSTRAINT unique_user_push_token UNIQUE (user_id, push_token);
    END IF;
  END IF;
END $$;

COMMIT;
