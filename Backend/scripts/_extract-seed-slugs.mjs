import fs from 'fs';

const transcript =
  'C:/Users/Ayush Porwal/.cursor/projects/d-Blaze-New/agent-transcripts/fc2c91c3-82c9-48f3-bbce-a99b3863da68/fc2c91c3-82c9-48f3-bbce-a99b3863da68.jsonl';
const audit =
  'C:/Users/Ayush Porwal/.cursor/projects/d-Blaze-New/agent-transcripts/fc2c91c3-82c9-48f3-bbce-a99b3863da68/subagents/15ef60d5-93c3-432c-a314-133f104036c4.jsonl';

const slugs = new Set();
const names = new Set();

for (const file of [transcript, audit]) {
  const text = fs.readFileSync(file, 'utf8');
  for (const m of text.matchAll(/slug:\\"([a-z0-9-]+)\\"/g)) slugs.add(m[1]);
  for (const m of text.matchAll(/slug: \\"([a-z0-9-]+)\\"/g)) slugs.add(m[1]);
  for (const m of text.matchAll(/"slug":"([a-z0-9-]+)"/g)) slugs.add(m[1]);
  for (const m of text.matchAll(/name:\\"([^\\"]{2,80})\\"/g)) {
    if (/Fruits|Dairy|Cold|Snacks|Bakery|Instant|Fresh|Vegetables|Bread|Drinks|Munch|Frozen|Biscuits|Juice/i.test(m[1])) {
      names.add(m[1]);
    }
  }
}

const out = {
  slugs: [...slugs].sort(),
  names: [...names].sort(),
};
fs.writeFileSync('d:/Blaze_New/Backend/scripts/_seed-slugs.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
