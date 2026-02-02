# Complete AWS Deployment Guide - RIFT Hackathon

## 🎯 Architecture Overview

Your complete stack on AWS:

```
┌─────────────────────────────────────────────────────────────┐
│                         AWS Cloud                            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Route 53   │───▶│ CloudFront   │───▶│  S3 Bucket   │  │
│  │   (DNS)      │    │   (CDN)      │    │  (Landing)   │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                                                     │
│         ▼                                                     │
│  ┌──────────────┐                                            │
│  │ Load Balancer│                                            │
│  └──────────────┘                                            │
│         │                                                     │
│    ┌────┴────┐                                               │
│    ▼         ▼                                               │
│  ┌────┐   ┌────┐                                            │
│  │EC2 │   │EC2 │  ← Frontend (Next.js) + Nginx             │
│  │ 1  │   │ 2  │                                            │
│  └────┘   └────┘                                            │
│         │                                                     │
│         ▼                                                     │
│  ┌──────────────┐                                            │
│  │     EC2      │  ← Backend (Go API)                       │
│  │  (Go Server) │                                            │
│  └──────────────┘                                            │
│         │                                                     │
│         ▼                                                     │
│  ┌──────────────┐                                            │
│  │  RDS (PostgreSQL)  ← Database                            │
│  │  Multi-AZ    │                                            │
│  └──────────────┘                                            │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**Services Used:**
- **RDS PostgreSQL** - Database
- **EC2** - Backend (Go) + Frontend (Next.js)
- **S3 + CloudFront** - Landing page (static files)
- **Application Load Balancer** - Traffic distribution
- **Route 53** - DNS management
- **Security Groups** - Network security
- **IAM** - Access management


---

## 📋 Prerequisites

Before starting:
- ✅ AWS Account created
- ✅ AWS CLI installed (optional but recommended)
- ✅ Domain name (optional, can use AWS provided URLs)
- ✅ SSH key pair for EC2 access

---

## 🚀 PART 1: Database Setup (RDS PostgreSQL)

### Step 1.1: Create RDS PostgreSQL Instance

1. **Go to AWS Console** → **RDS** → **Create database**

2. **Engine Options:**
   - Engine type: **PostgreSQL**
   - Version: **PostgreSQL 15.x** (latest stable)

3. **Templates:**
   - Select: **Free tier** (for testing) or **Production** (for live)

4. **Settings:**
   - DB instance identifier: `rift-database`
   - Master username: `riftadmin`
   - Master password: `[Create a strong password]`
   - ✅ **Save this password securely!**

5. **Instance Configuration:**
   - **Free tier:** db.t3.micro (1 vCPU, 1 GB RAM)
   - **Production:** db.t3.small or larger

6. **Storage:**
   - Allocated storage: **20 GB** (minimum)
   - Storage type: **General Purpose SSD (gp3)**
   - ✅ Enable storage autoscaling: **Yes**
   - Maximum storage threshold: **100 GB**

7. **Connectivity:**
   - VPC: **Default VPC** (or create new)
   - Subnet group: **Default**
   - Public access: **No** (accessed via EC2 only)
   - VPC security group: **Create new**
     - Name: `rift-database-sg`
   - Availability Zone: **No preference**

8. **Database Authentication:**
   - Choose: **Password authentication**

9. **Additional Configuration:**
   - Initial database name: `rift_hackathon`
   - Backup retention: **7 days**
   - ✅ Enable automated backups: **Yes**
   - Monitoring: **Enable Enhanced Monitoring**

10. **Click:** `Create database`

⏱️ **Wait 5-10 minutes** for database to be created.

### Step 1.2: Note Database Endpoint

Once created:
1. Go to **RDS** → **Databases** → **rift-database**
2. Copy the **Endpoint** (looks like: `rift-database.xxxxxxx.us-east-1.rds.amazonaws.com`)
3. **Save this!** You'll need it for the backend configuration.

---

## 🔧 PART 2: Backend Setup (Go Server on EC2)

### Step 2.1: Launch EC2 Instance for Backend

1. **Go to EC2** → **Launch Instance**

2. **Name and Tags:**
   - Name: `rift-backend-server`

3. **Application and OS Images:**
   - AMI: **Ubuntu Server 22.04 LTS**
   - Architecture: **64-bit (x86)**

4. **Instance Type:**
   - **Free tier:** t3.micro
   - **Production:** t3.small or t3.medium

5. **Key Pair:**
   - Create new key pair OR select existing
   - Name: `rift-backend-key`
   - Type: **RSA**
   - Format: **.pem** (for Mac/Linux) or **.ppk** (for Windows/PuTTY)
   - **Download and save securely!**

6. **Network Settings:**
   - VPC: **Same as RDS** (default)
   - Subnet: **Any public subnet**
   - Auto-assign public IP: **Enable**
   
   **Security Group:**
   - Create new: `rift-backend-sg`
   - Allow:
     - SSH (22) from **Your IP**
     - HTTP (80) from **Anywhere** (0.0.0.0/0)
     - HTTPS (443) from **Anywhere** (0.0.0.0/0)
     - Custom TCP (8080) from **VPC CIDR** (for internal API)

7. **Storage:**
   - 20 GB gp3 (free tier: 8 GB)

8. **Click:** `Launch instance`

### Step 2.2: Configure Database Security Group

Allow backend to connect to database:

1. **Go to RDS** → **rift-database** → **Security** tab
2. Click the security group (`rift-database-sg`)
3. **Edit inbound rules** → **Add rule:**
   - Type: **PostgreSQL**
   - Port: **5432**
   - Source: **Security group** → Select `rift-backend-sg`
   - Description: `Allow backend access`
4. **Save rules**

### Step 2.3: Connect to Backend EC2

```bash
# From your local Mac terminal
chmod 400 ~/Downloads/rift-backend-key.pem
ssh -i ~/Downloads/rift-backend-key.pem ubuntu@<BACKEND-PUBLIC-IP>
```

Replace `<BACKEND-PUBLIC-IP>` with your EC2 public IP from AWS console.

### Step 2.4: Install Go and Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Go 1.21
wget https://go.dev/dl/go1.21.6.linux-amd64.tar.gz
sudo rm -rf /usr/local/go
sudo tar -C /usr/local -xzf go1.21.6.linux-amd64.tar.gz

# Add to PATH
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
source ~/.bashrc

# Verify installation
go version

# Install PostgreSQL client (for testing)
sudo apt install postgresql-client -y

# Install git
sudo apt install git -y
```

