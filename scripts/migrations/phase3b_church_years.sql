-- ==============================================================================
-- PHASE 3B: AUTHORITATIVE CHURCH YEARS & CLASS INSTANCES STRUCTURAL MIGRATION
-- Run in Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- ==============================================================================

BEGIN;

-- 1. Preflight Safety Gate: Check state-machine
DO $$
DECLARE
  v_has_church_years BOOLEAN := false;
  v_has_instances BOOLEAN := false;
  v_has_memberships BOOLEAN := false;
  v_has_assignments BOOLEAN := false;
  v_year_exists BOOLEAN := false;
  v_instance_count INT := 0;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'church_years') INTO v_has_church_years;
  SELECT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'class_instances') INTO v_has_instances;
  SELECT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'class_memberships') INTO v_has_memberships;
  SELECT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'servant_class_assignments') INTO v_has_assignments;

  IF v_has_church_years AND v_has_instances AND v_has_memberships AND v_has_assignments THEN
    SELECT EXISTS (SELECT 1 FROM public.church_years WHERE id = '2026-2027' AND is_active = true) INTO v_year_exists;
    SELECT count(*) INTO v_instance_count FROM public.class_instances WHERE church_year_id = '2026-2027';

    IF v_year_exists AND v_instance_count = 6 THEN
      RAISE EXCEPTION 'Migration Aborted: Phase 3B church year (2026-2027) is already completely applied.';
    END IF;

    IF v_year_exists OR v_instance_count > 0 THEN
      RAISE EXCEPTION 'Migration Aborted: Inconsistent partial state detected. Manual audit required.';
    END IF;
  ELSIF v_has_church_years OR v_has_instances OR v_has_memberships OR v_has_assignments THEN
    RAISE EXCEPTION 'Migration Aborted: Partial table setup detected. Manual audit required.';
  END IF;
END;
$$;

-- 2. Create Normalized Tables & Constraints
CREATE TABLE public.church_years (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.timezone('utc'::text, pg_catalog.now()),
  activated_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_church_years_single_active 
ON public.church_years (is_active) 
WHERE is_active = true;

CREATE TABLE public.class_instances (
  id TEXT PRIMARY KEY,
  church_year_id TEXT NOT NULL REFERENCES public.church_years(id) ON DELETE RESTRICT,
  class_group_id TEXT NOT NULL CHECK (class_group_id IN ('angels', 'primary_1', 'primary_2', 'preparatory', 'secondary', 'university')),
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  join_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.timezone('utc'::text, pg_catalog.now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.timezone('utc'::text, pg_catalog.now()),
  CONSTRAINT uq_year_class_group UNIQUE (church_year_id, class_group_id),
  CONSTRAINT uq_class_instance_join_code UNIQUE (join_code),
  CONSTRAINT uq_class_instances_id_year UNIQUE (id, church_year_id)
);

CREATE OR REPLACE VIEW public.class_instances_directory
WITH (security_invoker = true)
AS
SELECT 
  id, 
  church_year_id, 
  class_group_id, 
  name_en, 
  name_ar, 
  created_at, 
  updated_at
FROM public.class_instances;

CREATE TABLE public.class_memberships (
  id TEXT PRIMARY KEY,
  church_year_id TEXT NOT NULL REFERENCES public.church_years(id) ON DELETE RESTRICT,
  class_instance_id TEXT NOT NULL,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  exact_grade TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'transferred', 'graduated')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.timezone('utc'::text, pg_catalog.now()),
  left_at TIMESTAMPTZ,
  removal_reason TEXT,
  enrolled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT uq_student_church_year UNIQUE (church_year_id, student_id),
  CONSTRAINT fk_membership_instance_and_year 
    FOREIGN KEY (class_instance_id, church_year_id) 
    REFERENCES public.class_instances (id, church_year_id) 
    ON DELETE RESTRICT
);

CREATE TABLE public.servant_class_assignments (
  id TEXT PRIMARY KEY,
  church_year_id TEXT NOT NULL REFERENCES public.church_years(id) ON DELETE RESTRICT,
  class_instance_id TEXT NOT NULL,
  servant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.timezone('utc'::text, pg_catalog.now()),
  is_active BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT uq_servant_class_year UNIQUE (church_year_id, class_instance_id, servant_id),
  CONSTRAINT fk_servant_instance_and_year 
    FOREIGN KEY (class_instance_id, church_year_id) 
    REFERENCES public.class_instances (id, church_year_id) 
    ON DELETE RESTRICT
);

-- 3. Indexes
CREATE INDEX idx_class_memberships_student ON public.class_memberships(student_id, church_year_id);
CREATE INDEX idx_class_memberships_instance ON public.class_memberships(class_instance_id, status);
CREATE INDEX idx_servant_assignments_servant ON public.servant_class_assignments(servant_id, church_year_id, is_active);

-- 4. Row Level Security Setup
ALTER TABLE public.church_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servant_class_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "church_years_select" ON public.church_years FOR SELECT TO authenticated USING (true);

CREATE POLICY "class_instances_authorized_select" ON public.class_instances
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.servant_class_assignments sca
    JOIN public.church_years cy ON cy.id = sca.church_year_id
    WHERE sca.servant_id = auth.uid()
      AND sca.class_instance_id = public.class_instances.id
      AND sca.is_active = true
      AND cy.is_active = true
  )
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

