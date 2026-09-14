import { execSync } from 'node:child_process';
import { mkdirSync, renameSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const nodeModules = join(root, 'node_modules');
const imgDir = join(nodeModules, '@img');

const packages = [
  { name: 'sharp', version: '0.33.5', dest: join(nodeModules, 'sharp') },
  {
    name: '@img/sharp-win32-x64',
    version: '0.33.5',
    dest: join(imgDir, 'sharp-win32-x64'),
  },
  { name: 'color', version: '4.2.3', dest: join(nodeModules, 'color') },
  {
    name: 'color-string',
    version: '1.9.1',
    dest: join(nodeModules, 'color-string'),
  },
  {
    name: 'simple-swizzle',
    version: '0.2.4',
    dest: join(nodeModules, 'simple-swizzle'),
  },
  {
    name: 'is-arrayish',
    version: '0.3.4',
    dest: join(nodeModules, 'is-arrayish'),
  },
];

function packAndInstall({ name, version, dest }) {
  const spec = `${name}@${version}`;
  const tarball = execSync(`npm pack ${spec} --silent`, {
    cwd: root,
    encoding: 'utf8',
  }).trim();
  const tarballPath = join(root, tarball);
  const extracted = join(root, 'package');

  if (existsSync(dest)) {
    rmSync(dest, { recursive: true, force: true });
  }
  mkdirSync(join(dest, '..'), { recursive: true });

  execSync(`tar -xzf "${tarballPath}"`, { cwd: root, stdio: 'inherit' });
  renameSync(extracted, dest);
  rmSync(tarballPath, { force: true });
  console.log(`Installed ${spec}`);
}

for (const pkg of packages) {
  packAndInstall(pkg);
}

execSync('node -e "import(\'sharp\').then(() => console.log(\'sharp ready\'))"', {
  cwd: root,
  stdio: 'inherit',
});
