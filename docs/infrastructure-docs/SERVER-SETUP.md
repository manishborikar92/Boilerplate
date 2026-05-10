# Server Setup and Configuration

## Overview

This guide covers general server setup tasks including firewall configuration, Docker installation, and security hardening. These steps apply to any Linux server (Ubuntu, Debian, etc.) regardless of the hosting provider.

**Time:** 15-20 minutes

---

## Prerequisites

- Linux server (Ubuntu 20.04+ or Debian 10+ recommended)
- Root or sudo access
- Public IP address
- SSH access to the server

---

## Part 1: Initial Server Access

### Step 1.1: Connect via SSH

```bash
ssh username@<SERVER_IP>
```

Replace `<SERVER_IP>` with your server's public IP address.

### Step 1.2: Update System Packages

```bash
sudo apt update
sudo apt upgrade -y
```

**Time:** 2-5 minutes

---

## Part 2: Configure Firewall (iptables)

### Step 2.1: Install iptables-persistent

```bash
sudo apt install -y iptables-persistent
```

This ensures firewall rules persist across reboots.

### Step 2.2: Configure IPv4 Rules

```bash
# Allow established connections
sudo iptables -I INPUT 1 -m state --state ESTABLISHED,RELATED -j ACCEPT

# Allow loopback
sudo iptables -I INPUT 2 -i lo -j ACCEPT

# Allow SSH (port 22)
sudo iptables -I INPUT 3 -p tcp --dport 22 -j ACCEPT

# Allow HTTP (port 80)
sudo iptables -I INPUT 4 -p tcp --dport 80 -j ACCEPT

# Allow HTTPS (port 443)
sudo iptables -I INPUT 5 -p tcp --dport 443 -j ACCEPT

# Allow custom application port (e.g., 8000 for Coolify)
sudo iptables -I INPUT 6 -p tcp --dport 8000 -j ACCEPT

# Set default policies
sudo iptables -P INPUT DROP
sudo iptables -P FORWARD DROP
sudo iptables -P OUTPUT ACCEPT
```

### Step 2.3: Configure IPv6 Rules

```bash
# Allow established connections
sudo ip6tables -I INPUT 1 -m state --state ESTABLISHED,RELATED -j ACCEPT

# Allow loopback
sudo ip6tables -I INPUT 2 -i lo -j ACCEPT

# Allow SSH (port 22)
sudo ip6tables -I INPUT 3 -p tcp --dport 22 -j ACCEPT

# Allow HTTP (port 80)
sudo ip6tables -I INPUT 4 -p tcp --dport 80 -j ACCEPT

# Allow HTTPS (port 443)
sudo ip6tables -I INPUT 5 -p tcp --dport 443 -j ACCEPT

# Allow custom application port (e.g., 8000)
sudo ip6tables -I INPUT 6 -p tcp --dport 8000 -j ACCEPT

# Set default policies
sudo ip6tables -P INPUT DROP
sudo ip6tables -P FORWARD DROP
sudo ip6tables -P OUTPUT ACCEPT
```

### Step 2.4: Save Firewall Rules

```bash
# Save IPv4 rules
sudo iptables-save | sudo tee /etc/iptables/rules.v4 > /dev/null

# Save IPv6 rules
sudo ip6tables-save | sudo tee /etc/iptables/rules.v6 > /dev/null
```

### Step 2.5: Verify Rules

```bash
# Check IPv4 rules
sudo iptables -L -n -v

# Check IPv6 rules
sudo ip6tables -L -n -v
```

**Time:** 5 minutes

---

## Part 3: Install Docker

### Step 3.1: Install Docker

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

### Step 3.2: Add User to Docker Group

```bash
sudo usermod -aG docker $USER
```

Log out and back in for this to take effect, or run:

```bash
newgrp docker
```

### Step 3.3: Verify Docker Installation

```bash
docker --version
docker compose version
```

Expected output:
```
Docker version 24.x.x
Docker Compose version v2.x.x
```

**Time:** 3-5 minutes

---

## Part 4: Security Hardening

### Step 4.1: Configure SSH

Edit SSH configuration:

```bash
sudo nano /etc/ssh/sshd_config
```

Recommended settings:

```
# Disable root login
PermitRootLogin no

# Disable password authentication (use SSH keys only)
PasswordAuthentication no

# Allow only specific users (optional)
AllowUsers your_username

# Change default SSH port (optional, for additional security)
# Port 2222
```

Restart SSH service:

```bash
sudo systemctl restart sshd
```

### Step 4.2: Install Fail2Ban

Protect against brute-force attacks:

```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### Step 4.3: Enable Automatic Security Updates

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

**Time:** 5 minutes

---

## Part 5: Optional Enhancements

### Step 5.1: Install Monitoring Tools

```bash
# htop - Interactive process viewer
sudo apt install -y htop

# ncdu - Disk usage analyzer
sudo apt install -y ncdu

# netstat - Network statistics
sudo apt install -y net-tools
```

### Step 5.2: Configure Swap (if needed)

For servers with limited RAM:

```bash
# Create 2GB swap file
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Step 5.3: Set Timezone

```bash
sudo timedatectl set-timezone America/New_York
```

Replace with your timezone. List available timezones:

```bash
timedatectl list-timezones
```

**Time:** 5 minutes

---

