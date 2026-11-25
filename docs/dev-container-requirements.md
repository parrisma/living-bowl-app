# Expo development container

## Goal

Provide a Linux container that VS Code can attach to for developing and
testing Living Bowl, a cross-platform React Native app built with Expo. The
project directory resolved by `docker/run-dev.sh` is bind-mounted from the
host to `/home/app` in the container, so source files remain on the host.
Developers use Expo Go on physical Android and iOS devices; the container does
not compile native apps.

## Required environment

- **Node.js:** pin an active LTS version supported by the selected Expo SDK.
- **Package manager:** use npm and commit `package-lock.json`. The one-time
  setup script uses npm; avoid adding another package manager unless needed.
- **Project dependencies:** declare Expo, React Native, and test tools in the
  project manifest. Install them inside the container from the lockfile. Keep
  `node_modules` in a Docker-managed volume rather than on the host, to avoid
  host/container platform and native-module conflicts.
- **Small OS baseline:** CA certificates and any shell/network tools actually
  needed by the app. Add Python or a C/C++ toolchain only if a chosen
  JavaScript dependency requires native Node.js compilation; do not add them
  preemptively.
- **Docker access:** install the Docker CLI and Compose plugin in the image.
  The build uses the host socket's GID to create a matching `docker` group and
  add the app user to it. The launcher bind-mounts the host socket and adds
  its group ID at runtime. Docker commands inside the container use the host
  daemon; this grants container users control over that daemon.
- **Expo Go and networking:** run Metro in the container on port 8081 and
  publish that port. Use Expo Go on Android and iOS devices. Prefer LAN mode
  when the device can reach the container; use Expo tunnel mode when LAN
  routing or container port forwarding prevents a connection.

Use Expo SDK APIs and native modules supported by Expo Go. Features requiring
a custom development client or native project changes are outside this
workflow.

## Initial setup

1. Build the image with `bash docker/build-dev.sh`.
2. Start the persistent container with `bash docker/run-dev.sh`.
3. In VS Code, run **Dev Containers: Attach to Running Container...** and
   select `living-bowl-dev`.
4. In the attached VS Code terminal, run `bash docker/setup-project.sh` once.
   It creates a blank TypeScript Expo app, adds a basic Jest test setup, and
   installs dependencies into the container's `node_modules` volume.
5. Start Expo with `npm start -- --host lan` or
   `npm start -- --host tunnel`. Run checks with `npm test` and
   `npm run typecheck`.

The setup script refuses to run if a root `package.json` already exists. It is
for bootstrapping this currently empty project, not for resetting an existing
app.

### Tests

Run unit/component tests and static checks in the container through project
scripts, so the commands are shared with CI. A typical Expo test setup uses
`jest`, `jest-expo`, and `@testing-library/react-native`; add TypeScript or
lint tooling only if the app uses them. These checks should not require an
emulator or native build. Smoke-test the app in Expo Go on both platforms.

End-to-end automation is optional. If introduced, select a tool that works
with the Expo Go workflow and document its device/CI requirements separately;
do not make an emulator or local native compilation a prerequisite for the
development container.

### Native builds

Do not install a JDK, Android SDK/NDK, Gradle, Xcode, or an emulator in this
container. If distributable binaries are needed, use a remote service such as
EAS Build; that requires Expo account access and network connectivity, not a
local native toolchain.

## Implementation plan

1. **Build the development image in `../docker/Dockerfile.dev` and
   `../docker/build-dev.sh`.** Use Node.js
   22, a non-root user, `/home/app` as the working directory, and port 8081.
   Remove `gofr-base`, Python/`uv`, `gofr-common`, GOFR paths, and inherited
   service ports. Install the Docker CLI and Compose plugin, but not a Docker
   daemon; create a `docker` group using the host socket GID and add the app
   user to it. Do not add Android or iOS build tools or bake app dependencies
   into the image. Build the image as `living-bowl-dev:latest` and pass host
   UID/GID plus Docker socket GID arguments.

2. **Simplify `../docker/entrypoint-dev.sh`.** It should execute commands
   unchanged and idle when started without a command, keeping the container
   available for VS Code.

3. **Update `../docker/run-dev.sh`.** Replace its stale delegation to the
   missing `scripts/run-dev-container.sh`. Start a named persistent container
   with the project bind-mounted at `/home/app`, a named `node_modules` volume
   at `/home/app/node_modules`, and port 8081 published. Mount
   `/var/run/docker.sock` and add its group ID to the
   container so its Docker CLI can control the host daemon. When given
   arguments, run them with `docker exec`; otherwise print the VS Code attach
   and setup instructions.

4. **Bootstrap the app after attaching.** Run
   `bash docker/setup-project.sh` once. It scaffolds the Expo app, resolves
   compatible app dependencies, creates a lockfile, adds a starter Jest test
   and typecheck script, then runs both checks.

5. **Verify the workflow.** Build and attach to the container; run the
   bootstrap script; confirm tests and typecheck pass; start Metro and open
   the app in Expo Go on Android and iOS. Confirm host edits remain visible,
   dependencies stay in the Docker volume, and devices can reach Metro.
