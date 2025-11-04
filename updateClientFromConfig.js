const fs = require('fs');
const path = require('path');

/**
 * Updates App.js and package.json with values from production-config.txt
 * Reads the config file and replaces placeholders in React app files
 */

const CONFIG_FILE = path.join(__dirname, 'production-config.txt');
const APP_FILE = path.join(__dirname, '..', 'PDFPasswordOverlay', 'src', 'App.js');
const PACKAGE_FILE = path.join(__dirname, '..', 'PDFPasswordOverlay', 'package.json');

// Parse production-config.txt and extract values
function parseConfig(configName = 'ExampleProject', isStaging = false) {
  // Check if config file exists
  if (!fs.existsSync(CONFIG_FILE)) {
    const templatePath = path.join(__dirname, 'production-config.template.txt');
    const templateExists = fs.existsSync(templatePath);
    
    console.error('\n❌ ERROR: production-config.txt not found!');
    console.error('\nTo set up your configuration:');
    console.error('1. Copy production-config.template.txt to production-config.txt');
    if (templateExists) {
      console.error(`   Copy command: cp "${templatePath}" "${CONFIG_FILE}"`);
    } else {
      console.error(`   Template should be at: ${templatePath}`);
    }
    console.error('2. Edit production-config.txt and fill in your production values');
    console.error('3. Run this script again\n');
    process.exit(1);
  }
  
  const configContent = fs.readFileSync(CONFIG_FILE, 'utf8');
  
  // Find the config section (starts with "=== [CONFIG_NAME] ===")
  // Look for the section header followed by separator line, then capture content
  const sectionHeader = `=== ${configName} ===`;
  const headerIndex = configContent.indexOf(sectionHeader);
  
  if (headerIndex === -1) {
    throw new Error(`Config section "${configName}" not found in production-config.txt`);
  }
  
  // Find the start of the actual config values section
  // Skip past informational headers and find "1. PDF Filename:" (the first real config value)
  let contentStart = headerIndex + sectionHeader.length;
  const pdfFilenameMatch = configContent.substring(contentStart).match(/\n1\.\s+PDF Filename:/);
  if (pdfFilenameMatch) {
    contentStart = contentStart + pdfFilenameMatch.index + 1; // +1 to skip the newline
  } else {
    // Fallback: look for any "1. " pattern after the section header
    const firstMatch = configContent.substring(contentStart).match(/\n1\.\s+/);
    if (firstMatch) {
      contentStart = contentStart + firstMatch.index + 1;
    } else {
      // Last resort: just find the next newline after header
      contentStart = configContent.indexOf('\n', headerIndex + sectionHeader.length);
      if (contentStart === -1) {
        throw new Error(`Config section "${configName}" has invalid format`);
      }
      contentStart++; // Skip the newline
    }
  }
  
  // Find the end (next section header or end of file)
  const nextSectionRegex = /\n=== \w+ ===/g;
  nextSectionRegex.lastIndex = contentStart;
  const nextSectionMatch = nextSectionRegex.exec(configContent);
  const contentEnd = nextSectionMatch ? nextSectionMatch.index : configContent.length;
  
  const configSection = configContent.substring(contentStart, contentEnd);
  
  // Extract values - match numbered list format
  // Format: "1. Key Name:\n   value" or "1. Key Name: value"
  const values = {};
  const lines = configSection.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Match: "1. PDF Filename:" or "10. Cloud Run Service Name: value"
    const match = line.match(/^\d+\.\s+([^:]+):\s*(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      
      // If value is empty, check next line for indented value
      if (!value && i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        const indentMatch = nextLine.match(/^\s{3,}(.+)$/);
        if (indentMatch) {
          // Value is on next line - collect all indented lines
          const multiLineParts = [];
          let j = i + 1;
          while (j < lines.length) {
            const indentLine = lines[j];
            const indentMatch2 = indentLine.match(/^\s{3,}(.+)$/);
            if (indentMatch2) {
              // Skip warning lines (contain ⚠️)
              if (!indentLine.includes('⚠️')) {
                multiLineParts.push(indentLine.trim());
              }
              j++;
            } else {
              break;
            }
          }
          value = multiLineParts.join('\n').trim();
          i = j - 1; // Skip processed lines
        }
      } else if (value) {
        // Value is on same line - but might have warning on next line
        // Skip warning lines if present
        if (i + 1 < lines.length && lines[i + 1].includes('⚠️')) {
          // Skip the warning line
          i++;
        }
      }
      
      if (value) {
        values[key] = value;
      }
    }
  }
  
  // Map to our expected keys
  const subdirectory = isStaging 
    ? `${values['Production Subdirectory'] || ''}/${values['Staging Subdirectory'] || ''}`
    : values['Production Subdirectory'] || '';
  
  return {
    pdfFilename: values['PDF Filename'] || '',
    password: values['Password (for Cloud Run server only)'] || values['Password'] || '',
    cloudRunUrl: values['Cloud Run URL'] || '',
    subdirectory: subdirectory,
    stagingSubdirectory: values['Staging Subdirectory'] || ''
  };
}

