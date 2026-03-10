 -- ============================================================================
-- SERVICE CENTER MANAGEMENT - COMPLETE DATABASE SETUP SCRIPT
-- Database: PostgreSQL
-- Generated: 2026-03-09
-- ============================================================================
-- 
-- INSTRUCTIONS:
-- 1. Install PostgreSQL on the new PC
-- 2. Create the database:    CREATE DATABASE service_center_db;
-- 3. Run Django migrations:  python manage.py migrate
-- 4. Then run THIS script:   psql -U postgres -d service_center_db -f db_setup_script.sql
--    OR copy-paste sections into pgAdmin / psql as needed.
--
-- NOTE: Django migrations create all the tables automatically.
--       This script provides the SEED DATA and STORED PROCEDURES
--       that are needed AFTER running migrations.
-- ============================================================================


-- ============================================================================
-- STEP 1: DATABASE CREATION (run from psql as superuser)
-- ============================================================================
-- CREATE DATABASE service_center_db;
-- \c service_center_db


-- ============================================================================
-- STEP 2: STORED PROCEDURE - Job Status Transition
-- (Referenced by jobs/models.py JobCard.transition_status)
-- ============================================================================

CREATE OR REPLACE PROCEDURE transition_job_status(
    p_job_id UUID,
    p_new_status VARCHAR(20),
    p_user_id UUID,
    p_notes TEXT DEFAULT '',
    p_is_override BOOLEAN DEFAULT FALSE
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_current_status VARCHAR(20);
    v_user_role VARCHAR(20);
BEGIN
    -- Get current status with row lock
    SELECT status INTO v_current_status
    FROM jobs_jobcard
    WHERE id = p_job_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Job not found: %', p_job_id;
    END IF;

    -- Check terminal status
    IF v_current_status IN ('DELIVERED', 'CANCELLED', 'REJECTED') AND NOT p_is_override THEN
        RAISE EXCEPTION 'Job is in terminal status: %', v_current_status;
    END IF;

    -- Check override permissions
    IF p_is_override THEN
        SELECT role INTO v_user_role
        FROM core_user
        WHERE id = p_user_id;

        IF v_user_role NOT IN ('OWNER', 'MANAGER', 'SUPER_ADMIN') THEN
            RAISE EXCEPTION 'Only OWNER or MANAGER can override status transitions';
        END IF;
    END IF;

    -- Update job status
    UPDATE jobs_jobcard
    SET status = p_new_status,
        updated_at = NOW()
    WHERE id = p_job_id;

    -- Set completion timestamps based on status
    IF p_new_status = 'READY_FOR_DELIVERY' THEN
        UPDATE jobs_jobcard
        SET actual_completion_date = NOW()
        WHERE id = p_job_id AND actual_completion_date IS NULL;
    ELSIF p_new_status = 'DELIVERED' THEN
        UPDATE jobs_jobcard
        SET delivery_date = NOW()
        WHERE id = p_job_id AND delivery_date IS NULL;
    ELSIF p_new_status = 'APPROVED' THEN
        UPDATE jobs_jobcard
        SET customer_approval_date = NOW()
        WHERE id = p_job_id AND customer_approval_date IS NULL;
    END IF;

    -- Insert status history record
    INSERT INTO jobs_jobstatushistory (
        id, job_id, from_status, to_status, changed_by_id, notes, is_override, created_at, updated_at
    ) VALUES (
        gen_random_uuid(), p_job_id, v_current_status, p_new_status, p_user_id, p_notes, p_is_override, NOW(), NOW()
    );
END;
$$;


-- ============================================================================
-- STEP 3: SEED DATA - Role Permissions
-- (Defines the RBAC permission matrix for all roles)
-- ============================================================================

INSERT INTO core_rolepermission (
    id, role, 
    can_view_dashboard, can_view_job_cards, can_create_job_cards, can_edit_job_cards,
    can_view_inventory, can_manage_inventory, can_view_billing, can_create_invoices,
    can_view_reports, can_manage_branches, can_manage_users, can_view_pickups, updated_at
) VALUES

-- SUPER_ADMIN: Full access to everything
(1, 'SUPER_ADMIN',
    TRUE, TRUE, TRUE, TRUE,
    TRUE, TRUE, TRUE, TRUE,
    TRUE, TRUE, TRUE, TRUE, NOW()),

-- OWNER: Full access within their organization
(2, 'OWNER',
    TRUE, TRUE, TRUE, TRUE,
    TRUE, TRUE, TRUE, TRUE,
    TRUE, TRUE, TRUE, TRUE, NOW()),

-- MANAGER: Full access to assigned branches
(3, 'MANAGER',
    TRUE, TRUE, TRUE, TRUE,
    TRUE, TRUE, TRUE, TRUE,
    TRUE, FALSE, TRUE, TRUE, NOW()),

-- RECEPTIONIST: Create jobs, manage customers
(4, 'RECEPTIONIST',
    TRUE, TRUE, TRUE, TRUE,
    TRUE, FALSE, TRUE, TRUE,
    FALSE, FALSE, FALSE, TRUE, NOW()),

-- TECHNICIAN: View assigned jobs, add diagnosis
(5, 'TECHNICIAN',
    TRUE, TRUE, FALSE, TRUE,
    TRUE, FALSE, FALSE, FALSE,
    FALSE, FALSE, FALSE, FALSE, NOW()),

-- ACCOUNTANT: Billing, payments, reports
(6, 'ACCOUNTANT',
    TRUE, TRUE, FALSE, FALSE,
    TRUE, FALSE, TRUE, TRUE,
    TRUE, FALSE, FALSE, FALSE, NOW())

ON CONFLICT (role) DO UPDATE SET
    can_view_dashboard = EXCLUDED.can_view_dashboard,
    can_view_job_cards = EXCLUDED.can_view_job_cards,
    can_create_job_cards = EXCLUDED.can_create_job_cards,
    can_edit_job_cards = EXCLUDED.can_edit_job_cards,
    can_view_inventory = EXCLUDED.can_view_inventory,
    can_manage_inventory = EXCLUDED.can_manage_inventory,
    can_view_billing = EXCLUDED.can_view_billing,
    can_create_invoices = EXCLUDED.can_create_invoices,
    can_view_reports = EXCLUDED.can_view_reports,
    can_manage_branches = EXCLUDED.can_manage_branches,
    can_manage_users = EXCLUDED.can_manage_users,
    can_view_pickups = EXCLUDED.can_view_pickups,
    updated_at = NOW();


-- ============================================================================
-- STEP 4: SEED DATA - Inventory Categories (Global / No Branch)
-- These are the default categories displayed as icon cards in inventory.
-- NOTE: You should also run:  python manage.py seed_categories
--       to seed categories for each individual branch.
-- ============================================================================

-- For "universal" (branch=NULL) categories used as defaults:
INSERT INTO inventory_inventorycategory (id, branch_id, name, description, created_at, updated_at)
VALUES
    (gen_random_uuid(), NULL, 'RAM',         'DDR4 / DDR5 memory modules — 4GB, 8GB, 16GB, 32GB', NOW(), NOW()),
    (gen_random_uuid(), NULL, 'SSD',         'Solid State Drives — SATA & NVMe — 128GB to 2TB', NOW(), NOW()),
    (gen_random_uuid(), NULL, 'HDD',         'Hard Disk Drives — 500GB, 1TB, 2TB', NOW(), NOW()),
    (gen_random_uuid(), NULL, 'Screen',      'Laptop/Desktop display panels — 13.3", 14", 15.6", 17.3"', NOW(), NOW()),
    (gen_random_uuid(), NULL, 'Battery',     'Laptop batteries — by brand and model', NOW(), NOW()),
    (gen_random_uuid(), NULL, 'Keyboard',    'Internal & external keyboards — by brand and model', NOW(), NOW()),
    (gen_random_uuid(), NULL, 'Charger',     'Power adapters — 45W, 65W, 90W, Type-C', NOW(), NOW()),
    (gen_random_uuid(), NULL, 'Motherboard', 'Laptop / Desktop motherboards — by brand and model', NOW(), NOW()),
    (gen_random_uuid(), NULL, 'Fan',         'CPU & GPU cooling fans', NOW(), NOW()),
    (gen_random_uuid(), NULL, 'Trackpad',    'Trackpad / Touchpad modules — by brand and model', NOW(), NOW()),
    (gen_random_uuid(), NULL, 'Speaker',     'Internal speaker modules', NOW(), NOW()),
    (gen_random_uuid(), NULL, 'Camera',      'Webcam / camera modules', NOW(), NOW()),
    (gen_random_uuid(), NULL, 'Other',       'Miscellaneous parts & accessories', NOW(), NOW())
ON CONFLICT ON CONSTRAINT unique_branch_category_name DO NOTHING;


-- ============================================================================
-- STEP 5: CREATE SUPERUSER (via Django management command)
-- ============================================================================
-- Run this in terminal AFTER migrations:
--
--   python manage.py createsuperuser --email admin@example.com
--
-- This creates the SUPER_ADMIN user who can then create organizations,
-- branches, and other users from the application.


-- ============================================================================
-- QUICK SETUP CHECKLIST (run these commands in order on the new PC):
-- ============================================================================
--
-- 1. Install PostgreSQL 14+ and create database:
--      CREATE DATABASE service_center_db;
--
-- 2. Update Backend/.env with correct database credentials:
--      DATABASE_URL=postgres://postgres:YOUR_PASSWORD@localhost:5432/service_center_db
--
-- 3. Install Python dependencies:
--      cd Backend
--      pip install -r requirements.txt
--
-- 4. Run Django migrations (creates all tables):
--      python manage.py migrate
--
-- 5. Run this SQL script (seed data + stored procedure):FFF
--      psql -U postgres -d service_center_db -f db_setup_script.sql
--
-- 6. Seed inventory categories for all branches:
--      python manage.py seed_categories
--
-- 7. Create the superuser:
--      python manage.py createsuperuser
--
-- 8. Start the server:
--      python manage.py runserver
--
-- ============================================================================
