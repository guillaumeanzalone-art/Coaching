import Foundation
import Capacitor
import HealthKit

@objc(HealthStepsPlugin)
public class HealthStepsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HealthStepsPlugin"
    public let jsName = "HealthSteps"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getTodaySteps", returnType: CAPPluginReturnPromise)
    ]

    private let healthStore = HKHealthStore()

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve([
            "available": HKHealthStore.isHealthDataAvailable()
        ])
    }

    @objc func requestAuthorization(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.unavailable("HealthKit n'est pas disponible sur cet appareil.")
            return
        }

        guard let stepType = HKQuantityType.quantityType(forIdentifier: .stepCount) else {
            call.unavailable("Le type de donnée 'pas' n'est pas disponible.")
            return
        }

        healthStore.requestAuthorization(toShare: [], read: [stepType]) { success, error in
            DispatchQueue.main.async {
                if let error = error {
                    call.reject(error.localizedDescription, nil, error)
                    return
                }

                call.resolve([
                    "granted": success
                ])
            }
        }
    }

    @objc func getTodaySteps(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.unavailable("HealthKit n'est pas disponible sur cet appareil.")
            return
        }

        guard let stepType = HKQuantityType.quantityType(forIdentifier: .stepCount) else {
            call.unavailable("Le type de donnée 'pas' n'est pas disponible.")
            return
        }

        let calendar = Calendar.current
        let startOfDay = calendar.startOfDay(for: Date())
        let end = Date()
        let predicate = HKQuery.predicateForSamples(
            withStart: startOfDay,
            end: end,
            options: [.strictStartDate]
        )

        let query = HKStatisticsQuery(
            quantityType: stepType,
            quantitySamplePredicate: predicate,
            options: [.cumulativeSum]
        ) { _, result, error in
            DispatchQueue.main.async {
                if let error = error {
                    call.reject(error.localizedDescription, nil, error)
                    return
                }

                let steps = result?.sumQuantity()?.doubleValue(for: HKUnit.count()) ?? 0

                call.resolve([
                    "steps": Int(max(0, steps)),
                    "date": ISO8601DateFormatter().string(from: startOfDay),
                    "syncedAt": ISO8601DateFormatter().string(from: end)
                ])
            }
        }

        healthStore.execute(query)
    }
}
