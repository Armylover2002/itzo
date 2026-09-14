const fs = require('fs');
const path = 'c:/Users/JAY HIND/Desktop/itzo-new/frontend/src/modules/Food/pages/user/Home.jsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /({\/\* TABS SECTION \/ CARDS SECTION [\s\S]*?<\/button>\s*\);\s*}\)}\s*<\/div>)\s*<div className={activeTab === "food" \? "relative mx-auto w-full max-w-7xl md:px-4 lg:px-8" : "hidden"}>\s*<div className="bg-white dark:bg-\[#0a0a0a\]">/;

content = content.replace(regex, (match, p1) => {
  return `<div className={activeTab === "food" ? "relative mx-auto w-full max-w-7xl md:px-4 lg:px-8" : "hidden"}>\n        <div className="bg-white dark:bg-[#0a0a0a]">\n      ` + p1;
});

fs.writeFileSync(path, content, 'utf8');
console.log('Done!');
