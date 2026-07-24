import Capacitor
import UIKit

final class BridgeViewController: CAPBridgeViewController {
    private let nativeCallNotifications = NativeCallNotificationsPlugin()
    private let nativeSessionMemory = NativeSessionMemoryPlugin()

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(nativeSessionMemory)
        bridge?.registerPluginInstance(nativeCallNotifications)
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        NativeCallCoordinator.shared.bridgeDidAppear()
    }
}
