// scripts/test-changelog-utils.js
const { getCommitsSinceLastTag, parseConventionalCommit } = require('./changelog-utils');

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