GRANT SELECT ON public.class_instances_directory TO authenticated;

CREATE POLICY "servant_assignments_select" ON public.servant_class_assignments
FOR SELECT TO authenticated
USING (
  servant_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "servant_assignments_admin_manage" ON public.servant_class_assignments
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = servant_id AND role IN ('teacher', 'admin'))
);

CREATE POLICY "memberships_select" ON public.class_memberships
FOR SELECT TO authenticated
USING (
  student_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.servant_class_assignments sca
    JOIN public.church_years cy ON cy.id = sca.church_year_id
    WHERE sca.servant_id = auth.uid()
      AND sca.class_instance_id = public.class_memberships.class_instance_id
      AND sca.is_active = true
      AND cy.is_active = true
  )
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 5. Seed 2026-2027 Active Church Year & 6 Verified Class Instances
INSERT INTO public.church_years (id, name, start_date, end_date, is_active, activated_at)
VALUES ('2026-2027', '2026 / 2027', '2026-09-01', '2027-08-31', true, pg_catalog.timezone('utc'::text, pg_catalog.now()));

INSERT INTO public.class_instances (id, church_year_id, class_group_id, name_en, name_ar, join_code)
VALUES
  ('inst_2026-2027_angels', '2026-2027', 'angels', 'Angels', 'فصل الملايكة', 'MUSA-ANG1'),
  ('inst_2026-2027_primary_1', '2026-2027', 'primary_1', 'Primary 1–3', 'فصل ابتدائي 1–3', 'MUSA-7K4P'),
  ('inst_2026-2027_primary_2', '2026-2027', 'primary_2', 'Primary 4–6', 'فصل ابتدائي 4–6', 'MUSA-P46B'),
  ('inst_2026-2027_preparatory', '2026-2027', 'preparatory', 'Preparatory', 'فصل إعدادي', 'MUSA-PRP1'),
  ('inst_2026-2027_secondary', '2026-2027', 'secondary', 'Secondary', 'فصل ثانوي', 'MUSA-SEC1'),
  ('inst_2026-2027_university', '2026-2027', 'university', 'University & Youth', 'فصل شباب جامعة', 'MUSA-UNI1');

-- 6. Functions (Hardened search_path = '')
CREATE OR REPLACE FUNCTION public.generate_class_join_code() 
RETURNS TEXT 
LANGUAGE plpgsql 
VOLATILE 
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  chars TEXT := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  result TEXT := 'MUSA-';
  v_uuid TEXT;
  val INT;
  i INT;
