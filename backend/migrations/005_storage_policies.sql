-- ==============================================================================
-- Migration: 005_storage_policies.sql
-- Description: Provisioning private Supabase Storage bucket 'restaurant-uploads'
--              with path-based tenant isolation policies.
-- ==============================================================================

-- 1. Create the private bucket if it does not already exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'restaurant-uploads',
    'restaurant-uploads',
    false, -- STRICTLY PRIVATE: objects cannot be accessed via direct public URL
    52428800, -- 50 MB file size limit
    ARRAY[
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 52428800;

-- 2. Storage RLS Policies
-- Expected object path convention:
-- restaurant-uploads / {restaurant_id} / {upload_id} / {filename}

DROP POLICY IF EXISTS "Tenant members can view their restaurant uploads" ON storage.objects;
CREATE POLICY "Tenant members can view their restaurant uploads"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'restaurant-uploads' AND
        public.user_has_restaurant_role(
            ((storage.foldername(name))[1])::uuid,
            'analyst'
        )
    );

DROP POLICY IF EXISTS "Tenant admins can upload files" ON storage.objects;
CREATE POLICY "Tenant admins can upload files"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'restaurant-uploads' AND
        public.user_has_restaurant_role(
            ((storage.foldername(name))[1])::uuid,
            'admin'
        )
    );

DROP POLICY IF EXISTS "Tenant admins can delete their uploads" ON storage.objects;
CREATE POLICY "Tenant admins can delete their uploads"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'restaurant-uploads' AND
        public.user_has_restaurant_role(
            ((storage.foldername(name))[1])::uuid,
            'admin'
        )
    );
