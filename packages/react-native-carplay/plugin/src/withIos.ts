import {
  ConfigPlugin,
  IOSConfig,
  XcodeProject,
  withDangerousMod,
  withEntitlementsPlist,
  withInfoPlist,
  withXcodeProject,
} from 'expo/config-plugins';
import * as fs from 'fs';
import * as path from 'path';

export interface IosCarPlayProps {
  entitlements: string[];
  phoneModuleName?: string;
  supportsMultipleScenes?: boolean;
}

export const withIosCarPlay: ConfigPlugin<IosCarPlayProps> = (config, props) => {
  const phoneModuleName = props?.phoneModuleName ?? 'main';
  const supportsMultipleScenes =
    props?.supportsMultipleScenes === undefined ? false : !!props.supportsMultipleScenes;
  const entitlements = props?.entitlements ?? [];

  if (!entitlements.length) {
    throw new Error(
      'react-native-carplay: iOS entitlements are required. Provide at least one entitlement (e.g., com.apple.developer.carplay-audio).',
    );
  }

  // 0) Info.plist scene manifest
  config = withInfoPlist(config, config => {
    const manifest: any = config.modResults.UIApplicationSceneManifest ?? {};
    manifest.UIApplicationSupportsMultipleScenes = supportsMultipleScenes;
    manifest.UISceneConfigurations = {
      ...(manifest.UISceneConfigurations ?? {}),
      UIWindowSceneSessionRoleApplication: [
        {
          UISceneClassName: 'UIWindowScene',
          UISceneConfigurationName: 'Phone',
          UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).PhoneSceneDelegate',
        },
      ],
      CPTemplateApplicationSceneSessionRoleApplication: [
        {
          UISceneClassName: 'CPTemplateApplicationScene',
          UISceneConfigurationName: 'CarPlay',
          UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).CarSceneDelegate',
        },
      ],
    };
    config.modResults.UIApplicationSceneManifest = manifest;
    return config;
  });

  // 1) Entitlements
  config = withEntitlementsPlist(config, config => {
    for (const key of entitlements) {
      (config.modResults as Record<string, any>)[key] = true;
    }
    return config;
  });

  // 2) Write Swift scene files (PhoneScene.swift, CarScene.swift)
  config = withDangerousMod(config, [
    'ios',
    async config => {
      const projectRoot = config.modRequest.projectRoot;
      const iosRoot = config.modRequest.platformProjectRoot; // <projectRoot>/ios
      const projectName = resolveProjectName(iosRoot, config.modRequest.projectName);
      const destDir = path.join(iosRoot, projectName);

      ensureDir(destDir);

      // PhoneScene.swift
      const phoneScenePath = path.join(destDir, 'PhoneScene.swift');
      if (!fs.existsSync(phoneScenePath)) {
        const phoneSceneContents = generatePhoneSceneSwift(phoneModuleName);
        fs.writeFileSync(phoneScenePath, phoneSceneContents, 'utf-8');
      }

      // CarScene.swift
      const carScenePath = path.join(destDir, 'CarScene.swift');
      if (!fs.existsSync(carScenePath)) {
        const carSceneContents = generateCarSceneSwift(phoneModuleName);
        fs.writeFileSync(carScenePath, carSceneContents, 'utf-8');
      }

      // Patch AppDelegate.swift to guard window creation on iOS 13+ (scenes)
      const appDelegate = IOSConfig.Paths.getAppDelegate(projectRoot);
      if (appDelegate.language === 'swift') {
        try {
          let contents = fs.readFileSync(appDelegate.path, 'utf-8');
          const updated = patchAppDelegateSwift(contents, phoneModuleName);
          if (updated !== contents) {
            fs.writeFileSync(appDelegate.path, updated, 'utf-8');
          }
        } catch {
          // best-effort; ignore if missing or unreadable
        }
      }

      return config;
    },
  ]);

  // 3) Link Swift files to Xcode project
  config = withXcodeProject(config, config => {
    const proj: XcodeProject = config.modResults;
    const projectName = config.modRequest.projectName;

    addSourceFileIfNeeded(proj, `${projectName}/PhoneScene.swift`);
    addSourceFileIfNeeded(proj, `${projectName}/CarScene.swift`);
    return config;
  });

  return config;
};

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function resolveProjectName(iosRoot: string, provided?: string): string {
  if (provided && provided.length > 0) return provided;
  // Infer from *.xcodeproj folder name
  const entries = fs.readdirSync(iosRoot);
  const xcodeproj = entries.find(name => name.endsWith('.xcodeproj'));
  if (xcodeproj) {
    return xcodeproj.replace(/\.xcodeproj$/, '');
  }
  throw new Error(
    'react-native-carplay: Unable to determine iOS project name. Provide config.modRequest.projectName or ensure an .xcodeproj exists.',
  );
}

