-- Separates Backend fuer persoenliche Slime-Soar-Bestscores und globale Raenge.
-- Diese Migration veraendert public.slime_jump_highscores nicht und loescht keine Daten.
-- Vor der Ausfuehrung gemeinsam pruefen und danach manuell im Supabase SQL Editor starten.

begin;

create table if not exists public.slime_jump_player_bests (
  player_id uuid primary key,
  best_score bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint slime_jump_player_bests_best_score_check
    check (best_score > 0 and best_score <= 1000000000)
);

create index if not exists slime_jump_player_bests_best_score_idx
  on public.slime_jump_player_bests (best_score desc);

alter table public.slime_jump_player_bests enable row level security;

-- Direkte Tabellenzugriffe sind fuer den oeffentlichen Client nicht erforderlich.
-- Der Client darf ausschliesslich die beiden eng begrenzten RPCs aufrufen.
revoke all on table public.slime_jump_player_bests from public, anon, authenticated;

create or replace function public.submit_slime_jump_personal_best(
  p_player_id uuid,
  p_best_score bigint
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

  if p_best_score is null or p_best_score <= 0 or p_best_score > 1000000000 then
    raise exception 'best_score muss zwischen 1 und 1000000000 liegen'
      using errcode = '22023';
  end if;

  insert into public.slime_jump_player_bests as player_best (
    player_id,
    best_score
  )
  values (
    p_player_id,
    p_best_score
  )
  on conflict (player_id) do update
  set
    best_score = excluded.best_score,
    updated_at = now()
  where excluded.best_score > player_best.best_score
  returning player_best.best_score into stored_best_score;

  if found then
    score_was_improved := true;
  else
    select player_best.best_score
    into stored_best_score
    from public.slime_jump_player_bests as player_best
    where player_best.player_id = p_player_id;
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

  select player_best.best_score
  into stored_best_score
  from public.slime_jump_player_bests as player_best
  where player_best.player_id = p_player_id;

  if not found then
    return query select null::bigint, null::bigint;
    return;
  end if;

  select count(*) + 1
  into personal_rank
  from public.slime_jump_player_bests as player_best
  where player_best.best_score > stored_best_score;

  return query
  select stored_best_score, personal_rank;
end;
$function$;

-- PostgreSQL-Funktionen sind sonst standardmaessig fuer PUBLIC ausfuehrbar.
-- Der aktuelle Publishable-Key-Client verwendet ohne Benutzer-Session die Rolle anon.
revoke all on function public.submit_slime_jump_personal_best(uuid, bigint)
  from public, anon, authenticated;
revoke all on function public.get_slime_jump_personal_rank(uuid)
  from public, anon, authenticated;

grant execute on function public.submit_slime_jump_personal_best(uuid, bigint)
  to anon;
grant execute on function public.get_slime_jump_personal_rank(uuid)
  to anon;

commit;

-- Sicherheitsgrenze:
-- player_id ist eine lokale Installations-UUID und keine kryptographisch
-- verifizierte Identitaet. Die RPCs isolieren Tabellenrechte und verhindern
-- Score-Reduktionen, ersetzen aber weder Authentifizierung noch Anti-Cheat.
