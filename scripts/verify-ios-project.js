import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

const [
  packageSwift,
  project,
  infoPlist,
  entitlements,
  privacyManifest,
  callCoordinator,
  appIconContents,
  testflightWorkflow,
] = await Promise.all([
  read("ios/App/CapApp-SPM/Package.swift"),
  read("ios/App/App.xcodeproj/project.pbxproj"),
  read("ios/App/App/Info.plist"),
  read("ios/App/App/App.entitlements"),
  read("ios/App/App/PrivacyInfo.xcprivacy"),
  read("ios/App/App/NativeCallCoordinator.swift"),
  read("ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json"),
  read(".github/workflows/testflight.yml"),
]);

assert.doesNotMatch(
  packageSwift,
  /\.package\([^\r\n]*\bpath:\s*"[^"]*\\/,
  "Package.swift contient un chemin Windows non portable.",
);
assert.match(
  packageSwift,
  /CapacitorPushNotifications/,
  "Le paquet Capacitor Push Notifications manque à la cible iOS.",
);
assert.match(
  project,
  /PrivacyInfo\.xcprivacy in Resources/,
  "Le manifeste de confidentialité n'est pas intégré.",
);
assert.match(
  project,
  /MARKETING_VERSION = 1\.14;/,
  "La version iOS doit correspondre à la version mobile 1.14.",
);
assert.match(
  project,
  /CURRENT_PROJECT_VERSION = 15;/,
  "Le build iOS doit correspondre au build mobile 15.",
);
assert.match(
  project,
  /CODE_SIGN_ENTITLEMENTS = App\/App\.entitlements;/,
  "Les droits iOS ne sont pas appliqués.",
);
assert.match(
  infoPlist,
  /NSCameraUsageDescription/,
  "La justification caméra manque.",
);
assert.match(
  infoPlist,
  /NSMicrophoneUsageDescription/,
  "La justification microphone manque.",
);
assert.match(
  infoPlist,
  /<string>voip<\/string>/,
  "Le mode d'arrière-plan VoIP manque.",
);
assert.match(
  infoPlist,
  /<string>remote-notification<\/string>/,
  "Le mode notification distante manque.",
);
assert.match(
  entitlements,
  /<key>aps-environment<\/key>/,
  "Le droit APNs manque.",
);
assert.match(
  privacyManifest,
  /NSPrivacyAccessedAPICategoryUserDefaults/,
  "L'usage de UserDefaults n'est pas déclaré.",
);
assert.match(
  privacyManifest,
  /<string>CA92\.1<\/string>/,
  "La raison Apple de UserDefaults manque.",
);
assert.match(
  privacyManifest,
  /NSPrivacyTracking[\s\S]*<false\/>/,
  "L'absence de suivi n'est pas déclarée.",
);
assert.match(
  callCoordinator,
  /authorizedContactLabel = "Contact autorisé"/,
  "CallKit doit afficher le libellé neutre.",
);
assert.doesNotMatch(
  callCoordinator,
  /callerName|caller_name|displayName|display_name/,
  "CallKit ne doit pas reprendre un nom du push.",
);
assert.match(
  appIconContents,
  /AppIcon-512@2x\.png/,
  "L'icône iOS principale manque.",
);
assert.match(
  testflightWorkflow,
  /workflow_dispatch:/,
  "La publication TestFlight doit rester manuelle.",
);
assert.match(
  testflightWorkflow,
  /github\.ref == 'refs\/heads\/main'/,
  "TestFlight doit être limité à main.",
);
assert.match(
  testflightWorkflow,
  /runs-on: macos-26/,
  "Capacitor 8 doit être construit avec Xcode 26.",
);
assert.match(
  testflightWorkflow,
  /environment: testflight/,
  "Les secrets Apple doivent être isolés.",
);
assert.match(
  testflightWorkflow,
  /destination -string upload/,
  "L'archive doit être envoyée à App Store Connect.",
);
assert.match(
  testflightWorkflow,
  /CODE_SIGN_STYLE=Automatic/,
  "La signature TestFlight doit être gérée par Apple dans le cloud.",
);
assert.match(
  testflightWorkflow,
  /-allowProvisioningUpdates/,
  "Xcode doit pouvoir créer la signature et le profil sur le runner macOS.",
);
assert.doesNotMatch(
  testflightWorkflow,
  /APPLE_DISTRIBUTION_CERTIFICATE|APPLE_PROVISIONING_PROFILE/,
  "La publication cloud ne doit pas exiger de certificat ou profil exporté depuis un Mac.",
);

await Promise.all(
  [
    "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png",
    "ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png",
    "ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-1.png",
    "ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-2.png",
    "ios/App/App/public/index.html",
  ].map((path) => access(new URL(path, root))),
);

console.log(
  "Projet iOS vérifié : Capacitor, APNs/VoIP, confidentialité, identité et bundle web.",
);
