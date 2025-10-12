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

module.exports = {
  getCommitsSinceLastTag,
};
