# KBase - AI Landing Zone

Project management portal for AI initiatives.

## Prerequisites

- Node.js 22+
- Docker Desktop (for local database)

## Local Development

### 1. Start Local PostgreSQL

```bash
cd backend
npm run db:start
```

This starts a PostgreSQL container using Docker.

### 2. Set Environment Variable

**Mac/Linux:**
```bash
export BRANCH=your-feature-name
```

**Windows PowerShell:**
```powershell
$env:BRANCH = "your-feature-name"
```

**Windows CMD:**
```cmd
set BRANCH=your-feature-name
```

When `BRANCH` is set, the app automatically connects to local PostgreSQL (localhost:5432).

### 3. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 4. Run the App

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

### Database Commands

```bash
npm run db:start   # Start PostgreSQL container
npm run db:stop    # Stop PostgreSQL container
npm run db:reset   # Reset database (delete all data)
```

## Production Deployment

### Environment Variables

For Azure PostgreSQL with Entra Auth:
```
PGHOST=your-postgres.postgres.database.azure.com
PGDATABASE=your-db-name
PGUSER=your-service-principal-name
PGPORT=5432
AZURE_CLIENT_ID=<service principal client id>
AZURE_CLIENT_SECRET=<service principal secret>
AZURE_TENANT_ID=<tenant id>
```

Or with password auth:
```
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
```

### Build & Deploy to ACR

```bash
# Login to ACR (if public access enabled)
az acr login --name <acr-name>

# Build and push
docker build -t <acr-name>.azurecr.io/aiboard-frontend:latest .
docker push <acr-name>.azurecr.io/aiboard-frontend:latest

# Or use ACR Tasks (builds in cloud)
az acr build --registry <acr-name> --image aiboard-frontend:latest .
```

## Project Structure

```
├── backend/
│   ├── db/           # Database connection
│   ├── routes/       # API routes
│   ├── middleware/   # Auth middleware
│   └── server.js     # Express server
├── frontend/
│   ├── src/
│   │   ├── pages/    # React pages
│   │   ├── components/
│   │   └── App.css   # Styles
│   └── vite.config.js
├── docker-compose.dev.yml  # Local PostgreSQL
└── Dockerfile              # Production build
```

## Default Admin

On first run, a default admin is created:
- Email: Divakar.Doreiswamy@knorr-bremse.com
- Password: admin123

Change this password after first login.
