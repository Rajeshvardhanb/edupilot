# SVIET Student Management System

## 1. Windows deployment and presentation guide

**Project owner / presenter: LANKE SANDHYA — 24MQ5A0509**

Install **Node.js and MySQL Community Server directly on Windows**, then open the application in a browser. **Docker, WSL, virtual machines and Git Bash are not required.**

- **Application:** a Node.js process started from PowerShell.
- **Database:** a native MySQL Windows service.
- **Browser address:** `http://localhost:3000/login`.
- **Terminal:** ordinary Windows PowerShell, except when installing software or starting a stopped Windows service.
- **First setup:** Sections 2–6. **Daily startup:** Section 7. **Logins / presentation:** Sections 8–9. **Backup:** Section 10.

### What to have ready

- A 64-bit Windows laptop supported by the Node.js and MySQL installers.
- Internet for initial software installation and npm package downloads.
- The **complete, current project folder/ZIP supplied by the developer**, including `package-lock.json`, `.env.example`, `prisma`, `public`, `scripts` and `src`. A report PDF alone cannot run the application.
- Several GB of free disk space for installed software, dependencies and the application build. Actual space and memory use depend on the machine; no minimum laptop configuration has been benchmarked for this project.

Use `C:\Projects\SVIET-SMS`, outside OneDrive or a network drive. Run commands one block at a time. Stop if a command fails and consult troubleshooting.

### On a modest laptop

Install only MySQL Server and its command-line tools; Workbench and other database GUI tools are optional. Close unused browser tabs, VS Code and other heavy programs before the first build. Build once, then use the production start command for subsequent demonstrations. The build can need more memory than everyday presentation use; rehearse on the actual laptop.

The application was verified on Linux. These native Windows instructions have been checked against the source configuration and official installer documentation, but have not been executed on a Windows laptop in this session.
<!-- pagebreak -->

## 2. Install Node.js and MySQL — once

### Install Node.js

