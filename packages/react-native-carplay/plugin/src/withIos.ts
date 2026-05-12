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

  // 2) Write Swift scene files (CarPlayReactNativeManager.swift, PhoneScene.swift, CarScene.swift)
  config = withDangerousMod(config, [
    'ios',
    async config => {
      const projectRoot = config.modRequest.projectRoot;
      const iosRoot = config.modRequest.platformProjectRoot; // <projectRoot>/ios
      const projectName = resolveProjectName(iosRoot, config.modRequest.projectName);
      const destDir = path.join(iosRoot, projectName);

      ensureDir(destDir);

      // CarPlayReactNativeManager.swift
      const managerPath = path.join(destDir, 'CarPlayReactNativeManager.swift');
      if (!fs.existsSync(managerPath)) {
        const managerContents = generateCarPlayReactNativeManagerSwift();
        fs.writeFileSync(managerPath, managerContents, 'utf-8');
      }

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

    addSourceFileIfNeeded(proj, `${projectName}/CarPlayReactNativeManager.swift`);
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

function generateCarPlayReactNativeManagerSwift(): string {
  return `import Foundation
import UIKit
import React
import React_RCTAppDelegate
import ExpoModulesCore
import EXUpdates

class CarPlayReactNativeManager {
  static let shared = CarPlayReactNativeManager()
  
  private(set) var expoUpdatesStartCalled = false
  private var readyObserver: NSObjectProtocol?
  
  var factory: RCTReactNativeFactory? {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else {
      NSLog("CarPlayReactNativeManager:AppDelegate not found")
      return nil
    }
    return appDelegate.reactNativeFactory
  }
  
  /// Check if expo-updates has finished loading
  var isReady: Bool {
    guard AppController.isInitialized() else {
      NSLog("CarPlayReactNativeManager: AppController not initialized")
      return false
    }
    return AppController.sharedInstance.launchAssetUrl() != nil
  }
  
  func markExpoUpdatesStartCalled() {
    expoUpdatesStartCalled = true
    NSLog("CarPlayReactNativeManager: expoUpdatesStartCalled")
  }
  
  /// Wait for React Native to be ready
  func waitForReady(completion: @escaping () -> Void) {
    if isReady {
      NSLog("CarPlayReactNativeManager: isReady called")
      completion()
      return
    }
    
    // Listen for JS load completion
    readyObserver = NotificationCenter.default.addObserver(
      forName: NSNotification.Name("RCTJavaScriptDidLoadNotification"),
      object: nil,
      queue: .main
    ) { [weak self] _ in
      NSLog("CarPlayReactNativeManager: RCTJavaScriptDidLoadNotification received")
      if let observer = self?.readyObserver {
        NotificationCenter.default.removeObserver(observer)
      }
      completion()
    }
  }
}

`;
}

function generatePhoneSceneSwift(moduleName: string): string {
  return `import UIKit
import UIKit
import React
import React_RCTAppDelegate
import react_native_carplay
import ExpoModulesCore
import EXUpdates
import ReactAppDependencyProvider
import Expo
#if DEBUG
import EXDevLauncher
#endif

@objc(PhoneSceneDelegate)
class PhoneSceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?
  
  var cachedURLContext: UIOpenURLContext?
  
  func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
    guard let windowScene = scene as? UIWindowScene else {
      NSLog("PhoneSceneDelegate: windowScene not found")
      return
    }
    let window = UIWindow(windowScene: windowScene)
    self.window = window
    
    let manager = CarPlayReactNativeManager.shared
    guard let factory = manager.factory else {
      NSLog("PhoneSceneDelegate: factory not found")
      return
    }
    
    if !manager.expoUpdatesStartCalled {
      // FIRST SCENE: Normal expo-updates flow
      manager.markExpoUpdatesStartCalled()
      factory.startReactNative(withModuleName: "${moduleName}", in: window, launchOptions: nil)
      NSLog("PhoneSceneDelegate: expo-updates started")
      cachedURLContext = connectionOptions.urlContexts.first
      NSLog("PhoneSceneDelegate: cachedURLContext: \(cachedURLContext)")
      // By default, the EXDevLauncherController do the autoSetupStart right after the return of app delegate's application:didFinishLaunchingWithOptions:
      // It subscribes the didFinishLaunchingWithOptions: callback and start the React Native app after the return.
      // However, when the app is scene-based, at the end of didFinishLaunchingWithOptions:, the app is not yet ready to start the React Native app because THERE IS NO WINDOW YET.
      // So we need to call the autoSetupStart manually here when getting a window from the scene.
      // This workaround requires PATCHes to expo-dev-launcher for it to not throw fatalError when the window is not yet ready.
      #if DEBUG
      EXDevLauncherController.sharedInstance().autoSetupStart(self.window!)
      NSLog("PhoneSceneDelegate: autoSetupStart called")
      #endif

    } else if manager.isReady {
      // SECOND SCENE, READY: Bypass expo-updates, create view from existing bridge
      createRootViewDirectly(factory: factory, window: window)
      NSLog("PhoneSceneDelegate: root view created")
    } else {
      // SECOND SCENE, LOADING: Wait for expo-updates to finish
      manager.waitForReady { [weak self] in
        self?.createRootViewDirectly(factory: factory, window: window)
        NSLog("PhoneSceneDelegate: root view created")
      }
      NSLog("PhoneSceneDelegate: expo-updates finished")
    }

    if let urlContext = cachedURLContext {
      self.scene(scene, openURLContexts: [urlContext])
      cachedURLContext = nil
    }
  }

  func scene(_ scene: UIScene, didConnectTo session: UISceneSession) {
    let appDelegate = UIApplication.shared.delegate as? AppDelegate
    NSLog("PhoneSceneDelegate: scene didConnectTo: \(scene)")
    if let urlContext = cachedURLContext {
      NSLog("PhoneSceneDelegate: opening URL context: \(urlContext)")
      self.scene(scene, openURLContexts: [urlContext])
      cachedURLContext = nil
    }
  }
  
  private func createRootViewDirectly(factory: RCTReactNativeFactory, window: UIWindow) {
    // Use superViewWithModuleName to BYPASS the expo-updates handler
    guard let expoFactory = factory.rootViewFactory as? ExpoReactRootViewFactory else {
      NSLog("PhoneSceneDelegate: expoFactory not found")
      return
    }

    NSLog("PhoneSceneDelegate: superView called")
    let rootView = expoFactory.superView(
      withModuleName: "${moduleName}",
      initialProperties: nil as [String: Any]?,
      launchOptions: nil as [UIApplication.LaunchOptionsKey: Any]?
    )
    NSLog("PhoneSceneDelegate: rootView created")

    let vc = UIViewController()
    vc.view = rootView
    window.rootViewController = vc
    window.makeKeyAndVisible()
  }

  // SceneDelegate.swift
    // Forward custom URL scheme deep links to AppDelegate
    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
      guard let context = URLContexts.first else { return }
      let url = context.url
      let options = context.options

      // Build options dictionary mirroring UIApplication.OpenURLOptionsKey
      var openOptions: [UIApplication.OpenURLOptionsKey: Any] = [:]
      if let sourceApp = options.sourceApplication {
          openOptions[.sourceApplication] = sourceApp
      }
      if let annotation = options.annotation {
          openOptions[.annotation] = annotation
      }
      if options.openInPlace {
          openOptions[.openInPlace] = true
      }

      // Forward to AppDelegate's application(_:open:options:)
      if let appDelegate = UIApplication.shared.delegate as? AppDelegate {
          _ = appDelegate.application(UIApplication.shared, open: url, options: openOptions)
      }
    }

    // Forward Universal Links (NSUserActivityTypeBrowsingWeb) to AppDelegate
    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }

        // Forward to AppDelegate's application(_:continue:restorationHandler:)
        _ = appDelegate.application(
            UIApplication.shared,
            continue: userActivity,
            restorationHandler: { _ in
                // React Native typically doesn't use UI restoration.
                // Provide an empty handler for API compatibility.
            }
        )
    }

    // Optional: forward scene lifecycle to AppDelegate if you rely on those
    func sceneWillEnterForeground(_ scene: UIScene) {
        (UIApplication.shared.delegate as? AppDelegate)?
            .applicationWillEnterForeground(UIApplication.shared)
    }

    func sceneDidEnterBackground(_ scene: UIScene) {
        (UIApplication.shared.delegate as? AppDelegate)?
            .applicationDidEnterBackground(UIApplication.shared)
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        (UIApplication.shared.delegate as? AppDelegate)?
            .applicationDidBecomeActive(UIApplication.shared)
    }

    func sceneWillResignActive(_ scene: UIScene) {
        (UIApplication.shared.delegate as? AppDelegate)?
            .applicationWillResignActive(UIApplication.shared)
    }
}

`;
}

function generateCarSceneSwift(moduleName: string): string {
  return `import Foundation
import CarPlay
import react_native_carplay
#if DEBUG
import EXDevLauncher
#endif

@objc(CarSceneDelegate)
class CarSceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate {
  var interfaceController: CPInterfaceController?
  private var hiddenWindow: UIWindow?
  
  func templateApplicationScene(
    _ templateApplicationScene: CPTemplateApplicationScene,
    didConnect interfaceController: CPInterfaceController
  ) {
    self.interfaceController = interfaceController
    
    let manager = CarPlayReactNativeManager.shared
    guard let factory = manager.factory else {
      NSLog("CarSceneDelegate: factory not found")
      return
    }
    
    // Store interface controller for react-native-carplay to access
    let store = RNCPStore.sharedManager()
    if store?.app == nil {
      store?.app = RNCarPlayApp()
      NSLog("CarSceneDelegate: app created")
    }
    if let app = store?.app as? RNCarPlayApp {
      app.interfaceController = interfaceController
      NSLog("CarSceneDelegate: interfaceController set")
    }
    
    if !manager.expoUpdatesStartCalled {
      // CARPLAY IS FIRST: Must start React Native
      manager.markExpoUpdatesStartCalled()
      NSLog("CarSceneDelegate: expo-updates started")
      // Create hidden window for expo-updates callback to find
      hiddenWindow = UIWindow(frame: CGRect(x: 0, y: 0, width: 1, height: 1))
      hiddenWindow?.isHidden = true
      
      // CRITICAL: Set appDelegate.window so getWindow() won't crash
      let appDelegate = UIApplication.shared.delegate as? AppDelegate
      appDelegate?.window = hiddenWindow
      
      // Start React Native - triggers expo-updates
      factory.startReactNative(
        withModuleName: "${moduleName}",
        in: templateApplicationScene.carWindow,
        launchOptions: nil as [UIApplication.LaunchOptionsKey: Any]?
      )
      NSLog("CarSceneDelegate: React Native started")
      // JS bundle will handle CarPlay templates via react-native-carplay
    }
    // If Phone started first, bridge is already running
    // JS will handle CarPlay UI automatically when it detects the connection
    
    RNCarPlay.connect(with: interfaceController, window: templateApplicationScene.carWindow, scene: templateApplicationScene)
    NSLog("CarSceneDelegate: RNCarPlay connected")
  }
  
  func templateApplicationScene(
    _ templateApplicationScene: CPTemplateApplicationScene,
    didDisconnectInterfaceController interfaceController: CPInterfaceController
  ) {
    self.interfaceController = nil
    let store = RNCPStore.sharedManager()
    if let app = store?.app as? RNCarPlayApp {
      app.interfaceController = nil
      NSLog("CarSceneDelegate: interfaceController set to nil")
    }
    RNCarPlay.disconnect()
    NSLog("CarSceneDelegate: RNCarPlay disconnected")
  }

  // Forward custom URL scheme deep links to AppDelegate
  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let context = URLContexts.first else { return }
    let url = context.url
    let options = context.options

    // Build options dictionary mirroring UIApplication.OpenURLOptionsKey
    var openOptions: [UIApplication.OpenURLOptionsKey: Any] = [:]
    if let sourceApp = options.sourceApplication {
        openOptions[.sourceApplication] = sourceApp
    }
    if let annotation = options.annotation {
        openOptions[.annotation] = annotation
    }
    if options.openInPlace {
        openOptions[.openInPlace] = true
    }

    // Forward to AppDelegate's application(_:open:options:)
    if let appDelegate = UIApplication.shared.delegate as? AppDelegate {
        _ = appDelegate.application(UIApplication.shared, open: url, options: openOptions)
    }
  }

  // Forward Universal Links (NSUserActivityTypeBrowsingWeb) to AppDelegate
  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
      guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }

      NSLog("CarSceneDelegate: scene continue userActivity: \(userActivity)")

      // Forward to AppDelegate's application(_:continue:restorationHandler:)
      _ = appDelegate.application(
          UIApplication.shared,
          continue: userActivity,
          restorationHandler: { _ in
              // React Native typically doesn't use UI restoration.
              // Provide an empty handler for API compatibility.
          }
      )
  }

  // CarPlay.md: notify JS when this CarPlay scene becomes visible / hidden (e.g. user switches to another car app).
  func sceneWillEnterForeground(_ scene: UIScene) {
      RNCarPlay.stateChanged(true)
      (UIApplication.shared.delegate as? AppDelegate)?
          .applicationWillEnterForeground(UIApplication.shared)
  }

  func sceneDidEnterBackground(_ scene: UIScene) {
      RNCarPlay.stateChanged(false)
      (UIApplication.shared.delegate as? AppDelegate)?
          .applicationDidEnterBackground(UIApplication.shared)
  }

  func sceneDidBecomeActive(_ scene: UIScene) {
      (UIApplication.shared.delegate as? AppDelegate)?
          .applicationDidBecomeActive(UIApplication.shared)
  }

  func sceneWillResignActive(_ scene: UIScene) {
      (UIApplication.shared.delegate as? AppDelegate)?
          .applicationWillResignActive(UIApplication.shared)
  }
}
`;
}

function patchAppDelegateSwift(src: string, moduleName: string): string {
  let result = src;

  // Step 1: Comment out the window creation block if it exists
  const ifPattern = /#if\s+os\(iOS\)\s+\|\|\s+os\(tvOS\)/;
  const ifMatch = ifPattern.exec(result);

  if (ifMatch) {
    const startIndex = ifMatch.index;
    const afterIf = result.substring(startIndex);
    const endifPattern = /#endif/;
    const endifMatch = endifPattern.exec(afterIf);

    if (endifMatch) {
      const endIndex = startIndex + endifMatch.index + '#endif'.length;
      const blockContent = result.substring(startIndex, endIndex);

      const hasWindowCreation = /window\s*=\s*UIWindow\(frame:\s*UIScreen\.main\.bounds\)/.test(
        blockContent,
      );
      const hasStartReactNative =
        /factory\.startReactNative\([\s\S]*?launchOptions:\s*launchOptions\)/.test(blockContent);

      // Comment out the block if it contains window creation and startReactNative
      // (makeKeyAndVisible is optional - some blocks may not have it)
      if (hasWindowCreation && hasStartReactNative) {
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

        result = result.substring(0, startIndex) + replacement + result.substring(endIndex);
      }
    }
  }

  // Step 2: Add startReactNative and connectionOptionsToLaunchOptions methods if they don't exist
  const hasStartReactNativeMethod = /func\s+startReactNative\(withWindow\s+window:\s*UIWindow/.test(
    result,
  );
  const hasConnectionOptionsHelper = /func\s+connectionOptionsToLaunchOptions\(/.test(result);

  if (!hasStartReactNativeMethod || !hasConnectionOptionsHelper) {
    // Find the AppDelegate class closing brace
    // Look for the class definition first
    const classPattern = /class\s+AppDelegate[^{]*\{/;
    const classMatch = classPattern.exec(result);

    if (classMatch) {
      // Find the matching closing brace for the class
      // We'll search from the class opening brace forward, counting braces
      let braceCount = 0;
      let insertIndex = -1;
      const startPos = classMatch.index + classMatch[0].length - 1; // Position of opening brace

      for (let i = startPos; i < result.length; i++) {
        if (result[i] === '{') {
          braceCount++;
        } else if (result[i] === '}') {
          braceCount--;
          if (braceCount === 0) {
            // Found the closing brace of the class
            insertIndex = i;
            break;
          }
        }
      }

      if (insertIndex > 0) {
        // Build the methods to insert
        const methodsToAdd: string[] = [];

        if (!hasConnectionOptionsHelper) {
          methodsToAdd.push(`  func connectionOptionsToLaunchOptions(_ connectionOptions: UIScene.ConnectionOptions?) -> [UIApplication.LaunchOptionsKey: Any]? {
    guard let connectionOptions = connectionOptions else {
      return nil
    }
    
    var launchOptions: [UIApplication.LaunchOptionsKey: Any] = [:]
    
    // Handle notification response
    if let notificationResponse = connectionOptions.notificationResponse {
      launchOptions[UIApplication.LaunchOptionsKey.remoteNotification] = notificationResponse.notification.request.content.userInfo
    }
    
    // Handle user activities
    if connectionOptions.userActivities.count > 0 {
      if let userActivity = connectionOptions.userActivities.first {
        let userActivityDictionary: [String: Any] = [
          "UIApplicationLaunchOptionsUserActivityTypeKey": userActivity.activityType,
          "UIApplicationLaunchOptionsUserActivityKey": userActivity
        ]
        launchOptions[UIApplication.LaunchOptionsKey.userActivityDictionary] = userActivityDictionary
      }
    }
    
    // Handle URL contexts
    if let urlContext = connectionOptions.urlContexts.first {
      launchOptions[UIApplication.LaunchOptionsKey.url] = urlContext.url
    }
    
    return launchOptions.isEmpty ? nil : launchOptions
  }`);
        }

        if (!hasStartReactNativeMethod) {
          methodsToAdd.push(`  public func startReactNative(withWindow window: UIWindow, connectionOptions: UIScene.ConnectionOptions?) {
    reactNativeFactory?.startReactNative(
      withModuleName: "${moduleName}",
      in: window,
      launchOptions: connectionOptionsToLaunchOptions(connectionOptions))
    window.makeKeyAndVisible()
  }`);
        }

        if (methodsToAdd.length > 0) {
          // Insert before the closing brace, with proper indentation
          const beforeBrace = result.substring(0, insertIndex);
          const afterBrace = result.substring(insertIndex);
          const methodsCode = '\n' + methodsToAdd.join('\n\n') + '\n';
          result = beforeBrace + methodsCode + afterBrace;
        }
      }
    }
  }

  return result;
}

function findBridgingHeader(iosRoot: string, projectName: string): string | null {
  // Common locations for bridging headers
  const possiblePaths = [
    path.join(iosRoot, `${projectName}-Bridging-Header.h`),
    path.join(iosRoot, projectName, `${projectName}-Bridging-Header.h`),
    path.join(iosRoot, 'Bridging-Header.h'),
  ];

  for (const headerPath of possiblePaths) {
    if (fs.existsSync(headerPath)) {
      return headerPath;
    }
  }

  // Try to find any bridging header in the ios directory
  try {
    const entries = fs.readdirSync(iosRoot);
    const bridgingHeader = entries.find(name => name.endsWith('-Bridging-Header.h'));
    if (bridgingHeader) {
      return path.join(iosRoot, bridgingHeader);
    }
  } catch {
    // Ignore errors
  }

  return null;
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
