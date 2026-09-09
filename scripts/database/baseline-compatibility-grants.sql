-- Proposed empty-install compatibility contract, reviewed under ADR-0006.
-- These are explicit exceptions to the source-only privilege reference, not
-- proof that the immutable application migrations originally granted them.
-- Preserve existing server-role capabilities from the reviewed export; do not
-- add anon/authenticated/PUBLIC access, grant options or future-object defaults.
-- No blanket "ALL TABLES/FUNCTIONS IN SCHEMA" grant is permitted here.
grant all on table public.event_sessions to service_role;
grant all on table public.events to service_role;
grant all on table public.item_interactions to service_role;
grant all on table public.item_list_entries to service_role;
grant all on table public.item_lists to service_role;
grant all on table public.items to service_role;
grant all on table public.profile_invitations to service_role;
grant all on table public.profile_members to service_role;
grant all on table public.profiles to service_role;
grant all on table public.shared_item_consensus to service_role;
grant all on table public.shared_item_endorsements to service_role;
grant all on table public.users to service_role;

grant execute on function public.add_shared_profile_member(uuid,text) to service_role;
grant execute on function public.complete_personal_profile(text) to service_role;
grant execute on function public.create_custom_item_list(uuid,text) to service_role;
grant execute on function public.create_shared_profile(text) to service_role;
grant execute on function public.delete_custom_item_list(uuid) to service_role;
grant execute on function public.endorse_shared_item(uuid,uuid) to service_role;
grant execute on function public.get_item_list_entries(uuid) to service_role;
grant execute on function public.get_my_shared_profile_invitations() to service_role;
grant execute on function public.get_my_shared_profiles() to service_role;
grant execute on function public.get_profile_consumed_items(uuid,text) to service_role;
grant execute on function public.get_profile_item_lists(uuid,uuid) to service_role;
grant execute on function public.invite_shared_profile_member(uuid,text) to service_role;
grant execute on function public.leave_shared_profile(uuid) to service_role;
grant execute on function public.rename_custom_item_list(uuid,text) to service_role;
grant execute on function public.respond_shared_profile_invitation(uuid,boolean) to service_role;
grant execute on function public.reverse_shared_item_endorsement(uuid,uuid) to service_role;
grant execute on function public.set_item_list_destinations(uuid,uuid,uuid[]) to service_role;
grant execute on function public.set_item_list_entry(uuid,uuid,boolean) to service_role;
