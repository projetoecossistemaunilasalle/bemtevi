-- Migration: 20260910001000_content_draft_operations.sql
-- Description: V2 editorial draft RPC surface, part 1 (dossier 15): private
--   structural/digest/image/operation helpers and the admin load/head/mutate
--   RPCs. All access is RPC-only: no public policies are created for the new
--   tables and every helper stays inside content_private without grants.
--
-- Error protocol: private helpers raise SQLSTATE P0001 (RAISE EXCEPTION) whose
-- MESSAGE_TEXT is exactly a frozen domain error code from doc 14, optionally
-- followed by ';' and a JSON detail object. Wrappers catch known codes inside
-- rollback exception sub-blocks and return Result<T> JSONB; unexpected
-- exceptions re-raise and roll back the whole request.

-- ---------------------------------------------------------------------------
-- Digest, timestamps and small structural utilities
-- ---------------------------------------------------------------------------

create or replace function content_private.payload_digest(p_payload jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(p_payload::text, 'UTF8')),
    'hex'
  );
$$;

create or replace function content_private.iso8601(p_time timestamptz)
returns text
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.to_char(p_time at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
$$;

create or replace function content_private.json_keys(p_object jsonb)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    array(select k from jsonb_object_keys(p_object) k order by k),
    array[]::text[]
  );
$$;

-- Exact operation/image key-set enforcement (reject unknown keys).
create or replace function content_private.expect_object_keys(p_object jsonb, p_expected text[])
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if content_private.json_keys(p_object)
    is distinct from array(select unnest(p_expected) order by 1) then
    raise exception 'invalid_operations';
  end if;
end;
$$;

-- Reject object keys outside a permitted set (subset check).
create or replace function content_private.reject_extra_keys(p_object jsonb, p_allowed text[])
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_key text;
begin
  for v_key in select k from jsonb_object_keys(p_object) k
  loop
    if not (v_key = any (p_allowed)) then
      raise exception 'invalid_operations';
    end if;
  end loop;
end;
$$;

-- Frozen scope field allowlists (dossier 14). Frozen data in SQL: never
-- derived from the V1 compatibility facade. `storage` is the set of keys a
-- stored payload item may carry (add ∪ patch ∪ unset ∪ protected image keys).
create or replace function content_private.allowed_keys(p_scope text, p_kind text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case p_kind
    when 'add' then
      case p_scope
        when 'flows' then array[
          'id', 'version', 'locale', 'title', 'type', 'purpose', 'status',
          'entry', 'nodes', 'nodeOrder']
        when 'educationMaterials' then array[
          'id', 'title', 'source', 'description', 'tags', 'audience', 'body',
          'embed', 'href', 'group', 'groupOrder', 'review']
        when 'educationGroups' then array['id', 'title', 'description', 'order']
        when 'contacts' then array[
          'id', 'name', 'type', 'badgeTone', 'city', 'state', 'locationId',
          'address', 'phoneDisplay', 'phoneHref', 'hours', 'notes', 'lat',
          'lng', 'review']
        when 'locations' then array['id', 'city', 'state']
      end
    when 'patch' then
      case p_scope
        when 'flows' then array[
          'version', 'locale', 'title', 'type', 'purpose', 'status', 'entry',
          'nodes', 'nodeOrder']
        when 'educationMaterials' then array[
          'title', 'source', 'description', 'tags', 'audience', 'body',
          'embed', 'href', 'group', 'groupOrder', 'review']
        when 'educationGroups' then array['title', 'description', 'order']
        when 'contacts' then array[
          'name', 'type', 'badgeTone', 'city', 'state', 'locationId',
          'address', 'phoneDisplay', 'phoneHref', 'hours', 'notes', 'lat',
          'lng', 'review']
        when 'locations' then array['city', 'state']
      end
    when 'unset' then
      case p_scope
        when 'flows' then array['purpose', 'nodeOrder']
        when 'educationMaterials' then array['body', 'embed', 'href', 'group', 'groupOrder']
        when 'educationGroups' then array['description']
        when 'contacts' then array['locationId', 'hours', 'notes', 'lat', 'lng']
        when 'locations' then array[]::text[]
      end
    when 'storage' then
      case p_scope
        when 'flows' then array[
          'id', 'version', 'locale', 'title', 'type', 'purpose', 'status',
          'entry', 'nodes', 'nodeOrder']
        when 'educationMaterials' then array[
          'id', 'title', 'source', 'description', 'imageUrl', 'imageFileName',
          'featuredImage', 'tags', 'audience', 'body', 'embed', 'href',
          'group', 'groupOrder', 'review']
        when 'educationGroups' then array['id', 'title', 'description', 'order']
        when 'contacts' then array[
          'id', 'name', 'type', 'badgeTone', 'city', 'state', 'locationId',
          'address', 'phoneDisplay', 'phoneHref', 'hours', 'notes', 'lat',
          'lng', 'review']
        when 'locations' then array['id', 'city', 'state']
      end
  end;
$$;

create or replace function content_private.is_scope(p_scope jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p_scope) = 'string'
    and p_scope #>> '{}' in (
      'flows', 'educationMaterials', 'educationGroups', 'contacts', 'locations'
    );
$$;

