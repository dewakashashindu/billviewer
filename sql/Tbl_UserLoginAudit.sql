-- Login audit table: no NULLs (defaults everywhere), unused GPS columns removed.
-- Safe to run repeatedly: creates when missing, drops unused columns,
-- backfills NULLs, then enforces NOT NULL.
IF OBJECT_ID(N'dbo.Tbl_UserLoginAudit',N'U') IS NULL
CREATE TABLE dbo.Tbl_UserLoginAudit(
 Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
 LoginAt DATETIME2(0) NOT NULL,
 UserId NVARCHAR(50) NOT NULL CONSTRAINT DF_LoginAudit_UserId DEFAULT(''),
 LoginName NVARCHAR(100) NOT NULL,
 UserName NVARCHAR(200) NOT NULL CONSTRAINT DF_LoginAudit_UserName DEFAULT(''),
 Success BIT NOT NULL,
 FailReason NVARCHAR(200) NOT NULL CONSTRAINT DF_LoginAudit_FailReason DEFAULT(''),
 IpAddress NVARCHAR(45) NOT NULL CONSTRAINT DF_LoginAudit_Ip DEFAULT(''),
 ForwardedFor NVARCHAR(500) NOT NULL CONSTRAINT DF_LoginAudit_Fwd DEFAULT(''),
 GeoCountry NVARCHAR(100) NOT NULL CONSTRAINT DF_LoginAudit_GeoCountry DEFAULT(''),
 GeoRegion NVARCHAR(100) NOT NULL CONSTRAINT DF_LoginAudit_GeoRegion DEFAULT(''),
 GeoCity NVARCHAR(100) NOT NULL CONSTRAINT DF_LoginAudit_GeoCity DEFAULT(''),
 GeoLatitude DECIMAL(9,6) NOT NULL CONSTRAINT DF_LoginAudit_GeoLat DEFAULT(0),
 GeoLongitude DECIMAL(9,6) NOT NULL CONSTRAINT DF_LoginAudit_GeoLon DEFAULT(0),
 GeoTimezone NVARCHAR(100) NOT NULL CONSTRAINT DF_LoginAudit_GeoTz DEFAULT(''),
 Isp NVARCHAR(200) NOT NULL CONSTRAINT DF_LoginAudit_Isp DEFAULT(''),
 ConnectionType NVARCHAR(50) NOT NULL CONSTRAINT DF_LoginAudit_ConnType DEFAULT(''),
 IsVpnOrProxy BIT NOT NULL CONSTRAINT DF_LoginAudit_Vpn DEFAULT(0),
 DeviceType NVARCHAR(30) NOT NULL CONSTRAINT DF_LoginAudit_DeviceType DEFAULT(''),
 DeviceModel NVARCHAR(150) NOT NULL CONSTRAINT DF_LoginAudit_DeviceModel DEFAULT(''),
 Browser NVARCHAR(80) NOT NULL CONSTRAINT DF_LoginAudit_Browser DEFAULT(''),
 BrowserVersion NVARCHAR(40) NOT NULL CONSTRAINT DF_LoginAudit_BrowserVer DEFAULT(''),
 OsName NVARCHAR(80) NOT NULL CONSTRAINT DF_LoginAudit_OsName DEFAULT(''),
 OsVersion NVARCHAR(40) NOT NULL CONSTRAINT DF_LoginAudit_OsVer DEFAULT(''),
 AcceptLanguage NVARCHAR(100) NOT NULL CONSTRAINT DF_LoginAudit_Lang DEFAULT(''),
 ClientHints NVARCHAR(500) NOT NULL CONSTRAINT DF_LoginAudit_Hints DEFAULT(''),
 UserAgent NVARCHAR(1000) NOT NULL CONSTRAINT DF_LoginAudit_Ua DEFAULT(''),
 DeviceKey NVARCHAR(200) NOT NULL CONSTRAINT DF_LoginAudit_DeviceKey DEFAULT(''),
 LocationCode NVARCHAR(20) NOT NULL CONSTRAINT DF_LoginAudit_Loc DEFAULT(''),
 SessionRef NVARCHAR(64) NOT NULL CONSTRAINT DF_LoginAudit_SessionRef DEFAULT(''),
 IsNewDevice BIT NOT NULL CONSTRAINT DF_LoginAudit_NewDevice DEFAULT(0),
 IsNewLocation BIT NOT NULL CONSTRAINT DF_LoginAudit_NewLocation DEFAULT(0),
 GeoSource NVARCHAR(50) NOT NULL CONSTRAINT DF_LoginAudit_GeoSource DEFAULT('')
);
IF COL_LENGTH('dbo.Tbl_UserLoginAudit','PreciseLatitude') IS NOT NULL ALTER TABLE dbo.Tbl_UserLoginAudit DROP COLUMN PreciseLatitude;
IF COL_LENGTH('dbo.Tbl_UserLoginAudit','PreciseLongitude') IS NOT NULL ALTER TABLE dbo.Tbl_UserLoginAudit DROP COLUMN PreciseLongitude;
IF COL_LENGTH('dbo.Tbl_UserLoginAudit','PreciseAccuracyM') IS NOT NULL ALTER TABLE dbo.Tbl_UserLoginAudit DROP COLUMN PreciseAccuracyM;
IF COL_LENGTH('dbo.Tbl_UserLoginAudit','PreciseLabel') IS NOT NULL ALTER TABLE dbo.Tbl_UserLoginAudit DROP COLUMN PreciseLabel;
IF COL_LENGTH('dbo.Tbl_UserLoginAudit','LocationSource') IS NOT NULL ALTER TABLE dbo.Tbl_UserLoginAudit DROP COLUMN LocationSource;
IF COL_LENGTH('dbo.Tbl_UserLoginAudit','GeoSource') IS NULL ALTER TABLE dbo.Tbl_UserLoginAudit ADD GeoSource NVARCHAR(50) NOT NULL CONSTRAINT DF_LoginAudit_GeoSource DEFAULT('');
UPDATE dbo.Tbl_UserLoginAudit SET UserId=ISNULL(UserId,''),UserName=ISNULL(UserName,''),FailReason=ISNULL(FailReason,''),IpAddress=ISNULL(IpAddress,''),ForwardedFor=ISNULL(ForwardedFor,''),GeoCountry=ISNULL(GeoCountry,''),GeoRegion=ISNULL(GeoRegion,''),GeoCity=ISNULL(GeoCity,''),GeoLatitude=ISNULL(GeoLatitude,0),GeoLongitude=ISNULL(GeoLongitude,0),GeoTimezone=ISNULL(GeoTimezone,''),Isp=ISNULL(Isp,''),ConnectionType=ISNULL(ConnectionType,''),IsVpnOrProxy=ISNULL(IsVpnOrProxy,0),DeviceType=ISNULL(DeviceType,''),DeviceModel=ISNULL(DeviceModel,''),Browser=ISNULL(Browser,''),BrowserVersion=ISNULL(BrowserVersion,''),OsName=ISNULL(OsName,''),OsVersion=ISNULL(OsVersion,''),AcceptLanguage=ISNULL(AcceptLanguage,''),ClientHints=ISNULL(ClientHints,''),UserAgent=ISNULL(UserAgent,''),DeviceKey=ISNULL(DeviceKey,''),LocationCode=ISNULL(LocationCode,''),SessionRef=ISNULL(SessionRef,''),GeoSource=ISNULL(GeoSource,'');
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN UserId NVARCHAR(50) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN UserName NVARCHAR(200) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN FailReason NVARCHAR(200) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN IpAddress NVARCHAR(45) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN ForwardedFor NVARCHAR(500) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN GeoCountry NVARCHAR(100) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN GeoRegion NVARCHAR(100) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN GeoCity NVARCHAR(100) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN GeoLatitude DECIMAL(9,6) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN GeoLongitude DECIMAL(9,6) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN GeoTimezone NVARCHAR(100) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN Isp NVARCHAR(200) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN ConnectionType NVARCHAR(50) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN IsVpnOrProxy BIT NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN DeviceType NVARCHAR(30) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN DeviceModel NVARCHAR(150) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN Browser NVARCHAR(80) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN BrowserVersion NVARCHAR(40) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN OsName NVARCHAR(80) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN OsVersion NVARCHAR(40) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN AcceptLanguage NVARCHAR(100) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN ClientHints NVARCHAR(500) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN UserAgent NVARCHAR(1000) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN DeviceKey NVARCHAR(200) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN LocationCode NVARCHAR(20) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN SessionRef NVARCHAR(64) NOT NULL;
ALTER TABLE dbo.Tbl_UserLoginAudit ALTER COLUMN GeoSource NVARCHAR(50) NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_LoginAudit_LoginAt' AND object_id=OBJECT_ID(N'dbo.Tbl_UserLoginAudit'))
 CREATE INDEX IX_LoginAudit_LoginAt ON dbo.Tbl_UserLoginAudit(LoginAt DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_LoginAudit_LoginName' AND object_id=OBJECT_ID(N'dbo.Tbl_UserLoginAudit'))
 CREATE INDEX IX_LoginAudit_LoginName ON dbo.Tbl_UserLoginAudit(LoginName,LoginAt DESC);
