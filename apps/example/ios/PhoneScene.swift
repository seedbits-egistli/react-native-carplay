import Foundation
import UIKit
import SwiftUI

class PhoneSceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?
  func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
    
    if session.role != .windowApplication {
      return
    }
    
    guard let appDelegate = (UIApplication.shared.delegate as? AppDelegate) else { return }
    guard let windowScene = (scene as? UIWindowScene) else { return }

    // Initialize app from scene (creates bridge if needed)
    let hasCreatedBridge = appDelegate.initAppFromScene(connectionOptions)
    
    // Create rootViewController
    let rootViewController = UIViewController()
    rootViewController.view = appDelegate.rootView

    // Create window and set rootViewController
    let window = UIWindow(windowScene: windowScene)
    window.rootViewController = rootViewController
    self.window = window
    appDelegate.window = window
    
    // Store rootViewController in appDelegate
    appDelegate.rootViewController = rootViewController
    
    window.makeKeyAndVisible()
    
    // Call finishedLaunchingWithOptions for Expo integration
    appDelegate.finishedLaunchingWithOptions(connectionOptions)
  }
}
