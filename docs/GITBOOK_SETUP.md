# Gitbook Setup Guide

This guide explains how to host the SolixDB API documentation at `docs.solixdb.xyz` using Gitbook.

## Option 1: Gitbook Cloud (Recommended)

### Step 1: Create Gitbook Account

1. Go to [gitbook.com](https://www.gitbook.com)
2. Sign up for an account (free tier available)
3. Verify your email address

### Step 2: Create a New Space

1. Click **"Create a new space"**
2. Choose **"Import from GitHub"** or **"Start from scratch"**
3. If importing from GitHub:
   - Connect your GitHub account
   - Select the repository containing the `docs/` folder
   - Choose the branch (usually `main` or `master`)
   - Set the root path to `docs/`

### Step 3: Configure Gitbook Space

1. Go to **Space Settings** → **Integrations**
2. Enable **GitHub integration** if not already enabled
3. Configure the sync:
   - **Repository**: Your repository
   - **Branch**: `main` or `master`
   - **Root path**: `docs/`
   - **Auto-sync**: Enable for automatic updates

### Step 4: Configure Custom Domain

1. Go to **Space Settings** → **Domain**
2. Click **"Add custom domain"**
3. Enter `docs.solixdb.xyz`
4. Gitbook will provide DNS records to add:
   - **CNAME record**: Point `docs.solixdb.xyz` to `gitbook.io`
   - Or **A record**: Use the provided IP addresses

### Step 5: Configure DNS

Add the following DNS records to your domain provider (e.g., Cloudflare, Route53):

**Option A: CNAME (Recommended)**
```
Type: CNAME
Name: docs
Value: gitbook.io
TTL: 3600
```

**Option B: A Record**
```
Type: A
Name: docs
Value: [IP addresses provided by Gitbook]
TTL: 3600
```

### Step 6: SSL Certificate

1. Gitbook automatically provisions SSL certificates via Let's Encrypt
2. Wait 5-10 minutes for DNS propagation
3. SSL will be automatically configured

### Step 7: Verify Setup

1. Visit `https://docs.solixdb.xyz`
2. Verify the documentation loads correctly
3. Check that all pages are accessible

## Option 2: Gitbook CLI (Self-Hosted)

If you prefer to self-host, you can use Gitbook CLI:

### Step 1: Install Gitbook CLI

```bash
npm install -g gitbook-cli
```

### Step 2: Build Documentation

```bash
cd docs
gitbook install
gitbook build
```

### Step 3: Serve Locally (for testing)

```bash
gitbook serve
```

### Step 4: Deploy to Server

You can deploy the built files (`_book/` directory) to any static hosting service:

- **Nginx**: Serve the `_book/` directory
- **Netlify**: Deploy the `_book/` folder
- **Vercel**: Deploy the `_book/` folder
- **AWS S3 + CloudFront**: Upload and serve

## Option 3: GitHub Pages Integration

Gitbook can also integrate with GitHub Pages:

1. In Gitbook Space Settings → **Integrations** → **GitHub Pages**
2. Enable GitHub Pages integration
3. Gitbook will automatically build and deploy to GitHub Pages
4. Configure custom domain in GitHub repository settings

## Gitbook Configuration

The `.gitbook.yaml` file is already configured:

```yaml
root: ./

structure:
  readme: README.md
  summary: SUMMARY.md
```

### Additional Configuration Options

You can enhance `.gitbook.yaml` with:

```yaml
root: ./

structure:
  readme: README.md
  summary: SUMMARY.md

plugins:
  - search
  - sharing
  - fontsettings
  - theme-default

pluginsConfig:
  sharing:
    facebook: true
    twitter: true
    google: false
    weibo: false
    instapaper: false
    vk: false
    all:
      - facebook
      - twitter
      - google
      - weibo
      - instapaper
      - vk

theme:
  default:
    showLevel: true
```

## Continuous Integration

### GitHub Actions Workflow

Create `.github/workflows/gitbook.yml`:

```yaml
name: Deploy to Gitbook

on:
  push:
    branches:
      - main
    paths:
      - 'docs/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install Gitbook CLI
        run: npm install -g gitbook-cli
      
      - name: Build Gitbook
        run: |
          cd docs
          gitbook install
          gitbook build
      
      - name: Deploy to Gitbook
        # Add your deployment step here
        # This depends on your hosting method
```

## Troubleshooting

### DNS Issues

- **Problem**: Domain not resolving
- **Solution**: 
  - Wait 24-48 hours for DNS propagation
  - Verify DNS records are correct using `dig docs.solixdb.xyz`
  - Check domain provider DNS settings

### SSL Certificate Issues

- **Problem**: SSL certificate not provisioning
- **Solution**:
  - Ensure DNS is correctly configured
  - Wait for Gitbook's automatic SSL provisioning (can take up to 24 hours)
  - Contact Gitbook support if issues persist

### Content Not Updating

- **Problem**: Changes not reflected on live site
- **Solution**:
  - Check GitHub integration sync status
  - Manually trigger sync in Gitbook settings
  - Verify root path is set to `docs/`

### Build Errors

- **Problem**: Gitbook build fails
- **Solution**:
  - Check `.gitbook.yaml` syntax
  - Verify all markdown files are valid
  - Check for broken links using `gitbook serve` locally

## Best Practices

1. **Version Control**: Keep all docs in Git for version control
2. **Auto-sync**: Enable auto-sync with GitHub for automatic updates
3. **Preview**: Use Gitbook's preview feature before publishing
4. **Analytics**: Enable Gitbook analytics to track usage
5. **Search**: Ensure search plugin is enabled for better UX
6. **Mobile**: Test documentation on mobile devices

## Support

- **Gitbook Documentation**: [docs.gitbook.com](https://docs.gitbook.com)
- **Gitbook Community**: [community.gitbook.com](https://community.gitbook.com)
- **Gitbook Support**: support@gitbook.com

## Quick Reference

```bash
# Local development
cd docs
gitbook install
gitbook serve

# Build for production
gitbook build

# Deploy (if using CLI)
# Upload _book/ directory to your hosting service
```

## Next Steps

1. ✅ Documentation structure is ready
2. ⏳ Create Gitbook account
3. ⏳ Connect GitHub repository
4. ⏳ Configure custom domain
5. ⏳ Set up DNS records
6. ⏳ Verify SSL certificate
7. ⏳ Test documentation site

