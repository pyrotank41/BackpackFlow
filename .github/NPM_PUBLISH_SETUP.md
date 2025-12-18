# npm Publishing Workflow Setup Guide

This guide explains how to set up automatic npm publishing when you create a GitHub Release.

---

## 🎯 Workflow Overview

```
1. Update version in package.json
2. Commit & push to main
3. Create GitHub Release with tag
   └─> Triggers GitHub Action
       ├─ ✅ Run all 237 tests
       ├─ ✅ Build package
       ├─ ✅ Validate version matches tag
       ├─ ✅ Verify build output
       └─ 🚀 Publish to npm
```

---

## 🔐 One-Time Setup: npm Token

### Step 1: Generate npm Token

1. **Login to npm:**
   ```bash
   npm login
   ```

2. **Generate an Automation Token:**
   - Go to [npmjs.com](https://www.npmjs.com/)
   - Click your profile → "Access Tokens"
   - Click "Generate New Token" → "Classic Token"
   - Select **"Automation"** (required for CI/CD)
   - Give it a name: `BackpackFlow-GitHub-Actions`
   - Copy the token (starts with `npm_...`)

### Step 2: Add Token to GitHub Secrets

1. **Go to your GitHub repository:**
   - Navigate to: `https://github.com/pyrotank41/Backpackflow`

2. **Add the secret:**
   - Go to **Settings** → **Secrets and variables** → **Actions**
   - Click **"New repository secret"**
   - Name: `NPM_TOKEN`
   - Value: Paste your npm token
   - Click **"Add secret"**

✅ **Setup complete!** The workflow will now be able to publish to npm.

---

## 📦 How to Release a New Version

### The Simple 3-Step Process

```bash
# Step 1: Bump version (updates package.json, creates commit & tag)
npm version major  # or minor, or patch

# Step 2: Push to GitHub (including tags)
git push origin main --follow-tags

# Step 3: Create GitHub Release from tag (triggers workflow)
gh release create v2.0.0 --generate-notes
# OR use GitHub UI: https://github.com/pyrotank41/Backpackflow/releases/new
```

That's it! The GitHub Action will automatically test, build, and publish to npm.

---

### Detailed Step-by-Step Guide

#### Step 1: Use `npm version` to Bump Version

The `npm version` command handles everything automatically:

```bash
# For breaking changes (1.3.0 → 2.0.0)
npm version major -m "chore: release v%s"

# For new features (2.0.0 → 2.1.0)
npm version minor -m "chore: release v%s"

# For bug fixes (2.0.0 → 2.0.1)
npm version patch -m "chore: release v%s"
```

**What this does:**
- ✅ Updates `package.json` version
- ✅ Creates a git commit with message `"chore: release vX.Y.Z"`
- ✅ Creates a git tag (e.g., `v2.0.0`)
- ✅ All in one command!

#### Step 2: Push to GitHub

```bash
# Push commits AND tags to GitHub
git push origin main --follow-tags
```

**Important:** The `--follow-tags` flag pushes the version tag to GitHub.

#### Step 3: Create GitHub Release

**Option A: Using GitHub CLI (Fastest)**

```bash
# Install gh CLI if you haven't
brew install gh  # macOS

# Login once
gh auth login

# Create release (auto-generates notes from commits)
gh release create v2.0.0 --generate-notes

# OR with custom notes
gh release create v2.0.0 \
  --title "v2.0.0 - Backpack Architecture + Telemetry + Serialization" \
  --notes-file CHANGELOG.md
```

**Option B: Using GitHub UI**

1. Go to: `https://github.com/pyrotank41/Backpackflow/releases/new`
2. **Choose a tag:** Select `v2.0.0` (created by `npm version`)
3. **Release title:** `v2.0.0 - [Release Name]`
4. **Description:** Click "Generate release notes" or write custom notes
5. Click **"Publish release"**

#### Step 4: Watch the Magic ✨

Once you create the GitHub Release:
1. Go to **Actions** tab: `https://github.com/pyrotank41/Backpackflow/actions`
2. Watch "Publish to npm" workflow run
3. All 237 tests will run
4. Package will build and publish to npm
5. Done! 🎉

---

### Quick Reference

```bash
# Complete release in 3 commands:
npm version major -m "chore: release v%s"
git push origin main --follow-tags
gh release create v2.0.0 --generate-notes

# Package is now live on npm! 🚀
```

---

## ✅ Pre-Release Checklist

Before creating a release, make sure:

- [ ] All tests passing locally (`npm test`)
- [ ] Build succeeds (`npm run build`)
- [ ] Version in `package.json` updated
- [ ] CHANGELOG.md updated with changes
- [ ] Documentation updated (if needed)
- [ ] All PRs merged to main
- [ ] CI passing on main branch

---

## 🛡️ Safety Features

The workflow includes multiple safety checks:

### 1. **Tests Must Pass**
- All 237 tests run before publishing
- If any test fails, publish is aborted

### 2. **Version Validation**
- Workflow verifies `package.json` version matches release tag
- Example: `package.json` has `2.0.0` → Release tag must be `v2.0.0`
- Prevents accidental version mismatches

### 3. **Build Verification**
- Ensures TypeScript compilation succeeds
- Verifies `dist/index.js` and `dist/index.d.ts` exist
- Prevents publishing broken builds

### 4. **Duplicate Detection**
- Checks if version already exists on npm
- Warns but doesn't block (allows re-releases if needed)

### 5. **Provenance**
- Uses `--provenance` flag for npm publish
- Provides cryptographic proof of package origin
- Increases trust and security

---

## 🚨 Troubleshooting

### "Error: 401 Unauthorized"
- **Cause:** npm token is invalid or expired
- **Fix:** Regenerate npm token and update GitHub secret

### "Version mismatch"
- **Cause:** `package.json` version doesn't match release tag
- **Fix:** Update `package.json` or delete and recreate the release with correct tag

### "Tests failed"
- **Cause:** One or more tests are failing
- **Fix:** Run `npm test` locally, fix failing tests, commit, and push

### "dist/index.js not found"
- **Cause:** Build failed or `dist/` is in `.gitignore`
- **Fix:** Ensure `npm run build` works locally and `dist/` is generated

### "Already published"
- **Cause:** Version already exists on npm
- **Fix:** Bump version in `package.json` or unpublish old version (within 72h)

---

## 📊 Workflow Logs

To view detailed logs:

1. Go to **Actions** tab in GitHub
2. Click on the "Publish to npm" workflow run
3. Click on the "publish" job
4. Expand each step to see detailed output

---

## 🎯 Version Numbering (Semantic Versioning)

Follow [semver](https://semver.org/) for version numbers:

- **Major (X.0.0):** Breaking changes
  - Example: `1.3.0` → `2.0.0` (v2.0 with Backpack Architecture)
- **Minor (x.Y.0):** New features (backward compatible)
  - Example: `2.0.0` → `2.1.0` (new observability dashboard)
- **Patch (x.y.Z):** Bug fixes
  - Example: `2.0.0` → `2.0.1` (fix memory leak)

---

## 🔄 CI Workflow (Automatic Testing)

The repository also has a CI workflow that runs on every PR and push to main:

- **Triggers:** PRs, pushes to main
- **Tests:** Runs on Node 18 and Node 20
- **Steps:**
  1. Install dependencies
  2. Run all tests
  3. Build package
  4. Verify build output
  5. Check TypeScript compilation

This ensures code quality before merging PRs!

---

## 📚 Additional Resources

- [npm Automation Tokens](https://docs.npmjs.com/about-access-tokens#automation-tokens)
- [GitHub Actions: Publishing Node packages](https://docs.github.com/en/actions/publishing-packages/publishing-nodejs-packages)
- [npm Provenance](https://docs.npmjs.com/generating-provenance-statements)
- [Semantic Versioning](https://semver.org/)

---

## 🎉 Example: v2.0.0 Release

Here's a complete example of releasing v2.0.0:

```bash
# 1. Make sure you're on main and up to date
git checkout main
git pull origin main

# 2. Run tests locally (optional but recommended)
npm test  # All 237 tests should pass!

# 3. Update CHANGELOG.md (optional but recommended)
# Add your release notes to CHANGELOG.md

# 4. Bump version (creates commit + tag automatically)
npm version major -m "chore: release v%s"
# Output: v2.0.0

# 5. Push to GitHub (including the new tag)
git push origin main --follow-tags

# 6. Create GitHub Release
gh release create v2.0.0 \
  --title "v2.0.0 - BackpackFlow Major Release" \
  --notes "
## 🎉 Major Release: BackpackFlow v2.0

### New Features
- ✅ **PRD-001:** Backpack Architecture (Git-like state management)
- ✅ **PRD-002:** Telemetry System (Complete observability)
- ✅ **PRD-003:** Serialization Bridge (Config-driven flows)

### Breaking Changes
- Replaced SharedStore with Backpack
- New BackpackNode base class required
- Config schema updated to 2.0.0

### Stats
- 237 tests passing
- ~4,550 lines of production code
- Complete TypeScript rewrite

See [CHANGELOG.md](./CHANGELOG.md) for full details.
"

# 7. Watch the workflow run:
# https://github.com/pyrotank41/Backpackflow/actions

# 8. Verify publication:
# https://www.npmjs.com/package/backpackflow
```

**Timeline:**
- Step 1-6: ~2 minutes (manual)
- Step 7: ~3-5 minutes (automated: tests, build, publish)
- **Total:** ~5-7 minutes from start to npm! 🚀

---

**Questions?** Open an issue or reach out to @pyrotank41 on GitHub!

