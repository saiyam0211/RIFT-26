# Complete AWS Deployment Guide - RIFT Hackathon

## 🎯 Architecture Overview (Single Domain)

We will serve both the landing page and the web app from the same domain: **`rift.pwioi.club`**

- **Landing Page**: `https://rift.pwioi.club` (Served from S3)
- **Web App**: `https://rift.pwioi.club/hackathon` (Served from EC2)
- **Backend API**: `https://api.rift.pwioi.club` (Served from EC2)

```
┌─────────────────────────────────────────────────────────────┐
│                 User (rift.pwioi.club)                      │
├─────────────────────────────────────────────────────────────┤
│                           │                                 │
│                           ▼                                 │
│                 ┌───────────────────┐                       │
│                 │    CloudFront     │                       │
│                 └─────────┬─────────┘                       │
│                           │                                 │
│           ┌───────────────┴───────────────┐                 │
│           │                               │                 │
│    Path: /hackathon/*                Path: Default (*)      │
│           │                               │                 │
│           ▼                               ▼                 │
│    ┌──────────────┐                ┌──────────────┐         │
│    │  EC2 Server  │                │  S3 Bucket   │         │
│    │ (Frontend)   │                │  (Landing)   │         │
│    └──────────────┘                └──────────────┘         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 Prerequisites

- ✅ AWS Account
- ✅ Domain: `rift.pwioi.club` (Managed in Route 53)
- ✅ SSH key pair for EC2 access

---

## 🚀 PART 1: Database Setup (RDS PostgreSQL)

### Step 1.1: Create RDS Instance

1. **Go to RDS** → **Create database**
2. **Engine**: PostgreSQL (v15.x or 16.x)
3. **Template**: Free tier (t3.micro) or Production (t3.small)
4. **Identifier**: `rift-database`
5. **Credentials**:
   - Master username: `riftadmin`
   - Master password: `[Secure Password]`
6. **Storage**: 20 GB (gp3)
7. **Connectivity**:
   - Public access: **No**
   - Security Group: Create new (`rift-database-sg`)
8. **Create Database**

---

## 🔧 PART 2: Servers Setup (EC2)

We will use **2 EC2 instances**:
1. `rift-backend` - Runs Go API
2. `rift-frontend` - Runs Next.js App

### Step 2.1: Launch Backend EC2

1. **Launch Instance** (Ubuntu 22.04 LTS)
2. **Name**: `rift-backend`
3. **Type**: t3.micro (Free Tier) or t3.small
4. **Security Group** (`rift-backend-sg`):
   - Allow SSH (22)
   - Allow HTTP (80)
   - Allow HTTPS (443)
5. **Key Pair**: Create/Select `rift-key`

### Step 2.2: Launch Frontend EC2

1. **Launch Instance** (Ubuntu 22.04 LTS)
2. **Name**: `rift-frontend`
3. **Type**: t3.micro or t3.small
4. **Security Group** (`rift-frontend-sg`):
   - Allow SSH (22)
   - Allow HTTP (80)
   - Allow **Custom TCP (3000)** from Anywhere (for testing)

---

## ⚙️ PART 3: Deploy Backend (API)

**Target Domain**: `api.rift.pwioi.club`

1. **SSH into Backend EC2**:
   ```bash
   ssh -i rift-key.pem ubuntu@<BACKEND_IP>
   ```

2. **Install Go & Postgres Client**:
   ```bash
   sudo apt update
   wget https://go.dev/dl/go1.21.6.linux-amd64.tar.gz
   sudo rm -rf /usr/local/go
   sudo tar -C /usr/local -xzf go1.21.6.linux-amd64.tar.gz
   echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
   source ~/.bashrc
   sudo apt install postgresql-client -y
   ```

3. **Deploy Code**:
   - Copy backend code to server (use SCP or Git)
   - Create `.env` file with DB credentials

4. **Run Migrations & Start Server**:
   ```bash
   go run cmd/migrate/main.go
   go build -o server cmd/server/main.go
   
   # Run in background (systemd is better for production)
   ./server &
   ```

5. **Setup Nginx (SSL)**:
   - Install Certbot: `sudo apt install certbot python3-certbot-nginx`
   - Run: `sudo certbot --nginx -d api.rift.pwioi.club`

---

## 🎨 PART 4: Deploy Frontend (Web App)

**Target Path**: `rift.pwioi.club/hackathon`

1. **SSH into Frontend EC2**:
   ```bash
   ssh -i rift-key.pem ubuntu@<FRONTEND_IP>
   ```

2. **Install Node.js & PM2**:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs
   sudo npm install -g pnpm pm2
   ```

