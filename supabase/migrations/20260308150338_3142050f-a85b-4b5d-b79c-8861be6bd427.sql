
-- Clean up the orphaned college admin that was created without college_admins record
DELETE FROM hierarchy_admins WHERE role = 'college_super_admin' AND username = 'A.M.J.C';
DELETE FROM colleges WHERE id = '0b95e851-634a-4adc-b134-6cc1cf16c892';

-- Also clean up the auth user
DELETE FROM auth.users WHERE id = 'edf5033c-3d9c-43ee-b2ab-9f10c6bbca89';