function generatePhoneSceneSwift(moduleName: string): string {
  return `import UIKit
import react_native_carplay
import EXDevLauncher

@objc(PhoneSceneDelegate)
class PhoneSceneDelegate: UIResponder, UIWindowSceneDelegate {
  // We need to retain the window instance in the delegate to avoid it being deallocated before the app is ready to start the React Native app.
  var window: UIWindow?

  func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
    NSLog("<<<<<--------------------")
    NSLog("PhoneSceneDelegate scene willConnectTo")
    NSLog("---------------------->>>>")
    if session.role != .windowApplication {
      NSLog("session role: %@", String(describing: session.role))
      return
    }
    
    guard let appDelegate = (UIApplication.shared.delegate as? AppDelegate) else {
      NSLog("no app delegate")
      return
    }
    guard let windowScene = (scene as? UIWindowScene) else {
      NSLog("no window scene")
      return
    }

    // Create window and set rootViewController
    NSLog("window scene: %@", String(describing: windowScene))
    self.window = UIWindow(windowScene: windowScene)
    appDelegate.startReactNative(withWindow: self.window!, connectionOptions: connectionOptions)
    self.window!.makeKeyAndVisible()

    // By default, the EXDevLauncherController do the autoSetupStart right after the return of app delegate's application:didFinishLaunchingWithOptions:
    // It subscribes the didFinishLaunchingWithOptions: callback and start the React Native app after the return.
    // However, when the app is scene-based, at the end of didFinishLaunchingWithOptions:, the app is not yet ready to start the React Native app because THERE IS NO WINDOW YET.
    // So we need to call the autoSetupStart manually here when getting a window from the scene.
    // This workaround requires PATCHes to expo-dev-launcher for it to not throw fatalError when the window is not yet ready.
    EXDevLauncherController.sharedInstance().autoSetupStart(self.window!)
  }
}

`;
}

function generateCarSceneSwift(moduleName: string): string {
  return `import Foundation
import CarPlay
import react_native_carplay
import EXDevLauncher

@objc(CarSceneDelegate)
class CarSceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate {
  
  func templateApplicationScene(_ templateApplicationScene: CPTemplateApplicationScene,
                                  didConnect interfaceController: CPInterfaceController) {
    // Initialize app from scene (creates bridge if needed)
    // Pass nil for connectionOptions since CarPlay doesn't provide them in the same way
    guard let appDelegate = (UIApplication.shared.delegate as? AppDelegate) else {
      NSLog("no app delegate");
      return
    }
    appDelegate.startReactNative(withWindow: templateApplicationScene.carWindow, connectionOptions: nil)
    RNCarPlay.connect(with:interfaceController, window: templateApplicationScene.carWindow)
    EXDevLauncherController.sharedInstance().autoSetupStart(nil)
    NSLog("carplay connected");
  }

  func templateApplicationScene(_ templateApplicationScene: CPTemplateApplicationScene, didDisconnectInterfaceController interfaceController: CPInterfaceController) {
    NSLog("carplay disconnected");
    RNCarPlay.disconnect()
  }
}
`;
}

function patchAppDelegateSwift(src: string, moduleName: string): string {
  // Pattern to match the #if os(iOS) || os(tvOS) block with window creation and startReactNative
  // Match from #if to the corresponding #endif, ensuring it contains the specific patterns
  const ifPattern = /#if\s+os\(iOS\)\s+\|\|\s+os\(tvOS\)/;

  const ifMatch = ifPattern.exec(src);
  if (!ifMatch) {
    return src; // No matching #if found
  }

  const startIndex = ifMatch.index;

  // Find the matching #endif by looking for the next one after this #if
  // (simple approach: find next #endif, assuming no nested #if/#endif)
  const afterIf = src.substring(startIndex);
  const endifPattern = /#endif/;
  const endifMatch = endifPattern.exec(afterIf);

  if (!endifMatch) {
    return src; // No matching #endif found
  }

  const endIndex = startIndex + endifMatch.index + '#endif'.length;
  const blockContent = src.substring(startIndex, endIndex);

  // Check if this block contains the patterns we're looking for
  const hasWindowCreation = /window\s*=\s*UIWindow\(frame:\s*UIScreen\.main\.bounds\)/.test(
    blockContent,
  );
  const hasMakeKeyAndVisible = /window\?\.makeKeyAndVisible\(\)/.test(blockContent);
  const hasStartReactNative =
    /factory\.startReactNative\([\s\S]*?launchOptions:\s*launchOptions\)/.test(blockContent);

  if (hasWindowCreation && hasMakeKeyAndVisible && hasStartReactNative) {
    // Comment out each line in the block
    const commentedBlock = blockContent
      .split('\n')
      .map(line => {
        const trimmed = line.trim();
        // Don't add comment to empty lines, but preserve them
        return trimmed ? `// ${line}` : line;
      })
      .join('\n');

    // Add explanatory comment before the commented block
    const replacement = `// This section is not needed for Scene-based application for supporting CarPlay.\n${commentedBlock}`;

    return src.substring(0, startIndex) + replacement + src.substring(endIndex);
  }

  return src; // Block doesn't match the expected pattern, return unchanged
}

function addSourceFileIfNeeded(proj: XcodeProject, file: string) {
  // Don't add if it already exists in the project
  // @ts-ignore: hasFile is available on xcode projects
  if ((proj as any).hasFile && (proj as any).hasFile(file)) {
    return;
  }

  // Find target and group
  const firstTarget = proj.getFirstTarget().firstTarget;
  // @ts-ignore: uuid available on firstTarget
  const targetUuid = firstTarget?.uuid || (proj as any).findTargetKey(firstTarget);
  // Prefer group with the product name (project name)
  // @ts-ignore
  const groupUuid =
    (proj as any).findPBXGroupKey({ name: firstTarget?.productName }) ||
    // @ts-ignore
    (proj as any).findPBXGroupKey({ name: firstTarget?.name }) ||
    proj.getFirstProject().firstProject.mainGroup;

  // Add the file
  // @ts-ignore: addSourceFile exists on xcode project
  (proj as any).addSourceFile(file, { target: targetUuid }, groupUuid);
}
