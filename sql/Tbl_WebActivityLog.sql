-- Web activity log: who did what inside the web app (permissions, users,
-- master data, reports, security denials, sessions). Created automatically
-- by the app (lib/activityLog.ts); this script is the manual equivalent.
-- Retention: the app deletes rows older than 3 months automatically.
IF OBJECT_ID(N'dbo.Tbl_WebActivityLog',N'U') IS NULL
CREATE TABLE dbo.Tbl_WebActivityLog(
 Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
 ActivityAt DATETIME2(0) NOT NULL,
 UserId NVARCHAR(50) NOT NULL CONSTRAINT DF_WebActivity_UserId DEFAULT(''),
 LoginName NVARCHAR(100) NOT NULL CONSTRAINT DF_WebActivity_LoginName DEFAULT(''),
 UserName NVARCHAR(200) NOT NULL CONSTRAINT DF_WebActivity_UserName DEFAULT(''),
 LocationCode NVARCHAR(20) NOT NULL CONSTRAINT DF_WebActivity_Loc DEFAULT(''),
 Category NVARCHAR(30) NOT NULL CONSTRAINT DF_WebActivity_Category DEFAULT(''),
 Action NVARCHAR(50) NOT NULL CONSTRAINT DF_WebActivity_Action DEFAULT(''),
 TargetType NVARCHAR(50) NOT NULL CONSTRAINT DF_WebActivity_TargetType DEFAULT(''),
 TargetId NVARCHAR(100) NOT NULL CONSTRAINT DF_WebActivity_TargetId DEFAULT(''),
 TargetName NVARCHAR(200) NOT NULL CONSTRAINT DF_WebActivity_TargetName DEFAULT(''),
 Details NVARCHAR(1000) NOT NULL CONSTRAINT DF_WebActivity_Details DEFAULT(''),
 BeforeValue NVARCHAR(1000) NOT NULL CONSTRAINT DF_WebActivity_Before DEFAULT(''),
 AfterValue NVARCHAR(1000) NOT NULL CONSTRAINT DF_WebActivity_After DEFAULT(''),
 IpAddress NVARCHAR(45) NOT NULL CONSTRAINT DF_WebActivity_Ip DEFAULT(''),
 SessionRef NVARCHAR(64) NOT NULL CONSTRAINT DF_WebActivity_SessionRef DEFAULT('')
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_WebActivity_At' AND object_id=OBJECT_ID(N'dbo.Tbl_WebActivityLog'))
 CREATE INDEX IX_WebActivity_At ON dbo.Tbl_WebActivityLog(ActivityAt DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_WebActivity_User' AND object_id=OBJECT_ID(N'dbo.Tbl_WebActivityLog'))
 CREATE INDEX IX_WebActivity_User ON dbo.Tbl_WebActivityLog(LoginName,ActivityAt DESC);
