import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';

const root = process.cwd();
const baselinePath = join(root, 'security/device-capabilities.json');

if (!existsSync(baselinePath)) {
  throw new Error(`Capability baseline not found: ${baselinePath}`);
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
const errors = [];

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function checkExact(label, actual, expected) {
  const actualSorted = sortedUnique(actual);
  const expectedSorted = sortedUnique(expected);
  if (JSON.stringify(actualSorted) !== JSON.stringify(expectedSorted)) {
    errors.push(
      `${label} mismatch\n  expected: ${JSON.stringify(expectedSorted)}\n  actual:   ${JSON.stringify(actualSorted)}`,
    );
  }
}

function findFiles(directory, predicate) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return findFiles(path, predicate);
    }
    return predicate(path) ? [path] : [];
  });
}

const androidManifestPath = join(
  root,
  'android/app/src/main/AndroidManifest.xml',
);
if (!existsSync(androidManifestPath)) {
  throw new Error(
    `Generated Android manifest not found: ${androidManifestPath}. Run expo prebuild first.`,
  );
}

const androidManifest = readFileSync(androidManifestPath, 'utf8');
const androidPermissions = [];
const androidBlockedPermissions = [];
const permissionTags = androidManifest.match(
  /<uses-permission(?:-[\w-]+)?\b[^>]*\/?>/g,
) ?? [];

for (const tag of permissionTags) {
  const name = tag.match(/\bandroid:name=["']([^"']+)["']/)?.[1];
  if (!name) {
    errors.push(`Permission declaration has no android:name: ${tag}`);
    continue;
  }

  if (/\btools:node=["']remove["']/.test(tag)) {
    androidBlockedPermissions.push(name);
  } else {
    androidPermissions.push(name);
  }
}

checkExact('Android permissions', androidPermissions, baseline.androidPermissions);
checkExact(
  'Android blocked permissions',
  androidBlockedPermissions,
  baseline.androidBlockedPermissions,
);

const iosRoot = join(root, 'ios');
if (!existsSync(iosRoot)) {
  throw new Error(`Generated iOS project not found: ${iosRoot}. Run expo prebuild first.`);
}

const infoPlists = findFiles(iosRoot, (path) => basename(path) === 'Info.plist');
if (infoPlists.length === 0) {
  throw new Error(`No generated Info.plist found under ${iosRoot}`);
}

const iosUsageDescriptions = [];
const iosBackgroundModes = [];
for (const path of infoPlists) {
  const plist = readFileSync(path, 'utf8');
  iosUsageDescriptions.push(
    ...[...plist.matchAll(/<key>(NS[A-Za-z0-9]+UsageDescription)<\/key>/g)].map(
      ([, key]) => key,
    ),
  );
  for (const [, array] of plist.matchAll(
    /<key>UIBackgroundModes<\/key>\s*<array>([\s\S]*?)<\/array>/g,
  )) {
    iosBackgroundModes.push(
      ...[...array.matchAll(/<string>(.*?)<\/string>/g)].map(([, mode]) => mode),
    );
  }
}

checkExact(
  'iOS usage descriptions',
  iosUsageDescriptions,
  baseline.iosUsageDescriptions,
);
checkExact('iOS background modes', iosBackgroundModes, baseline.iosBackgroundModes);

const entitlementFiles = findFiles(iosRoot, (path) =>
  path.endsWith('.entitlements'),
);
const iosEntitlements = [];
for (const path of entitlementFiles) {
  const entitlements = readFileSync(path, 'utf8');
  iosEntitlements.push(
    ...[...entitlements.matchAll(/<key>(.*?)<\/key>/g)].map(([, key]) => key),
  );
}

checkExact('iOS entitlements', iosEntitlements, baseline.iosEntitlements);

if (errors.length > 0) {
  console.error('Device capability check failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
} else {
  console.log('Generated device capabilities match the approved baseline.');
}
