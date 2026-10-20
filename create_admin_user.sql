-- ============================================================
-- MicroEChef Bill Viewer — FIRST ADMIN USER (run once)
-- Database: POS MSSQL (smarterasp.net)
--
-- ⚠️ STEP 1 — generate YOUR OWN password hash first:
--
--      node scripts/hash-password.mjs "YourStrongPassword"
--      → scrypt$<salt>$<hash>
--
--    STEP 2 — paste that string into @hash below, then run this.
--
-- The password is stored as a SCRYPT HASH in the Password column
-- (never plain text). Sign in and change it any time from
-- Settings > Reset Password.
--
-- 🔒 WHY NO READY-MADE HASH HERE?
-- An earlier version of this file shipped a pre-computed hash for
-- "Admin@123". Because the repo is public, that pair was effectively
-- published — anyone who found the deployment could sign in to the
-- back office (36 reports, settings, table-QR, user management).
-- The hash is now generated per-install, so no two deployments share
-- a known password. If you already ran the old script, change the
-- admin password NOW.
-- ============================================================

DECLARE @loginName varchar(50) = 'admin';
DECLARE @hash      varchar(400) = 'PASTE_YOUR_SCRYPT_HASH_HERE';

IF @hash = 'PASTE_YOUR_SCRYPT_HASH_HERE' OR @hash NOT LIKE 'scrypt$%$%'
BEGIN
    RAISERROR(
      'Generate a password hash first:  node scripts/hash-password.mjs "YourStrongPassword"  — then paste it into @hash.',
      16, 1);
    RETURN;
END

IF NOT EXISTS (
    SELECT 1 FROM dbo.Tbl_UserDetails
    WHERE LTRIM(RTRIM(LoginName)) = @loginName
)
BEGIN
    INSERT INTO dbo.Tbl_UserDetails
        (UserId, NIC, LogName, PSW, LoginName, Password, GroupId,
         UserName, Rmks, Add1, Add2, Add3, Add4, ContNo, Email,
         DOB, DOJ, DOL, CreateUser, Picture, Enable, LOCCODE)
    VALUES
        ('UADMIN',
         'N/A',
         @loginName,
         '',              -- legacy POS "PSW" column left empty
         @loginName,
         @hash,           -- scrypt$<salt>$<hash>  (your own password)
         'ADMIN',
         'Administrator',
         '', '', '', '', '',
         '0771096131',    -- ← ContNo: forgot-password OTP SMS yanawa. CHANGE THIS.
         '',
         '1980-01-01', GETDATE(), '1900-01-01',
         'SYSTEM', NULL, 1, '');

    PRINT 'Admin user created. Login name: ' + @loginName;
END
ELSE
BEGIN
    PRINT 'Login "' + @loginName + '" already exists — nothing inserted.';
    PRINT 'To reset its password from SQL, run the UPDATE below with a fresh hash:';
    PRINT '  UPDATE dbo.Tbl_UserDetails SET Password = ''scrypt$...'' WHERE LTRIM(RTRIM(LoginName)) = ''admin'';';
END
GO
