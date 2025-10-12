const { execSync } = require('child_process');

/**
 * Get all commits since the last git tag, or all commits if no tags exist.
 * @returns {Array<{hash: string, message: string}>} Array of commit objects
 */
function getCommitsSinceLastTag() {
  try {
    // Try to find the last tag
    const lastTag = execSync('git describe --tags --abbrev=0 2>/dev/null', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    // Get commits since last tag
    const output = execSync(`git log ${lastTag}..HEAD --format='%H|%s'`, {
      encoding: 'utf8',
    });

    return parseGitLog(output);
  } catch {
    // No tags exist, get all commits
    const output = execSync("git log --format='%H|%s'", {
      encoding: 'utf8',
    });

    return parseGitLog(output);
  }
}

/**
 * Parse git log output into commit objects.
 * @param {string} output - Raw git log output
 * @returns {Array<{hash: string, message: string}>}
 */
function parseGitLog(output) {
  if (!output.trim()) {
    return [];
  }

  return output
    .trim()
    .split('\n')
    .map((line) => {
      const [hash, ...messageParts] = line.split('|');
      return {
        hash: hash.trim(),
        message: messageParts.join('|').trim(),
      };
    })
    .filter((commit) => commit.hash && commit.message);
}

/**
 * Parse a conventional commit message.
 * @param {string} message - Commit message
 * @returns {{type: string|null, scope: string|null, message: string}}
 */
function parseConventionalCommit(message) {
  const conventionalRegex =
    /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(([^)]+)\))?!?:\s*(.+)$/i;
  const match = message.match(conventionalRegex);

  if (!match) {
    return {
      type: null,
      scope: null,
      message: message.trim(),
    };
  }

  const [, type, , scope, msg] = match;

  return {
    type: type.toLowerCase(),
    scope: scope || null,
    message: msg.trim(),
  };
}

/**
 * Categorize commits into Keep a Changelog sections.
 * @param {Array<{hash: string, message: string}>} commits
 * @returns {{added: string[], fixed: string[], changed: string[], other: string[]}}
 */
function categorizeCommits(commits) {
  const categories = {
    added: [],
    fixed: [],
    changed: [],
    other: [],
  };

  commits.forEach((commit) => {
    const parsed = parseConventionalCommit(commit.message);

    // Skip release and merge commits
    if (
      commit.message.toLowerCase().startsWith('release:') ||
      commit.message.toLowerCase().startsWith('merge ')
    ) {
      return;
    }

    // Skip docs, test, build, ci commits
    if (['docs', 'test', 'build', 'ci'].includes(parsed.type)) {
      return;
    }

    const cleanedMessage = cleanCommitMessage(parsed.message);

    // Map conventional commit types to changelog categories
    switch (parsed.type) {
      case 'feat':
        categories.added.push(cleanedMessage);
        break;
      case 'fix':
        categories.fixed.push(cleanedMessage);
        break;
      case 'chore':
      case 'refactor':
      case 'perf':
      case 'style':
      case 'revert':
        categories.changed.push(cleanedMessage);
        break;
      default:
        categories.other.push(cleanedMessage);
        break;
    }
  });

  // Sort entries alphabetically within each category
  Object.keys(categories).forEach((key) => {
    categories[key].sort();
  });

  return categories;
}

/**
 * Clean and format a commit message for changelog display.
 * @param {string} message - Raw commit message
 * @returns {string} Cleaned message
 */
function cleanCommitMessage(message) {
  let cleaned = message.trim();

  // Capitalize first letter if lowercase
  if (cleaned.length > 0 && cleaned[0] === cleaned[0].toLowerCase()) {
    cleaned = cleaned[0].toUpperCase() + cleaned.slice(1);
  }

  // Remove trailing period if present
  if (cleaned.endsWith('.')) {
    cleaned = cleaned.slice(0, -1);
  }

  // Truncate extremely long messages
  if (cleaned.length > 100) {
    cleaned = cleaned.slice(0, 97) + '...';
  }

  return cleaned;
}

/**
 * Format a changelog entry for a version.
 * @param {string} version - Semantic version
 * @param {string} date - Release date (YYYY-MM-DD)
 * @param {{added: string[], fixed: string[], changed: string[], other: string[]}} categories
 * @returns {string} Formatted changelog entry
 */
function formatChangelogEntry(version, date, categories) {
  const lines = [];

  lines.push(`## [${version}] - ${date}`);
  lines.push('');

  // Add sections in Keep a Changelog order
  const sections = [
    { key: 'added', title: 'Added' },
    { key: 'changed', title: 'Changed' },
    { key: 'fixed', title: 'Fixed' },
    { key: 'other', title: 'Other' },
  ];

  sections.forEach(({ key, title }) => {
    const entries = categories[key];
    if (entries && entries.length > 0) {
      lines.push(`### ${title}`);
      lines.push('');
      entries.forEach((entry) => {
        lines.push(`- ${entry}`);
      });
      lines.push('');
    }
  });

  // If no entries at all, add a note
  const totalEntries = Object.values(categories).reduce((sum, arr) => sum + arr.length, 0);
  if (totalEntries === 0) {
    lines.push('No changes recorded.');
    lines.push('');
  }

  return lines.join('\n');
}

module.exports = {
  getCommitsSinceLastTag,
  parseConventionalCommit,
  categorizeCommits,
  formatChangelogEntry,
};