-- ID: nonempty string of at most 200 Unicode code points.
create or replace function content_private.check_id(p_id jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_id text;
begin
  if jsonb_typeof(p_id) is distinct from 'string' then
    raise exception 'invalid_operations';
  end if;
  v_id := p_id #>> '{}';
  if v_id is null or char_length(v_id) < 1 or char_length(v_id) > 200 then
    raise exception 'invalid_operations';
  end if;
end;
$$;

-- Finite safe integer bound (counters/defaultGroupOrder).
create or replace function content_private.check_safe_integer(p_value jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if jsonb_typeof(p_value) is distinct from 'number' then
    raise exception 'invalid_operations';
  end if;
  if (p_value #>> '{}') !~ '^-?[0-9]+$'
    or abs((p_value #>> '{}')::numeric) > 9007199254740991 then
    raise exception 'invalid_operations';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Bounded byte readers and image container validation
-- ---------------------------------------------------------------------------

create or replace function content_private.read_u32be(p_bytes bytea, p_offset integer)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select ((get_byte(p_bytes, p_offset)::bigint & 255) << 24)
    | ((get_byte(p_bytes, p_offset + 1)::bigint & 255) << 16)
    | ((get_byte(p_bytes, p_offset + 2)::bigint & 255) << 8)
    | (get_byte(p_bytes, p_offset + 3)::bigint & 255);
$$;

create or replace function content_private.read_u32le(p_bytes bytea, p_offset integer)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select ((get_byte(p_bytes, p_offset + 3)::bigint & 255) << 24)
    | ((get_byte(p_bytes, p_offset + 2)::bigint & 255) << 16)
    | ((get_byte(p_bytes, p_offset + 1)::bigint & 255) << 8)
    | (get_byte(p_bytes, p_offset)::bigint & 255);
$$;

create or replace function content_private.read_u16be(p_bytes bytea, p_offset integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select ((get_byte(p_bytes, p_offset) & 255) << 8) | (get_byte(p_bytes, p_offset + 1) & 255);
$$;

create or replace function content_private.check_image_dimensions(p_width bigint, p_height bigint)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_width < 1 or p_height < 1 or p_width > 4096 or p_height > 4096
    or p_width * p_height > 16000000 then
    raise exception 'invalid_image';
  end if;
end;
$$;

-- Header/container validation only (dossier 14): PNG signature/IHDR plus
-- bounded chunk scan rejecting acTL; JPEG SOI, length-bounded marker scan
-- through SOF0/SOF1/SOF2 requiring EOI; WebP RIFF/WEBP bounds with VP8/VP8L/
-- VP8X dimensions, rejecting animation bit/ANIM/ANMF.
create or replace function content_private.inspect_image_container(p_bytes bytea, p_mime text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_len bigint := octet_length(p_bytes);
  v_offset bigint;
  v_limit bigint;
  v_length bigint;
  v_marker integer;
  v_chunk bytea;
  v_w bigint;
  v_h bigint;
  v_bits bigint;
begin
  if p_mime = 'image/png' then
    if v_len < 33
      or substring(p_bytes from 1 for 8) is distinct from '\x89504e470d0a1a0a'::bytea
      or substring(p_bytes from 13 for 4) is distinct from '\x49484452'::bytea then
      raise exception 'invalid_image';
    end if;
    v_offset := 8;
    while v_offset + 12 <= v_len loop
      v_length := content_private.read_u32be(p_bytes, v_offset::integer);
      v_chunk := substring(p_bytes from (v_offset + 5)::integer for 4);
      if v_chunk = '\x6163544c'::bytea then
        raise exception 'invalid_image';
      end if;
      if v_chunk = '\x49484452'::bytea then
        v_w := content_private.read_u32be(p_bytes, (v_offset + 8)::integer);
        v_h := content_private.read_u32be(p_bytes, (v_offset + 12)::integer);
        perform content_private.check_image_dimensions(v_w, v_h);
        return;
      end if;
      v_offset := v_offset + 12 + v_length;
      if v_offset > v_len then
        raise exception 'invalid_image';
      end if;
    end loop;
    raise exception 'invalid_image';
  elsif p_mime = 'image/jpeg' then
    if v_len < 4 or get_byte(p_bytes, 0) <> 255 or get_byte(p_bytes, 1) <> 216 then
      raise exception 'invalid_image';
    end if;
    v_offset := 2;
    while v_offset + 2 <= v_len loop
      if get_byte(p_bytes, v_offset::integer) <> 255 then
        raise exception 'invalid_image';
      end if;
      v_marker := get_byte(p_bytes, v_offset::integer + 1);
      if v_marker = 216 or v_marker = 1 or v_marker between 208 and 215 then
        v_offset := v_offset + 2;
        continue;
      end if;
      if v_marker = 217 then
        if v_w is null then
          raise exception 'invalid_image';
        end if;
        perform content_private.check_image_dimensions(v_w, v_h);
        return;
      end if;
      v_length := content_private.read_u16be(p_bytes, v_offset::integer + 2);
      if v_length < 2 or v_offset + 2 + v_length > v_len then
        raise exception 'invalid_image';
      end if;
      if v_marker between 192 and 207 and v_marker not in (196, 200, 204) then
        if v_marker not in (192, 193, 194) then
          raise exception 'invalid_image';
        end if;
        v_h := content_private.read_u16be(p_bytes, v_offset::integer + 5);
        v_w := content_private.read_u16be(p_bytes, v_offset::integer + 7);
      end if;
      v_offset := v_offset + 2 + v_length;
    end loop;
    raise exception 'invalid_image';
  elsif p_mime = 'image/webp' then
    if v_len < 27
      or substring(p_bytes from 1 for 4) is distinct from '\x52494646'::bytea
      or substring(p_bytes from 9 for 4) is distinct from '\x57454250'::bytea then
      raise exception 'invalid_image';
    end if;
    v_limit := least(v_len, 8 + content_private.read_u32le(p_bytes, 4)::bigint);
    if 8 + content_private.read_u32le(p_bytes, 4)::bigint > v_len then
      raise exception 'invalid_image';
    end if;
    v_offset := 12;
    while v_offset + 8 <= v_limit loop
      v_chunk := substring(p_bytes from (v_offset + 1)::integer for 4);
      v_length := content_private.read_u32le(p_bytes, (v_offset + 4)::integer);
      if v_offset + 8 + v_length > v_limit then
        raise exception 'invalid_image';
      end if;
      if v_chunk = '\x414e494d'::bytea or v_chunk = '\x414e4d46'::bytea then
        raise exception 'invalid_image';
      end if;
      if v_chunk = '\x56503858'::bytea then
        if (get_byte(p_bytes, v_offset::integer + 8) & 2) <> 0 then
          raise exception 'invalid_image';
        end if;
        v_w := 1 + (
          (get_byte(p_bytes, v_offset::integer + 9)
            | (get_byte(p_bytes, v_offset::integer + 10) << 8)
            | (get_byte(p_bytes, v_offset::integer + 11) << 16)) & 16777215
        )::bigint;
        v_h := 1 + (
          (get_byte(p_bytes, v_offset::integer + 12)
            | (get_byte(p_bytes, v_offset::integer + 13) << 8)
            | (get_byte(p_bytes, v_offset::integer + 14) << 16)) & 16777215
        )::bigint;
        perform content_private.check_image_dimensions(v_w, v_h);
        return;
      elsif v_chunk = '\x56503820'::bytea then
        if v_offset + 14 > v_len
          or get_byte(p_bytes, v_offset::integer + 8) <> 157
          or get_byte(p_bytes, v_offset::integer + 9) <> 1
          or get_byte(p_bytes, v_offset::integer + 10) <> 42 then
          raise exception 'invalid_image';
        end if;
        v_w := (
          (get_byte(p_bytes, v_offset::integer + 11)
            | ((get_byte(p_bytes, v_offset::integer + 12) & 63) << 8)) & 16383
        )::bigint;
        v_h := (
          (get_byte(p_bytes, v_offset::integer + 13)
            | ((get_byte(p_bytes, v_offset::integer + 14) & 63) << 8)) & 16383
        )::bigint;
        perform content_private.check_image_dimensions(v_w, v_h);
        return;
      elsif v_chunk = '\x5650384c'::bytea then
        v_bits := content_private.read_u32le(p_bytes, (v_offset + 8)::integer);
        if (v_bits & 255) <> 47 then
          raise exception 'invalid_image';
        end if;
        v_w := ((v_bits >> 8) & 16383) + 1;
        v_h := ((v_bits >> 22) & 16383) + 1;
        perform content_private.check_image_dimensions(v_w, v_h);
        return;
      end if;
      v_offset := v_offset + 8 + v_length + (v_length % 2);
    end loop;
    raise exception 'invalid_image';
  else
    raise exception 'invalid_image';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Image value contract (dossier 14, Image Mapping)
-- ---------------------------------------------------------------------------

create or replace function content_private.assert_image(p_image jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_kind text;
  v_mime text;
  v_base64 text;
  v_bytes bytea;
  v_file_name text;
  v_alt text;
  v_url text;
  v_authority text;
begin
  if jsonb_typeof(p_image) is distinct from 'object' then
    raise exception 'invalid_image';
  end if;
  v_kind := p_image ->> 'kind';
  if v_kind = 'uploaded' then
    if content_private.json_keys(p_image)
      is distinct from array['alt', 'base64', 'fileName', 'kind', 'mime'] then
      raise exception 'invalid_image';
    end if;
    v_mime := p_image ->> 'mime';
    if v_mime is null or v_mime not in ('image/png', 'image/jpeg', 'image/webp') then
      raise exception 'invalid_image';
    end if;
    v_base64 := p_image ->> 'base64';
    if jsonb_typeof(p_image -> 'base64') is distinct from 'string'
      or char_length(v_base64) < 1 or char_length(v_base64) > 2097152 then
      raise exception 'invalid_image';
    end if;
    begin
      v_bytes := pg_catalog.decode(v_base64, 'base64');
    exception
      when others then
        raise exception 'invalid_image';
    end;
    -- Strict padded canonical standard base64: re-encode must match exactly,
    -- which also enforces zero trailing bits. (encode inserts newlines; strip
    -- them before comparing.)
    if replace(pg_catalog.encode(v_bytes, 'base64'), chr(10), '')
      is distinct from v_base64 then
      raise exception 'invalid_image';
    end if;
    if octet_length(v_bytes) < 1 or octet_length(v_bytes) > 1048576 then
      raise exception 'invalid_image';
    end if;
    perform content_private.inspect_image_container(v_bytes, v_mime);
    v_file_name := p_image ->> 'fileName';
    if jsonb_typeof(p_image -> 'fileName') is distinct from 'string'
      or char_length(v_file_name) not between 1 and 120
      or v_file_name ~ '[[:cntrl:]]'
      or position('/' in v_file_name) > 0
      or position('\' in v_file_name) > 0 then
      raise exception 'invalid_image';
    end if;
    v_alt := p_image ->> 'alt';
    if jsonb_typeof(p_image -> 'alt') is distinct from 'string'
      or char_length(v_alt) > 500 then
      raise exception 'invalid_image';
    end if;
  elsif v_kind = 'catalog' then
    if content_private.json_keys(p_image) is distinct from array['imageId', 'kind'] then
      raise exception 'invalid_image';
    end if;
    if jsonb_typeof(p_image -> 'imageId') is distinct from 'string'
      or p_image ->> 'imageId' not in (
        'hands-holding-plant', 'classroom-1', 'classroom-2', 'green-patch',
        'respiracao-1', 'respiracao-2') then
      raise exception 'invalid_image';
    end if;
  elsif v_kind = 'external' then
    if content_private.json_keys(p_image) is distinct from array['alt', 'kind', 'url'] then
      raise exception 'invalid_image';
    end if;
    v_url := p_image ->> 'url';
    if jsonb_typeof(p_image -> 'url') is distinct from 'string'
      or char_length(v_url) < 1 or char_length(v_url) > 2048
      or left(v_url, 8) is distinct from 'https://' then
      raise exception 'invalid_image';
    end if;
    v_authority := split_part(substring(v_url from 9), '/', 1);
    if v_authority = ''
      or position('@' in v_authority) > 0
      or position(':' in v_authority) > 0 then
      raise exception 'invalid_image';
    end if;
    v_alt := p_image ->> 'alt';
    if jsonb_typeof(p_image -> 'alt') is distinct from 'string'
      or char_length(v_alt) > 500 then
      raise exception 'invalid_image';
    end if;
  elsif v_kind = 'remove' then
    perform content_private.expect_object_keys(p_image, array['kind']);
  else
    raise exception 'invalid_image';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- JSON purity and payload structure
-- ---------------------------------------------------------------------------

create or replace function content_private.assert_unique_ids(p_array jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_element jsonb;
  v_id text;
begin
  if jsonb_typeof(p_array) is distinct from 'array' then
    return;
  end if;
  for v_element in select e from jsonb_array_elements(p_array) e
  loop
    continue when jsonb_typeof(v_element) is distinct from 'object';
    continue when not (v_element ? 'id');
    v_id := v_element ->> 'id';
    if v_id is null or char_length(v_id) < 1 or char_length(v_id) > 200 then
      raise exception 'invalid_operations';
    end if;
    if 1 <> (
      select count(*)
      from jsonb_array_elements(p_array) e2
      where jsonb_typeof(e2) = 'object' and e2 ->> 'id' = v_id
    ) then
      raise exception 'invalid_operations';
    end if;
  end loop;
end;
$$;

-- JSON purity: finite numbers, depth <= 150, no prototype keys anywhere,
-- unique nonempty ids (<= 200 code points) in arrays of id-bearing objects.
create or replace function content_private.assert_json_value(p_value jsonb, p_depth integer)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_key text;
  v_element jsonb;
begin
  if p_depth > 150 then
    raise exception 'invalid_operations';
  end if;
  case jsonb_typeof(p_value)
    when 'object' then
      for v_key, v_element in
        select k.key, k.value from jsonb_each(p_value) k
      loop
        if v_key in ('__proto__', 'constructor', 'prototype') then
          raise exception 'invalid_operations';
        end if;
        perform content_private.assert_json_value(v_element, p_depth + 1);
      end loop;
    when 'array' then
      perform content_private.assert_unique_ids(p_array := p_value);
      for v_element in select e from jsonb_array_elements(p_value) e
      loop
        perform content_private.assert_json_value(v_element, p_depth + 1);
      end loop;
    when 'number' then
      if (p_value #>> '{}') !~ '^-?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$' then
        raise exception 'invalid_operations';
      end if;
    else
      null;
  end case;
end;
$$;

-- Keyed nested identity: flow node map keys must equal the node ids.
create or replace function content_private.assert_flow_nodes_identity(p_nodes jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_key text;
  v_node jsonb;
begin
  if jsonb_typeof(p_nodes) is distinct from 'object' then
    return;
  end if;
  for v_key, v_node in
    select k.key, k.value from jsonb_each(p_nodes) k
  loop
    continue when jsonb_typeof(v_node) is distinct from 'object';
    continue when not (v_node ? 'id');
    if jsonb_typeof(v_node -> 'id') is distinct from 'string'
      or v_node #>> '{id}' is distinct from v_key
      or char_length(v_key) < 1
      or char_length(v_key) > 200 then
      raise exception 'invalid_operations';
    end if;
  end loop;
end;
$$;

-- Total payload structural check (dossier 15, Initialization And Mutation).
create or replace function content_private.assert_payload(p_payload jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_scope text;
  v_items jsonb;
  v_item jsonb;
begin
  if jsonb_typeof(p_payload) is distinct from 'object' then
    raise exception 'invalid_operations';
  end if;
  if content_private.json_keys(p_payload) is distinct from array[
    'contacts', 'defaultGroupOrder', 'educationGroups', 'educationMaterials',
    'flows', 'locations'] then
    raise exception 'invalid_operations';
  end if;
  perform content_private.check_safe_integer(p_payload -> 'defaultGroupOrder');
  foreach v_scope in array array[
    'flows', 'educationMaterials', 'educationGroups', 'contacts', 'locations']
  loop
    v_items := p_payload -> v_scope;
    if jsonb_typeof(v_items) is distinct from 'array' then
      raise exception 'invalid_operations';
    end if;
    for v_item in select e from jsonb_array_elements(v_items) e
    loop
      if jsonb_typeof(v_item) is distinct from 'object' then
        raise exception 'invalid_operations';
      end if;
      perform content_private.reject_extra_keys(
        v_item, content_private.allowed_keys(v_scope, 'storage'));
      perform content_private.check_id(v_item -> 'id');
      if v_scope = 'flows' then
        perform content_private.assert_flow_nodes_identity(v_item -> 'nodes');
      end if;
    end loop;
  end loop;
  perform content_private.assert_json_value(p_payload, 0);
  if pg_catalog.octet_length(pg_catalog.convert_to(p_payload::text, 'UTF8')) > 5242880 then
    raise exception 'payload_too_large';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Protected image slot rules during generic operations (dossier 14)
-- ---------------------------------------------------------------------------

create or replace function content_private.check_material_add_body(p_body jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_block jsonb;
begin
  if jsonb_typeof(p_body) is distinct from 'array' then
    return;
  end if;
  for v_block in select e from jsonb_array_elements(p_body) e
  loop
    continue when jsonb_typeof(v_block) is distinct from 'object';
    continue when v_block ->> 'kind' is distinct from 'image';
    if v_block ? 'imageUrl' or v_block ? 'imageFileName' or v_block ? 'alt' then
      raise exception 'invalid_operations';
    end if;
  end loop;
end;
$$;

create or replace function content_private.check_material_body_replacement(
  p_old_body jsonb,
  p_new_body jsonb
)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_block jsonb;
  v_old_block jsonb;
  v_key text;
begin
  if jsonb_typeof(p_new_body) is distinct from 'array' then
    return;
  end if;
  for v_block in select e from jsonb_array_elements(p_new_body) e
  loop
    continue when jsonb_typeof(v_block) is distinct from 'object';
    continue when v_block ->> 'kind' is distinct from 'image';
    continue when jsonb_typeof(v_block -> 'id') is distinct from 'string';
    select e into v_old_block
    from jsonb_array_elements(p_old_body) e
    where jsonb_typeof(e) = 'object'
      and e ->> 'kind' = 'image'
      and e ->> 'id' = v_block #>> '{id}';
    if v_old_block is not null then
      foreach v_key in array array['imageUrl', 'imageFileName', 'alt'] loop
        if (v_old_block ? v_key) <> (v_block ? v_key)
          or ((v_old_block ? v_key) and v_old_block -> v_key is distinct from v_block -> v_key) then
          raise exception 'invalid_operations';
        end if;
      end loop;
    elsif v_block ? 'imageUrl' or v_block ? 'imageFileName' or v_block ? 'alt' then
      raise exception 'invalid_operations';
    end if;
  end loop;
end;
$$;

create or replace function content_private.check_flow_add_nodes(p_nodes jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_node jsonb;
begin
  if jsonb_typeof(p_nodes) is distinct from 'object' then
    return;
  end if;
  for v_node in select e.value from jsonb_each(p_nodes) e
  loop
    if jsonb_typeof(v_node) = 'object' and v_node ? 'visuals' then
      raise exception 'invalid_operations';
    end if;
  end loop;
end;
$$;

create or replace function content_private.check_flow_nodes_patch(
  p_old_nodes jsonb,
  p_new_nodes jsonb
)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_key text;
  v_new_node jsonb;
  v_old_node jsonb;
begin
  if jsonb_typeof(p_new_nodes) is distinct from 'object'
    or jsonb_typeof(p_old_nodes) is distinct from 'object' then
    return;
  end if;
  for v_key, v_new_node in
    select k.key, k.value from jsonb_each(p_new_nodes) k
  loop
    v_old_node := p_old_nodes -> v_key;
    -- Missing and JSON null both coalesce to JSON null (mirrors the core
    -- `jsonEquals(oldVisuals ?? null, newVisuals ?? null)` comparison).
    if coalesce(v_old_node -> 'visuals', 'null'::jsonb)
      is distinct from coalesce(v_new_node -> 'visuals', 'null'::jsonb) then
      raise exception 'invalid_operations';
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Draft head projection
-- ---------------------------------------------------------------------------

create or replace function content_private.draft_head(p_draft public.content_drafts)
returns jsonb
language plpgsql
stable
set search_path = ''
set timezone = 'UTC'
as $$
begin
  return jsonb_build_object(
    'id', p_draft.id,
    'schemaVersion', p_draft.schema_version,
    'baseRevision', p_draft.base_revision,
    'generation', p_draft.generation,
    'digest', p_draft.digest,
    'updatedAt', content_private.iso8601(p_draft.updated_at),
    'lastActor', jsonb_build_object(
      'kind', p_draft.last_actor_kind,
      'principalUserId', p_draft.last_principal_user_id::text,
      'connectionId',
      case
        when p_draft.last_actor_kind = 'agent' then p_draft.last_actor_id::text
        else null
      end
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Operation application (pure: raises domain codes, never touches tables)
-- ---------------------------------------------------------------------------

create or replace function content_private.apply_operations(
  p_payload jsonb,
  p_operations jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_count integer;
  v_i integer;
  v_payload jsonb;
  v_op jsonb;
  v_op_name text;
  v_scope text;
  v_value jsonb;
  v_items jsonb;
  v_new_items jsonb;
  v_element jsonb;
  v_id text;
  v_patch jsonb;
  v_unset jsonb;
  v_target_index integer;
  v_unset_key text;
  v_target jsonb;
  v_slot_kind text;
  v_image jsonb;
  v_image_kind text;
  v_data_url text;
begin
  if jsonb_typeof(p_operations) is distinct from 'array' then
    raise exception 'invalid_operations';
  end if;
  v_count := jsonb_array_length(p_operations);
  if v_count < 1 or v_count > 200 then
    raise exception 'invalid_operations';
  end if;
  perform content_private.assert_payload(p_payload);
  v_payload := p_payload;

  for v_i in 0 .. v_count - 1 loop
    v_op := p_operations -> v_i;
    if jsonb_typeof(v_op) is distinct from 'object' then
      raise exception 'invalid_operations';
    end if;
    if jsonb_typeof(v_op -> 'op') is distinct from 'string' then
      raise exception 'invalid_operations';
    end if;
    v_op_name := v_op ->> 'op';

    case v_op_name
      when 'add' then
        perform content_private.expect_object_keys(v_op, array['op', 'scope', 'value']);
        perform content_private.check_id(v_op -> 'scope');
        if not content_private.is_scope(v_op -> 'scope') then
          raise exception 'invalid_operations';
        end if;
        v_scope := v_op ->> 'scope';
        v_value := v_op -> 'value';
        if jsonb_typeof(v_value) is distinct from 'object' then
          raise exception 'invalid_operations';
        end if;
        perform content_private.reject_extra_keys(
          v_value, content_private.allowed_keys(v_scope, 'add'));
        if not (v_value ? 'id') then
          raise exception 'invalid_operations';
        end if;
        perform content_private.check_id(v_value -> 'id');
        v_id := v_value ->> 'id';
        if v_scope = 'flows' then
          perform content_private.check_flow_add_nodes(v_value -> 'nodes');
        end if;
        if v_scope = 'educationMaterials' then
          perform content_private.check_material_add_body(v_value -> 'body');
        end if;
        v_items := v_payload -> v_scope;
        if exists (
          select 1 from jsonb_array_elements(v_items) e
          where jsonb_typeof(e) = 'object' and e ->> 'id' = v_id
        ) then
          raise exception 'invalid_operations';
        end if;
        v_payload := jsonb_set(
          v_payload, array[v_scope], v_items || jsonb_build_array(v_value));

      when 'update' then
        perform content_private.expect_object_keys(
          v_op, array['op', 'scope', 'id', 'patch', 'unset']);
        if not content_private.is_scope(v_op -> 'scope') then
          raise exception 'invalid_operations';
        end if;
        v_scope := v_op ->> 'scope';
        perform content_private.check_id(v_op -> 'id');
        v_id := v_op ->> 'id';
        v_patch := v_op -> 'patch';
        v_unset := v_op -> 'unset';
        if jsonb_typeof(v_patch) is distinct from 'object'
          or jsonb_typeof(v_unset) is distinct from 'array' then
          raise exception 'invalid_operations';
        end if;
        perform content_private.reject_extra_keys(
          v_patch, content_private.allowed_keys(v_scope, 'patch'));
        for v_unset_key in select k from jsonb_array_elements_text(v_unset) k
        loop
          if not (v_unset_key = any (content_private.allowed_keys(v_scope, 'unset'))) then
            raise exception 'invalid_operations';
          end if;
        end loop;
        if exists (
          select 1
          from jsonb_array_elements_text(v_unset) k
          join jsonb_object_keys(v_patch) pk on pk = k
        ) then
          raise exception 'invalid_operations';
        end if;
        if jsonb_array_length(v_unset)
          <> (select count(distinct k) from jsonb_array_elements_text(v_unset) k) then
          raise exception 'invalid_operations';
        end if;
        -- Empty update (empty patch plus empty unset) is invalid.
        if (select count(*) from jsonb_object_keys(v_patch)) = 0
          and jsonb_array_length(v_unset) = 0 then
          raise exception 'invalid_operations';
        end if;
        v_items := v_payload -> v_scope;
        select ord - 1, e into v_target_index, v_target
        from jsonb_array_elements(v_items) with ordinality t(e, ord)
        where jsonb_typeof(e) = 'object' and e ->> 'id' = v_id;
        if v_target is null then
          raise exception 'invalid_operations';
        end if;
        -- Protected image rules for generic updates.
        if v_scope = 'educationMaterials' and v_patch ? 'body' then
          perform content_private.check_material_body_replacement(
            v_target -> 'body', v_patch -> 'body');
        end if;
        if v_scope = 'flows' and v_patch ? 'nodes' then
          perform content_private.check_flow_nodes_patch(
            v_target -> 'nodes', v_patch -> 'nodes');
        end if;
        -- Shallow patch at item-field level, then distinct unsets.
        v_target := v_target || v_patch;
        for v_unset_key in select k from jsonb_array_elements_text(v_unset) k
        loop
          v_target := v_target - v_unset_key;
        end loop;
        v_new_items := '[]'::jsonb;
        for v_element, v_i in
          select e, ord - 1
          from jsonb_array_elements(v_items) with ordinality t(e, ord)
        loop
          if v_i = v_target_index then
            v_new_items := v_new_items || v_target;
          else
            v_new_items := v_new_items || v_element;
          end if;
        end loop;
        v_payload := jsonb_set(v_payload, array[v_scope], v_new_items);

      when 'delete' then
        perform content_private.expect_object_keys(v_op, array['op', 'scope', 'id', 'confirmation']);
        if not content_private.is_scope(v_op -> 'scope') then
          raise exception 'invalid_operations';
        end if;
        v_scope := v_op ->> 'scope';
        perform content_private.check_id(v_op -> 'id');
        v_id := v_op ->> 'id';
        if jsonb_typeof(v_op -> 'confirmation') is distinct from 'boolean'
          or (v_op -> 'confirmation') is distinct from 'true'::jsonb then
          raise exception 'invalid_operations';
        end if;
        v_items := v_payload -> v_scope;
        if not exists (
          select 1 from jsonb_array_elements(v_items) e
          where jsonb_typeof(e) = 'object' and e ->> 'id' = v_id
        ) then
          raise exception 'invalid_operations';
        end if;
        v_new_items := '[]'::jsonb;
        for v_element in select e from jsonb_array_elements(v_items) e
        loop
          if v_element ->> 'id' is distinct from v_id then
            v_new_items := v_new_items || v_element;
          end if;
        end loop;
        v_payload := jsonb_set(v_payload, array[v_scope], v_new_items);

      when 'reorder' then
        perform content_private.expect_object_keys(v_op, array['op', 'scope', 'ids']);
        if not content_private.is_scope(v_op -> 'scope') then
          raise exception 'invalid_operations';
        end if;
        v_scope := v_op ->> 'scope';
        if jsonb_typeof(v_op -> 'ids') is distinct from 'array' then
          raise exception 'invalid_operations';
        end if;
        for v_id in select k from jsonb_array_elements_text(v_op -> 'ids') k
        loop
          if v_id is null or char_length(v_id) < 1 or char_length(v_id) > 200 then
            raise exception 'invalid_operations';
          end if;
        end loop;
        v_items := v_payload -> v_scope;
        if jsonb_array_length(v_op -> 'ids') <> jsonb_array_length(v_items)
          or (select array_agg(k order by k) from jsonb_array_elements_text(v_op -> 'ids') k)
            is distinct from
             (select array_agg(e ->> 'id' order by e ->> 'id')
              from jsonb_array_elements(v_items) e) then
          raise exception 'invalid_operations';
        end if;
        v_new_items := '[]'::jsonb;
        for v_id in select k from jsonb_array_elements_text(v_op -> 'ids') k
        loop
          select e into v_element
          from jsonb_array_elements(v_items) e
          where jsonb_typeof(e) = 'object' and e ->> 'id' = v_id;
          v_new_items := v_new_items || v_element;
        end loop;
        v_payload := jsonb_set(v_payload, array[v_scope], v_new_items);

      when 'set_default_group_order' then
        perform content_private.expect_object_keys(v_op, array['op', 'value']);
        perform content_private.check_safe_integer(v_op -> 'value');
        v_payload := jsonb_set(v_payload, array['defaultGroupOrder'], v_op -> 'value');

      when 'set_material_image' then
        perform content_private.expect_object_keys(
          v_op, array['op', 'materialId', 'slot', 'image']);
        perform content_private.check_id(v_op -> 'materialId');
        v_id := v_op ->> 'materialId';
        if jsonb_typeof(v_op -> 'slot') is distinct from 'object'
          or jsonb_typeof(v_op -> 'slot' -> 'kind') is distinct from 'string' then
          raise exception 'invalid_operations';
        end if;
        v_slot_kind := v_op -> 'slot' ->> 'kind';
        if v_slot_kind not in ('featured', 'legacy', 'body') then
          raise exception 'invalid_operations';
        end if;
        if v_slot_kind = 'body' then
          if content_private.json_keys(v_op -> 'slot')
            is distinct from array['blockId', 'kind'] then
            raise exception 'invalid_operations';
          end if;
          perform content_private.check_id(v_op -> 'slot' -> 'blockId');
        else
          if content_private.json_keys(v_op -> 'slot')
            is distinct from array['kind'] then
            raise exception 'invalid_operations';
          end if;
        end if;
        v_image := v_op -> 'image';
        perform content_private.assert_image(v_image);
        v_image_kind := v_image ->> 'kind';
        v_items := v_payload -> 'educationMaterials';
        select ord - 1, e into v_target_index, v_target
        from jsonb_array_elements(v_items) with ordinality t(e, ord)
        where jsonb_typeof(e) = 'object' and e ->> 'id' = v_id;
        if v_target is null then
          raise exception 'invalid_operations';
        end if;
        if v_slot_kind = 'featured' then
          if v_image_kind = 'remove' then
            v_target := v_target - 'featuredImage';
          elsif v_image_kind = 'uploaded' then
            v_data_url := 'data:' || (v_image ->> 'mime') || ';base64,'
              || (v_image ->> 'base64');
            v_target := jsonb_set(
              v_target, array['featuredImage'],
              jsonb_build_object(
                'kind', 'uploaded',
                'dataUrl', v_data_url,
                'alt', v_image ->> 'alt',
                'fileName', v_image ->> 'fileName'));
          elsif v_image_kind = 'catalog' then
            v_target := jsonb_set(
              v_target, array['featuredImage'],
              jsonb_build_object('kind', 'catalog', 'imageId', v_image ->> 'imageId'));
          else
            v_target := jsonb_set(
              v_target, array['featuredImage'],
              jsonb_build_object(
                'kind', 'external', 'imageUrl', v_image ->> 'url',
                'alt', v_image ->> 'alt'));
          end if;
        elsif v_slot_kind = 'legacy' then
          if v_image_kind in ('uploaded', 'external')
            and (jsonb_typeof(v_image -> 'alt') is distinct from 'string'
              or (v_image ->> 'alt') is distinct from '') then
            raise exception 'invalid_image';
          end if;
          if v_image_kind = 'remove' then
            v_target := v_target - 'imageUrl' - 'imageFileName';
          elsif v_image_kind = 'uploaded' then
            v_data_url := 'data:' || (v_image ->> 'mime') || ';base64,'
              || (v_image ->> 'base64');
            v_target := jsonb_set(
              v_target, array['imageUrl'], to_jsonb(v_data_url));
            v_target := jsonb_set(
              v_target, array['imageFileName'], to_jsonb(v_image ->> 'fileName'));
          elsif v_image_kind = 'catalog' then
            raise exception 'invalid_image';
          else
            v_target := jsonb_set(
              v_target, array['imageUrl'], to_jsonb(v_image ->> 'url'));
            v_target := v_target - 'imageFileName';
          end if;
        else
          if jsonb_typeof(v_target -> 'body') is distinct from 'array' then
            raise exception 'invalid_image';
          end if;
          select e into v_element
          from jsonb_array_elements(v_target -> 'body') e
          where jsonb_typeof(e) = 'object'
            and e ->> 'id' = v_op #>> '{slot,blockId}';
          if v_element is null then
            raise exception 'invalid_image';
          end if;
          if v_element ->> 'kind' is distinct from 'image' then
            raise exception 'invalid_image';
          end if;
          if v_image_kind = 'remove' then
            v_element := v_element - 'imageUrl' - 'imageFileName' - 'alt';
          elsif v_image_kind = 'uploaded' then
            v_data_url := 'data:' || (v_image ->> 'mime') || ';base64,'
              || (v_image ->> 'base64');
            v_element := jsonb_set(
              v_element, array['imageUrl'], to_jsonb(v_data_url));
            v_element := jsonb_set(
              v_element, array['imageFileName'], to_jsonb(v_image ->> 'fileName'));
            v_element := jsonb_set(
              v_element, array['alt'], to_jsonb(v_image ->> 'alt'));
          elsif v_image_kind = 'catalog' then
            raise exception 'invalid_image';
          else
            v_element := jsonb_set(
              v_element, array['imageUrl'], to_jsonb(v_image ->> 'url'));
            v_element := jsonb_set(
              v_element, array['alt'], to_jsonb(v_image ->> 'alt'));
            v_element := v_element - 'imageFileName';
          end if;
          -- Replace the block inside the body array.
          declare
            v_body_new jsonb := '[]'::jsonb;
            v_body_element jsonb;
          begin
            for v_body_element in select e from jsonb_array_elements(v_target -> 'body') e
            loop
              if v_body_element ->> 'id' = v_op #>> '{slot,blockId}' then
                v_body_new := v_body_new || v_element;
              else
                v_body_new := v_body_new || v_body_element;
              end if;
            end loop;
            v_target := jsonb_set(v_target, array['body'], v_body_new);
          end;
        end if;
        -- Write the updated material back into the collection.
        v_new_items := '[]'::jsonb;
        for v_element, v_i in
          select e, ord - 1
          from jsonb_array_elements(v_items) with ordinality t(e, ord)
        loop
          if v_i = v_target_index then
            v_new_items := v_new_items || v_target;
          else
            v_new_items := v_new_items || v_element;
          end if;
        end loop;
        v_payload := jsonb_set(v_payload, array['educationMaterials'], v_new_items);

      else
        raise exception 'invalid_operations';
    end case;
  end loop;

  perform content_private.assert_payload(v_payload);
  return v_payload;
end;
$$;

-- ---------------------------------------------------------------------------
-- CAS mutation (dossier 15, Initialization And Mutation)
-- ---------------------------------------------------------------------------

create or replace function content_private.mutate_draft(
  p_expected_generation bigint,
  p_operations jsonb,
  p_actor_kind text,
  p_principal uuid,
  p_connection uuid
)
returns jsonb
language plpgsql
volatile
set search_path = ''
set timezone = 'UTC'
as $$
declare
  v_row public.content_drafts;
  v_candidate jsonb;
  v_head jsonb;
  v_err_code text;
begin
  if p_actor_kind is distinct from 'admin' and p_actor_kind is distinct from 'agent' then
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'invalid_input'));
  end if;
  if (p_actor_kind = 'agent') <> (p_connection is not null) then
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'invalid_input'));
  end if;
  if p_expected_generation is null or p_operations is null then
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'invalid_input'));
  end if;

  select * into v_row
  from public.content_drafts
  where id = 'current'
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'draft_unavailable'));
  end if;

  if v_row.generation <> p_expected_generation then
    v_head := content_private.draft_head(v_row);
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'stale_generation')
        || jsonb_build_object('currentHead', v_head));
  end if;

  -- All-or-nothing operation application: any domain failure inside the batch
  -- must leave zero content side effects.
  begin
    v_candidate := content_private.apply_operations(v_row.payload, p_operations);
  exception
    when raise_exception then
      get stacked diagnostics v_err_code = MESSAGE_TEXT;
      if v_err_code in ('invalid_operations', 'invalid_image', 'payload_too_large') then
        return jsonb_build_object('ok', false, 'error',
          jsonb_build_object('code', v_err_code));
      end if;
      raise;
  end;

  -- Accepted no-op does not advance generation and keeps the head metadata.
  if v_candidate is not distinct from v_row.payload then
    return jsonb_build_object('ok', true, 'data',
      jsonb_build_object(
        'head', content_private.draft_head(v_row),
        'changed', false));
  end if;

  if v_row.generation >= 9007199254740991 then
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'counter_exhausted'));
  end if;

  begin
    update public.content_drafts
    set
      payload = v_candidate,
      digest = content_private.payload_digest(v_candidate),
      generation = v_row.generation + 1,
      updated_at = now(),
      last_actor_kind = p_actor_kind,
      last_actor_id = coalesce(p_connection, p_principal),
      last_principal_user_id = p_principal
    where id = 'current';
  exception
    when check_violation then
      return jsonb_build_object('ok', false, 'error',
        jsonb_build_object('code', 'counter_exhausted'));
  end;

  select * into v_row from public.content_drafts where id = 'current';
  return jsonb_build_object('ok', true, 'data',
    jsonb_build_object(
      'head', content_private.draft_head(v_row),
      'changed', true));
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin RPC wrappers (authenticated only; authorization precedes any
-- data-bearing error or head return)
-- ---------------------------------------------------------------------------

create or replace function public.get_content_draft()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  v_principal uuid;
  v_row public.content_drafts;
  v_revision bigint;
  v_published_by uuid;
  v_payload jsonb;
  v_err_code text;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'unauthorized'));
  end if;
  v_principal := nullif(auth.user_id(), '')::uuid;
  if v_principal is null then
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'unauthorized'));
  end if;

  select * into v_row from public.content_drafts where id = 'current';
  if found then
    return jsonb_build_object('ok', true, 'data',
      jsonb_build_object(
        'id', v_row.id,
        'schemaVersion', v_row.schema_version,
        'baseRevision', v_row.base_revision,
        'generation', v_row.generation,
        'digest', v_row.digest,
        'updatedAt', content_private.iso8601(v_row.updated_at),
        'lastActor', (content_private.draft_head(v_row) -> 'lastActor'),
        'status', v_row.status,
        'payload', v_row.payload,
        'canonicalPayload', v_row.payload::text,
        'createdAt', content_private.iso8601(v_row.created_at),
        'createdBy', v_row.created_by::text));
  end if;

  -- Initialization: serialize through the fixed advisory lock, recheck, then
  -- copy the live published row. Never seed from a bundle or empty payload.
  perform pg_advisory_xact_lock(4318, 2);
  select * into v_row from public.content_drafts where id = 'current';
  if not found then
    select revision, payload, published_by into v_revision, v_payload, v_published_by
    from public.published_content
    where id = 'current'
    for share;
    if not found then
      return jsonb_build_object('ok', false, 'error',
        jsonb_build_object('code', 'published_base_unavailable'));
    end if;
    begin
      perform content_private.assert_payload(v_payload);
    exception
      when raise_exception then
        get stacked diagnostics v_err_code = MESSAGE_TEXT;
        if v_err_code in ('invalid_operations', 'payload_too_large', 'invalid_image') then
          return jsonb_build_object('ok', false, 'error',
            jsonb_build_object('code', v_err_code));
        end if;
        raise;
    end;
    insert into public.content_drafts (
      id, schema_version, base_revision, generation, payload, digest, status,
      created_by, last_actor_kind, last_actor_id, last_principal_user_id
    )
    values (
      'current', '1.0.0', v_revision, 1,
      v_payload,
      content_private.payload_digest(v_payload),
      'active', v_principal, 'admin', v_principal, v_principal
    );
    select * into v_row from public.content_drafts where id = 'current';
  end if;

  return jsonb_build_object('ok', true, 'data',
    jsonb_build_object(
      'id', v_row.id,
      'schemaVersion', v_row.schema_version,
      'baseRevision', v_row.base_revision,
      'generation', v_row.generation,
      'digest', v_row.digest,
      'updatedAt', content_private.iso8601(v_row.updated_at),
      'lastActor', (content_private.draft_head(v_row) -> 'lastActor'),
      'status', v_row.status,
      'payload', v_row.payload,
      'canonicalPayload', v_row.payload::text,
      'createdAt', content_private.iso8601(v_row.created_at),
      'createdBy', v_row.created_by::text));
end;
$$;

create or replace function public.get_content_draft_head()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  v_row public.content_drafts;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'unauthorized'));
  end if;
  if nullif(auth.user_id(), '')::uuid is null then
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'unauthorized'));
  end if;

  select * into v_row from public.content_drafts where id = 'current';
  if not found then
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'draft_unavailable'));
  end if;
  return jsonb_build_object('ok', true, 'data', content_private.draft_head(v_row));