3. **Deploy Code**:
   ```bash
   # On LOCAL machine, build first
   cd frontend
   pnpm build
   
   # Copy standalone build to EC2
   scp -i rift-key.pem -r .next/standalone public .next/static ubuntu@<FRONTEND_IP>:~/app
   ```

4. **Start App**:
   ```bash
   cd ~/app
   pm2 start server.js --name "rift-frontend"
   ```

5. **Configure Nginx**:
   Your Next.js app is already configured with `basePath: '/hackathon'`, so it expects that prefix.
   
   ```nginx
   # /etc/nginx/sites-available/default
   server {
       listen 80;
       server_name _;

       location /hackathon {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
       }
   }
   ```
   
   Restart Nginx: `sudo systemctl restart nginx`

---

## 📄 PART 5: Landing Page (S3)

1. **Create S3 Bucket**: `rift-landing-page`
2. **Upload Landing Files**:
   ```bash
   aws s3 sync landing/ s3://rift-landing-page/
   ```
3. **Enable Static Website Hosting** in bucket properties.

---

## ☁️ PART 6: CloudFront & DNS (The Magic Glue)

This is where we combine everything under `rift.pwioi.club`.

### Step 6.1: Create CloudFront Distribution

1. **Create Distribution**
2. **Origin 1 (Default)**:
   - Origin Domain: Select your S3 bucket (`rift-landing-page`)
   - Origin Access: Origin Access Control (OAC) settings (Create new)
   
3. **Origin 2 (Frontend)**:
   - Under "Origins" tab, click "Create Origin"
   - Origin Domain: `<FRONTEND_EC2_PUBLIC_DNS>` (e.g., ec2-x-x-x.compute-1.amazonaws.com)
   - Protocol: HTTP only (Port 80)

### Step 6.2: Configure Behaviors (Routing)

Go to **Behaviors** tab:

1. **Create Behavior** for App:
   - Path Pattern: `/hackathon*`
   - Origin: Select **Origin 2 (Frontend)**
   - Viewer Protocol Policy: Redirect HTTP to HTTPS
   - Cache Policy: `CachingDisabled` (for dynamic app) or `Managed-CachingOptimized`
   - **Important**: Forward all headers/cookies

2. **Default Behavior (*)** (already exists):
   - Origin: **Origin 1 (S3)**
   - Viewer Protocol Policy: Redirect HTTP to HTTPS

### Step 6.3: Custom Domain & SSL

1. **Request Certificate** (ACM):
   - Domain: `rift.pwioi.club` and `*.rift.pwioi.club`
   - Region: `us-east-1` (Must be N. Virginia for CloudFront)
   
2. **Attach to CloudFront**:
   - Edit Distribution Settings
   - Alternate Domain Names (CNAMEs): `rift.pwioi.club`
   - Custom SSL Certificate: Select the one you just created

### Step 6.4: Update S3 Policy

Update your S3 bucket policy to allow CloudFront access (CloudFront will provide the policy snippet when you select OAC).

---

## 🔗 PART 7: Final DNS Setup (Route 53)

Go to Route 53 Hosted Zone for `rift.pwioi.club`:

1. **Root Record (`rift.pwioi.club`)**:
   - Type: **A**
   - Alias: **Yes**
   - Route to: **CloudFront Distribution**

2. **API Record (`api.rift.pwioi.club`)**:
   - Type: **A**
   - Value: `<BACKEND_EC2_IP>`

---

## ✅ Deployment Checklist

1. **Landing Page**:
   - Visit `https://rift.pwioi.club`
   - Should load the static landing page from S3.

2. **Web App**:
   - Visit `https://rift.pwioi.club/hackathon`
   - Should load the Next.js app provided by EC2.

3. **Backend API**:
   - Visit `https://api.rift.pwioi.club/api/v1/health`
   - Should return `{"status": "healthy"}`.

---

## 🔄 Updating Your Deployments

### To Update Landing Page:
```bash
aws s3 sync landing/ s3://rift-landing-page/
aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"
```

### To Update Frontend App:
```bash
# Local
pnpm build
scp -r .next/standalone ... ubuntu@<IP>:~/app

# Remote
pm2 restart rift-frontend
```

### To Update Backend API:
```bash
# Remote
git pull
go build -o server
sudo systemctl restart rift-backend
```