## Part 6: Static IP Configuration (Cloud Provider Specific)

### For Cloud Providers with Reserved IPs

Most cloud providers (AWS, DigitalOcean, Oracle Cloud, etc.) allow you to reserve a static IP address through their console. This prevents your IP from changing if the server is stopped/restarted.

**General steps:**
1. Go to your cloud provider's console
2. Navigate to networking or IP management section
3. Reserve/allocate a new public IP address
4. Attach the reserved IP to your server instance
5. Update DNS records to point to the new static IP

**Benefits:**
- IP address persists across server restarts
- No need to update DNS records after maintenance
- More reliable for production deployments

---

## Verification Checklist

Before proceeding to application deployment, verify:

- [ ] Server is accessible via SSH
- [ ] System packages are up to date
- [ ] Firewall rules are configured and saved
- [ ] Ports 22, 80, 443 are open
- [ ] Docker is installed and working
- [ ] Docker Compose is available
- [ ] SSH is hardened (optional but recommended)
- [ ] Fail2Ban is running (optional but recommended)
- [ ] Static IP is configured (if applicable)

---

## Common Firewall Ports

| Port | Service | Purpose |
|------|---------|---------|
| 22 | SSH | Remote server access |
| 80 | HTTP | Web traffic (unencrypted) |
| 443 | HTTPS | Web traffic (encrypted) |
| 8000 | Coolify | Application management dashboard |
| 3000 | Node.js | Common development server port |
| 5432 | PostgreSQL | Database (internal only, don't expose) |
| 6379 | Redis | Cache (internal only, don't expose) |
| 27017 | MongoDB | Database (internal only, don't expose) |

**Security Note:** Only expose ports that need to be publicly accessible. Database ports should only be accessible internally (via Docker networks or localhost).

---

## Troubleshooting

### Can't Connect After Firewall Configuration

**Problem:** SSH connection lost after configuring firewall

**Solution:**
1. If you have console access (cloud provider), use it to connect
2. Check if SSH rule was added correctly:
   ```bash
   sudo iptables -L -n | grep 22
   ```
3. If rule is missing, add it:
   ```bash
   sudo iptables -I INPUT 3 -p tcp --dport 22 -j ACCEPT
   sudo iptables-save | sudo tee /etc/iptables/rules.v4 > /dev/null
   ```

### Docker Commands Require Sudo

**Problem:** Need to use `sudo` for every Docker command

**Solution:**
1. Add user to docker group:
   ```bash
   sudo usermod -aG docker $USER
   ```
2. Log out and back in, or run:
   ```bash
   newgrp docker
   ```

### Firewall Rules Don't Persist After Reboot

**Problem:** Firewall rules are lost after server restart

**Solution:**
1. Install iptables-persistent:
   ```bash
   sudo apt install -y iptables-persistent
   ```
2. Save rules:
   ```bash
   sudo iptables-save | sudo tee /etc/iptables/rules.v4 > /dev/null
   sudo ip6tables-save | sudo tee /etc/iptables/rules.v6 > /dev/null
   ```

### Port Already in Use

**Problem:** Application can't bind to port (e.g., 80 or 443)

**Solution:**
1. Check what's using the port:
   ```bash
   sudo lsof -i :80
   sudo lsof -i :443
   ```
2. Stop the conflicting service or choose a different port

---

## Quick Reference Commands

### Firewall Management

```bash
# View current rules
sudo iptables -L -n -v

# Add a new port
sudo iptables -I INPUT 7 -p tcp --dport <PORT> -j ACCEPT
sudo iptables-save | sudo tee /etc/iptables/rules.v4 > /dev/null

# Remove a rule (by line number)
sudo iptables -D INPUT <LINE_NUMBER>
sudo iptables-save | sudo tee /etc/iptables/rules.v4 > /dev/null

# Flush all rules (DANGEROUS - will lock you out if done remotely)
sudo iptables -F
```

### Docker Management

```bash
# View running containers
docker ps

# View all containers
docker ps -a

# View Docker images
docker images

# Remove unused containers and images
docker system prune -a

# View Docker logs
docker logs <container_name>

# Restart a container
docker restart <container_name>
```

### System Monitoring

```bash
# CPU and memory usage
htop

# Disk usage
df -h
ncdu /

# Network connections
netstat -tulpn

# System logs
sudo journalctl -f
```

---

## Next Steps

After completing server setup:

1. **Configure DNS** - Point your domain to the server
   - See [CLOUDFLARE-SETUP.md](CLOUDFLARE-SETUP.md) for Cloudflare configuration

2. **Deploy Applications** - Install Coolify or deploy directly with Docker
   - See [COOLIFY-SETUP.md](COOLIFY-SETUP.md) for application deployment

3. **Set Up Monitoring** - Configure uptime monitoring and alerts

4. **Configure Backups** - Set up automated backups for databases and important data

---

## Summary

You've successfully configured:
- ✅ Firewall with iptables (IPv4 + IPv6)
- ✅ Docker and Docker Compose
- ✅ SSH hardening (optional)
- ✅ Fail2Ban protection (optional)
- ✅ Automatic security updates (optional)

Your server is now ready for application deployment!

---

**Cost:** Varies by provider (Oracle Cloud: $0/month, DigitalOcean: ~$6/month, AWS: ~$10/month)

**Security Level:** Production-ready with recommended hardening applied
