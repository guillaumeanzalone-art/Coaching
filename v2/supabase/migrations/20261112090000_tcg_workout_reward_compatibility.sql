-- Compatibilite recompenses existantes pendant la migration vers un controle complet de seance.
-- Le RPC exige deja auth.uid et can_edit_athlete.
alter function public.claim_tcg_workout_pack_v1(text,text,smallint,smallint) security definer;
revoke all on function public.claim_tcg_workout_pack_v1(text,text,smallint,smallint) from public, anon;
grant execute on function public.claim_tcg_workout_pack_v1(text,text,smallint,smallint) to authenticated;