BEGIN
  v_uuid := pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', '');
  FOR i IN 1..4 LOOP
    val := ('x' || pg_catalog.substr(v_uuid, (i - 1) * 2 + 1, 2))::bit(8)::int;
    result := result || pg_catalog.substr(chars, (val % pg_catalog.length(chars)) + 1, 1);
  END LOOP;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.activate_new_church_year(
  p_year_id TEXT,
  p_name TEXT,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_existing_active_id TEXT;
  v_groups TEXT[] := ARRAY['angels', 'primary_1', 'primary_2', 'preparatory', 'secondary', 'university'];
  v_names_en TEXT[] := ARRAY['Angels', 'Primary 1–3', 'Primary 4–6', 'Preparatory', 'Secondary', 'University & Youth'];
  v_names_ar TEXT[] := ARRAY['فصل الملايكة', 'فصل ابتدائي 1–3', 'فصل ابتدائي 4–6', 'فصل إعدادي', 'فصل ثانوي', 'فصل شباب جامعة'];
  v_group_id TEXT;
  v_inst_id TEXT;
  v_code TEXT;
  v_created_instances INT := 0;
  i INT;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated: Sign-in required.';
  END IF;

  SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;
  IF v_caller_role IS NULL OR v_caller_role <> 'admin' THEN
    RAISE EXCEPTION 'Unauthorized: Only an administrator can start a new church year.';
  END IF;

  LOCK TABLE public.church_years IN EXCLUSIVE MODE;

  IF EXISTS (SELECT 1 FROM public.church_years WHERE id = p_year_id) THEN
    RAISE EXCEPTION 'Conflict: Church year % already exists.', p_year_id;
  END IF;

  SELECT id INTO v_existing_active_id FROM public.church_years WHERE is_active = true;
  IF v_existing_active_id IS NOT NULL THEN
    UPDATE public.church_years 
    SET is_active = false, archived_at = pg_catalog.timezone('utc'::text, pg_catalog.now())
    WHERE id = v_existing_active_id;
  END IF;

  INSERT INTO public.church_years (id, name, start_date, end_date, is_active, activated_at)
  VALUES (p_year_id, p_name, p_start_date, p_end_date, true, pg_catalog.timezone('utc'::text, pg_catalog.now()));

  FOR i IN 1..6 LOOP
    v_group_id := v_groups[i];
    v_inst_id := 'inst_' || p_year_id || '_' || v_group_id;
    
    LOOP
      v_code := public.generate_class_join_code();
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.class_instances WHERE join_code = v_code);
    END LOOP;

    INSERT INTO public.class_instances (
      id, church_year_id, class_group_id, name_en, name_ar, join_code
    ) VALUES (
      v_inst_id, p_year_id, v_group_id, v_names_en[i], v_names_ar[i], v_code
    );
    v_created_instances := v_created_instances + 1;
  END LOOP;

  IF v_created_instances <> 6 THEN
    RAISE EXCEPTION 'Activation Failed: Expected exactly 6 class instances, created %.', v_created_instances;
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'activatedYear', p_year_id,
    'previousYearArchived', v_existing_active_id,
    'classInstancesCreated', v_created_instances
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.join_class_by_code(p_join_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_student_id UUID;
  v_student_role TEXT;
  v_student_grade TEXT;
  v_active_year_id TEXT;
  v_instance_id TEXT;
  v_class_group_id TEXT;
  v_compatible BOOLEAN := false;
  v_existing_id TEXT;
  v_existing_status TEXT;
  v_mem_id TEXT;
BEGIN
  v_student_id := auth.uid();
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated: Sign-in required.';
  END IF;

  SELECT role, grade INTO v_student_role, v_student_grade 
  FROM public.profiles WHERE id = v_student_id;

  IF v_student_role IS NULL OR v_student_role <> 'student' THEN
    RAISE EXCEPTION 'Forbidden: Only students can join a class via code.';
  END IF;

  SELECT id INTO v_active_year_id FROM public.church_years WHERE is_active = true;
  IF v_active_year_id IS NULL THEN
    RAISE EXCEPTION 'No active church year configured.';
  END IF;

  SELECT id, class_group_id INTO v_instance_id, v_class_group_id
  FROM public.class_instances 
  WHERE join_code = pg_catalog.upper(pg_catalog.trim(p_join_code)) 
    AND church_year_id = v_active_year_id;

  IF v_instance_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired class join code for the active church year.';
  END IF;

  IF (v_class_group_id = 'angels' AND v_student_grade IN ('KG1', 'KG2')) OR
     (v_class_group_id = 'primary_1' AND v_student_grade IN ('Grade 1', 'Grade 2', 'Grade 3')) OR
     (v_class_group_id = 'primary_2' AND v_student_grade IN ('Grade 4', 'Grade 5', 'Grade 6')) OR
     (v_class_group_id = 'preparatory' AND v_student_grade IN ('Prep 1', 'Prep 2', 'Prep 3')) OR
     (v_class_group_id = 'secondary' AND v_student_grade IN ('Secondary 1', 'Secondary 2', 'Secondary 3')) OR
     (v_class_group_id = 'university' AND v_student_grade IN ('University', 'Youth')) THEN
    v_compatible := true;
  END IF;

  IF NOT v_compatible THEN
    RAISE EXCEPTION 'Grade Incompatibility: Student grade % cannot join class group %.', v_student_grade, v_class_group_id;
  END IF;

  SELECT id, status INTO v_existing_id, v_existing_status
  FROM public.class_memberships
  WHERE church_year_id = v_active_year_id AND student_id = v_student_id;

  IF v_existing_id IS NOT NULL THEN
    IF v_existing_status = 'active' THEN
      RAISE EXCEPTION 'Student is already actively enrolled in this church year.';
    ELSE
      UPDATE public.class_memberships
      SET status = 'active',
          class_instance_id = v_instance_id,
          exact_grade = v_student_grade,
          joined_at = pg_catalog.timezone('utc'::text, pg_catalog.now()),
          left_at = NULL,
          removal_reason = NULL,
          enrolled_by = v_student_id
      WHERE id = v_existing_id;

      RETURN pg_catalog.jsonb_build_object(
        'success', true, 
        'action', 'reactivated', 
        'membershipId', v_existing_id, 
        'classInstanceId', v_instance_id
      );
    END IF;
  ELSE
    v_mem_id := 'mem_' || pg_catalog.substr(v_student_id::text, 1, 8) || '_' || v_active_year_id;
    INSERT INTO public.class_memberships (
      id, church_year_id, class_instance_id, student_id, exact_grade, status, enrolled_by
    ) VALUES (
      v_mem_id, v_active_year_id, v_instance_id, v_student_id, v_student_grade, 'active', v_student_id
    );

    RETURN pg_catalog.jsonb_build_object(
      'success', true, 
      'action', 'enrolled', 
      'membershipId', v_mem_id, 
      'classInstanceId', v_instance_id
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.enroll_student_in_class(
  p_student_id UUID, 
  p_class_instance_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_active_year_id TEXT;
  v_inst_year_id TEXT;
  v_class_group_id TEXT;
  v_student_role TEXT;
  v_student_grade TEXT;
  v_is_authorized BOOLEAN := false;
  v_compatible BOOLEAN := false;
  v_existing_id TEXT;
  v_existing_status TEXT;
  v_mem_id TEXT;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated: Sign-in required.';
  END IF;

  SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;
  IF v_caller_role NOT IN ('teacher', 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only servants or administrators can manually enroll students.';
  END IF;

  SELECT id INTO v_active_year_id FROM public.church_years WHERE is_active = true;
  IF v_active_year_id IS NULL THEN
    RAISE EXCEPTION 'No active church year configured.';
  END IF;

  SELECT church_year_id, class_group_id INTO v_inst_year_id, v_class_group_id
  FROM public.class_instances WHERE id = p_class_instance_id;

  IF v_inst_year_id IS NULL OR v_inst_year_id <> v_active_year_id THEN
    RAISE EXCEPTION 'Invalid class instance: must belong to the active church year %.', v_active_year_id;
  END IF;

  IF v_caller_role = 'admin' THEN
    v_is_authorized := true;
  ELSIF v_caller_role = 'teacher' AND EXISTS (
    SELECT 1 FROM public.servant_class_assignments
    WHERE servant_id = v_caller_id 
      AND class_instance_id = p_class_instance_id 
      AND is_active = true
      AND church_year_id = v_active_year_id
  ) THEN
    v_is_authorized := true;
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Unauthorized: Servant is not assigned to this class instance in the active church year.';
  END IF;

  SELECT role, grade INTO v_student_role, v_student_grade FROM public.profiles WHERE id = p_student_id;
  IF v_student_role IS NULL OR v_student_role <> 'student' THEN
    RAISE EXCEPTION 'Target user does not exist or does not hold the student role.';
  END IF;

  IF (v_class_group_id = 'angels' AND v_student_grade IN ('KG1', 'KG2')) OR
     (v_class_group_id = 'primary_1' AND v_student_grade IN ('Grade 1', 'Grade 2', 'Grade 3')) OR
     (v_class_group_id = 'primary_2' AND v_student_grade IN ('Grade 4', 'Grade 5', 'Grade 6')) OR
     (v_class_group_id = 'preparatory' AND v_student_grade IN ('Prep 1', 'Prep 2', 'Prep 3')) OR
     (v_class_group_id = 'secondary' AND v_student_grade IN ('Secondary 1', 'Secondary 2', 'Secondary 3')) OR
     (v_class_group_id = 'university' AND v_student_grade IN ('University', 'Youth')) THEN
    v_compatible := true;
  END IF;

  IF NOT v_compatible THEN
    RAISE EXCEPTION 'Grade Incompatibility: Student grade % is not compatible with class group %.', v_student_grade, v_class_group_id;
  END IF;

  SELECT id, status INTO v_existing_id, v_existing_status
  FROM public.class_memberships
  WHERE church_year_id = v_active_year_id AND student_id = p_student_id;

  IF v_existing_id IS NOT NULL THEN
    IF v_existing_status = 'active' THEN
      RAISE EXCEPTION 'Student already has an active class membership in this church year.';
    ELSE
      UPDATE public.class_memberships
      SET status = 'active',
          class_instance_id = p_class_instance_id,
          exact_grade = v_student_grade,
          joined_at = pg_catalog.timezone('utc'::text, pg_catalog.now()),
          left_at = NULL,
          removal_reason = NULL,
          enrolled_by = v_caller_id
      WHERE id = v_existing_id;

      RETURN pg_catalog.jsonb_build_object(
        'success', true, 
        'action', 'reactivated', 
        'membershipId', v_existing_id, 
        'classInstanceId', p_class_instance_id
      );
    END IF;
  ELSE
    v_mem_id := 'mem_' || pg_catalog.substr(p_student_id::text, 1, 8) || '_' || v_active_year_id;
    INSERT INTO public.class_memberships (
      id, church_year_id, class_instance_id, student_id, exact_grade, status, enrolled_by
    ) VALUES (
      v_mem_id, v_active_year_id, p_class_instance_id, p_student_id, v_student_grade, 'active', v_caller_id
    );

    RETURN pg_catalog.jsonb_build_object(
      'success', true, 
      'action', 'enrolled', 
      'membershipId', v_mem_id, 
      'classInstanceId', p_class_instance_id
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_student_from_class(
  p_membership_id TEXT, 
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_active_year_id TEXT;
  v_mem_year_id TEXT;
  v_mem_instance_id TEXT;
  v_mem_status TEXT;
  v_is_authorized BOOLEAN := false;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated: Sign-in required.';
  END IF;

  SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('teacher', 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only an assigned servant or administrator can remove a student.';
  END IF;

  SELECT id INTO v_active_year_id FROM public.church_years WHERE is_active = true;
  IF v_active_year_id IS NULL THEN
    RAISE EXCEPTION 'No active church year configured.';
  END IF;

  SELECT church_year_id, class_instance_id, status 
  INTO v_mem_year_id, v_mem_instance_id, v_mem_status
  FROM public.class_memberships 
  WHERE id = p_membership_id;

  IF v_mem_instance_id IS NULL THEN
    RAISE EXCEPTION 'Membership not found.';
  END IF;

  IF v_mem_year_id <> v_active_year_id THEN
    RAISE EXCEPTION 'Invalid Operation: Historical or archived memberships cannot be modified.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.class_instances 
    WHERE id = v_mem_instance_id AND church_year_id = v_active_year_id
  ) THEN
    RAISE EXCEPTION 'Data Integrity Violation: Target class instance does not belong to the active church year.';
  END IF;

  IF v_caller_role = 'admin' THEN
    v_is_authorized := true;
  ELSIF v_caller_role = 'teacher' THEN
    IF EXISTS (
      SELECT 1 FROM public.servant_class_assignments
      WHERE servant_id = v_caller_id 
        AND class_instance_id = v_mem_instance_id 
        AND church_year_id = v_active_year_id 
        AND is_active = true
    ) THEN
      v_is_authorized := true;
    END IF;
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Unauthorized: Servant is not assigned to this class instance in the active church year.';
  END IF;

  IF v_mem_status = 'inactive' THEN
    RAISE EXCEPTION 'Student membership is already inactive.';
  END IF;

  UPDATE public.class_memberships
  SET status = 'inactive',
      left_at = pg_catalog.timezone('utc'::text, pg_catalog.now()),
      removal_reason = pg_catalog.trim(p_reason)
  WHERE id = p_membership_id;

  RETURN pg_catalog.jsonb_build_object(
    'success', true, 
    'membershipId', p_membership_id, 
    'status', 'inactive',
    'leftAt', pg_catalog.timezone('utc'::text, pg_catalog.now())
  );
END;
$$;

-- Function Execution Grants & Revokes
REVOKE ALL ON FUNCTION public.generate_class_join_code() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.activate_new_church_year(TEXT, TEXT, DATE, DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.join_class_by_code(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enroll_student_in_class(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_student_from_class(TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.activate_new_church_year(TEXT, TEXT, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_class_by_code(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enroll_student_in_class(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_student_from_class(TEXT, TEXT) TO authenticated;

COMMIT;
