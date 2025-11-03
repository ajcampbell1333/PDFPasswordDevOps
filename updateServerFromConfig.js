const fs = require('fs');
const path = require('path');

/**
 * Updates server.js with values from production-config.txt
 * Reads the config file and replaces placeholders in server.js
 */

const CONFIG_FILE = path.join(__dirname, 'production-config.txt');
const SERVER_FILE = path.join(__dirname, '..', 'PDFPasswordServer', 'server.js');

// Parse production-config.txt and extract values
function parseConfig(configName = 'ExampleProject') {
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
  
  // Find the start of the actual config values (look for first "1. " after the header)
  const afterHeader = configContent.substring(headerIndex + sectionHeader.length);
  const firstNumberedLine = afterHeader.match(/\n\s*1\.\s+/);
  
  if (!firstNumberedLine) {
    throw new Error(`Config section "${configName}" does not contain numbered values starting with "1."`);
  }
  
  const contentStart = headerIndex + sectionHeader.length + (firstNumberedLine.index || 0) + 1;
  
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
  
  // Map to our expected keys (handle variations in key names)
  return {
    pdfFilename: values['PDF Filename'] || '',
    password: values['Password (for both React app and Cloud Run)'] || values['Password'] || '',
    allowedOrigin: values['Allowed Origin (for CORS and CSP frame-ancestors)'] || values['Allowed Origin'] || '',
    cloudRunUrl: values['Cloud Run URL'] || '',
    gcpProjectId: values['GCP Project ID'] || '',
    subdirectory: values['Production Subdirectory'] || '',
    jwtSecret: values['JWT Secret'] || '',
    region: values['GCP Region'] || '',
    serviceName: values['Cloud Run Service Name'] || '',
    servePngsForIos: (values['Serve PNGs for iOS (true/false)'] || values['Serve PNGs for iOS'] || 'false').trim()
  };
}

// Update server.js with production values
function updateServer(configName = 'ExampleProject') {
  const config = parseConfig(configName);
  
  // Debug output
  console.log('Parsed config:', JSON.stringify(config, null, 2));
  
  if (!config.allowedOrigin) {
    throw new Error('Allowed Origin not found in config. Parsed values: ' + JSON.stringify(config));
  }
  
  let serverContent = fs.readFileSync(SERVER_FILE, 'utf8');
  
  // Update frame-ancestors
  serverContent = serverContent.replace(
    /"frame-ancestors":\s*\["self",\s*"[^"]*"\]/,
    `"frame-ancestors": ["'self'", "${config.allowedOrigin}"]`
  );
  
  // Update img-src (handle both single domain and wildcard)
  const domain = config.allowedOrigin.replace(/^https?:\/\//, '');
  const domainWildcard = `https://*.${domain.replace(/^www\./, '')}`;
  serverContent = serverContent.replace(
    /"img-src":\s*\["self",\s*"data:",\s*"[^"]*",\s*"[^"]*"\]/,
    `"img-src": ["'self'", "data:", "${config.allowedOrigin}", "${domainWildcard}"]`
  );
  
  fs.writeFileSync(SERVER_FILE, serverContent, 'utf8');
  console.log(`✅ Updated server.js with config: ${configName}`);
  console.log(`   Allowed Origin: ${config.allowedOrigin}`);
}

// Revert server.js to white-label
function revertServer() {
  let serverContent = fs.readFileSync(SERVER_FILE, 'utf8');
  
  serverContent = serverContent.replace(
    /"frame-ancestors":\s*\["self",\s*"[^"]*"\]/,
    `"frame-ancestors": ["'self'", "https://yourdomain.com"]`
  );
  
  serverContent = serverContent.replace(
    /"img-src":\s*\["self",\s*"data:",\s*"[^"]*",\s*"[^"]*"\]/,
    `"img-src": ["'self'", "data:", "https://yourdomain.com", "https://*.yourdomain.com"]`
  );
  
  fs.writeFileSync(SERVER_FILE, serverContent, 'utf8');
  console.log('✅ Reverted server.js to white-label');
}

// CLI interface
const args = process.argv.slice(2);
const command = args[0];
const configName = args[1] || 'ExampleProject';

if (command === 'update') {
  updateServer(configName);
} else if (command === 'revert') {
  revertServer();
} else {
  console.log('Usage: node updateServerFromConfig.js [update|revert] [configName]');
  console.log('  update [configName] - Update server.js with values from config');
  console.log('  revert              - Revert server.js to white-label');
  process.exit(1);
}

