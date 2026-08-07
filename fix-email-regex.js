const fs = require('fs');
const path = require('path');

const dir = 'e:\\itzo folder\\itzo\\Frontend\\src';
const old1Escaped = "/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/";
const old2Escaped = "/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,5}$/";
const newRegex = "/^[a-zA-Z0-9._%+-]+@(?!(gmail\\\\.comm|yahoo\\\\.con)$)[a-zA-Z0-9.-]+\\\\.[a-zA-Z]{2,}$/";

function processDir(directory) {
  const files = fs.readdirSync(directory);
  for (const file of files) {
    const fullPath = path.join(directory, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let updated = false;
      
      if (content.includes(old1Escaped)) {
        content = content.split(old1Escaped).join(newRegex);
        updated = true;
      }
      if (content.includes(old2Escaped)) {
        content = content.split(old2Escaped).join(newRegex);
        updated = true;
      }
      
      if (updated) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Updated', fullPath);
      }
    }
  }
}
processDir(dir);
