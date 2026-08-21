-- Nicht-destruktive Vorbereitung fuer das kanonische globale Rangsystem.
-- Diese Migration fuegt player_id hinzu, ersetzt die Submit-/Rang-RPCs und
-- sperrt direkte Legacy-Schreibzugriffe. Sie loescht oder veraendert keine Scores.
-- Erst gemeinsam pruefen, dann manuell im Supabase SQL Editor ausfuehren.

begin;

alter table public.slime_jump_highscores
  add column if not exists player_id uuid;

-- PostgreSQL erlaubt in einem Unique-Index mehrere NULL-Werte. Dadurch bleiben
-- die 130 Legacy-Zeilen bis zum separaten Reset unveraendert bestehen.
create unique index if not exists slime_jump_highscores_player_id_uidx
  on public.slime_jump_highscores (player_id);

create or replace function public.submit_slime_jump_global_best(
  p_player_id uuid,
  p_name text,
  p_score bigint,
  p_level integer,
  p_game_version text,
  p_slime_color text,
  p_slime_cosmetic text,
  p_slime_beard text,
  p_slime_achievements text[],
  p_calling_card_snapshot jsonb
)
returns table (
  best_score bigint,
  improved boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  stored_best_score bigint;
  score_was_improved boolean := false;
begin
  if p_player_id is null then
    raise exception 'player_id darf nicht NULL sein'
      using errcode = '22023';
  end if;

  if p_name is null or p_name !~ '^[A-Z]{3}$' then
    raise exception 'name muss aus genau drei Buchstaben A-Z bestehen'
      using errcode = '22023';
  end if;

  if p_score is null or p_score <= 0 or p_score > 1000000000 then
    raise exception 'score muss zwischen 1 und 1000000000 liegen'
      using errcode = '22023';
  end if;

  if p_level is null or p_level < 1 or p_level > 1000000 then
    raise exception 'level muss zwischen 1 und 1000000 liegen'
      using errcode = '22023';
  end if;

  insert into public.slime_jump_highscores as leaderboard (
    player_id,
    name,
    score,
    level,
    game_version,
    slime_color,
    slime_cosmetic,
    slime_beard,
    slime_achievements,
    calling_card_snapshot
  )
  values (
    p_player_id,
    p_name,
    p_score,
    p_level,
    p_game_version,
    p_slime_color,
    p_slime_cosmetic,
    p_slime_beard,
    coalesce(p_slime_achievements, '{}'::text[]),
    p_calling_card_snapshot
  )
  on conflict (player_id) do update
  set
    name = excluded.name,
    score = excluded.score,
    level = excluded.level,
    game_version = excluded.game_version,
    slime_color = excluded.slime_color,
    slime_cosmetic = excluded.slime_cosmetic,
    slime_beard = excluded.slime_beard,
    slime_achievements = excluded.slime_achievements,
    calling_card_snapshot = excluded.calling_card_snapshot,
    created_at = now()
  where excluded.score > leaderboard.score
  returning leaderboard.score into stored_best_score;

  if found then
    score_was_improved := true;
  else
    select leaderboard.score
    into stored_best_score
    from public.slime_jump_highscores as leaderboard
    where leaderboard.player_id = p_player_id;
  end if;

  return query
  select stored_best_score, score_was_improved;
end;
$function$;

create or replace function public.get_slime_jump_personal_rank(
  p_player_id uuid
)
returns table (
  best_score bigint,
  rank bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  stored_best_score bigint;
  personal_rank bigint;
begin
  if p_player_id is null then
    return query select null::bigint, null::bigint;
    return;
  end if;

  select leaderboard.score
  into stored_best_score
  from public.slime_jump_highscores as leaderboard
  where leaderboard.player_id = p_player_id;

  if not found then
    return query select null::bigint, null::bigint;
    return;
  end if;

  select count(*) + 1
  into personal_rank
  from public.slime_jump_highscores as leaderboard
  where leaderboard.player_id is not null
    and leaderboard.score > stored_best_score;

  return query
  select stored_best_score, personal_rank;
end;
$function$;

-- Alte Clients duerfen keine Zeilen ohne player_id mehr direkt anlegen.
revoke insert, update, delete on table public.slime_jump_highscores
  from public, anon, authenticated;

-- Die alte zweite Rangquelle bleibt als Tabelle erhalten, ist aber fuer Clients
-- weder direkt noch ueber ihre bisherige Submit-RPC beschreibbar.
revoke all on function public.submit_slime_jump_personal_best(uuid, bigint)
  from public, anon, authenticated;

revoke all on function public.submit_slime_jump_global_best(
  uuid, text, bigint, integer, text, text, text, text, text[], jsonb
) from public, anon, authenticated;
revoke all on function public.get_slime_jump_personal_rank(uuid)
  from public, anon, authenticated;

grant execute on function public.submit_slime_jump_global_best(
  uuid, text, bigint, integer, text, text, text, text, text[], jsonb
) to anon;
grant execute on function public.get_slime_jump_personal_rank(uuid)
  to anon;

commit;

-- Sicherheitsgrenze:
-- player_id bleibt eine lokale Installations-ID und keine authentifizierte
-- Benutzeridentitaet. Die RPC verhindert Downgrades und direkte Legacy-Inserts,
-- ersetzt aber keine serverseitige Anti-Cheat-Pruefung.
