#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ -e "$PROJECT_ROOT/package.json" ]; then
    echo "An app package.json already exists; refusing to overwrite the project."
    exit 1
fi

TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT

echo "Creating a blank TypeScript Expo app..."
npx --yes create-expo-app@latest "$TEMP_DIR/app" \
    --template blank-typescript \
    --no-install \
    --yes

cp -an "$TEMP_DIR/app/." "$PROJECT_ROOT/"
cd "$PROJECT_ROOT"

echo "Installing app dependencies..."
npm install

echo "Adding Expo-compatible Jest dependencies..."
npx expo install --dev jest-expo jest @types/jest
npm install --save-dev @testing-library/react-native

npm pkg set \
    "scripts.test=jest" \
    "scripts.typecheck=tsc --noEmit" \
    "jest.preset=jest-expo"

mkdir -p "$PROJECT_ROOT/__tests__"
cat > "$PROJECT_ROOT/__tests__/App.test.tsx" <<'EOF'
import { render } from "@testing-library/react-native";
import App from "../App";

describe("App", () => {
  it("renders", () => {
    expect(render(<App />).toJSON()).not.toBeNull();
  });
});
EOF

echo "Checking the starter app..."
npm test -- --runInBand
npm run typecheck

echo "Expo app setup complete."
