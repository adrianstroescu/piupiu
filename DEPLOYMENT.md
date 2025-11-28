# 🚀 Deployment Guide to Vercel

## Prerequisites
- GitHub account
- Vercel account (free at https://vercel.com)

## Step-by-Step Deployment

### 1. Push to GitHub

Your code is already committed locally. Now push it to GitHub:

```bash
# Create a new repository on GitHub (https://github.com/new)
# Name it something like "multiplayer-car-shooter"
# Don't initialize with README

# Then run these commands:
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

### 2. Deploy to Vercel

**Option A: Using Vercel Website (Easiest)**

1. Go to https://vercel.com and sign up/login
2. Click "Add New..." → "Project"
3. Import your GitHub repository
4. Vercel will auto-detect the settings
5. Click "Deploy"
6. Wait 1-2 minutes for deployment to complete
7. Your game will be live at: `https://your-project-name.vercel.app`

**Option B: Using Vercel CLI**

```bash
# Install Vercel CLI globally
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# Follow the prompts:
# - Set up and deploy? Y
# - Which scope? (select your account)
# - Link to existing project? N
# - Project name? (press enter or type a name)
# - Directory? ./ (press enter)
# - Override settings? N

# Deploy to production
vercel --prod
```

### 3. Share Your Game!

Once deployed, you'll get a URL like:
`https://your-project-name.vercel.app`

Share this with friends to play together!

## ⚠️ Important Notes

1. **Socket.IO on Vercel**: Socket.IO works on Vercel but has limitations:
   - Each serverless function has a 10-second timeout
   - For better performance, consider upgrading to Vercel Pro or use a dedicated hosting service

2. **Environment**: Vercel automatically detects Node.js and installs dependencies

3. **Custom Domain** (Optional): You can add a custom domain in Vercel settings

## 🎮 Playing Multiplayer

1. Open your Vercel URL in multiple browser tabs
2. Each tab represents a different player
3. You'll see other players as red cars
4. Shoot the Alexa NPCs and compete!

## 🐛 Troubleshooting

If deployment fails:
- Check that all files are committed: `git status`
- Verify package.json has all dependencies
- Check Vercel deployment logs in the dashboard
- Make sure vercel.json is properly configured

## 📝 Local Testing

Before deploying, test locally:
```bash
npm start
```
Open http://localhost:3000 in multiple browser tabs

---

Need help? Check:
- Vercel Docs: https://vercel.com/docs
- Socket.IO Docs: https://socket.io/docs/
