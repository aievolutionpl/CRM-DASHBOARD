begin;
-- Profil marki (Brand Studio) przechowywany w ustawieniach przestrzeni.
create or replace function public.save_workspace(wid uuid, expected_revision integer, crm jsonb, prefs jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare rev integer; t text; k text; begin
 if public.workspace_role(wid) not in ('owner','admin','marketer') or public.workspace_role(wid) is null then
 raise exception 'forbidden' using errcode='42501'; end if;
 select revision into rev from public.workspaces where id=wid for update;
 if rev<>expected_revision then raise exception 'revision_conflict' using errcode='40001'; end if;
 if pg_column_size(crm)>5000000 then raise exception 'payload_too_large'; end if;
 foreach k in array array['firms','contacts','deals','tasks','mails'] loop
 if jsonb_typeof(crm->k) is distinct from 'array' or jsonb_array_length(crm->k)>10000 then raise exception 'invalid_payload'; end if;
 end loop;
 if jsonb_typeof(prefs->'onboarded') is distinct from 'boolean' or jsonb_typeof(prefs->'agentEnabled') is distinct from 'boolean'
 or jsonb_typeof(prefs->'sender') is distinct from 'string' or length(prefs->>'sender')>200 then raise exception 'invalid_settings'; end if;
 if prefs ? 'automation' and (jsonb_typeof(prefs->'automation') is distinct from 'object' or pg_column_size(prefs->'automation')>3000000
 or jsonb_typeof(coalesce(prefs->'automation'->'jobs','[]'::jsonb)) is distinct from 'array' or jsonb_array_length(coalesce(prefs->'automation'->'jobs','[]'::jsonb))>30
 or jsonb_typeof(coalesce(prefs->'automation'->'reports','[]'::jsonb)) is distinct from 'array' or jsonb_array_length(coalesce(prefs->'automation'->'reports','[]'::jsonb))>48
 or jsonb_typeof(coalesce(prefs->'automation'->'runs','[]'::jsonb)) is distinct from 'array' or jsonb_array_length(coalesce(prefs->'automation'->'runs','[]'::jsonb))>80) then raise exception 'invalid_automation'; end if;
 if prefs ? 'brand' and jsonb_typeof(prefs->'brand') is distinct from 'null' and (jsonb_typeof(prefs->'brand') is distinct from 'object' or pg_column_size(prefs->'brand')>200000) then raise exception 'invalid_brand'; end if;
 if prefs ? 'businessMode' and (jsonb_typeof(prefs->'businessMode') is distinct from 'string' or prefs->>'businessMode' not in ('crm','services')) then raise exception 'invalid_business_mode'; end if;
 delete from public.contacts where workspace_id=wid;
 delete from public.deals where workspace_id=wid;
 delete from public.tasks where workspace_id=wid;
 delete from public.companies where workspace_id=wid;
 delete from public.mails where workspace_id=wid;
 insert into public.companies select wid,v->>'id',v from jsonb_array_elements(crm->'firms') v;
 foreach t in array array['contacts','deals','tasks'] loop
 execute format('insert into public.%I select $1,v->>''id'',v->>''companyId'',v from jsonb_array_elements($2) v',t) using wid,crm->t;
 end loop;
 insert into public.mails select wid,v->>'id',v from jsonb_array_elements(crm->'mails') v;
 update public.workspaces set revision=rev+1,settings=jsonb_build_object('onboarded',prefs->'onboarded','sender',prefs->'sender','agentEnabled',prefs->'agentEnabled','businessMode',coalesce(prefs->'businessMode','"crm"'::jsonb),'automation',coalesce(prefs->'automation','{"jobs":[],"runs":[],"reports":[]}'::jsonb),'brand',coalesce(prefs->'brand','null'::jsonb)) where id=wid;
 insert into public.audit_logs(workspace_id,actor_id,action,metadata) values(wid,auth.uid(),'crm.saved',jsonb_build_object('revision',rev+1));
 return rev+1;
end $$;

commit;
