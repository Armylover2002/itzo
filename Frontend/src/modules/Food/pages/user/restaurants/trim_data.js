const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

const fs = require('fs');
const path = 'e:\\appzetofood\\appzetofood\\frontend\\src\\module\\user\\pages\\restaurants\\RestaurantDetails.jsx';
const content = fs.readFileSync(path, 'utf8');
const lines = content.split(/\r?\n/);
debugLog('Total lines:', lines.length);

// We want lines 1-41 (indices 0-40)
// And lines 2952-end (indices 2951-end)
// Line 41 content check: "// Restaurant data - matching the structure" (or similar)
// Line 2952 content check: "" (empty) or "export default..."

debugLog('Line 41:', lines[40]);
debugLog('Line 2952:', lines[2951]);

const newLines = [...lines.slice(0, 41), ...lines.slice(2951)];
const newContent = newLines.join('\n');
fs.writeFileSync(path, newContent);
debugLog('File updated. New line count:', newLines.length);

