-- Clients need to see which units are allocated and to whom in the building engine,
-- but direct SELECT on reservations/profiles is restricted by RLS. This RPC runs
-- with definer rights and returns only fields needed for the inventory UI.

CREATE OR REPLACE FUNCTION public.building_unit_allocations(p_building_id uuid)
RETURNS TABLE (
    unit_id uuid,
    user_id uuid,
    reservation_status text,
    display_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT DISTINCT ON (r.unit_id)
        r.unit_id,
        r.user_id,
        r.status::text AS reservation_status,
        CASE
            WHEN NULLIF(trim(COALESCE(p.full_name, '')), '') IS NOT NULL
                AND NULLIF(trim(COALESCE(p.company, '')), '') IS NOT NULL
                THEN trim(COALESCE(p.full_name, '')) || ' · ' || trim(COALESCE(p.company, ''))
            WHEN NULLIF(trim(COALESCE(p.full_name, '')), '') IS NOT NULL
                THEN trim(COALESCE(p.full_name, ''))
            WHEN NULLIF(trim(COALESCE(p.company, '')), '') IS NOT NULL
                THEN trim(COALESCE(p.company, ''))
            ELSE 'Client'
        END AS display_name
    FROM public.reservations r
    INNER JOIN public.units u
        ON u.id = r.unit_id
        AND u.building_id = p_building_id
        AND u.deleted_at IS NULL
    LEFT JOIN public.profiles p ON p.id = r.user_id
    WHERE r.status IN ('approved', 'soft_lock')
    ORDER BY
        r.unit_id,
        (CASE WHEN r.status = 'approved' THEN 2 ELSE 1 END) DESC,
        r.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.building_unit_allocations(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.building_unit_allocations(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.building_unit_allocations(uuid) TO authenticated;

COMMENT ON FUNCTION public.building_unit_allocations(uuid) IS
    'Active unit allocations (approved/soft_lock) for a building, for engine UI; bypasses reservations/profiles RLS.';
