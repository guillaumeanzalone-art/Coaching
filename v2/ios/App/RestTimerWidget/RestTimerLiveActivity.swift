import ActivityKit
import AppIntents
import SwiftUI
import UserNotifications
import WidgetKit

struct RestTimerLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(
            for:
                RestTimerAttributes
                    .self
        ) { context in
            RestTimerLockScreenView(
                context: context
            )
            .activityBackgroundTint(
                Color(
                    red: 0.055,
                    green: 0.075,
                    blue: 0.14
                )
            )
            .activitySystemActionForegroundColor(
                .white
            )
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(
                    .leading
                ) {
                    Label(
                        "Repos",
                        systemImage:
                            "timer"
                    )
                    .font(
                        .caption
                            .bold()
                    )
                }

                DynamicIslandExpandedRegion(
                    .trailing
                ) {
                    RestTimerCountdown(
                        endDate:
                            context.state
                                .endDate,
                        compact: true
                    )
                }

                DynamicIslandExpandedRegion(
                    .center
                ) {
                    Text(
                        context.state
                            .exerciseName
                    )
                    .font(
                        .headline
                    )
                    .lineLimit(1)
                }

                DynamicIslandExpandedRegion(
                    .bottom
                ) {
                    VStack(
                        alignment:
                            .leading,
                        spacing: 7
                    ) {
                        RestTimerNextSet(
                            state:
                                context.state
                        )

                        if #available(
                            iOSApplicationExtension 17.0,
                            *
                        ) {
                            RestTimerIntentButtons()
                        }
                    }
                }
            } compactLeading: {
                Image(
                    systemName:
                        "timer"
                )
                .foregroundStyle(
                    .cyan
                )
            } compactTrailing: {
                RestTimerCountdown(
                    endDate:
                        context.state
                            .endDate,
                    compact: true
                )
            } minimal: {
                Image(
                    systemName:
                        "timer"
                )
                .foregroundStyle(
                    .cyan
                )
            }
        }
    }
}

private struct RestTimerLockScreenView: View {
    let context:
        ActivityViewContext<
            RestTimerAttributes
        >

    var body: some View {
        VStack(
            alignment: .leading,
            spacing: 9
        ) {
            HStack(
                alignment: .firstTextBaseline
            ) {
                VStack(
                    alignment: .leading,
                    spacing: 2
                ) {
                    Text(
                        context.state
                            .exerciseName
                    )
                    .font(
                        .headline
                            .bold()
                    )
                    .lineLimit(1)

                    if !context.state
                        .completedSet
                        .isEmpty
                    {
                        Text(
                            context.state
                                .completedSet
                        )
                        .font(
                            .caption
                        )
                        .foregroundStyle(
                            .secondary
                        )
                        .lineLimit(1)
                    }
                }

                Spacer()

                RestTimerCountdown(
                    endDate:
                        context.state
                            .endDate,
                    compact: false
                )
            }

            RestTimerProgress(
                endDate:
                    context.state
                        .endDate,
                durationSeconds:
                    context.state
                        .durationSeconds
            )

            RestTimerNextSet(
                state:
                    context.state
            )

            if #available(
                iOSApplicationExtension 17.0,
                *
            ) {
                RestTimerIntentButtons()
            }
        }
        .padding(
            14
        )
    }
}

private struct RestTimerCountdown: View {
    let endDate: Date
    let compact: Bool

    var body: some View {
        if endDate > Date() {
            Text(
                timerInterval:
                    Date()...endDate,
                countsDown: true
            )
            .monospacedDigit()
            .font(
                compact
                    ? .caption.bold()
                    : .title2.bold()
            )
            .foregroundStyle(
                .white
            )
        } else {
            Text("GO")
                .font(
                    compact
                        ? .caption.bold()
                        : .title2.bold()
                )
                .foregroundStyle(
                    .green
                )
        }
    }
}

private struct RestTimerProgress: View {
    let endDate: Date
    let durationSeconds: Int

    private var progress: Double {
        let remaining =
            max(
                0,
                endDate
                    .timeIntervalSinceNow
            )

        return min(
            1,
            remaining /
            Double(
                max(
                    1,
                    durationSeconds
                )
            )
        )
    }

    var body: some View {
        GeometryReader {
            proxy in

            ZStack(
                alignment: .leading
            ) {
                Capsule()
                    .fill(
                        Color.white
                            .opacity(0.12)
                    )

                Capsule()
                    .fill(
                        LinearGradient(
                            colors: [
                                .blue,
                                .cyan
                            ],
                            startPoint:
                                .leading,
                            endPoint:
                                .trailing
                        )
                    )
                    .frame(
                        width:
                            proxy.size.width *
                            progress
                    )
            }
        }
        .frame(
            height: 5
        )
    }
}

private struct RestTimerNextSet: View {
    let state:
        RestTimerAttributes
            .ContentState

    var body: some View {
        VStack(
            alignment: .leading,
            spacing: 2
        ) {
            Text("SUIVANTE")
                .font(
                    .caption2
                        .bold()
                )
                .foregroundStyle(
                    .secondary
                )

            Text(
                state.nextSet
            )
            .font(
                .subheadline
                    .bold()
            )
            .lineLimit(1)

            Text(
                [
                    state.nextLoad,
                    state.nextReps
                ]
                .filter {
                    !$0.isEmpty
                }
                .joined(
                    separator: " · "
                )
            )
            .font(
                .caption
            )
            .foregroundStyle(
                .secondary
            )
            .lineLimit(1)
        }
    }
}

@available(
    iOSApplicationExtension 17.0,
    *
)
private struct RestTimerIntentButtons: View {
    var body: some View {
        HStack(
            spacing: 8
        ) {
            Button(
                intent:
                    RestTimerMinusIntent()
            ) {
                Text("−15 s")
                    .frame(
                        maxWidth:
                            .infinity
                    )
            }

            Button(
                intent:
                    RestTimerSkipIntent()
            ) {
                Text("Prêt")
                    .frame(
                        maxWidth:
                            .infinity
                    )
            }

            Button(
                intent:
                    RestTimerPlusIntent()
            ) {
                Text("+15 s")
                    .frame(
                        maxWidth:
                            .infinity
                    )
            }
        }
        .buttonStyle(
            .bordered
        )
        .tint(
            .blue
        )
    }
}

@available(
    iOSApplicationExtension 17.0,
    *
)
struct RestTimerMinusIntent: AppIntent {
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

@available(
    iOSApplicationExtension 17.0,
    *
)
struct RestTimerPlusIntent: AppIntent {
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

@available(
    iOSApplicationExtension 17.0,
    *
)
struct RestTimerSkipIntent: AppIntent {
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

@available(
    iOSApplicationExtension 17.0,
    *
)
private enum RestTimerIntentHelper {
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
