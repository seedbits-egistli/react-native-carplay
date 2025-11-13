import Foundation
import CarPlay

class CarSceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate {
  func templateApplicationScene(_ templateApplicationScene: CPTemplateApplicationScene,
                                  didConnect interfaceController: CPInterfaceController) {
    // Initialize app from scene (creates bridge if needed)
    // Pass nil for connectionOptions since CarPlay doesn't provide them in the same way
    guard let appDelegate = (UIApplication.shared.delegate as? AppDelegate) else { return }
    _ = appDelegate.initAppFromScene(nil)
    
    // Ensure bridge exists before connecting
    guard appDelegate.bridge != nil else {
      print("Error: Bridge not initialized for CarPlay scene")
      return
    }
    
    RNCarPlay.connect(with: interfaceController, window: templateApplicationScene.carWindow, scene: templateApplicationScene);
  }

  func templateApplicationScene(_ templateApplicationScene: CPTemplateApplicationScene, didDisconnectInterfaceController interfaceController: CPInterfaceController) {
    RNCarPlay.disconnect()
  }
}
