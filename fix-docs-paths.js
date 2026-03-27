#!/usr/bin/env node
/**
 * Post-process TypeDoc generated HTML files to fix paths for subdirectory deployment.
 * Converts relative asset paths (assets/...) to absolute paths (/docs/assets/...)
 *
 * This is necessary because TypeDoc doesn't support serving from a subdirectory natively.
 */

const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.join(__dirname, 'docs');
const BASE_PATH = '/docs/';

function fixPathsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Fix asset references in href attributes
  if (content.includes('href="assets/')) {
    content = content.replace(/href="assets\//g, `href="${BASE_PATH}assets/`);
    modified = true;
  }

  // Fix script sources
  if (content.includes('src="assets/')) {
    content = content.replace(/src="assets\//g, `src="${BASE_PATH}assets/`);
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  return false;
}

console.log('Fixing TypeDoc paths for /docs/ deployment...');

// Fix paths in index.html only
const indexPath = path.join(DOCS_DIR, 'index.html');
if (fs.existsSync(indexPath)) {
  if (fixPathsInFile(indexPath)) {
    console.log('Fixed paths in index.html');
  } else {
    console.log('No path fixes needed in index.html');
  }
} else {
  console.warn('Warning: index.html not found in docs directory');
}
