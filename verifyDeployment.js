const fs = require('fs');
const path = require('path');

/**
 * Verifies what files will be included in the Cloud Run deployment
 * by checking what's in pdfs/ and pngs/ directories.
 */

const SERVER_DIR = path.join(__dirname, '..', 'PDFPasswordServer');
const PDFS_DIR = path.join(SERVER_DIR, 'pdfs');
const PNGS_DIR = path.join(SERVER_DIR, 'pngs');
const BACKUP_DIR = path.join(SERVER_DIR, 'deployment-backup');

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function getFileSize(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

console.log('🔍 Verifying deployment files...\n');

// Check PDFs
console.log('📄 PDFs directory:');
if (fs.existsSync(PDFS_DIR)) {
  const pdfFiles = fs.readdirSync(PDFS_DIR).filter(f => f.endsWith('.pdf'));
  if (pdfFiles.length === 0) {
    console.log('   ⚠️  No PDF files found');
  } else {
    let totalSize = 0;
    pdfFiles.forEach(file => {
      const filePath = path.join(PDFS_DIR, file);
      const size = getFileSize(filePath);
      totalSize += size;
      console.log(`   ✓ ${file} (${formatBytes(size)})`);
    });
    console.log(`   Total: ${pdfFiles.length} file(s), ${formatBytes(totalSize)}\n`);
  }
} else {
  console.log('   ⚠️  PDFs directory does not exist\n');
}

// Check PNGs
console.log('🖼️  PNGs directory:');
if (fs.existsSync(PNGS_DIR)) {
  const subdirs = fs.readdirSync(PNGS_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  
  if (subdirs.length === 0) {
    console.log('   ⚠️  No PNG subdirectories found');
  } else {
    let totalFiles = 0;
    let totalSize = 0;
    
    subdirs.forEach(subdir => {
      const subdirPath = path.join(PNGS_DIR, subdir);
      const pngFiles = fs.readdirSync(subdirPath).filter(f => f.endsWith('.png'));
      totalFiles += pngFiles.length;
      
      console.log(`   📁 ${subdir}/`);
      pngFiles.forEach(file => {
        const filePath = path.join(subdirPath, file);
        const size = getFileSize(filePath);
        totalSize += size;
        console.log(`      ✓ ${file} (${formatBytes(size)})`);
      });
    });
    
    console.log(`   Total: ${totalFiles} PNG file(s) in ${subdirs.length} subdirectory(ies), ${formatBytes(totalSize)}\n`);
  }
} else {
  console.log('   ⚠️  PNGs directory does not exist\n');
}

// Check backup directory
console.log('📦 Backup directory:');
if (fs.existsSync(BACKUP_DIR)) {
  console.log('   ⚠️  WARNING: Backup directory exists!');
  console.log('   This means files were moved to backup but not yet restored.');
  console.log('   The backup directory should be EXCLUDED via .gcloudignore (✓ already done)\n');
  
  // Show what's in backup (for reference, but won't be uploaded)
  const backupPdfs = fs.existsSync(path.join(BACKUP_DIR, 'pdfs'))
    ? fs.readdirSync(path.join(BACKUP_DIR, 'pdfs')).filter(f => f.endsWith('.pdf'))
    : [];
  const backupPngs = fs.existsSync(path.join(BACKUP_DIR, 'pngs'))
    ? fs.readdirSync(path.join(BACKUP_DIR, 'pngs'), { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
    : [];
  
  if (backupPdfs.length > 0 || backupPngs.length > 0) {
    console.log('   Files in backup (will NOT be uploaded):');
    backupPdfs.forEach(file => {
      console.log(`      - PDF: ${file}`);
    });
    backupPngs.forEach(subdir => {
      console.log(`      - PNG subdir: ${subdir}/`);
    });
  }
} else {
  console.log('   ✓ No backup directory (all files restored or never backed up)\n');
}

console.log('✅ Verification complete!\n');
console.log('💡 Tip: If you see too many files, run: node prepareDeployment.js prepare [ConfigName]');

