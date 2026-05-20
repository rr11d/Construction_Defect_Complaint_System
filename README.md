# Construction Defect Complaint System

React/Vite frontend, Express API server, MySQL database, and a separate AI analysis server.

## Quick Start With Docker

### 1. Prerequisites

- Node.js
- Docker Desktop

### 2. Create `.env`

Copy `.env.example` to `.env`.

Default Docker DB values:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=complaint_app
DB_PASS=complaint_app_pw
DB_NAME=construction_defect
```

Also fill in:

```env
OPENAI_API_KEY=your-openai-api-key
SECRET_KEY=change-this-secret
```

### 3. Install packages

```bash
npm install
```

On Windows PowerShell, if `npm` is blocked, use:

```powershell
npm.cmd install
```

### 4. Start MySQL with Docker

```bash
docker compose up -d
```

Wait until the DB container is healthy, then initialize tables and the admin account:

```bash
npm run setup:db
```

Windows PowerShell alternative:

```powershell
npm.cmd run setup:db
```

Expected output:

```text
Database ready: construction_defect
Admin account ready: test / 1111
```

### 5. Start the app

Terminal 1:

```bash
npm run dev
```

Terminal 2:

```bash
node AIserver.js
```

### 6. Open the app

- Frontend: http://127.0.0.1:5173
- API server: http://127.0.0.1:3000
- AI server: http://127.0.0.1:4000

### Admin login

- ID: `test`
- Password: `1111`

## Docker Commands

Start DB:

```bash
docker compose up -d
```

Stop DB:

```bash
docker compose down
```

Stop DB and remove data volume:

```bash
docker compose down -v
```

## Notes

- `npm run dev` starts the frontend and the main Express server.
- `node AIserver.js` must also be running for AI image analysis features.
- The database setup script expects the target database to already exist, which Docker handles automatically.