end;
$$;

create or replace function public.apply_content_draft_operations(
  p_expected_generation bigint,
  p_operations jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  v_principal uuid;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'unauthorized'));
  end if;
  v_principal := nullif(auth.user_id(), '')::uuid;
  if v_principal is null then
    return jsonb_build_object('ok', false, 'error',
      jsonb_build_object('code', 'unauthorized'));
  end if;

  return content_private.mutate_draft(
    p_expected_generation, p_operations, 'admin', v_principal, null);
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges: helpers stay private; admin wrappers are authenticated-only
-- ---------------------------------------------------------------------------

revoke all on function content_private.payload_digest(jsonb) from public, anonymous, authenticated;
revoke all on function content_private.iso8601(timestamptz) from public, anonymous, authenticated;
revoke all on function content_private.json_keys(jsonb) from public, anonymous, authenticated;
revoke all on function content_private.expect_object_keys(jsonb, text[]) from public, anonymous, authenticated;
revoke all on function content_private.reject_extra_keys(jsonb, text[]) from public, anonymous, authenticated;
revoke all on function content_private.allowed_keys(text, text) from public, anonymous, authenticated;
revoke all on function content_private.is_scope(jsonb) from public, anonymous, authenticated;
revoke all on function content_private.check_id(jsonb) from public, anonymous, authenticated;
revoke all on function content_private.check_safe_integer(jsonb) from public, anonymous, authenticated;
revoke all on function content_private.read_u32be(bytea, integer) from public, anonymous, authenticated;
revoke all on function content_private.read_u32le(bytea, integer) from public, anonymous, authenticated;
revoke all on function content_private.read_u16be(bytea, integer) from public, anonymous, authenticated;
revoke all on function content_private.check_image_dimensions(bigint, bigint) from public, anonymous, authenticated;
revoke all on function content_private.inspect_image_container(bytea, text) from public, anonymous, authenticated;
revoke all on function content_private.assert_image(jsonb) from public, anonymous, authenticated;
revoke all on function content_private.assert_unique_ids(jsonb) from public, anonymous, authenticated;
revoke all on function content_private.assert_json_value(jsonb, integer) from public, anonymous, authenticated;
revoke all on function content_private.assert_flow_nodes_identity(jsonb) from public, anonymous, authenticated;
revoke all on function content_private.assert_payload(jsonb) from public, anonymous, authenticated;
revoke all on function content_private.check_material_add_body(jsonb) from public, anonymous, authenticated;
revoke all on function content_private.check_material_body_replacement(jsonb, jsonb) from public, anonymous, authenticated;
revoke all on function content_private.check_flow_add_nodes(jsonb) from public, anonymous, authenticated;
revoke all on function content_private.check_flow_nodes_patch(jsonb, jsonb) from public, anonymous, authenticated;
revoke all on function content_private.draft_head(public.content_drafts) from public, anonymous, authenticated;
revoke all on function content_private.apply_operations(jsonb, jsonb) from public, anonymous, authenticated;
revoke all on function content_private.mutate_draft(bigint, jsonb, text, uuid, uuid) from public, anonymous, authenticated;
revoke all on function public.get_content_draft() from public, anonymous, authenticated;
revoke all on function public.get_content_draft_head() from public, anonymous, authenticated;
revoke all on function public.apply_content_draft_operations(bigint, jsonb) from public, anonymous, authenticated;

grant execute on function public.get_content_draft() to authenticated;
grant execute on function public.get_content_draft_head() to authenticated;
grant execute on function public.apply_content_draft_operations(bigint, jsonb) to authenticated;

comment on function content_private.payload_digest(jsonb) is
  'Persistence digest: lowercase SHA-256 of UTF-8 payload::text.';
comment on function content_private.apply_operations(jsonb, jsonb) is
  'Pure structural operation application with literal revision-8 allowlists and protected image rules.';
comment on function content_private.mutate_draft(bigint, jsonb, text, uuid, uuid) is
  'Generation CAS mutation: lock, compare, all-or-nothing batch apply, bounded/no-op aware.';
comment on function public.get_content_draft() is
  'Admin draft load with safe initialization from the live published row.';
comment on function public.get_content_draft_head() is
  'Admin draft head without payload and without initialization.';
comment on function public.apply_content_draft_operations(bigint, jsonb) is
  'Admin CAS mutation applying an all-or-nothing editorial operation batch.';