### Step 2.5: Deploy Backend Code

```bash
# Create app directory
sudo mkdir -p /opt/rift-backend
sudo chown ubuntu:ubuntu /opt/rift-backend
cd /opt/rift-backend

# Upload your backend code
# From your LOCAL terminal (new window):
scp -i ~/Downloads/rift-backend-key.pem -r /Users/saiyam0211/Documents/RIFT/backend/* ubuntu@<BACKEND-PUBLIC-IP>:/opt/rift-backend/
```

Back on the server:

```bash
cd /opt/rift-backend

# Create .env file
nano .env
```

Paste (update with your values):

```env
# Database
DB_HOST=rift-database.xxxxxxx.us-east-1.rds.amazonaws.com
DB_PORT=5432
DB_USER=riftadmin
DB_PASSWORD=your_rds_password_here
DB_NAME=rift_hackathon
DB_SSLMODE=require

# Server
PORT=8080
GIN_MODE=release

# SMTP (Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Other configs
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

Save (`Ctrl+X`, `Y`, `Enter`).

### Step 2.6: Run Database Migrations

```bash
# Test database connection
psql -h rift-database.xxxxxxx.us-east-1.rds.amazonaws.com -U riftadmin -d rift_hackathon

# If connected successfully, exit with \q

# Run migrations
cd /opt/rift-backend
go run cmd/migrate/main.go
```

### Step 2.7: Build and Run Backend

```bash
# Build the binary
cd /opt/rift-backend
go build -o rift-server cmd/api/main.go

# Test run
./rift-server
```

If it starts successfully (you'll see "Server running on :8080"), press `Ctrl+C` to stop.

### Step 2.8: Setup as System Service (PM2 or Systemd)

**Option A: Using systemd (Recommended)**

```bash
sudo nano /etc/systemd/system/rift-backend.service
```

Paste:

```ini
[Unit]
Description=RIFT Backend API
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/rift-backend
EnvironmentFile=/opt/rift-backend/.env
ExecStart=/opt/rift-backend/rift-server
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Save and enable:

```bash
sudo systemctl daemon-reload
sudo systemctl enable rift-backend
sudo systemctl start rift-backend
sudo systemctl status rift-backend
```

### Step 2.9: Setup Nginx Reverse Proxy

```bash
# Install nginx
sudo apt install nginx -y

# Create nginx config
sudo nano /etc/nginx/sites-available/rift-backend
```

Paste:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;  # Or use EC2 IP for now

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable and restart:

```bash
sudo ln -s /etc/nginx/sites-available/rift-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

✅ **Backend is now running!** Test it: `curl http://<BACKEND-PUBLIC-IP>/api/v1/health`

---

## 🌐 PART 3: Frontend Setup (Next.js on EC2)

### Step 3.1: Launch EC2 Instance for Frontend

Same as backend setup, but:
- Name: `rift-frontend-server`
- Key pair: `rift-frontend-key` (or reuse backend key)
- Security group: `rift-frontend-sg`
  - Allow SSH (22), HTTP (80), HTTPS (443)

### Step 3.2: Connect and Install Node.js

```bash
ssh -i ~/Downloads/rift-frontend-key.pem ubuntu@<FRONTEND-PUBLIC-IP>

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install pnpm
sudo npm install -g pnpm

# Verify
node -v  # Should be v20.x
pnpm -v
```

### Step 3.3: Deploy Frontend Code

```bash
# Create directory
sudo mkdir -p /opt/rift-frontend
sudo chown ubuntu:ubuntu /opt/rift-frontend

# From LOCAL terminal:
cd /Users/saiyam0211/Documents/RIFT/frontend

# Build first
pnpm build

# Upload
scp -i ~/Downloads/rift-frontend-key.pem -r .next package.json pnpm-lock.yaml next.config.ts public ubuntu@<FRONTEND-PUBLIC-IP>:/opt/rift-frontend/
```

### Step 3.4: Install Dependencies and Start

On the server:

```bash
cd /opt/rift-frontend

# Create .env.local
nano .env.local
```

Paste:

```env
NEXT_PUBLIC_API_URL=http://<BACKEND-PUBLIC-IP>/api/v1
```

(Later change to `https://api.yourdomain.com/api/v1`)

```bash
# Install production dependencies
pnpm install --prod

# Test run
pnpm start
```

If works, press `Ctrl+C`.

### Step 3.5: Setup PM2 Process Manager

```bash
# Install PM2
sudo npm install -g pm2

# Start app
pm2 start pnpm --name "rift-frontend" -- start

# Auto-start on boot
pm2 startup systemd
# Run the command it outputs

pm2 save
```

### Step 3.6: Configure Nginx

```bash
sudo apt install nginx -y

sudo nano /etc/nginx/sites-available/rift-frontend
```

Paste:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Next.js hackathon app
    location /hackathon {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Landing page - serve from /var/www/rift
    location / {
        root /var/www/rift;
        try_files $uri $uri/ /index.html;
    }
}
```

Enable:

```bash
sudo ln -s /etc/nginx/sites-available/rift-frontend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 📄 PART 4: Landing Page Setup (S3 + CloudFront)

### Step 4.1: Create S3 Bucket