Download the **Node.js 24.x LTS Windows installer** from [Node.js downloads](https://nodejs.org/en/download). Select version 24.x to use the project's documented runtime major version. Include npm and PATH support, then reopen PowerShell:

```powershell
node --version
npm.cmd --version
```

Expected: `v24...` and an npm version. This guide uses `npm.cmd` to avoid PowerShell restrictions on `npm.ps1` scripts.

### Install MySQL Community Server

Download **MySQL Community Server 8.4 LTS, Windows 64-bit MSI** from [MySQL Community downloads](https://dev.mysql.com/downloads/mysql/). Select the 8.4 version series. Follow the [official Windows installation guide](https://dev.mysql.com/doc/refman/8.4/en/windows-installation.html). Install any Microsoft runtime prerequisite requested by the installer.

Complete the included [MySQL Configurator](https://dev.mysql.com/doc/refman/8.4/en/mysql-configurator.html) with these settings:

1. Select **Development Computer** if offered, to reserve fewer resources than a dedicated database server configuration.
2. Enable TCP/IP, using port **3306**. This presentation needs only local access; a firewall exception for remote machines is unnecessary.
3. Set and securely record your own **root password**. Keep the default recommended authentication setting.
4. Configure a Windows service named **MySQL84**, with **Start at system startup** enabled. Apply the configuration and confirm the server starts.

Workbench, MySQL Shell, Router and sample databases are not required for this guide. The server package includes the `mysql.exe` and `mysqldump.exe` command-line tools used below.

```powershell
Get-Service -Name MySQL84
```

Expected: **Running**. If you chose a different service name, use that name throughout the guide. If MySQL is already installed, ask the person maintaining that installation for its version, service name, port and root access; do not reinstall it over existing databases.
<!-- pagebreak -->

## 3. Open the project and create its database

Extract the supplied project to `C:\Projects\SVIET-SMS`, then open PowerShell:

```powershell
Set-Location 'C:\Projects\SVIET-SMS'
Get-Item package.json, package-lock.json, .env.example
```

All three files should be listed. If they are inside another extracted subfolder, open that folder instead. Install dependencies and build locally rather than copying `node_modules` or a Linux-generated `.next` folder.

### Connect to MySQL

The default MySQL 8.4 installation uses this tools folder. Adjust the path if you chose a different installation location:

```powershell
$mysqlBin = 'C:\Program Files\MySQL\MySQL Server 8.4\bin'
& "$mysqlBin\mysql.exe" -u root -p
```

Type the **root password chosen in the installer** when prompted; it will not be displayed. A successful connection shows a `mysql>` prompt.

### Run these statements at the `mysql>` prompt

For a new local demo installation, create a database and a user restricted to that database:

```sql
CREATE DATABASE IF NOT EXISTS edupilot CHARACTER SET utf8mb4;
CREATE USER 'sviet_app'@'localhost' IDENTIFIED BY 'SvietDemo2026';
GRANT ALL PRIVILEGES ON edupilot.* TO 'sviet_app'@'localhost';
EXIT;
```

`SvietDemo2026` is a **local demonstration password for the application database user**, not your MySQL root password or browser login. The next section uses it in `.env`. If you choose a different password, use that same value there.

If `sviet_app` already exists, do not delete it or change its password blindly. Use the known credentials for the existing installation or ask the developer to help. If an existing `edupilot` database contains valuable records, preserve it before loading sample data.
<!-- pagebreak -->

## 4. Configure the application connection

Return to PowerShell in `C:\Projects\SVIET-SMS`. Create `.env` only if it does not already exist, generate a secret, and open the settings:

```powershell
if (-not (Test-Path '.env')) { Copy-Item '.env.example' '.env' }
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
notepad .env
```

Copy the generated random value into `AUTH_SECRET`. Save the following as plain text in **`.env`**, not `.env.txt`:

```dotenv
DATABASE_URL="mysql://sviet_app:SvietDemo2026@localhost:3306/edupilot"
AUTH_SECRET="PASTE_THE_GENERATED_RANDOM_VALUE_HERE"
APP_URL="http://localhost:3000"
SMTP_HOST=""
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM=""
BACKUP_MIRROR_DIR=""
AUTO_BACKUP=""
```

The supplied `.env.example` contains a different database example. **Replace its database URL** with the native MySQL URL above. Port 3306 and the `sviet_app` password must match Sections 2–3.

If your database password contains URL-special characters such as `@`, `#`, `%` or `:`, its password portion must be URL-encoded. The example password uses letters and digits to keep the local demonstration steps simple.

Keep the same authentication secret across normal restarts. Do not share `.env` with classmates or include it in screenshots. Blank SMTP records mail in the administration outbox without delivery; leave email-dependent steps out of the presentation unless mail is configured.

You do not need to edit the project's container files or install a Unix shell. For this native setup, use only the PowerShell commands in this guide; the `setup`, `db:up` and `prod:*` shortcuts are for a different deployment path.
<!-- pagebreak -->

## 5. Install, load demo data, build and start

Run these commands from `C:\Projects\SVIET-SMS`, with the MySQL service running. Wait for each command to finish successfully before continuing.

### Install dependencies and apply database migrations

```powershell
npm.cmd ci
npm.cmd run db:deploy
```

The install also generates the Prisma client. Prisma should report that migrations were applied or none are pending. No shadow database or development-migration command is needed.

### Load sample data — first setup only

**The seed deletes and replaces records in the database selected by `.env`. Use it only for this local demo database, never for daily startup.**

```powershell
npm.cmd run db:seed
```

Wait for `Seed complete`. The seed includes supplied student identities and illustrative academic records.

### Build once, then start the app

Close other heavy programs before the build. This may take time on a modest laptop:

```powershell
npm.cmd run build -- --webpack
```

After the build succeeds, start the presentation server:

```powershell
npm.cmd run start -- --hostname 127.0.0.1
```

Keep this PowerShell window open and visit **http://localhost:3000/login**. No domain or public hosting is needed. Use the production start command rather than running a development compiler throughout the presentation.

Rebuild after supplied source changes; restart after `.env` changes. If dependency files changed, repeat `npm.cmd ci`; apply newly supplied migrations with `npm.cmd run db:deploy`. Do not reseed for an ordinary update.

### Update an existing older demo database with the supplied student names

Back up first using Section 10. Preview the identity update, then apply it:

```powershell
node scripts/sync-student-identities.mjs
node scripts/sync-student-identities.mjs --apply
```

This matches the original 21 demo student records to the supplied names and roll numbers, preserving IDs, marks, attendance, results and passwords. It also updates roll-based sample login addresses; `student@edupilot.edu` stays available. It saves an identity snapshot under `backups/` and sends no email. A repeat run changes nothing once the identities match. Stop if a conflict is reported; do not reset or reseed to fix it. Only names/roll numbers supplied by the client are treated as real; academic/contact data remains illustrative. The 403 original generated student identities are hidden from the application presentation, including lists, counts, exports and related academic views. Their records remain in MySQL and backups. The 21 supplied students and newly registered students remain visible.

<!-- pagebreak -->

## 6. Check that the first installation worked

Sign in with `admin@edupilot.edu` and password `password123`.

1. Confirm that the login page and dashboard display the SVIET identity.
2. Open **Students** and search for **LANKE SANDHYA** or **24MQ5A0509**. Open her profile and confirm the supplied name/roll number.
3. Open **Academics** and confirm that departments, programmes, batches, subjects and teaching assignments are populated.
4. Open attendance, marks and published results and verify that records load without a database error.
5. Sign out and test the faculty, student and parent accounts listed in Section 8.
6. Download a sample grade card or hall ticket using the available screen controls and confirm that the PDF opens.

The supplied student names/roll numbers are real project inputs; marks, attendance, contact details, batch placement and placement outcomes are demonstration values.

Students can update their personal and contact details under **My profile → Edit my details**. Changing a login email requires the current password. Roll numbers, batches and academic status are managed by the administrator.

Administrators use **Students → Add student**, **View**, **Edit**, and **Delete**. Delete asks for confirmation, disables the student's login and archives the record; marks, attendance, results and audit history remain stored.

### Optional college logo

The default seed sets college text branding. If the approved logo is not visible, sign in as admin and upload the client-approved emblem under **Administration → Settings / branding**. A logo added only to another developer's database will not automatically appear on this laptop.

### Date-sensitive demonstrations

The seed's current term is **13 July–18 December 2026**, and its sample attendance covers July–early October 2026. Presentation dates outside that period can make current-day views or forms look empty or reject a date.

Use the seeded term and existing historical dates when reviewing records. For attendance entry, choose a valid past teaching date within that term, such as **8 October 2026**, rather than a future date. Check that the selected course/period is appropriate before saving. If the guide requires a current academic year, have the developer prepare that dataset in advance; do not change the laptop clock.
<!-- pagebreak -->

## 7. Start and stop on presentation day

You do **not** need to reinstall, migrate, seed or rebuild if nothing changed since rehearsal.

### Start

1. Connect the charger. Open ordinary PowerShell and check the database:

```powershell
Get-Service -Name MySQL84
```

2. If it is **Running**, continue. If it is **Stopped**, open a separate **Administrator PowerShell** and run:

```powershell
Start-Service -Name MySQL84
```

3. Return to ordinary PowerShell and start the app:

```powershell
Set-Location 'C:\Projects\SVIET-SMS'
npm.cmd run start -- --hostname 127.0.0.1
```

4. Keep the terminal open. Open **http://localhost:3000/login** and sign in. If your MySQL service has a different name, substitute it in the commands above.

### Stop

Press **Ctrl+C** in the app terminal. If asked to terminate the batch job, answer **Y**. MySQL may remain running as its normal Windows service; no database shutdown command is required for everyday use. A normal laptop restart preserves database records but stops the Node server, so start the app again afterwards.

### Keep the laptop responsive

- Keep only the app terminal and the browser windows needed for the demo open. VS Code, MySQL Workbench and terminals for other apps can be closed.
- Do not run builds, tests or a development server alongside the presentation server.
- After installation and the successful build, normal academic screens can work without internet. Email and external links still need a connection; rehearse once with Wi-Fi disconnected.
- Student edits, attendance and marks persist in MySQL after a normal restart. Do not reseed to start the app.
<!-- pagebreak -->

## 8. Demo login details

**Seeded demo password for all accounts below: `password123`.** This applies immediately after a successful seed; an account's later password change replaces it.

- **Administrator:** `admin@edupilot.edu` — academic setup, student management, exams and administration.
- **HOD:** `hod.cse@edupilot.edu` — department academic review and permitted management.
- **Faculty:** `faculty@edupilot.edu` — assigned-course attendance, marks and teaching workflows.
- **Student demo:** `student@edupilot.edu` — **LANKE SANDHYA (24MQ5A0509)**, with sample academic history.
- **Parent:** `parent@edupilot.edu` — records of the student linked by the seed.
- **Office:** `office@edupilot.edu` — student registration and permitted student-record work.
- **Accountant:** `accounts@edupilot.edu` — retained login and permitted student-record views; finance modules are removed.

### Sandhya's own student account

- **Name:** LANKE SANDHYA
- **Roll number:** `24MQ5A0509`
- **Email:** `24mq5a0509@student.edupilot.edu`
- **Seeded password:** `password123`

Sandhya's student account is separate from the generic `student@edupilot.edu` account. The default parent account is linked to the generic demo student; it is not automatically Sandhya's parent account. Do not expect their results or linked-child screens to be identical.

Use a normal browser window for one account and an InPrivate/Incognito window for another. Tabs in the same browser profile share a login, so signing in as a second role there also changes the first tab's session. Sign out between additional roles.

Newly registered students use a different initial-password rule: their lowercase roll number, followed by a required password change. The `password123` rule above is for seeded demo accounts.
<!-- pagebreak -->

## 9. Suggested presentation flow — approximately 10 minutes

**Introduction — 1 minute.** Introduce LANKE SANDHYA, the project title and SVIET. Explain that the application connects student records, teaching activity, attendance and results through role-based access.

**Student records — 2 minutes.** As admin, show the dashboard, search for Sandhya, and open her profile. Open the registration form and explain its fields. If creating a record, use a unique test roll number/email and save it only once.

**Academic setup — 1 minute.** Show the relationship between programme, batch, subject, term and course assignment. Basic teacher accounts support academic work; detailed HR management is outside this branch's scope.

**Attendance and marks — 2 minutes.** As faculty, open an assigned course. Show an existing attendance sheet and its report. Demonstrate a rehearsed attendance or marks save if required. Show published results from an earlier term rather than trying to publish a class with incomplete assessments.

**Student and parent views — 1 minute.** Sign in using the appropriate student account and show personal attendance, results and timetable. Explain that the parent sees only the linked child. Use Sandhya's account when presenting her identity; use the generic student/parent pair when demonstrating their link.

**Additional retained features — 2 minutes.** Show a hall ticket, exam schedule/seating, materials or assignments, leave/on-duty requests and placements/alumni. Choose two or three screens rather than rushing through every menu. Avoid changing placement eligibility or exam allocations during an unrehearsed demo.

**Close — 1 minute.** Explain validation, access boundaries, audit records and database persistence. Open the project report and show the architecture diagram and verification chapter if asked.

### Final rehearsal checklist

- Start from a laptop reboot and confirm the daily commands work.
- Test the projector/display scaling and browser zoom; keep screenshots and PDFs readable.
- Keep demo credentials, this guide and the project report accessible locally.
- Prepare and test a database backup before making demonstration changes.
- Confirm that all chosen screens contain the expected records; keep SMTP-dependent steps optional unless mail has been tested.
- Keep PowerShell running, connect the charger and prevent sleep during the presentation.
<!-- pagebreak -->

## 10. Back up and recover the demo database

Keep MySQL running. Stop the app with **Ctrl+C** for a simple presentation snapshot. Run from the project folder. The tools below come with native MySQL Server; adjust the installation path if necessary.

### Create a backup

```powershell
Set-Location 'C:\Projects\SVIET-SMS'
$mysqlBin = 'C:\Program Files\MySQL\MySQL Server 8.4\bin'
New-Item -ItemType Directory -Force '.\backups' | Out-Null
& "$mysqlBin\mysqldump.exe" -u root -p --single-transaction --no-tablespaces --routines --hex-blob --set-gtid-purged=OFF --result-file=C:/Projects/SVIET-SMS/backups/sviet-demo.sql edupilot
```

Enter the **MySQL root password** when prompted. Check `$LASTEXITCODE` immediately; it must be **0**. Then check that the file exists and has content:

```powershell
Get-Item '.\backups\sviet-demo.sql'
```

Use `--result-file` as shown, rather than PowerShell `>` redirection, to avoid dump-encoding problems. See the [official mysqldump guidance](https://dev.mysql.com/doc/refman/8.4/en/mysqldump.html). Rename older snapshots before making another backup with the same filename. Keep a second copy outside the laptop, along with the project source and private settings.

### Restore a known backup — only when needed

**Restore replaces records in `edupilot`. Stop the app and preserve newer data first. This is not a daily startup step.**

```powershell
$mysqlBin = 'C:\Program Files\MySQL\MySQL Server 8.4\bin'
& "$mysqlBin\mysql.exe" -u root -p edupilot
```

Enter the root password. At the **`mysql>` prompt**, run:

```sql
SOURCE C:/Projects/SVIET-SMS/backups/sviet-demo.sql;
EXIT;
```

Watch for SQL errors. After a successful restore, restart the app, sign in again and check a known record. Use the actual backup path if your project is elsewhere. Test recovery before presentation day.
<!-- pagebreak -->

## 11. Troubleshooting — setup and database

### `node` or `npm.cmd` is not recognized

Close and reopen PowerShell after installing Node.js. If still missing, repair the installation with PATH support enabled. Confirm `node --version` before installing project packages.

### `npm.ps1 cannot be loaded` / scripts are disabled

Use **`npm.cmd`** exactly as shown. You do not need to change the system's PowerShell execution policy.

### `package.json` cannot be found

Run `Get-Location`, then open the extracted folder containing `package.json`. Run all project commands there.

### `mysql.exe` cannot be found / service name is different

Check the MySQL installation folder in File Explorer. Use its actual `bin` path and the `&` call operator shown in Section 3. The MySQL client does not have to be on PATH. To find installed MySQL services:

```powershell
Get-Service -Name '*mysql*'
```

For example, a pre-existing MySQL 8.0 installation may use service `MySQL80` and a different tools folder. Have the developer confirm compatibility before substituting another database product; XAMPP's database may be MariaDB rather than this guide's MySQL.

### Prisma cannot reach MySQL / access denied

Check that the correct service is Running, and that `.env` uses the installed port (normally **3306**), database `edupilot`, and the `sviet_app` credentials created in Section 3. Test those credentials directly:

```powershell
& 'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe' -h localhost -P 3306 -u sviet_app -p edupilot
```

Enter the application database password, not the root password. Type `EXIT;` after connecting. If port 3306 is already used by an existing MySQL service, identify it before installing another server. Do not delete its data or reset its password as a guess.

### Missing tables or demo users

Complete `npm.cmd run db:deploy`. Seed only a confirmed disposable demo database. If previously saved data is missing, check the connection URL before reseeding.
<!-- pagebreak -->

## 12. Troubleshooting — application and presentation

### Production build is missing or the build runs out of memory

Build successfully with `npm.cmd run build -- --webpack` before starting the app. Close other programs and let the build finish while connected to power. Keep Windows-managed virtual memory enabled. Do not repeatedly build during the demonstration. If it still fails, send the full error to the developer so a Windows build can be prepared and rehearsed for that machine; a Linux `.next` folder is not a substitute.

### Port 3000 is in use

Stop the previous copy of this app with Ctrl+C. If another program needs that port, set `APP_URL` in `.env` to `http://localhost:3001`, restart the app using:

```powershell
npm.cmd run start -- --hostname 127.0.0.1 --port 3001
```

Open `http://localhost:3001/login`. Keep the browser and `APP_URL` port the same.

### Login fails, repeats or shows another role

Use Section 8's credentials. Confirm the seed completed and the account's password was not changed. Use the same HTTP address in `APP_URL` and the browser; incorrect HTTPS settings can prevent login. Sign out or use InPrivate to switch roles. Repeated wrong passwords can lock an account for 15 minutes.

### Empty timetable / rejected attendance date / email not delivered

Check the role, student, course, term and date. Seeded academic data uses 2026 dates; Section 6 explains how to demonstrate it. Blank SMTP records mail in the outbox without delivery. Keep email-dependent steps out of the planned demo unless tested.

### If still stuck

Send the failing command, full error text, `node --version`, `npm.cmd --version`, and `Get-Service -Name '*mysql*'`. Do not send `.env`, passwords or tokens. Preserve the source and data; do not reset the database or delete the lockfile.

The existing dependency advisory is recorded in the main report. A security-blocked or failed build needs developer review before presentation; do not disable checks or perform unreviewed package upgrades to force it through.
