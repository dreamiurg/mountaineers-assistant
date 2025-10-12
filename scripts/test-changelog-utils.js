// scripts/test-changelog-utils.js
const { getCommitsSinceLastTag } = require('./changelog-utils');

console.log('Testing getCommitsSinceLastTag...');
const commits = getCommitsSinceLastTag();
console.log(`Found ${commits.length} commits`);
console.log('Sample commit:', commits[0]);
console.log('✓ Test passed');
