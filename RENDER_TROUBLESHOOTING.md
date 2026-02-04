# 🔧 Render Deployment Troubleshooting Guide

## Issue: "Cause of failure could not be determined"

This error usually means the build succeeded but the service failed to start. Here are the steps to fix it:

---

## ✅ Solution 1: Check Build & Start Commands

### Current Configuration Should Be:

**In Render Dashboard:**
- **Root Directory**: `backend`
- **Build Command**: `go build -o server ./cmd/server`
- **Start Command**: `./server`

### Alternative (More Robust):
- **Build Command**: `go build -tags netgo -ldflags '-w -extldflags "-static"' -o server ./cmd/server`
- **Start Command**: `./server`

---

## ✅ Solution 2: Check Environment Variables

Make sure ALL these environment variables are set in Render:

### Required Variables:
```
DATABASE_URL=postgresql://your-connection-string
PORT=8080
JWT_SECRET=your-secret-key
ENVIRONMENT=production
ALLOWED_ORIGINS=https://your-frontend-url.vercel.app
```

### Email Variables (Required even if ENABLE_EMAIL_OTP=false):
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=support@rift.pwioi.com
SMTP_FROM_NAME=RIFT 2026 Support
ENABLE_EMAIL_OTP=false
```

### Optional Variables:
```
OTP_RATE_LIMIT_MAX_ATTEMPTS=5
OTP_RATE_LIMIT_WINDOW_HOURS=1
SCAN_RATE_LIMIT_MAX_REQUESTS=1000
SCAN_RATE_LIMIT_WINDOW_MINUTES=1
```

---

## ✅ Solution 3: Check Render Logs

1. Go to Render Dashboard
2. Click on your `rift-backend` service
3. Click on **Logs** tab
4. Look for error messages like:
   - `failed to connect to database`
   - `failed to load configuration`
   - `port already in use`
   - `missing environment variable`

### Common Log Errors:

#### Error: "failed to connect to database"
**Fix**: Check your `DATABASE_URL` is correct and includes `?sslmode=require`

#### Error: "port already in use" or "bind: address already in use"
**Fix**: Make sure `PORT` environment variable is set to `8080`

#### Error: "missing required environment variable"
**Fix**: Add the missing variable in Render dashboard

---

## ✅ Solution 4: Use render.yaml (Recommended)

I've created a `render.yaml` file in your project root. This ensures consistent deployments.

### To use it:

1. **Commit the render.yaml file**:
   ```bash
   git add render.yaml
   git commit -m "Add Render configuration"
   git push
   ```

2. **In Render Dashboard**:
   - Go to your service
   - Click **Settings**
   - Scroll to **Build & Deploy**
   - It should auto-detect the `render.yaml`

3. **Add Environment Variables**:
   - Even with `render.yaml`, you still need to add the actual values for sensitive variables
   - Go to **Environment** tab
   - Add all the variables listed in Solution 2

---

## ✅ Solution 5: Check Database Connection

### Test Database Locally:
```bash
cd backend
go run cmd/server/main.go
```

If it fails locally, check:
- Is your `.env` file correct?
- Can you connect to Neon DB from your machine?
- Is the database URL using the **pooled connection** string?

### Neon DB Pooled Connection:
Your connection string should look like:
```
postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/dbname?sslmode=require
```

Notice the `-pooler` in the hostname!

---

## ✅ Solution 6: Manual Deploy Steps

If automatic deployment isn't working, try manual deployment:

1. **Delete the existing service** in Render
2. **Create a new Web Service**
3. **Configure step by step**:
   - Name: `rift-backend`
   - Region: Singapore
   - Branch: `main`
   - Root Directory: `backend`
   - Runtime: Go
   - Build Command: `go build -o server ./cmd/server`
   - Start Command: `./server`
   - Instance Type: Free (or Starter)

4. **Add ALL environment variables** (from Solution 2)
5. **Deploy**

---

## ✅ Solution 7: Check Health Endpoint

After deployment, test if the service is running:

```bash
curl https://your-service.onrender.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "RIFT '26 API",
  "version": "1.0.0",
  "time": "2026-02-04T..."
}
```

If this fails:
- Service didn't start properly
- Check logs for startup errors

---

## ✅ Solution 8: Common Fixes Checklist

- [ ] Root directory is set to `backend`
- [ ] Build command includes `./cmd/server`
- [ ] Start command is `./server` (not `./main`)
- [ ] All environment variables are set
- [ ] DATABASE_URL includes `?sslmode=require`
- [ ] PORT is set to 8080
- [ ] Go version in go.mod matches Render's Go version (1.21)
- [ ] No syntax errors in recent code changes
- [ ] Database is accessible from Render's region

---

## 🔍 Debug Mode: Enable Verbose Logging

If you still can't find the issue, temporarily add this to your environment variables:

```
GIN_MODE=debug
```

This will show more detailed logs in Render.

---

## 📞 Get Specific Error

To see the actual error:

1. **Render Dashboard** → Your Service → **Logs**
2. Look for lines starting with:
   - `ERROR`
   - `FATAL`
   - `panic:`
   - `failed to`

3. **Copy the full error message** and we can fix it specifically

---

## 🎯 Quick Fix Commands

If you need to rebuild:

```bash
# In your local backend directory
cd backend

# Test build locally
go build -o server ./cmd/server

# If that works, push to trigger Render rebuild
git add .
git commit -m "Fix: Update deployment configuration"
git push
```

---

## 💡 Pro Tips

1. **Use Starter Plan ($7/mo)** during the actual event to avoid cold starts
2. **Set up Health Checks** in Render to auto-restart on failures
3. **Monitor Logs** during first deployment to catch issues early
4. **Test locally first** before deploying to Render

---

## 🆘 Still Not Working?

Share the following information:

1. **Full error from Render logs** (last 50 lines)
2. **Your build command**
3. **Your start command**
4. **List of environment variables** (without values)
5. **Output of**: `go build -o server ./cmd/server` locally

---

**Last Updated**: February 4, 2026
