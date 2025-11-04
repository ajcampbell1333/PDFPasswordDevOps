const fs = require('fs');
const path = require('path');

/**
 * Prepares the server directory for deployment by temporarily moving
 * only the PDF and PNG files needed for this deployment.
 * 
 * This prevents uploading unnecessary files to Cloud Run.
 */

const SERVER_DIR = path.join(__dirname, '..', 'PDFPasswordServer');
const PDFS_DIR = path.join(SERVER_DIR, 'pdfs');
const PNGS_DIR = path.join(SERVER_DIR, 'pngs');
const BACKUP_DIR = path.join(SERVER_DIR, 'deployment-backup');

// Parse production-config.txt to get PDF filename
function getPdfFilename(configName) {
  const configFile = path.join(__dirname, 'production-config.txt');
  if (!fs.existsSync(configFile)) {
    throw new Error('production-config.txt not found');
  }
  
  const configContent = fs.readFileSync(configFile, 'utf8');
  const sectionHeader = `=== ${configName} ===`;
  const headerIndex = configContent.indexOf(sectionHeader);
  
  if (headerIndex === -1) {
    throw new Error(`Config section "${configName}" not found`);
  }
  
  // Find the start of the actual config values (skip separator lines)
  const afterHeader = configContent.substring(headerIndex + sectionHeader.length);
  const firstNumberedLine = afterHeader.match(/\n\s*1\.\s+/);
  
  if (!firstNumberedLine) {
    throw new Error(`Config section "${configName}" does not contain numbered values starting with "1."`);
  }
  
  const contentStart = headerIndex + sectionHeader.length + (firstNumberedLine.index || 0) + 1;
  
  // Find the end (next section header or end of file)
  // Look for next "===" section header AFTER the current section's content
  const remainingContent = configContent.substring(contentStart);
  const nextSectionMatch = remainingContent.match(/\n=== \w+ ===/);
  const contentEnd = nextSectionMatch 
    ? contentStart + nextSectionMatch.index 
    : configContent.length;
  
  const configSection = configContent.substring(contentStart, contentEnd);
  
  // Extract PDF filename from this section - match "1. PDF Filename:" followed by indented value
  const lines = configSection.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match "1. PDF Filename:" (may have value on same line or next line)
    const match = line.match(/^1\.\s+PDF Filename:\s*(.*)$/);
    if (match) {
      let value = match[1].trim();
      // If value is empty, check next line for indented value
      if (!value && i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        const valueMatch = nextLine.match(/^\s{3,}(.+)$/);
        if (valueMatch) {
          value = valueMatch[1].trim();
        }
      }
      if (value) {
        return value;
      }
    }
  }
  
  throw new Error('PDF Filename not found in config section');
}

// Prepare deployment: backup all files, keep only needed ones
function prepareDeployment(configName) {
  const pdfFilename = getPdfFilename(configName);
  const baseName = pdfFilename.replace('.pdf', '');
  
  console.log(`📦 Preparing deployment for: ${pdfFilename}`);
  console.log(`   Keeping PDF: ${pdfFilename}`);
  console.log(`   Keeping PNGs matching: ${baseName}-*.png`);
  
  // Create backup directory
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    fs.mkdirSync(path.join(BACKUP_DIR, 'pdfs'), { recursive: true });
    fs.mkdirSync(path.join(BACKUP_DIR, 'pngs'), { recursive: true });
  }
  
  // Backup and filter PDFs
  const pdfFiles = fs.readdirSync(PDFS_DIR).filter(f => f.endsWith('.pdf'));
  for (const file of pdfFiles) {
    const sourcePath = path.join(PDFS_DIR, file);
    const backupPath = path.join(BACKUP_DIR, 'pdfs', file);
    
    if (file === pdfFilename) {
      console.log(`   ✓ Keeping PDF: ${file}`);
    } else {
      console.log(`   → Moving PDF to backup: ${file}`);
      fs.renameSync(sourcePath, backupPath);
    }
  }
  
  // Backup and filter PNGs (now in subdirectories)
  if (fs.existsSync(PNGS_DIR)) {
    // Get all subdirectories in pngs/
    const subdirs = fs.readdirSync(PNGS_DIR, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    // Create backup/pngs structure
    const backupPngsDir = path.join(BACKUP_DIR, 'pngs');
    if (!fs.existsSync(backupPngsDir)) {
      fs.mkdirSync(backupPngsDir, { recursive: true });
    }
    
    for (const subdir of subdirs) {
      const subdirPath = path.join(PNGS_DIR, subdir);
      const pngFiles = fs.readdirSync(subdirPath).filter(f => f.endsWith('.png'));
      
      if (subdir === baseName) {
        // Keep this subdirectory and all its PNGs
        console.log(`   ✓ Keeping PNG subdirectory: ${subdir}/`);
        for (const file of pngFiles) {
          console.log(`     ✓ Keeping PNG: ${subdir}/${file}`);
        }
      } else {
        // Move entire subdirectory to backup
        const backupSubdirPath = path.join(backupPngsDir, subdir);
        console.log(`   → Moving PNG subdirectory to backup: ${subdir}/`);
        if (fs.existsSync(backupSubdirPath)) {
          // If backup subdir exists, move files individually
          for (const file of pngFiles) {
            fs.renameSync(
              path.join(subdirPath, file),
              path.join(backupSubdirPath, file)
            );
          }
          // Remove empty source subdir
          fs.rmdirSync(subdirPath);
        } else {
          // Move entire subdirectory
          fs.renameSync(subdirPath, backupSubdirPath);
        }
      }
    }
  }
  
  console.log(`\n✅ Deployment prepared! Only ${pdfFilename} and matching PNGs remain.`);
  console.log(`   Backup saved to: ${BACKUP_DIR}`);
  console.log(`\n⚠️  After deployment, run: node prepareDeployment.js restore`);
  console.log(`   This will restore all files from backup.\n`);
}

