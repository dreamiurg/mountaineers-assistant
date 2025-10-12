const fs = require('fs');

/**
 * Extract a specific version section from CHANGELOG.md
 * @param {string} changelogPath - Path to CHANGELOG.md
 * @param {string} version - Version to extract (e.g., "0.1.8")
 * @returns {string} The changelog section for that version (without the ## [version] header)
 */
function extractVersionSection(changelogPath, version) {
  const content = fs.readFileSync(changelogPath, 'utf8');
  const lines = content.split('\n');

  const versionHeaderRegex = new RegExp(`^## \\[${escapeRegex(version)}\\]`);
  const nextVersionRegex = /^## \[/;

  let inSection = false;
  let sectionLines = [];

  for (const line of lines) {
    if (versionHeaderRegex.test(line)) {
      inSection = true;
      continue; // Skip the header line itself
    }

    if (inSection) {
      // Stop when we hit the next version section
      if (nextVersionRegex.test(line)) {
        break;
      }
      sectionLines.push(line);
    }
  }

  // Trim empty lines from start and end
  while (sectionLines.length > 0 && sectionLines[0].trim() === '') {
    sectionLines.shift();
  }
  while (sectionLines.length > 0 && sectionLines[sectionLines.length - 1].trim() === '') {
    sectionLines.pop();
  }

  return sectionLines.join('\n');
}

/**
 * Escape special regex characters
 * @param {string} str
 * @returns {string}
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  extractVersionSection,
};
