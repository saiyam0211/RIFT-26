# 🚀 Deployment Guide: Vercel (Frontend) & Render (Backend)

This guide deploys the RIFT stack using modern PaaS providers. This is easier to manage than raw EC2 instances and handles scaling automatically.

**Stack:**
- **Database**: Neon DB (PostgreSQL)
- **Backend**: Render (Go Service)
- **Frontend**: Vercel (Next.js)




---

## 🟢 PART 1: Database (Neon DB)

You are likely already using this. Ensure you have the **Connection String** ready.

1.  **Dashboard**: Go to your Neon console.
2.  **Connection Details**: Get the connection string. It looks like:
    ```
    postgres://user:password@ep-cool-frog-123456.us-east-1.aws.neon.tech/rift_hackathon?sslmode=require
    ```
3.  ⚠️ **Important**: For serverless environments (like Vercel/Render), use the **Pooled Connection** string if available (often contains `-pooler` in the host). If not, standard is fine for Go since we implemented our own pooling config in `postgres.go`.

---

## 🟣 PART 2: Backend Deployment (Render)

Render is great for Go web services.

### 2.1. Create Service
1.  Push your latest code to **GitHub**.
2.  Log in to [dashboard.render.com](https://dashboard.render.com/).
3.  Click **New +** → **Web Service**.
4.  Connect your GitHub repository.

### 2.2. Configure Service
*   **Name**: `rift-backend`
*   **Region**: Singapore (or closest to you/database).
*   **Branch**: `main`
*   **Root Directory**: `backend` (Important! Your go code is in this subfolder).
*   **Runtime**: **Go**
*   **Build Command**: `go build -o server cmd/server/main.go`
*   **Start Command**: `./server`
*   **Instance Type**: Free (for dev) or "Starter" ($7/mo) for the actual hackathon to avoid "spin-down" delays.

### 2.3. Environment Variables
Scroll down to "Environment Variables" and add these keys from your `.env` file:

| Key | Value |
| /---| /---|
| `DATABASE_URL` | `postgres://...` (Your Neon DB string) |
| `PORT` | `8080` |
| `JWT_SECRET` | `[Generate a long random string]` |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USERNAME` | `your-email@gmail.com` |
| `SMTP_PASSWORD` | `your-app-password` |
| `SMTP_FROM_EMAIL` | `support@rift.pwioi.club` |
| `SMTP_FROM_NAME` | `RIFT Hackathon` |
| `ENVIRONMENT` | `production` |
| `ALLOWED_ORIGINS` | `https://rift.pwioi.club` (We will update this after frontend deploy) |

### 2.4. Deploy
Click **Create Web Service**.
*   Render will clone, download Go modules, build, and start.
*   Once live, copy your service URL (e.g., `https://rift-backend.onrender.com`).

---

## ▲ PART 3: Frontend Deployment (Vercel)

Vercel is the creators of Next.js, making it the best place to host it.

### 3.1. Create Project
1.  Go to [vercel.com](https://vercel.com) and log in.
2.  Click **Add New...** → **Project**.
3.  Import your GitHub repository.

### 3.2. Configure Project
*   **Framework Preset**: Next.js (Auto-detected).
*   **Root Directory**: Click "Edit" and select `frontend`.
*   **Build Command**: `next build` (Default is correct).

### 3.3. Environment Variables
Expand the "Environment Variables" section.

| Key | Value |
| /---| /---|
| `NEXT_PUBLIC_API_URL` | `https://rift-backend.onrender.com/api/v1` (Your Render URL) |

### 3.4. Deploy
Click **Deploy**.
*   Vercel will build your static pages and deploy the edge functions.
*   Once done, you will get a URL like `rift-frontend.vercel.app`.

---

## 🌐 PART 4: Domain & Final Wiring

Now we connect `rift.pwioi.club`.

### 4.1. Custom Domain on Vercel
1.  Go to Vercel Project Settings → **Domains**.
2.  Add `rift.pwioi.club`.
3.  Vercel will give you DNS records (A record or CNAME).
4.  Go to your Domain Registrar (GoDaddy/Namecheap/Cloudflare) and add those records.
    *   **Type**: CNAME
    *   **Name**: `rift` (subdomain)
    *   **Value**: `cname.vercel-dns.com`

### 4.2. Update Backend CORS
1.  Go back to **Render Dashboard** → `rift-backend` → Environment.
2.  Update `ALLOWED_ORIGINS` to include your new domain:
    *   `https://rift.pwioi.club,https://rift-frontend.vercel.app`
3.  Save. Render will auto-restart the backend.

---

## ✅ Deployment Checklist

1.  **Frontend**: Visit `https://rift.pwioi.club/hackathon/admin`.
    *   Does it load?
2.  **Backend Connection**: Try to log in.
    *   If it fails, check Network Tab (F12).
    *   If you see CORS errors, check step 4.2.
3.  **Database**: Create a test announcement.
    *   Does it show up in Neon DB?

---

## 💰 Cost Analysis (Estimated)

*   **Neon DB**: **Free** (Free tier is generous for hackathons).
*   **Vercel**: **Free** (Hobby tier covers typical hackathon traffic).
*   **Render**:
    *   **Free**: Good for testing, but server "sleeps" after 15 mins of inactivity. 50s delay to wake up.
    *   **Starter ($7/mo)**: Recommended for the actual 2-3 days of the event to ensure 100% uptime.

**Total Cost**: **$0 - $7** depending on if you upgrade Render.
