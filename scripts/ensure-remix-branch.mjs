#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

const EXPECTED_BRANCH = 'sullyos-remix';
const REMIX_URL = 'https://sullyos-remix.sullyos-5fy.pages.dev/';
const PROD_URL = 'https://sullyos-5fy.pages.dev/';

function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}

const branch = git(['branch', '--show-current']);
const root = git(['rev-parse', '--show-toplevel']);
const remote = git(['remote', 'get-url', 'origin']);
const problems = [];

if (branch !== EXPECTED_BRANCH) {
  problems.push(`Current branch is "${branch || '(detached)'}"; expected "${EXPECTED_BRANCH}".`);
}

if (root.endsWith('/Documents/SullyOS')) {
  problems.push('Current worktree is /Users/fanyijia1205/Documents/SullyOS, which is the production/master worktree.');
}

if (remote && !remote.includes('fanika386/SullyOS')) {
  problems.push(`Unexpected origin remote: ${remote}`);
}

if (problems.length > 0) {
  console.error('SullyOS remix guard failed.');
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  console.error(`Remix branch: ${EXPECTED_BRANCH}`);
  console.error(`Remix URL: ${REMIX_URL}`);
  console.error(`Production URL: ${PROD_URL}`);
  console.error('Stop here unless the user explicitly asked to work on production/master.');
  process.exit(1);
}

console.log(`SullyOS remix guard passed: ${branch} -> ${REMIX_URL}`);
