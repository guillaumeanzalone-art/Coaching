import Foundation
import Capacitor
import ActivityKit
import UserNotifications

@objc(RestTimerNativePlugin)
public class RestTimerNativePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RestTimerNativePlugin"
    public let jsName = "RestTimerNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestTimerPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getCurrent", returnType: CAPPluginReturnPromise)
    ]

    private let iso = ISO8601DateFormatter()

    @objc func requestTimerPermissions(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().requestAuthorization(
            options: [.alert, .sound, .badge]
        ) { granted, error in
            if let error = error {
                call.reject(error.localizedDescription, nil, error)
                return
            }

            var liveActivities = false

            if #available(iOS 16.2, *) {
                liveActivities =
                    ActivityAuthorizationInfo()
                        .areActivitiesEnabled
            }

            call.resolve([
                "granted": granted,
                "liveActivities": liveActivities
            ])
        }
    }

    @objc func start(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.unavailable("Les Live Activities nécessitent iOS 16.2 ou une version ultérieure.")
            return
        }

        guard
            ActivityAuthorizationInfo()
                .areActivitiesEnabled
        else {
            call.unavailable("Les Live Activities sont désactivées sur cet iPhone.")
            return
        }

        guard
            let payload = payload(from: call)
        else {
            call.reject("Données du timer invalides.")
            return
        }

        Task {
            for activity in Activity<RestTimerAttributes>.activities {
                await activity.end(
                    nil,
                    dismissalPolicy: .immediate
                )
            }

            do {
                let attributes =
                    RestTimerAttributes(
                        athleteSlug: payload.athleteSlug,
                        exerciseKey: payload.exerciseKey,
                        startedAt: Date()
                    )

                let content =
                    ActivityContent(
                        state: payload.state,
                        staleDate:
                            payload.state.endDate
                                .addingTimeInterval(120)
                    )

                let activity =
                    try Activity.request(
                        attributes: attributes,
                        content: content,
                        pushType: nil
                    )

                await scheduleFinishedNotification(
                    state: payload.state
                )

                call.resolve([
                    "active": true,
                    "id": activity.id
                ])
            } catch {
                call.reject(
                    error.localizedDescription,
                    nil,
                    error
                )
            }
        }
    }

    @objc func update(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.unavailable("Les Live Activities nécessitent iOS 16.2 ou une version ultérieure.")
            return
        }

        guard
            let payload = payload(from: call)
        else {
            call.reject("Données du timer invalides.")
            return
        }

        Task {
            guard
                let activity =
                    Activity<RestTimerAttributes>
                        .activities
                        .first
            else {
                call.resolve([
                    "active": false
                ])
                return
            }

            let content =
                ActivityContent(
                    state: payload.state,
                    staleDate:
                        payload.state.endDate
                            .addingTimeInterval(120)
                )

            await activity.update(
                content
            )

            await scheduleFinishedNotification(
                state: payload.state
            )

            call.resolve([
                "active": true,
                "id": activity.id
            ])
        }
    }

    @objc func end(_ call: CAPPluginCall) {
        cancelFinishedNotification()

        guard #available(iOS 16.2, *) else {
            call.resolve([
                "active": false
            ])
            return
        }

        Task {
            for activity in Activity<RestTimerAttributes>.activities {
                await activity.end(
                    nil,
                    dismissalPolicy: .immediate
                )
            }

            call.resolve([
                "active": false
            ])
        }
    }

    @objc func getCurrent(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve([
                "active": false
            ])
            return
        }

        guard
            let activity =
                Activity<RestTimerAttributes>
                    .activities
                    .first
        else {
            call.resolve([
                "active": false
            ])
            return
        }

        let state =
            activity.content.state

        call.resolve([
            "active": true,
            "id": activity.id,
            "athleteSlug":
                activity.attributes
                    .athleteSlug,
            "exerciseKey":
                activity.attributes
                    .exerciseKey,
            "startedAt":
                activity.attributes
                    .startedAt
                    .timeIntervalSince1970 * 1000,
            "endAt":
                iso.string(
                    from:
                        state.endDate
                ),
            "durationSeconds":
                state.durationSeconds,
            "exerciseName":
                state.exerciseName,
            "completedSet":
                state.completedSet,
            "nextSet":
                state.nextSet,
            "nextLoad":
                state.nextLoad,
            "nextReps":
                state.nextReps
        ])
    }

    @available(iOS 16.2, *)
    private func payload(
        from call: CAPPluginCall
    ) -> (
        athleteSlug: String,
        exerciseKey: String,
        state: RestTimerAttributes.ContentState
    )? {
        guard
            let endAtRaw =
                call.getString("endAt"),
            let endDate =
                iso.date(
                    from:
                        endAtRaw
                )
        else {
            return nil
        }

        let athleteSlug =
            call.getString(
                "athleteSlug"
            ) ?? ""

        let exerciseKey =
            call.getString(
                "exerciseKey"
            ) ?? ""

        let state =
            RestTimerAttributes
                .ContentState(
                    endDate: endDate,
                    durationSeconds:
                        max(
                            1,
                            call.getInt(
                                "durationSeconds"
                            ) ?? 90
                        ),
                    exerciseName:
                        call.getString(
                            "exerciseName"
                        ) ?? "Exercice",
                    completedSet:
                        call.getString(
                            "completedSet"
                        ) ?? "",
                    nextSet:
                        call.getString(
                            "nextSet"
                        ) ?? "",
                    nextLoad:
                        call.getString(
                            "nextLoad"
                        ) ?? "",
                    nextReps:
                        call.getString(
                            "nextReps"
                        ) ?? ""
                )

        return (
            athleteSlug,
            exerciseKey,
            state
        )
    }

    @available(iOS 16.2, *)
    private func scheduleFinishedNotification(
        state: RestTimerAttributes.ContentState
    ) async {
        cancelFinishedNotification()

        let interval =
            state.endDate
                .timeIntervalSinceNow

        guard interval > 0 else {
            return
        }

        let content =
            UNMutableNotificationContent()

        content.title =
            "Repos terminé · " +
            state.exerciseName

        let next =
            [
                state.nextSet,
                state.nextLoad,
                state.nextReps
            ]
            .filter {
                !$0.isEmpty
            }
            .joined(
                separator: " · "
            )

        content.body =
            next.isEmpty
                ? "Prêt pour la prochaine série."
                : "À toi : " + next

        content.sound =
            .default

        let trigger =
            UNTimeIntervalNotificationTrigger(
                timeInterval:
                    max(
                        1,
                        interval
                    ),
                repeats: false
            )

        let request =
            UNNotificationRequest(
                identifier:
                    RestTimerSystem
                        .notificationIdentifier,
                content: content,
                trigger: trigger
            )

        try? await
            UNUserNotificationCenter
                .current()
                .add(request)
    }

    private func cancelFinishedNotification() {
        UNUserNotificationCenter
            .current()
            .removePendingNotificationRequests(
                withIdentifiers: [
                    RestTimerSystem
                        .notificationIdentifier
                ]
            )
    }
}