// Update App.js with production values
function updateApp(configName = 'ExampleProject', isStaging = false) {
  const config = parseConfig(configName, isStaging);
  
  let appContent = fs.readFileSync(APP_FILE, 'utf8');
  
  // Update CORRECT_PASSWORD
  // Note: When using server-hosted PDFs, password is NOT stored client-side for security
  // The password is only used for local PDF mode (serverHostedPDF = false)
  // For server-hosted PDFs, we leave it empty - authentication happens server-side only
  appContent = appContent.replace(
    /const CORRECT_PASSWORD = '[^']*';/,
    `const CORRECT_PASSWORD = ''; // Password validated server-side only (not stored client-side)`
  );
  
  // Update productionSubdirectory
  appContent = appContent.replace(
    /const productionSubdirectory = '[^']*';/,
    `const productionSubdirectory = '${config.subdirectory}';`
  );
  
  // Update DOCKER_SERVER_URL
  appContent = appContent.replace(
    /const DOCKER_SERVER_URL = '[^']*';/,
    `const DOCKER_SERVER_URL = '${config.cloudRunUrl}';`
  );
  
  // Update PDF_FILENAME
  appContent = appContent.replace(
    /const PDF_FILENAME = '[^']*';/,
    `const PDF_FILENAME = '${config.pdfFilename}';`
  );
  
  fs.writeFileSync(APP_FILE, appContent, 'utf8');
  console.log(`✅ Updated App.js with config: ${configName}${isStaging ? ' (staging)' : ''}`);
  console.log(`   Password: ${config.password}`);
  console.log(`   Subdirectory: ${config.subdirectory}`);
  console.log(`   Cloud Run URL: ${config.cloudRunUrl}`);
  console.log(`   PDF Filename: ${config.pdfFilename}`);
}

// Update package.json with production values
function updatePackage(configName = 'ExampleProject', isStaging = false) {
  const config = parseConfig(configName, isStaging);
  
  const packageContent = JSON.parse(fs.readFileSync(PACKAGE_FILE, 'utf8'));
  
  packageContent.homepage = `/${config.subdirectory}/`;
  
  fs.writeFileSync(PACKAGE_FILE, JSON.stringify(packageContent, null, 2) + '\n', 'utf8');
  console.log(`✅ Updated package.json homepage: /${config.subdirectory}/`);
}

// Revert App.js to white-label
function revertApp() {
  let appContent = fs.readFileSync(APP_FILE, 'utf8');
  
  appContent = appContent.replace(
    /const CORRECT_PASSWORD = '[^']*';/,
    `const CORRECT_PASSWORD = 'your-password-here';`
  );
  
  appContent = appContent.replace(
    /const productionSubdirectory = '[^']*';/,
    `const productionSubdirectory = 'your-subdirectory';`
  );
  
  appContent = appContent.replace(
    /const DOCKER_SERVER_URL = '[^']*';/,
    `const DOCKER_SERVER_URL = 'https://your-cloud-run-service-url.run.app';`
  );
  
  appContent = appContent.replace(
    /const PDF_FILENAME = '[^']*';/,
    `const PDF_FILENAME = 'your-document.pdf';`
  );
  
  fs.writeFileSync(APP_FILE, appContent, 'utf8');
  console.log('✅ Reverted App.js to white-label');
}

// Revert package.json to white-label
function revertPackage() {
  const packageContent = JSON.parse(fs.readFileSync(PACKAGE_FILE, 'utf8'));
  
  packageContent.homepage = '/your-subdirectory/';
  
  fs.writeFileSync(PACKAGE_FILE, JSON.stringify(packageContent, null, 2) + '\n', 'utf8');
  console.log('✅ Reverted package.json to white-label');
}

// CLI interface
const args = process.argv.slice(2);
const command = args[0];
const configName = args[1] || 'ExampleProject';
const isStaging = args.includes('--staging');

if (command === 'update') {
  updateApp(configName, isStaging);
  updatePackage(configName, isStaging);
} else if (command === 'revert') {
  revertApp();
  revertPackage();
} else {
  console.log('Usage: node updateClientFromConfig.js [update|revert] [configName] [--staging]');
  console.log('  update [configName] [--staging] - Update App.js and package.json with values from config');
  console.log('  revert                          - Revert to white-label');
  process.exit(1);
}

