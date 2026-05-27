# GitHub Setup Guide for ZenFlow

## Step 1: Create the GitHub Repository

1. Go to **https://github.com/new**
2. Repository name: `zenflow`
3. Description: `ZenFlow — The open-source Zoho alternative. Everything Flows.`
4. Set to **Public** (or Private if you prefer)
5. ❌ Do NOT initialize with README (we already have one)
6. Click **Create repository**

## Step 2: Push Existing Code

The remote has already been configured. Run this in your terminal:

```powershell
cd C:\xampp\htdocs\Claude
git push -u origin master
```

If it asks for credentials, GitHub now uses Personal Access Tokens:
1. Go to **https://github.com/settings/tokens**
2. Generate new token (classic)
3. Select scopes: `repo`, `workflow`
4. Use the token as your password when prompted

## Step 3: Verify Auto-Push Hook

The `.claude/settings.json` has a **Stop hook** configured that will:
- Auto-commit any changes when Claude Code session ends
- Push to `origin master` automatically

You can verify it's working by checking the hook in Claude Code: `/hooks`

## Step 4: Branch Strategy (Recommended)

```bash
# Each phase gets its own branch
git checkout -b feat/phase-1-foundation
# ... work happens ...
git push origin feat/phase-1-foundation
# Merge to master when phase is complete
```

## Repository URL

https://github.com/ymohit65127/zenflow

---

> Auto-push is configured via the Stop hook in `.claude/settings.json`
