import Foundation
import ActivityKit
import AppIntents
import UserNotifications

@available(iOS 17.0, *)
struct RestTimerMinusIntent: LiveActivityIntent {
    static var title:
        LocalizedStringResource =
            "Retirer 15 secondes"

    static var openAppWhenRun =
        false

    func perform()
        async throws
        -> some IntentResult
    {
        await RestTimerIntentHelper
            .adjust(
                seconds: -15
            )

        return .result()
    }
}

@available(iOS 17.0, *)
struct RestTimerPlusIntent: LiveActivityIntent {
    static var title:
        LocalizedStringResource =
            "Ajouter 15 secondes"

    static var openAppWhenRun =
        false

    func perform()
        async throws
        -> some IntentResult
    {
        await RestTimerIntentHelper
            .adjust(
                seconds: 15
            )

        return .result()
    }
}

@available(iOS 17.0, *)
struct RestTimerSkipIntent: LiveActivityIntent {
    static var title:
        LocalizedStringResource =
            "Finir le repos"

    static var openAppWhenRun =
        false

    func perform()
        async throws
        -> some IntentResult
    {
        await RestTimerIntentHelper
            .skip()

        return .result()
    }
}

@available(iOS 17.0, *)
enum RestTimerIntentHelper {
    static func adjust(
        seconds: TimeInterval
    ) async {
        guard
            let activity =
                Activity<
                    RestTimerAttributes
                >
                .activities
                .first
        else {
            return
        }

        var state =
            activity.content.state

        let remaining =
            max(
                5,
                state.endDate
                    .timeIntervalSinceNow +
                seconds
            )

        state.endDate =
            Date()
                .addingTimeInterval(
                    remaining
                )

        let content =
            ActivityContent(
                state: state,
                staleDate:
                    state.endDate
                        .addingTimeInterval(
                            120
                        )
            )

        await activity.update(
            content
        )

        scheduleNotification(
            state: state
        )
    }

    static func skip() async {
        guard
            let activity =
                Activity<
                    RestTimerAttributes
                >
                .activities
                .first
        else {
            return
        }

        UNUserNotificationCenter
            .current()
            .removePendingNotificationRequests(
                withIdentifiers: [
                    RestTimerSystem
                        .notificationIdentifier
                ]
            )

        await activity.end(
            nil,
            dismissalPolicy:
                .immediate
        )
    }

    static func scheduleNotification(
        state:
            RestTimerAttributes
                .ContentState
    ) {
        let center =
            UNUserNotificationCenter
                .current()

        center
            .removePendingNotificationRequests(
                withIdentifiers: [
                    RestTimerSystem
                        .notificationIdentifier
                ]
            )

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

        let request =
            UNNotificationRequest(
                identifier:
                    RestTimerSystem
                        .notificationIdentifier,
                content: content,
                trigger:
                    UNTimeIntervalNotificationTrigger(
                        timeInterval:
                            max(
                                1,
                                interval
                            ),
                        repeats:
                            false
                    )
            )

        center.add(
            request
        )
    }
}
