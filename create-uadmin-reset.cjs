#!/usr/bin/env node
'use strict';
// Generates a SQL Server script; this program never connects to a database.
// Run locally in a trusted interactive terminal, using Node.js 18 or newer.
const crypto = require('node:crypto');
const fs = require('node:fs');
const readline = require('node:readline');
const {Writable} = require('node:stream');
const path = require('node:path');
if (!process.stdin.isTTY || !process.stdout.isTTY) { console.error('Run this script in an interactive terminal.'); process.exit(1); }
let muted = false;
const terminalOutput = new Writable({write(chunk, encoding, done) { if (!muted) process.stdout.write(chunk, encoding); done(); }});
const rl = readline.createInterface({input: process.stdin, output: terminalOutput, terminal: true});
const ask = (q, secret=false) => new Promise(resolve => { if(secret){process.stdout.write(q);muted=true;rl.question('', v=>{muted=false;process.stdout.write('\n');resolve(v);});}else rl.question(q,resolve); });
async function main(){
  console.log('Generate a web-credential reset SQL script for existing UserId UADMIN. No database connection is made.');
  console.log('This replaces ONLY LoginNameWeb and PasswordWeb. It does not delete the user or change POS credentials.');
  const login=(await ask('New web login name (ASCII letters, numbers, . _ @ -): ')).trim();
  if (!/^[A-Za-z0-9._@-]{1,50}$/.test(login)) throw Error('Invalid web login name (1–50 ASCII characters).');
  const password=await ask('New web password (hidden, at least 12 characters): ',true);
  const confirm=await ask('Repeat password (hidden): ',true);
  if (password!==confirm) throw Error('Passwords do not match. No SQL file was created.');
  if (password.length<12 || password.length>256 || /[\r\n\0]/.test(password)) throw Error('Password must be 12–256 characters without newline or NUL.');
  const salt=crypto.randomBytes(16), hash=crypto.scryptSync(password,salt,64);
  const stored=`scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
  const output=path.resolve('uadmin-reset.sql');
  const script=`-- UADMIN WEB credentials reset. Review target database and take a backup first.
-- This contains a salted password hash. Handle as sensitive; delete after use.
-- POS credentials, permissions, location access and UserId are not changed.
SET NOCOUNT ON;
SET XACT_ABORT ON;
DECLARE @userId varchar(10) = 'UADMIN';
DECLARE @login varchar(50) = '${login}';
DECLARE @passwordHash varchar(255) = '${stored}';
DECLARE @count int;
BEGIN TRY
  BEGIN TRANSACTION;
  IF OBJECT_ID(N'dbo.Tbl_UserDetails', N'U') IS NULL
    RAISERROR('dbo.Tbl_UserDetails not found in this database.', 16, 1);
  -- Verify the physical storage capacity and types before changing data.
  IF NOT EXISTS (SELECT 1 FROM sys.columns c JOIN sys.types t ON c.user_type_id=t.user_type_id
      WHERE c.object_id=OBJECT_ID(N'dbo.Tbl_UserDetails') AND c.name=N'LoginNameWeb'
        AND t.name IN ('varchar','char','nvarchar','nchar')
        AND (c.max_length=-1 OR c.max_length >= LEN(@login) * CASE WHEN t.name IN ('nvarchar','nchar') THEN 2 ELSE 1 END))
    RAISERROR('LoginNameWeb is missing, incompatible, or too short.', 16, 1);
  IF NOT EXISTS (SELECT 1 FROM sys.columns c JOIN sys.types t ON c.user_type_id=t.user_type_id
      WHERE c.object_id=OBJECT_ID(N'dbo.Tbl_UserDetails') AND c.name=N'PasswordWeb'
        AND t.name IN ('varchar','char','nvarchar','nchar')
        AND (c.max_length=-1 OR c.max_length >= LEN(@passwordHash) * CASE WHEN t.name IN ('nvarchar','nchar') THEN 2 ELSE 1 END))
    RAISERROR('PasswordWeb is missing, incompatible, or too short for scrypt.', 16, 1);
  SELECT @count=COUNT(*) FROM dbo.Tbl_UserDetails WITH (TABLOCKX,HOLDLOCK)
    WHERE UPPER(LTRIM(RTRIM(UserId)))=UPPER(@userId);
  IF @count <> 1 RAISERROR('Expected exactly one UADMIN user; no rows updated.', 16, 1);
  IF EXISTS (SELECT 1 FROM dbo.Tbl_UserDetails WHERE UPPER(LTRIM(RTRIM(UserId)))=UPPER(@userId) AND ISNULL(Enable,0)<>1)
    RAISERROR('UADMIN is disabled; no rows updated. Enable through approved administration first.', 16, 1);
  IF EXISTS (SELECT 1 FROM dbo.Tbl_UserDetails WHERE UPPER(LTRIM(RTRIM(UserId)))<>UPPER(@userId)
       AND LOWER(LTRIM(RTRIM(ISNULL(LoginNameWeb,''))))=LOWER(@login))
    RAISERROR('The requested web login name is already used by another account.', 16, 1);
  UPDATE dbo.Tbl_UserDetails SET LoginNameWeb=@login, PasswordWeb=@passwordHash
    WHERE UPPER(LTRIM(RTRIM(UserId)))=UPPER(@userId);
  IF @@ROWCOUNT <> 1 RAISERROR('Unexpected update count; rollback.', 16, 1);
  COMMIT TRANSACTION;
  PRINT 'UADMIN web credentials updated. Existing sessions are not invalidated.';
END TRY
BEGIN CATCH
  IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
  DECLARE @message nvarchar(2048) = ERROR_MESSAGE();
  RAISERROR('%s',16,1,@message);
END CATCH;
`;
  fs.writeFileSync(output,script,{encoding:'utf8',mode:0o600,flag:'wx'});
  console.log(`Created: ${output}`);
  console.log('Review in SQL Server Management Studio: choose the correct database, back it up, then run the generated SQL.');
  console.log('Delete the generated SQL file securely after use; it contains a password hash.');
}
main().catch(e=>{console.error('Error:',e.message);process.exitCode=1}).finally(()=>rl.close());
