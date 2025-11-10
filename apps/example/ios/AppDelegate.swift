import UIKit
import CarPlay
import React

#if DEBUG
#if FB_SONARKIT_ENABLED
import FlipperKit
#endif
#endif

@main
class AppDelegate: RCTAppDelegate {

  var rootView: UIView?;
  var rootViewController: UIViewController?;
  var window: UIWindow?;
  var concurrentRootEnabled = true;

  static var shared: AppDelegate { return UIApplication.shared.delegate as! AppDelegate }

  override func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey : Any]? = nil) -> Bool {
    moduleName = "RNCarPlayScene"
    // Don't create bridge here for Scene-based apps - it will be created lazily in initAppFromScene
    return super.application(application, didFinishLaunchingWithOptions: launchOptions);
  }
  
  func initAppFromScene(_ connectionOptions: UIScene.ConnectionOptions?) -> Bool {
    // If bridge has already been initiated by another scene, there's nothing to do here
    if self.bridge != nil {
      return false;
    }
    
    // Create bridge if it doesn't exist
    let launchOptions = connectionOptionsToLaunchOptions(connectionOptions)
    self.bridge = RCTBridge(delegate: self, launchOptions: launchOptions)
    
    // Create rootView
    let initProps = prepareInitialProps()
    self.rootView = self.createRootView(
      with: self.bridge,
      moduleName: self.moduleName,
      initProps: initProps
    )
    
    self.rootView?.backgroundColor = UIColor.black
    
    return true
  }
  
  func connectionOptionsToLaunchOptions(_ connectionOptions: UIScene.ConnectionOptions?) -> [UIApplication.LaunchOptionsKey: Any]? {
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
  }
  
  func finishedLaunchingWithOptions(_ connectionOptions: UIScene.ConnectionOptions?) {
    let launchOptions = connectionOptionsToLaunchOptions(connectionOptions)
    // For Expo integration, this would forward to Expo's app delegate
    // For pure React Native, this may not be needed, but keeping for compatibility
    // If you're using Expo, uncomment and adapt:
    // _expoAppDelegate?.application(UIApplication.shared, didFinishLaunchingWithOptions: launchOptions)
  }

  override func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
    if (connectingSceneSession.role == UISceneSession.Role.carTemplateApplication) {
      let scene =  UISceneConfiguration(name: "CarPlay", sessionRole: connectingSceneSession.role)
      scene.delegateClass = CarSceneDelegate.self
      return scene
    } else {
      let scene =  UISceneConfiguration(name: "Phone", sessionRole: connectingSceneSession.role)
      scene.delegateClass = PhoneSceneDelegate.self
      return scene
    }
  }

  override func sourceURL(for bridge: RCTBridge!) -> URL! {
    #if DEBUG
      return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index");
    #else
      return Bundle.main.url(forResource:"main", withExtension:"jsbundle")
    #endif
  }

  // not exposed from RCTAppDelegate, recreating.
  func prepareInitialProps() -> [String: Any] {
    var initProps = self.initialProps as? [String: Any] ?? [String: Any]()
    #if RCT_NEW_ARCH_ENABLED
      initProps["kRNConcurrentRoot"] = concurrentRootEnabled()
    #endif
    return initProps
  }
}
