-- Verification applies to the facts reviewed by the Direzione, not later edits.
-- PostgreSQL runs same-event triggers alphabetically: diary_guard first rejects
-- explicit unauthorized state changes; diary_invalidate_verification then resets
-- verification only when an otherwise-authorized factual edit changes the note.
create or replace function app_private.invalidate_diary_verification() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not app_private.direction()
 and (new.event_on,new.category,new.description,new.action_taken) is distinct from (old.event_on,old.category,old.description,old.action_taken) then
  new.verification_status:='da_verificare';
 end if;
 return new;
end $$;
revoke all on function app_private.invalidate_diary_verification() from public,anon,authenticated;
create trigger diary_invalidate_verification before update on public.diary_entries for each row execute function app_private.invalidate_diary_verification();
