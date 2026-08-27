import UIKit
import Capacitor

class HealthBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(HealthStepsPlugin())
    }
}
