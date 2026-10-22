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
-- Username saves ONLY into the new [LoginName] column (legacy POS
-- [LogName] and [PSW] columns are left empty '').
-- Password saves into the [Password] column as a scrypt hash.
-- ============================================================

IF COL_LENGTH('dbo.Tbl_UserDetails', 'LoginName') IS NULL
BEGIN
    ALTER TABLE dbo.Tbl_UserDetails ADD LoginName VARCHAR(50) NULL;
END
GO

DECLARE @loginName varchar(50)  = 'admin';
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
         '',              -- legacy POS "LogName" column left empty
         '',              -- legacy POS "PSW" column left empty
         @loginName,      -- new "LoginName" column
         @hash,           -- scrypt$<salt>$<hash> in "Password" column
         'ADMIN',
         'Administrator',
         '', '', '', '', '',
         '0771096131',    -- ← ContNo: forgot-password OTP SMS yanawa. CHANGE THIS.
         '',
         '1980-01-01', GETDATE(), '1900-01-01',
         'SYSTEM', NULL, 1, '');

    PRINT 'Admin user created. LoginName: ' + @loginName;
END
ELSE
BEGIN
    PRINT 'LoginName "' + @loginName + '" already exists — nothing inserted.';
    PRINT 'To reset its password from SQL, run the UPDATE below with a fresh hash:';
    PRINT '  UPDATE dbo.Tbl_UserDetails SET Password = ''scrypt$...'' WHERE LTRIM(RTRIM(LoginName)) = ''admin'';';
END
GO
