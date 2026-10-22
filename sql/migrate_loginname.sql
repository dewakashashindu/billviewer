-- ============================================================
-- MicroEChef Bill Viewer — LoginName Column Migration Script
-- Database: POS MSSQL (SmarterASP.NET)
-- Table:    dbo.Tbl_UserDetails
--
-- මොකද්ද මේ Script එකෙන් වෙන්නේ:
--   1. dbo.Tbl_UserDetails table එකේ 'LoginName' column එක නැත්නම්
--      අලුතෙන් VARCHAR(50) විදිහට add කරනවා.
--   2. 'Password' column එක කිසිම වෙනසක් නොකර එහෙම්මම තියනවා
--      (table එකේ Password column එක නැතිම නම් විතරක් add කරනවා).
--   3. දැනට web login සඳහා සාදා ඇති Admin / User accounts වල
--      LoginName හිස් නම් පමණක්, පරණ LogName එකෙන් LoginName පුරවනවා
--      (පරණ POS staff rows වෙනස් කරන්නේ නැහැ).
-- ============================================================

-- 1) Add LoginName column if it does not exist yet
IF COL_LENGTH('dbo.Tbl_UserDetails', 'LoginName') IS NULL
BEGIN
    ALTER TABLE dbo.Tbl_UserDetails
    ADD LoginName VARCHAR(50) NULL;

    PRINT 'Added column [LoginName] to dbo.Tbl_UserDetails.';
END
ELSE
BEGIN
    PRINT 'Column [LoginName] already exists in dbo.Tbl_UserDetails.';
END
GO

-- 2) Ensure Password column exists (if already present, untouched)
IF COL_LENGTH('dbo.Tbl_UserDetails', 'Password') IS NULL
BEGIN
    ALTER TABLE dbo.Tbl_UserDetails
    ADD [Password] VARCHAR(400) NULL;

    PRINT 'Added column [Password] to dbo.Tbl_UserDetails.';
END
ELSE
BEGIN
    PRINT 'Column [Password] already exists (kept unchanged).';
END
GO

-- 3) Copy existing web/admin usernames from LogName -> LoginName
--    ONLY for accounts that already have a web Password set and
--    currently have an empty LoginName.
UPDATE dbo.Tbl_UserDetails
SET LoginName = LEFT(LTRIM(RTRIM(LogName)), 50)
WHERE (LoginName IS NULL OR LTRIM(RTRIM(LoginName)) = '')
  AND [Password] LIKE 'scrypt$%$%'
  AND LogName IS NOT NULL
  AND LTRIM(RTRIM(LogName)) <> '';
GO

-- 4) Verify current web-enabled users (LoginName + GroupId + Enable)
SELECT
    LTRIM(RTRIM(UserId))    AS UserId,
    LTRIM(RTRIM(LoginName)) AS LoginName,
    LTRIM(RTRIM(UserName))  AS UserName,
    LTRIM(RTRIM(GroupId))   AS GroupId,
    Enable
FROM dbo.Tbl_UserDetails WITH (NOLOCK)
WHERE NULLIF(LTRIM(RTRIM(LoginName)), '') IS NOT NULL
ORDER BY GroupId, LoginName;
GO
