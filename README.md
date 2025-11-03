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

## Error Handling

If `production-config.txt` is missing, the scripts will:
- Display an error message
- Provide instructions on how to set it up
- Exit with error code 1

This ensures the scripts work even when someone clones the repo without the config file.

