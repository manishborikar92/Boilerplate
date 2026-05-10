# Infrastructure & Server Setup Documentation

## Overview

This folder contains documentation for general infrastructure and server setup tasks that are independent of the OCI Hunter Bot project. These guides can be used for any server deployment, regardless of how the server was provisioned.

## Documentation Files

### DNS & Domain Configuration

- **[CLOUDFLARE-SETUP.md](CLOUDFLARE-SETUP.md)** - Complete guide for configuring DNS in Cloudflare
  - Setting up A records and wildcard domains
  - SSL/TLS configuration
  - Email service preservation (MX, TXT records)
  - Testing and production deployment strategies

### Application Deployment Platform

- **[COOLIFY-SETUP.md](COOLIFY-SETUP.md)** - Deploy websites and applications using Coolify
  - GitHub integration and auto-deploy
  - Deploying frontend applications (Next.js, React, Vue)
  - Deploying backend APIs (Node.js, Python, Go)
  - Database setup (PostgreSQL, MySQL, MongoDB, Redis)
  - SSL certificate management
  - Application monitoring and management

### Server Configuration

- **[SERVER-SETUP.md](SERVER-SETUP.md)** - General server setup and hardening
  - Firewall configuration (iptables)
  - Docker installation
  - Security best practices
  - Static IP configuration
  - SSH hardening

## When to Use This Documentation

These guides are applicable when you have:
- A Linux server (Ubuntu, Debian, etc.) from any provider
- Root or sudo access to the server
- A domain name you want to configure
- Applications you want to deploy

## Prerequisites

Before using these guides, you should have:
- A running Linux server with a public IP address
- SSH access to the server
- A domain name (for DNS configuration)
- Basic familiarity with command line operations

## Typical Workflow

1. **Server Setup** - Configure firewall, install Docker, secure SSH
2. **DNS Configuration** - Point your domain to the server
3. **Application Deployment** - Install Coolify and deploy your apps

## Independence from OCI Project

These documentation files are intentionally separated from the OCI Hunter Bot project because:
- They apply to any server, not just OCI instances
- They can be used as standalone references
- They may be converted into a separate repository in the future
- They focus on infrastructure rather than provisioning

## Related Project

This documentation was originally part of the [OCI Instance Creator](../) project, which automates the creation of Oracle Cloud ARM instances. If you need to provision a free ARM server from Oracle Cloud, refer to the main project documentation.

## Contributing

If you find issues or have improvements for these infrastructure guides, please note that they are maintained separately from the OCI provisioning project.

---

**Note**: This folder will eventually be converted into a separate repository for general infrastructure documentation.
