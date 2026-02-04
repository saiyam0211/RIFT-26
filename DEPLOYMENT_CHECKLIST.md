# ✅ RIFT Deployment Checklist

## Pre-Deployment

- [ ] All code is committed and pushed to GitHub
- [ ] `.env` file is NOT committed (check `.gitignore`)
- [ ] Database migrations are up to date
- [ ] Local testing completed successfully

---

## Backend (Render)

### Configuration
- [ ] Root Directory: `backend`
- [ ] Build Command: `go build -o server ./cmd/server`
- [ ] Start Command: `./server`
- [ ] Region: Singapore (or closest to your location)

### Environment Variables
- [ ] `DATABASE_URL` - Neon DB connection string with `?sslmode=require`
- [ ] `PORT` - Set to `8080`
- [ ] `JWT_SECRET` - Long random string (min 32 characters)
- [ ] `ENVIRONMENT` - Set to `production`
- [ ] `ALLOWED_ORIGINS` - Your frontend URL(s)
- [ ] `SMTP_HOST` - `smtp.gmail.com`
- [ ] `SMTP_PORT` - `587`
- [ ] `SMTP_USERNAME` - Your Gmail address
- [ ] `SMTP_PASSWORD` - Gmail app password
- [ ] `SMTP_FROM_EMAIL` - Support email
- [ ] `SMTP_FROM_NAME` - `RIFT 2026 Support`
- [ ] `ENABLE_EMAIL_OTP` - `false` (or `true` if email is configured)

### Verification
- [ ] Service deployed successfully
- [ ] Health check passes: `https://your-backend.onrender.com/health`
- [ ] No errors in logs
- [ ] Copy backend URL for frontend configuration

---

## Frontend (Vercel)

### Configuration
- [ ] Root Directory: `frontend`
- [ ] Framework: Next.js (auto-detected)
- [ ] Build Command: `npm run build` (default)

### Environment Variables
- [ ] `NEXT_PUBLIC_API_URL` - Your Render backend URL + `/api/v1`
  - Example: `https://rift-backend.onrender.com/api/v1`

### Verification
- [ ] Frontend deployed successfully
- [ ] Site loads without errors
- [ ] Copy frontend URL for CORS configuration

---

## Post-Deployment

### Update Backend CORS
- [ ] Go to Render → Backend Service → Environment
- [ ] Update `ALLOWED_ORIGINS` to include:
  - Your Vercel URL: `https://your-app.vercel.app`
  - Your custom domain: `https://rift.pwioi.com`
  - Separate multiple origins with commas
- [ ] Save (service will auto-restart)

### Test Full Flow
- [ ] Frontend loads correctly
- [ ] Can search for teams
- [ ] Can authenticate (email verification)
- [ ] Can submit RSVP
- [ ] Can access dashboard
- [ ] Admin login works
- [ ] Volunteer scanner works
- [ ] No CORS errors in browser console

### Custom Domain (Optional)
- [ ] Add custom domain in Vercel
- [ ] Update DNS records at your registrar
- [ ] Wait for DNS propagation (5-30 minutes)
- [ ] Update `ALLOWED_ORIGINS` in backend to include custom domain
- [ ] Test with custom domain

---

## Monitoring

### After Deployment
- [ ] Monitor Render logs for errors
- [ ] Check Vercel deployment logs
- [ ] Test all critical user flows
- [ ] Verify database connections are working
- [ ] Check email sending (if enabled)

### During Event
- [ ] Monitor service health
- [ ] Watch for rate limiting issues
- [ ] Check database connection pool
- [ ] Monitor response times
- [ ] Keep logs accessible for debugging

---

## Rollback Plan

If something goes wrong:

### Backend
1. Go to Render → Service → Events
2. Find last working deployment
3. Click "Redeploy"

### Frontend
1. Go to Vercel → Deployments
2. Find last working deployment
3. Click "Promote to Production"

---

## Common Issues & Fixes

### Issue: CORS Errors
**Fix**: Update `ALLOWED_ORIGINS` in Render to include your frontend URL

### Issue: 502 Bad Gateway
**Fix**: Check Render logs, service might have crashed. Restart service.

### Issue: Database Connection Errors
**Fix**: Verify `DATABASE_URL` is correct and includes `?sslmode=require`

### Issue: Slow Cold Starts (Free Tier)
**Fix**: Upgrade to Starter plan ($7/mo) or keep service warm with uptime monitor

---

## Production Recommendations

### For Actual Event Day:

1. **Upgrade Render to Starter Plan** ($7/mo)
   - Eliminates cold starts
   - Better performance
   - More reliable

2. **Set up Monitoring**
   - Use UptimeRobot or similar to ping `/health` every 5 minutes
   - Get alerts if service goes down

3. **Database Backup**
   - Neon DB auto-backups are enabled
   - Know how to restore if needed

4. **Have Admin Access Ready**
   - Test admin login before event
   - Have credentials saved securely
   - Test bulk upload functionality

---

## Emergency Contacts

- **Render Support**: https://render.com/docs/support
- **Vercel Support**: https://vercel.com/support
- **Neon DB Support**: https://neon.tech/docs/introduction

---

**Deployment Date**: _____________
**Backend URL**: _____________
**Frontend URL**: _____________
**Custom Domain**: _____________
