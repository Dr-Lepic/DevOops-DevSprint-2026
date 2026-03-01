# DevSprint 2026: Day 5 Deployment & Verification Guide

This guide walks you through the steps that require external setup (AWS EC2, GitHub Actions) and manual verification for Chaos Engineering. 

---

## 1. Setting up GitHub Actions CI/CD
The CI/CD pipeline (`.github/workflows/ci.yml`) is fully written and automates build, unit testing, docker building, and system testing. 

### Steps:
1. Initialize a Git repository if you haven't already:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of complete Day 5 features"
   ```
2. Create a new repository on GitHub.
3. Link your local repo and push:
   ```bash
   git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
   git branch -M main
   git push -u origin main
   ```
4. Navigate to the **Actions** tab in your GitHub repository to watch the pipeline execute.

---

## 2. AWS EC2 Free Tier Deployment
We will deploy the 8-container architecture to a single AWS `t3.micro` or `t2.micro` EC2 instance.

### Step 2.1: Provision EC2 & Security Groups
1. Go to AWS EC2 Console, click "Launch Instance".
2. Name: **Cafeteria-Node**
3. OS: **Amazon Linux 2023 AMI** or **Ubuntu 24.04**.
4. Instance Type: `t3.micro` (Free Tier eligible).
5. Key Pair: Create or select an existing SSH key.
6. **Network Settings** (Very Important):
   - Check "Allow SSH traffic" (Port 22)
   - Check "Allow HTTP traffic" (Port 80)
   - Add Custom TCP rules in the Security Group for the following ports:
     - **3000** (Order Gateway)
     - **3001** (Identity Provider)
     - **3003** (Notification Hub)
     - **3004** (Student UI)
7. Launch the instance.

### Step 2.2: Connect and Install Docker
Find your public IP (e.g., `54.12.34.56`) in the EC2 console and SSH in:
```bash
ssh -i /path/to/your-key.pem ec2-user@YOUR_EC2_PUBLIC_IP
```

Install Docker and Git:
```bash
# Update packages
sudo dnf update -y  # (Use `sudo apt update` for Ubuntu)

# Install Docker & Git
sudo dnf install -y docker git
sudo systemctl enable docker
sudo systemctl start docker

# Add user to docker group (so no sudo needed)
sudo usermod -a -G docker ec2-user
```
*Logout and SSH back in for the docker group to take effect.*

Install Docker Compose:
```bash
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### Step 2.3: Clone and Prepare
```bash
git clone https://github.com/YOUR_USER/YOUR_REPO.git
cd YOUR_REPO
```

**Crucial Step:** The Student UI frontend accesses the backend directly from the user's browser. Therefore, you MUST change `localhost` to your EC2's Public IP in `docker-compose.yml`.
Open `docker-compose.yml` (`nano docker-compose.yml`) and under `student-ui`, update the URLs:
```yaml
    environment:
      NEXT_PUBLIC_GATEWAY_URL: http://YOUR_EC2_PUBLIC_IP:3000
      NEXT_PUBLIC_IDENTITY_URL: http://YOUR_EC2_PUBLIC_IP:3001
      NEXT_PUBLIC_HUB_URL: http://YOUR_EC2_PUBLIC_IP:3003
      NEXT_PUBLIC_KITCHEN_QUEUE_URL: http://localhost:3005 # Kept localhost because UI polling via server-side or frontend shouldn't cross public unless exposed. (Actually Admin UI polls this from client! Change to YOUR_EC2_PUBLIC_IP:3005 and ensure port 3005 is allowed in AWS!)
      NEXT_PUBLIC_STOCK_SERVICE_URL: http://YOUR_EC2_PUBLIC_IP:3002
```
*Make sure ports 3002 and 3005 are added to your AWS Security Group if the client (browser) needs to access them directly for the Admin dashboard.*

### Step 2.4: Deploy container network
```bash
docker-compose up --build -d
```
Visit `http://YOUR_EC2_PUBLIC_IP:3004/login` in your browser.

---

## 3. Testing Chaos Engineering

I have implemented a `ChaosMiddleware` in `order-gateway` and `stock-service`, and a random error throw mechanism in `kitchen-queue` to test the fault-tolerance of your microservices (like BullMQ retries and Gateway resilience).

### Enabling Chaos Mode
To turn this on locally or on EC2:
1. Open `docker-compose.yml`.
2. Change `CHAOS_ENABLED: "false"` to `"true"` under:
   - `order-gateway`
   - `stock-service`
   - `kitchen-queue`
3. Apply changes and restart:
   ```bash
   docker-compose up -d --force-recreate
   ```

### What to Observe
- **Order Gateway & Stock Service**:
  - 10% of requests will experience a random **2 to 5 second latency delay**.
  - *Result*: The UI alert banner will appear saying "Gateway responded in >1s".
  - 5% of requests will return an **instant 500 error**.
  - *Result*: The React UI will catch the error and show the error state, proving failure propagation.
- **Kitchen Queue Worker**:
  - 10% of job processing will deliberately `throw new Error('Chaos')` during cooking.
  - *Result*: You will see the job marked as "Failed", but BullMQ's exponential backoff retry mechanism will pick it up a few seconds later and successfully complete the order. The user at the student UI will still get their notification eventually.