// Restore all files from backup
function restoreFiles() {
  if (!fs.existsSync(BACKUP_DIR)) {
    console.log('⚠️  No backup found. Nothing to restore.');
    return;
  }
  
  console.log('📥 Restoring files from backup...');
  
  // Restore PDFs
  const backupPdfsDir = path.join(BACKUP_DIR, 'pdfs');
  if (fs.existsSync(backupPdfsDir)) {
    const files = fs.readdirSync(backupPdfsDir);
    for (const file of files) {
      const sourcePath = path.join(backupPdfsDir, file);
      const destPath = path.join(PDFS_DIR, file);
      fs.renameSync(sourcePath, destPath);
      console.log(`   ✓ Restored PDF: ${file}`);
    }
  }
  
  // Restore PNGs (from subdirectories)
  const backupPngsDir = path.join(BACKUP_DIR, 'pngs');
  if (fs.existsSync(backupPngsDir)) {
    const subdirs = fs.readdirSync(backupPngsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    for (const subdir of subdirs) {
      const backupSubdirPath = path.join(backupPngsDir, subdir);
      const destSubdirPath = path.join(PNGS_DIR, subdir);
      
      // Move entire subdirectory back
      if (fs.existsSync(destSubdirPath)) {
        // If dest exists, move files individually
        const files = fs.readdirSync(backupSubdirPath);
        for (const file of files) {
          fs.renameSync(
            path.join(backupSubdirPath, file),
            path.join(destSubdirPath, file)
          );
        }
        fs.rmdirSync(backupSubdirPath);
      } else {
        // Move entire subdirectory
        fs.renameSync(backupSubdirPath, destSubdirPath);
      }
      console.log(`   ✓ Restored PNG subdirectory: ${subdir}/`);
    }
    
    // Also check for any loose PNG files (backwards compatibility)
    const files = fs.readdirSync(backupPngsDir).filter(f => f.endsWith('.png'));
    for (const file of files) {
      // Extract basename and create subdirectory
      const basenameMatch = file.match(/^(.+)-(\d+)\.png$/);
      if (basenameMatch) {
        const baseName = basenameMatch[1];
        const destSubdirPath = path.join(PNGS_DIR, baseName);
        if (!fs.existsSync(destSubdirPath)) {
          fs.mkdirSync(destSubdirPath, { recursive: true });
        }
        fs.renameSync(
          path.join(backupPngsDir, file),
          path.join(destSubdirPath, file)
        );
        console.log(`   ✓ Restored PNG: ${baseName}/${file}`);
      }
    }
  }
  
  // Clean up backup directory
  fs.rmSync(BACKUP_DIR, { recursive: true, force: true });
  console.log('\n✅ Files restored! Backup directory removed.');
}

// CLI interface
const args = process.argv.slice(2);
const command = args[0];
const configName = args[1];

if (command === 'prepare') {
  if (!configName) {
    console.error('❌ Error: Config name required');
    console.error('Usage: node prepareDeployment.js prepare [ConfigName]');
    process.exit(1);
  }
  prepareDeployment(configName);
} else if (command === 'restore') {
  restoreFiles();
} else {
  console.log('Usage: node prepareDeployment.js [prepare|restore] [ConfigName]');
  console.log('  prepare [ConfigName] - Move unwanted PDFs/PNGs to backup, keep only needed ones');
  console.log('  restore              - Restore all files from backup');
  process.exit(1);
}

