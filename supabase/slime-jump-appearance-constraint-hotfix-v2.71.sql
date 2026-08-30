-- Slime Soar v2.71: erweitert ausschliesslich die bestehenden Appearance-
-- Whitelists des globalen Leaderboards um alle aktuell gueltigen Client-IDs.
-- Diese Migration enthaelt keine Datenmutation und wird manuell ausgefuehrt.

begin;

alter table public.slime_jump_highscores
  drop constraint slime_jump_highscores_slime_cosmetic_check;

alter table public.slime_jump_highscores
  add constraint slime_jump_highscores_slime_cosmetic_check
  check (
    slime_cosmetic is null
    or slime_cosmetic in (
      'none',
      'sunglasses',
      'cap',
      'crown',
      'top_hat',
      'wizard_hat',
      'pirate_hat',
      'headphones',
      'bow',
      'cowboy_hat',
      'devil_horns',
      'halo',
      'ninja_headband',
      'viking_helmet',
      'party_hat',
      'chef_hat',
      'propeller_hat',
      'cat_ears',
      'bunny_ears',
      'graduation_cap',
      'construction_helmet',
      'mushroom_hat',
      'jester_hat',
      'chinese_straw_hat'
    )
  );

alter table public.slime_jump_highscores
  drop constraint slime_jump_highscores_slime_beard_check;

alter table public.slime_jump_highscores
  add constraint slime_jump_highscores_slime_beard_check
  check (
    slime_beard in (
      'none',
      'stubble',
      'mustache',
      'goatee',
      'full_beard',
      'cowboy_mustache',
      'viking_beard',
      'wizard_beard',
      'braided_beard',
      'lumberjack_beard',
      'imperial_beard',
      'walrus_mustache',
      'horseshoe_mustache',
      'soul_patch',
      'chinstrap_beard',
      'mutton_chops',
      'ducktail_beard',
      'forked_beard',
      'curly_beard',
      'box_beard',
      'pharaoh_beard',
      'fan_beard',
      'pencil_mustache',
      'circle_beard'
    )
  );

commit;