1. **Go to S3** → **Create bucket**
2. **Bucket name:** `rift-landing-page` (must be globally unique)
3. **Region:** `us-east-1` (or your preferred region)
4. **Block Public Access:** UNCHECK all (we'll use CloudFront)
5. **Click:** Create bucket

### Step 4.2: Upload Landing Files

**From your local terminal:**

```bash
# Install AWS CLI if not installed
brew install awscli

# Configure AWS CLI
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Default region: us-east-1
# Default output format: json

# Upload landing files
cd /Users/saiyam0211/Documents/RIFT
aws s3 sync landing/ s3://rift-landing-page/ --exclude ".git/*" --exclude ".DS_Store"
```

### Step 4.3: Enable Static Website Hosting

1. **Go to S3** → **rift-landing-page** → **Properties**
2. Scroll to **Static website hosting**
3. **Enable** → **Host a static website**
4. Index document: `index.html`
5. Error document: `index.html`
6. **Save**

### Step 4.4: Create CloudFront Distribution

1. **Go to CloudFront** → **Create distribution**

2. **Origin Settings:**
   - Origin domain: Select your S3 bucket
   - Origin access: **Origin access control** (recommended)
   - Create new OAC → Create

3. **Default Cache Behavior:**
   - Viewer protocol policy: **Redirect HTTP to HTTPS**
   - Allowed HTTP methods: **GET, HEAD**
   - Cache policy: **CachingOptimized**

4. **Settings:**
   - Price class: **Use all edge locations** (or choose based on budget)
   - Alternate domain names (CNAMEs): `yourdomain.com` (if you have a domain)
   - SSL certificate: **Request certificate** (if using custom domain)

5. **Default root object:** `index.html`

6. **Click:** Create distribution

⏱️ **Wait 10-20 minutes** for distribution to deploy.

### Step 4.5: Update S3 Bucket Policy

After CloudFront is created, update S3 policy:

1. **CloudFront** → Your distribution → Copy Distribution ID
2. **S3** → **rift-landing-page** → **Permissions** → **Bucket Policy**

Paste:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowCloudFrontServicePrincipal",
            "Effect": "Allow",
            "Principal": {
                "Service": "cloudfront.amazonaws.com"
            },
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::rift-landing-page/*",
            "Condition": {
                "StringEquals": {
                    "AWS:SourceArn": "arn:aws:cloudfront::YOUR_ACCOUNT_ID:distribution/YOUR_DISTRIBUTION_ID"
                }
            }
        }
    ]
}
```

Replace `YOUR_ACCOUNT_ID` and `YOUR_DISTRIBUTION_ID`.

---

## 🌍 PART 5: Domain Configuration (Route 53)

### Step 5.1: Create Hosted Zone

1. **Go to Route 53** → **Create hosted zone**
2. Domain name: `yourdomain.com`
3. Type: **Public hosted zone**
4. **Create**

### Step 5.2: Create DNS Records

**For Landing (CloudFront):**

1. **Create record**
2. Record name: (leave blank for root) or `www`
3. Record type: **A - IPv4 address**
4. Alias: **Yes**
5. Route traffic to: **CloudFront distribution**
6. Choose your distribution
7. **Create**

**For Frontend (EC2):**

1. **Create record**
2. Record name: `app`
3. Record type: **A - IPv4 address**
4. Value: `<FRONTEND-PUBLIC-IP>`
5. **Create**

**For Backend (EC2):**

1. **Create record**
2. Record name: `api`
3. Record type: **A - IPv4 address**
4. Value: `<BACKEND-PUBLIC-IP>`
5. **Create**

### Step 5.3: Update Nameservers

Copy the 4 nameservers from Route 53 and update them in your domain registrar (GoDaddy, etc.).

---

## 🔒 PART 6: SSL/HTTPS Setup (Certificate Manager)

### Step 6.1: Request SSL Certificate

1. **Go to Certificate Manager** (in `us-east-1` region for CloudFront)
2. **Request certificate** → **Request a public certificate**
3. **Domain names:**
   - `yourdomain.com`
   - `*.yourdomain.com` (wildcard for subdomains)
4. Validation: **DNS validation**
5. **Request**

### Step 6.2: Validate Certificate

1. Click **Create records in Route 53**
2. **Create records**
3. Wait 5-30 minutes for validation

### Step 6.3: Attach to CloudFront

1. **CloudFront** → Your distribution → **Edit**
2. **Alternate domain names:** `yourdomain.com, www.yourdomain.com`
3. **Custom SSL certificate:** Select your certificate
4. **Save changes**

### Step 6.4: Setup SSL on EC2 (Certbot)

**On Frontend EC2:**

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get certificate
sudo certbot --nginx -d app.yourdomain.com

# Auto-renewal is set up automatically
```

**On Backend EC2:**

```bash
sudo certbot --nginx -d api.yourdomain.com
```

---

## 📊 PART 7: Monitoring & Logging

### Step 7.1: Enable CloudWatch

**For EC2:**
```bash
# Install CloudWatch agent
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i amazon-cloudwatch-agent.deb
```

**For RDS:**
- Already enabled by default

### Step 7.2: Set Up Alarms

1. **CloudWatch** → **Alarms** → **Create alarm**
2. Create alarms for:
   - High CPU usage (>80%)
   - Low disk space (<20%)
   - Database connections

---

## 🔄 PART 8: Deployment Automation

### Step 8.1: Create Deployment Script

**On your local machine:**

```bash
nano /Users/saiyam0211/Documents/RIFT/deploy-to-aws.sh
```

Paste:

```bash
#!/bin/bash

echo "🚀 Deploying RIFT to AWS..."

# Backend
echo "📦 Deploying Backend..."
cd /Users/saiyam0211/Documents/RIFT/backend
ssh -i ~/Downloads/rift-backend-key.pem ubuntu@<BACKEND-IP> "cd /opt/rift-backend && git pull && go build -o rift-server cmd/api/main.go && sudo systemctl restart rift-backend"

# Frontend
echo "🎨 Deploying Frontend..."
cd /Users/saiyam0211/Documents/RIFT/frontend
pnpm build
scp -i ~/Downloads/rift-frontend-key.pem -r .next ubuntu@<FRONTEND-IP>:/opt/rift-frontend/
ssh -i ~/Downloads/rift-frontend-key.pem ubuntu@<FRONTEND-IP> "cd /opt/rift-frontend && pm2 restart rift-frontend"

# Landing
echo "📄 Deploying Landing..."
cd /Users/saiyam0211/Documents/RIFT
aws s3 sync landing/ s3://rift-landing-page/ --delete --exclude ".git/*"
aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths "/*"

echo "✅ Deployment complete!"
```

Make executable:

```bash
chmod +x /Users/saiyam0211/Documents/RIFT/deploy-to-aws.sh
```

---

## ✅ Testing Your Deployment

Visit these URLs:

1. **Landing:** `https://yourdomain.com`
2. **Frontend:** `https://app.yourdomain.com/hackathon`
3. **Backend:** `https://api.yourdomain.com/api/v1/health`

---

## 💰 Cost Optimization Tips

1. **Use Reserved Instances** for long-term (1-3 years) to save 30-70%
2. **Enable Auto Scaling** to scale up/down based on traffic
3. **Use S3 Intelligent-Tiering** for landing page assets
4. **Set up CloudWatch billing alarms** to avoid surprises
5. **Use RDS Read Replicas** only if needed

**Expected Monthly Costs:**
- RDS t3.micro: ~$15
- EC2 t3.small x2: ~$30
- S3 + CloudFront: ~$5
- Data transfer: ~$10
- **Total: ~$60-70/month**

---

## 🆘 Troubleshooting

### Backend won't connect to database
- Check security group rules
- Verify database endpoint
- Check .env file

### Frontend 502 Bad Gateway
- Check if PM2 is running: `pm2 status`
- Check logs: `pm2 logs rift-frontend`
- Restart: `pm2 restart rift-frontend`

### Landing page not accessible
- Check CloudFront distribution status
- Verify S3 bucket policy
- Check DNS propagation

---

## 📞 Quick Commands

**Check Backend Status:**
```bash
ssh -i ~/Downloads/rift-backend-key.pem ubuntu@<BACKEND-IP>
sudo systemctl status rift-backend
journalctl -u rift-backend -f
```

**Check Frontend Status:**
```bash
ssh -i ~/Downloads/rift-frontend-key.pem ubuntu@<FRONTEND-IP>
pm2 status
pm2 logs rift-frontend
```

**Update Landing:**
```bash
aws s3 sync landing/ s3://rift-landing-page/
aws cloudfront create-invalidation --distribution-id YOUR_ID --paths "/*"
```

---

## 🎉 You're Live on AWS!

Your complete stack is now running on AWS with:
- ✅ Scalable database (RDS)
- ✅ Reliable backend (EC2 + systemd)
- ✅ Fast frontend (EC2 + PM2)
- ✅ Global landing page (S3 + CloudFront)
- ✅ SSL/HTTPS everywhere
- ✅ Professional domain

**Next Steps:**
1. Set up monitoring and alerts
2. Configure automated backups
3. Implement CI/CD pipeline (optional)
4. Load testing before launch

Good luck! 🚀
