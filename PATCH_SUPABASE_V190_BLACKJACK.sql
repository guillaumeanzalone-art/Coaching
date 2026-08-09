-- ============================================================================
-- V190 — BLACKJACK DU NAIN FORGERON
-- À exécuter APRÈS les patchs RPG existants.
--
-- Règles :
-- - mise en Gold
-- - Hit / Stand
-- - Blackjack naturel payé 3:2
-- - victoire normale payée 1:1
-- - égalité = mise rendue
-- - dealer reste à 17 (S17)
-- - pas de split / double / assurance dans V190
-- - cartes et résultat calculés uniquement côté Supabase
-- ============================================================================

begin;

create or replace function public.rpg_blackjack_assert_access_v190(p_athlete_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentification requise.';
  end if;

  if not exists (
    select 1
    from public.app_users u
    where u.user_id = auth.uid()
      and lower(coalesce(u.role, '')) <> 'pending'
      and (
        lower(coalesce(u.role, '')) in ('coach', 'admin')
        or lower(coalesce(u.athlete_slug, '')) = lower(coalesce(p_athlete_slug, ''))
      )
  ) then
    raise exception 'Accès refusé pour cet athlète.';
  end if;
end;
$$;

revoke all on function public.rpg_blackjack_assert_access_v190(text) from public, anon;
grant execute on function public.rpg_blackjack_assert_access_v190(text) to authenticated;

-- Carte tirée depuis un sabot virtuel infini.
-- Le serveur ne transmet jamais la carte cachée du dealer pendant le tour joueur.
create or replace function public.rpg_blackjack_draw_card_v190()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_rank_idx integer := floor(random() * 13)::integer;
  v_suit_idx integer := floor(random() * 4)::integer;
  v_rank text;
  v_suit text;
begin
  v_rank := (array['A','2','3','4','5','6','7','8','9','10','J','Q','K'])[v_rank_idx + 1];
  v_suit := (array['♠','♥','♦','♣'])[v_suit_idx + 1];
  return jsonb_build_object('rank', v_rank, 'suit', v_suit);
end;
$$;

revoke all on function public.rpg_blackjack_draw_card_v190() from public, anon, authenticated;

create or replace function public.rpg_blackjack_hand_value_v190(p_cards jsonb)
returns integer
language plpgsql
immutable
security definer
set search_path = public
as $$
declare
  v_card jsonb;
  v_rank text;
  v_total integer := 0;
  v_aces integer := 0;
begin
  if p_cards is null or jsonb_typeof(p_cards) <> 'array' then
    return 0;
  end if;

  for v_card in select value from jsonb_array_elements(p_cards)
  loop
    v_rank := coalesce(v_card->>'rank','');
    if v_rank = 'A' then
      v_total := v_total + 11;
      v_aces := v_aces + 1;
    elsif v_rank in ('J','Q','K') then
      v_total := v_total + 10;
    elsif v_rank ~ '^[0-9]+$' then
      v_total := v_total + v_rank::integer;
    end if;
  end loop;

  while v_total > 21 and v_aces > 0 loop
    v_total := v_total - 10;
    v_aces := v_aces - 1;
  end loop;

  return v_total;
end;
$$;

revoke all on function public.rpg_blackjack_hand_value_v190(jsonb) from public, anon, authenticated;

create or replace function public.rpg_blackjack_is_natural_v190(p_cards jsonb)
returns boolean
language sql
immutable
security definer
set search_path = public
as $$
  select coalesce(jsonb_array_length(p_cards),0) = 2
     and public.rpg_blackjack_hand_value_v190(p_cards) = 21;
$$;

revoke all on function public.rpg_blackjack_is_natural_v190(jsonb) from public, anon, authenticated;

create table if not exists public.rpg_blackjack_state_v190 (
  athlete_slug text primary key,
  round_status text not null default 'idle'
    check (round_status in ('idle','player_turn','resolved')),
  player_cards jsonb not null default '[]'::jsonb,
  dealer_cards jsonb not null default '[]'::jsonb,
  bet numeric(30,0) not null default 0 check (bet >= 0),
  result text not null default '',
  payout numeric(30,0) not null default 0 check (payout >= 0),
  updated_at timestamptz not null default now()
);

alter table public.rpg_blackjack_state_v190 enable row level security;
revoke all on table public.rpg_blackjack_state_v190 from anon, authenticated;

create table if not exists public.rpg_blackjack_history_v190 (
  id bigserial primary key,
  athlete_slug text not null,
  bet numeric(30,0) not null,
  player_cards jsonb not null,
  dealer_cards jsonb not null,
  player_total integer not null,
  dealer_total integer not null,
  result text not null,
  payout numeric(30,0) not null,
  created_at timestamptz not null default now()
);

alter table public.rpg_blackjack_history_v190 enable row level security;
revoke all on table public.rpg_blackjack_history_v190 from anon, authenticated;

-- Vue RPC sécurisée : cache la deuxième carte du dealer pendant le tour joueur.
create or replace function public.get_rpg_blackjack_state_v190(p_athlete_slug text)
returns table (
  round_status text,
  player_cards jsonb,
  dealer_cards jsonb,
  player_total integer,
  dealer_total integer,
  bet numeric,
  result text,
  payout numeric,
  gold_balance numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_player jsonb;
  v_dealer jsonb;
  v_bet numeric;
  v_result text;
  v_payout numeric;
  v_gold numeric;
  v_public_dealer jsonb;
begin
  perform public.rpg_blackjack_assert_access_v190(p_athlete_slug);

  insert into public.rpg_blackjack_state_v190(athlete_slug)
  values (p_athlete_slug)
  on conflict (athlete_slug) do nothing;

  select s.round_status, s.player_cards, s.dealer_cards, s.bet, s.result, s.payout
  into v_status, v_player, v_dealer, v_bet, v_result, v_payout
  from public.rpg_blackjack_state_v190 s
  where lower(s.athlete_slug) = lower(p_athlete_slug)
  limit 1;

  select coalesce(ap.gold_balance,0)::numeric
  into v_gold
  from public.athlete_progress ap
  where lower(ap.athlete_slug) = lower(p_athlete_slug)
  limit 1;

  if v_status = 'player_turn' and jsonb_array_length(v_dealer) >= 2 then
    v_public_dealer := jsonb_build_array(
      v_dealer->0,
      jsonb_build_object('rank','?','suit','')
    );
  else
    v_public_dealer := v_dealer;
  end if;

  return query
  select
    v_status,
    v_player,
    v_public_dealer,
    public.rpg_blackjack_hand_value_v190(v_player),
    case
      when v_status = 'player_turn'
        then public.rpg_blackjack_hand_value_v190(jsonb_build_array(v_dealer->0))
      else public.rpg_blackjack_hand_value_v190(v_dealer)
    end,
    coalesce(v_bet,0),
    coalesce(v_result,''),
    coalesce(v_payout,0),
    coalesce(v_gold,0);
end;
$$;

revoke all on function public.get_rpg_blackjack_state_v190(text) from public, anon;
grant execute on function public.get_rpg_blackjack_state_v190(text) to authenticated;

create or replace function public.rpg_blackjack_start_v190(
  p_athlete_slug text,
  p_bet numeric
)
returns table (
  round_status text,
  player_cards jsonb,
  dealer_cards jsonb,
  player_total integer,
  dealer_total integer,
  bet numeric,
  result text,
  payout numeric,
  gold_balance numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bet numeric(30,0) := trunc(coalesce(p_bet,0));
  v_gold numeric(30,0);
  v_player jsonb;
  v_dealer jsonb;
  v_player_bj boolean;
  v_dealer_bj boolean;
  v_result text := '';
  v_payout numeric(30,0) := 0;
  v_status text := 'player_turn';
begin
  perform public.rpg_blackjack_assert_access_v190(p_athlete_slug);
  perform pg_advisory_xact_lock(hashtext('rpg_blackjack_v190'), hashtext(lower(p_athlete_slug)));

  if v_bet < 1 then
    raise exception 'La mise minimale est de 1 gold.';
  end if;

  if v_bet > 1000000000000000000000000::numeric then
    raise exception 'Mise trop élevée.';
  end if;

  insert into public.rpg_blackjack_state_v190(athlete_slug)
  values (p_athlete_slug)
  on conflict (athlete_slug) do nothing;

  if exists (
    select 1 from public.rpg_blackjack_state_v190 s
    where lower(s.athlete_slug) = lower(p_athlete_slug)
      and s.round_status = 'player_turn'
  ) then
    raise exception 'Une partie de blackjack est déjà en cours.';
  end if;

  select coalesce(ap.gold_balance,0)::numeric
  into v_gold
  from public.athlete_progress ap
  where lower(ap.athlete_slug) = lower(p_athlete_slug)
  for update;

  if not found then
    raise exception 'Progression RPG introuvable.';
  end if;

  if v_gold < v_bet then
    raise exception 'Gold insuffisant : % disponibles.', v_gold;
  end if;

  update public.athlete_progress
  set gold_balance = gold_balance - v_bet
  where lower(athlete_slug) = lower(p_athlete_slug);

  v_player := jsonb_build_array(
    public.rpg_blackjack_draw_card_v190(),
    public.rpg_blackjack_draw_card_v190()
  );
  v_dealer := jsonb_build_array(
    public.rpg_blackjack_draw_card_v190(),
    public.rpg_blackjack_draw_card_v190()
  );

  v_player_bj := public.rpg_blackjack_is_natural_v190(v_player);
  v_dealer_bj := public.rpg_blackjack_is_natural_v190(v_dealer);

  if v_player_bj and v_dealer_bj then
    v_status := 'resolved';
    v_result := 'push';
    v_payout := v_bet;
  elsif v_player_bj then
    v_status := 'resolved';
    v_result := 'blackjack';
    v_payout := trunc(v_bet * 2.5);
  elsif v_dealer_bj then
    v_status := 'resolved';
    v_result := 'dealer_blackjack';
    v_payout := 0;
  end if;

  if v_status = 'resolved' and v_payout > 0 then
    update public.athlete_progress
    set gold_balance = gold_balance + v_payout,
        gold_total_earned = coalesce(gold_total_earned,0) + v_payout
    where lower(athlete_slug) = lower(p_athlete_slug);
  end if;

  update public.rpg_blackjack_state_v190
  set round_status = v_status,
      player_cards = v_player,
      dealer_cards = v_dealer,
      bet = v_bet,
      result = v_result,
      payout = v_payout,
      updated_at = now()
  where lower(athlete_slug) = lower(p_athlete_slug);

  if v_status = 'resolved' then
    insert into public.rpg_blackjack_history_v190(
      athlete_slug, bet, player_cards, dealer_cards,
      player_total, dealer_total, result, payout
    ) values (
      p_athlete_slug, v_bet, v_player, v_dealer,
      public.rpg_blackjack_hand_value_v190(v_player),
      public.rpg_blackjack_hand_value_v190(v_dealer),
      v_result, v_payout
    );
  end if;

  return query
  select * from public.get_rpg_blackjack_state_v190(p_athlete_slug);
end;
$$;

revoke all on function public.rpg_blackjack_start_v190(text,numeric) from public, anon;
grant execute on function public.rpg_blackjack_start_v190(text,numeric) to authenticated;

create or replace function public.rpg_blackjack_action_v190(
  p_athlete_slug text,
  p_action text
)
returns table (
  round_status text,
  player_cards jsonb,
  dealer_cards jsonb,
  player_total integer,
  dealer_total integer,
  bet numeric,
  result text,
  payout numeric,
  gold_balance numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text := lower(trim(coalesce(p_action,'')));
  v_player jsonb;
  v_dealer jsonb;
  v_bet numeric(30,0);
  v_player_total integer;
  v_dealer_total integer;
  v_result text := '';
  v_payout numeric(30,0) := 0;
  v_resolved boolean := false;
begin
  perform public.rpg_blackjack_assert_access_v190(p_athlete_slug);
  perform pg_advisory_xact_lock(hashtext('rpg_blackjack_v190'), hashtext(lower(p_athlete_slug)));

  if v_action not in ('hit','stand') then
    raise exception 'Action invalide.';
  end if;

  select s.player_cards, s.dealer_cards, s.bet
  into v_player, v_dealer, v_bet
  from public.rpg_blackjack_state_v190 s
  where lower(s.athlete_slug) = lower(p_athlete_slug)
    and s.round_status = 'player_turn'
  for update;

  if not found then
    raise exception 'Aucune partie de blackjack en cours.';
  end if;

  if v_action = 'hit' then
    v_player := v_player || jsonb_build_array(public.rpg_blackjack_draw_card_v190());
    v_player_total := public.rpg_blackjack_hand_value_v190(v_player);

    if v_player_total > 21 then
      v_result := 'bust';
      v_resolved := true;
    elsif v_player_total < 21 then
      update public.rpg_blackjack_state_v190
      set player_cards = v_player,
          updated_at = now()
      where lower(athlete_slug) = lower(p_athlete_slug);

      return query
      select * from public.get_rpg_blackjack_state_v190(p_athlete_slug);
      return;
    end if;
    -- À exactement 21, résolution automatique comme un Stand.
  end if;

  if not v_resolved then
    v_player_total := public.rpg_blackjack_hand_value_v190(v_player);
    v_dealer_total := public.rpg_blackjack_hand_value_v190(v_dealer);

    while v_dealer_total < 17 loop
      v_dealer := v_dealer || jsonb_build_array(public.rpg_blackjack_draw_card_v190());
      v_dealer_total := public.rpg_blackjack_hand_value_v190(v_dealer);
    end loop;

    if v_dealer_total > 21 then
      v_result := 'win';
      v_payout := v_bet * 2;
    elsif v_player_total > v_dealer_total then
      v_result := 'win';
      v_payout := v_bet * 2;
    elsif v_player_total = v_dealer_total then
      v_result := 'push';
      v_payout := v_bet;
    else
      v_result := 'dealer_win';
      v_payout := 0;
    end if;

    v_resolved := true;
  end if;

  if v_payout > 0 then
    update public.athlete_progress
    set gold_balance = gold_balance + v_payout,
        gold_total_earned = coalesce(gold_total_earned,0) + v_payout
    where lower(athlete_slug) = lower(p_athlete_slug);
  end if;

  update public.rpg_blackjack_state_v190
  set round_status = 'resolved',
      player_cards = v_player,
      dealer_cards = v_dealer,
      result = v_result,
      payout = v_payout,
      updated_at = now()
  where lower(athlete_slug) = lower(p_athlete_slug);

  insert into public.rpg_blackjack_history_v190(
    athlete_slug, bet, player_cards, dealer_cards,
    player_total, dealer_total, result, payout
  ) values (
    p_athlete_slug, v_bet, v_player, v_dealer,
    public.rpg_blackjack_hand_value_v190(v_player),
    public.rpg_blackjack_hand_value_v190(v_dealer),
    v_result, v_payout
  );

  return query
  select * from public.get_rpg_blackjack_state_v190(p_athlete_slug);
end;
$$;

revoke all on function public.rpg_blackjack_action_v190(text,text) from public, anon;
grant execute on function public.rpg_blackjack_action_v190(text,text) to authenticated;

notify pgrst, 'reload schema';

commit;
