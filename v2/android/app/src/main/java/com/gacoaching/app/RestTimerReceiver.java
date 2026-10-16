package com.gacoaching.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import androidx.core.app.NotificationManagerCompat;

public class RestTimerReceiver extends BroadcastReceiver {
    public static final String ACTION_MINUS =
        "com.gacoaching.app.rest.MINUS_15";

    public static final String ACTION_PLUS =
        "com.gacoaching.app.rest.PLUS_15";

    public static final String ACTION_SKIP =
        "com.gacoaching.app.rest.SKIP";

    public static final String ACTION_FINISH =
        "com.gacoaching.app.rest.FINISH";

    @Override
    public void onReceive(
        Context context,
        Intent intent
    ) {
        if (intent == null) {
            return;
        }

        String action =
            intent.getAction();

        RestTimerNativePlugin.RestTimerState state =
            RestTimerNativePlugin
                .readState(context);

        if (state == null) {
            RestTimerNativePlugin
                .clearTimer(context);
            return;
        }

        if (ACTION_SKIP.equals(action)) {
            RestTimerNativePlugin
                .clearTimer(context);
            return;
        }

        if (ACTION_MINUS.equals(action)) {
            adjust(
                context,
                state,
                -15
            );
            return;
        }

        if (ACTION_PLUS.equals(action)) {
            adjust(
                context,
                state,
                15
            );
            return;
        }

        if (ACTION_FINISH.equals(action)) {
            NotificationManagerCompat
                .from(context)
                .cancel(
                    RestTimerNativePlugin
                        .ACTIVE_NOTIFICATION_ID
                );

            RestTimerNativePlugin
                .showFinishedNotification(
                    context,
                    state
                );

            RestTimerNativePlugin
                .clearTimer(context);
        }
    }

    private void adjust(
        Context context,
        RestTimerNativePlugin
            .RestTimerState state,
        int deltaSeconds
    ) {
        long now =
            System.currentTimeMillis();

        long remainingMs =
            Math.max(
                5_000L,
                state.endAtEpochMs -
                now +
                deltaSeconds * 1000L
            );

        state.endAtEpochMs =
            now +
            remainingMs;

        state.durationSeconds =
            Math.max(
                state.durationSeconds,
                (int) Math.ceil(
                    remainingMs /
                    1000.0
                )
            );

        RestTimerNativePlugin
            .saveState(
                context,
                state
            );

        RestTimerNativePlugin
            .showActiveNotification(
                context,
                state
            );

        RestTimerNativePlugin
            .scheduleFinishAlarm(
                context,
                state.endAtEpochMs
            );
    }
}
