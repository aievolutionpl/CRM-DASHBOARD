\set ON_ERROR_STOP on
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select public.create_workspace('Marka') as wa \gset
select public.save_workspace(:'wa',0,'{"firms":[],"contacts":[],"deals":[],"tasks":[],"mails":[]}', '{"onboarded":true,"sender":"A","agentEnabled":false,"brand":{"name":"Róża","applied":true,"colors":{"primary":"#e11d48"}}}');
select set_config('test.wa',:'wa',true);
do $$ declare s jsonb; begin
 s := public.read_workspace(current_setting('test.wa')::uuid)->'settings';
 if s->'brand'->>'name' is distinct from 'Róża' or s->'brand'->'colors'->>'primary' is distinct from '#e11d48' then raise exception 'brand not stored: %', s; end if;
 if s->'automation' is null then raise exception 'automation default lost: %', s; end if;
 begin perform public.save_workspace(current_setting('test.wa')::uuid,1,'{"firms":[],"contacts":[],"deals":[],"tasks":[],"mails":[]}','{"onboarded":true,"sender":"A","agentEnabled":false,"brand":"x"}'); raise exception 'invalid brand accepted'; exception when raise_exception then if sqlerrm <> 'invalid_brand' then raise; end if; end;
 perform public.save_workspace(current_setting('test.wa')::uuid,1,'{"firms":[],"contacts":[],"deals":[],"tasks":[],"mails":[]}','{"onboarded":true,"sender":"A","agentEnabled":false}');
 s := public.read_workspace(current_setting('test.wa')::uuid)->'settings';
 if jsonb_typeof(s->'brand') is distinct from 'null' then raise exception 'brand not cleared: %', s; end if;
end $$;
rollback;
\echo 'PASS: brand profile stored, validated and cleared'
