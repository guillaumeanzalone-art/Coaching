import Foundation
import ActivityKit

struct RestTimerAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var endDate: Date
        var durationSeconds: Int
        var exerciseName: String
        var completedSet: String
        var nextSet: String
        var nextLoad: String
        var nextReps: String
    }

    var athleteSlug: String
    var exerciseKey: String
    var startedAt: Date
}

enum RestTimerSystem {
    static let notificationIdentifier = "ga-coaching-rest-timer-finished"
}
