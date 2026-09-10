-- ============================================================
-- MicroEChef Bill Viewer — FIRST ADMIN USER (run once)
-- Database: POS MSSQL (smarterasp.net)
--
-- Creates login  : admin
-- with password  : Admin@123
--
-- The password is stored as a SCRYPT HASH in the Password column
-- (never plain text). Sign in and change it any time from
-- Settings > Reset Password.
-- ============================================================

IF NOT EXISTS (
    SELECT 1 FROM dbo.Tbl_UserDetails
    WHERE LTRIM(RTRIM(LoginName)) = 'admin'
)
BEGIN
    INSERT INTO dbo.Tbl_UserDetails
        (UserId, NIC, LogName, PSW, LoginName, Password, GroupId,
         UserName, Rmks, Add1, Add2, Add3, Add4, ContNo, Email,
         DOB, DOJ, DOL, CreateUser, Picture, Enable, LOCCODE)
    VALUES
        ('UADMIN',
         'N/A',
         'admin',
         '',              -- legacy POS "PSW" column left empty
         'admin',
         'scrypt$93eb20288574fa286e5acf6c49b954c0$c395a893d8c2ffcf1872994719094935952f0f1cbb9a1265a1fdbbdeeebdedc2a4b901eddcdef3169d4d92dc2a63f880857ac9f36ff5e2f5f829d7f27ea149e0',
         'ADMIN',
         'Administrator',
         '', '', '', '', '', '0771096131', '',
         '1980-01-01', GETDATE(), '1900-01-01',
         'SYSTEM', NULL, 1, '');
END
GO
