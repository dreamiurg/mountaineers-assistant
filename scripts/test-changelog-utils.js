// scripts/test-changelog-utils.js
const {
  getCommitsSinceLastTag,
  parseConventionalCommit,
  categorizeCommits,
} = require('./changelog-utils');

console.log('Testing getCommitsSinceLastTag...');
const commits = getCommitsSinceLastTag();
console.log(`Found ${commits.length} commits`);
console.log('Sample commit:', commits[0]);
console.log('✓ Test passed');

console.log('\nTesting parseConventionalCommit...');
const tests = [
  {
    input: 'feat: added partner filter',
    expected: { type: 'feat', scope: null, message: 'added partner filter' },
  },
  {
    input: 'fix(auth): corrected timeout',
    expected: { type: 'fix', scope: 'auth', message: 'corrected timeout' },
  },
  {
    input: 'chore: updated deps',
    expected: { type: 'chore', scope: null, message: 'updated deps' },
  },
  { input: 'random commit', expected: { type: null, scope: null, message: 'random commit' } },
];

tests.forEach((test, i) => {
  const result = parseConventionalCommit(test.input);
  if (JSON.stringify(result) !== JSON.stringify(test.expected)) {
    throw new Error(
      `Test ${i + 1} failed: ${JSON.stringify(result)} !== ${JSON.stringify(test.expected)}`
    );
  }
});
console.log('✓ All parseConventionalCommit tests passed');

console.log('\nTesting categorizeCommits...');
const sampleCommits = [
  { hash: 'abc123', message: 'feat: added partner filter' },
  { hash: 'def456', message: 'fix: corrected timeout' },
  { hash: 'ghi789', message: 'chore: updated deps' },
  { hash: 'jkl012', message: 'docs: updated README' },
  { hash: 'mno345', message: 'release: prepared v0.1.6' },
  { hash: 'pqr678', message: 'random commit message' },
];

const categorized = categorizeCommits(sampleCommits);

if (!categorized.added || categorized.added.length !== 1) {
  throw new Error('Expected 1 "added" entry');
}
if (!categorized.fixed || categorized.fixed.length !== 1) {
  throw new Error('Expected 1 "fixed" entry');
}
if (!categorized.changed || categorized.changed.length !== 1) {
  throw new Error('Expected 1 "changed" entry');
}
if (!categorized.other || categorized.other.length !== 1) {
  throw new Error('Expected 1 "other" entry');
}
if (categorized.added[0] !== 'Added partner filter') {
  throw new Error('Expected cleaned message "Added partner filter"');
}

console.log('✓ All categorizeCommits tests passed');
