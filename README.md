# Deployment Scripts

These scripts automate the deployment process by reading values from `production-config.txt` and updating your code files automatically.

## Setup

**First Time Setup:**
1. Copy the template file to create your production config:
   ```bash
   cp production-config.template.txt production-config.txt
   ```
   (Windows: `copy production-config.template.txt production-config.txt`)

2. Edit `production-config.txt` and fill in your actual production values

3. The `production-config.txt` file is NOT committed to Git (it's in `.gitignore`)

## Scripts

### `prepareDeployment.js`

**⚠️ IMPORTANT:** Before deploying to Cloud Run, use this script to filter out unnecessary PDFs/PNGs. This prevents uploading files from other deployments, saving storage and bandwidth.

**Usage:**
```bash
# Before deployment: Move unwanted files to backup, keep only needed ones
node prepareDeployment.js prepare [ConfigName]

# After deployment: Restore all files from backup
node prepareDeployment.js restore
```

**Example:**
```bash
# Before deploying CoverLetter service
node prepareDeployment.js prepare CoverLetter

# VERIFY what will be uploaded (optional but recommended)
node verifyDeployment.js

# Deploy to Cloud Run (only cover-letter-cv.pdf and matching PNGs will be included)
# ⚠️ DO NOT restore files until AFTER deployment completes!

# After deployment completes successfully, restore all files
node prepareDeployment.js restore
```

**⚠️ CRITICAL WORKFLOW:**
1. **ALWAYS** run `prepare` BEFORE deploying to Cloud Run
2. Deploy to Cloud Run (wait for completion)
3. **ONLY THEN** run `restore` to get your files back

If you restore before deploying, you'll upload unnecessary files and deployment will take forever!

This script reads the PDF filename from your config and keeps only:
- The specified PDF file
- PNG files in the subdirectory `pngs/[PDF-basename]/` matching the pattern `[PDF-basename]-*.png`
- All other PDFs/PNG subdirectories are moved to `PDFPasswordServer/deployment-backup/` temporarily

**Note:** PNGs must be organized in subdirectories: `pngs/[PDF-basename]/[PDF-basename]-1.png`, etc.

### `updateServerFromConfig.js`

Updates `PDFPasswordServer/server.js` with production values from the config.

**Usage:**
```bash
# Update server.js with values from a config section
node updateServerFromConfig.js update [ConfigName]

# Revert server.js to white-label
node updateServerFromConfig.js revert
```

**Example:**
```bash
node updateServerFromConfig.js update ExampleProject
node updateServerFromConfig.js revert
```

### `updateClientFromConfig.js`

Updates `PDFPasswordOverlay/src/App.js` and `package.json` with production values.

**Usage:**
```bash
# Update for production
node updateClientFromConfig.js update [ConfigName]

# Update for staging (nested subdirectory)
node updateClientFromConfig.js update [ConfigName] --staging

# Revert to white-label
node updateClientFromConfig.js revert
```

**Example:**
```bash
node updateClientFromConfig.js update ExampleProject
node updateClientFromConfig.js update ExampleProject --staging
node updateClientFromConfig.js revert
```

## Configuration File Format

The `production-config.txt` file contains multiple deployment configurations. Each configuration is a section with a header like:

```
=== ConfigName ===
```

Each section contains numbered values:
```
1. PDF Filename:
   your-document.pdf

2. Password (for both React app and Cloud Run):
   your-password

...
```

See `production-config.template.txt` for the full template with all required fields.

## Common User Commands

### Deploy a New Full-Stack Service

**Scenario:** User wants to deploy a completely new PDF service (new PDF/PNGs, new Cloud Run URL, new React app subdirectory).

**WHEN USER SAYS:** "deploy a new full-stack service" or "deploy new service" or "create new deployment"

**Prerequisites:**
1. Add a new configuration section to `production-config.txt` (e.g., `=== MyNewProject ===`)
2. Fill in values 1-6 manually (PDF filename, password, subdirectory, service name, PNG mode)
3. Place your PDF in `PDFPasswordServer/pdfs/` and PNGs (if needed) in `PDFPasswordServer/pngs/[basename]/`
4. Values 7-10 will be reused from previous deployments (or update if different)
5. Value 11 (Cloud Run URL) will be auto-updated after deployment

**Workflow:**
```bash
# 1. Prepare deployment (filter files to only include this project's PDF/PNGs)
node prepareDeployment.js prepare [ConfigName]

# 2. Verify what will be uploaded (optional but recommended)
node verifyDeployment.js

# 3. Update server code with config values
node updateServerFromConfig.js update [ConfigName]

# 4. Navigate to server directory and deploy to Cloud Run
cd ../PDFPasswordServer
gcloud config set project [VALUE 8: GCP Project ID] --quiet
gcloud run deploy [VALUE 5: Cloud Run Service Name] --source . --platform managed --region [VALUE 9: GCP Region] --allow-unauthenticated --quiet

# 5. Get the new Cloud Run URL
gcloud run services describe [VALUE 5: Cloud Run Service Name] --region [VALUE 9: GCP Region] --format="value(status.url)"

# 6. Update config value 11 (Cloud Run URL) with the URL from step 5
# (AI will update this automatically)

# 7. Set environment variables on Cloud Run
gcloud run services update [VALUE 5: Cloud Run Service Name] --region [VALUE 9: GCP Region] --update-env-vars="PDF_PASSWORD=[VALUE 2: Password],JWT_SECRET=[VALUE 10: JWT Secret],ALLOWED_ORIGINS=[VALUE 7: Allowed Origin],SERVE_PNGS_FOR_IOS=[VALUE 6: Serve PNGs for iOS]" --quiet

# 8. Restore all PDFs/PNGs from backup (now that deployment is complete)
cd ../PDFPasswordDevOps
node prepareDeployment.js restore

# 9. Update React app with config values
node updateClientFromConfig.js update [ConfigName]

# 10. Build React app (with clean - removes old build files first)
cd ../PDFPasswordOverlay
npm run build:clean

# 11. Upload build folder contents to cPanel via FTP
# Upload to: public_html/[VALUE 3: Production Subdirectory]/
```

**Note:** The AI assistant can automate most of these steps for you. Just say "deploy a new full-stack service" and provide the config name, or update values 1-6 in the config first.

### Update Existing Service

**Scenario:** User wants to update an existing service (e.g., new PDF, password change, etc.)

**WHEN USER SAYS:** "update the PDF" or "deploy PDF to Cloud Run" or "push new PDF" or "update existing service"

```bash
# 1. Update values in production-config.txt for the existing config section
# 2. Prepare deployment (filter files)
node prepareDeployment.js prepare [ExistingConfigName]

# 3. Follow steps 3-11 from "Deploy a New Full-Stack Service" above
```

### Build for Production

**Scenario:** User wants to build and deploy the React app to production subdirectory

**WHEN USER SAYS:** "build for production" or "deploy to production"

```bash
# 1. Update React app with config values
node updateClientFromConfig.js update [ConfigName]

# 2. Build React app (with clean - removes old build files first)
cd ../PDFPasswordOverlay
npm run build:clean

# 3. Upload build folder contents to cPanel via FTP
# Upload to: public_html/[VALUE 3: Production Subdirectory]/

# 4. (Optional) Revert React app to white-label
cd ../PDFPasswordDevOps
node updateClientFromConfig.js revert
```

### Build for Staging

**Scenario:** User wants to build and deploy the React app to staging subdirectory

**WHEN USER SAYS:** "build for staging" or "deploy to staging"

```bash
# 1. Update React app with staging config values
node updateClientFromConfig.js update [ConfigName] --staging

# 2. Build React app (with clean - removes old build files first)
cd ../PDFPasswordOverlay
npm run build:clean

# 3. Upload build folder contents to cPanel via FTP
# Upload to: public_html/[VALUE 3: Production Subdirectory]/[VALUE 4: Staging Subdirectory]/

# 4. (Optional) Revert React app to white-label
cd ../PDFPasswordDevOps
node updateClientFromConfig.js revert
```

### Revert to White-Label

**Scenario:** User wants to revert code changes back to white-label state

**WHEN USER SAYS:** "revert to white-label" or "revert code"

```bash
# Revert server code
node updateServerFromConfig.js revert

# Revert client code
node updateClientFromConfig.js revert
```

## Error Handling

If `production-config.txt` is missing, the scripts will:
- Display an error message
- Provide instructions on how to set it up
- Exit with error code 1

This ensures the scripts work even when someone clones the repo without the config file.

