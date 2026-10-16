package com.gacoaching.app;

import android.Manifest;
import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "RestTimerNative",
    permissions = {
        @Permission(
            alias = "notifications",
            strings = { Manifest.permission.POST_NOTIFICATIONS }
        )
    }
)
public class RestTimerNativePlugin extends Plugin {
    static final String PREFS = "ga_rest_timer_native_v1";
    static final String CHANNEL_ACTIVE = "ga_rest_timer_active";
    static final String CHANNEL_FINISHED = "ga_rest_timer_finished";
    static final int ACTIVE_NOTIFICATION_ID = 47017;
    static final int FINISHED_NOTIFICATION_ID = 47018;

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        ensureChannels(getContext());

        if (
            Build.VERSION.SDK_INT >= 33 &&
            getPermissionState("notifications") != PermissionState.GRANTED
        ) {
            requestPermissionForAlias(
                "notifications",
                call,
                "notificationPermissionCallback"
            );
            return;
        }

        JSObject result = new JSObject();
        result.put("granted", true);
        result.put("liveActivities", false);
        call.resolve(result);
    }

    @PermissionCallback
    private void notificationPermissionCallback(PluginCall call) {
        JSObject result = new JSObject();
        result.put(
            "granted",
            Build.VERSION.SDK_INT < 33 ||
            getPermissionState("notifications") == PermissionState.GRANTED
        );
        result.put("liveActivities", false);
        call.resolve(result);
    }

    @PluginMethod
    public void start(PluginCall call) {
        ensureChannels(getContext());

        RestTimerState state =
            RestTimerState.fromCall(call);

        if (state == null) {
            call.reject("Données du timer invalides.");
            return;
        }

        saveState(getContext(), state);
        showActiveNotification(getContext(), state);
        scheduleFinishAlarm(getContext(), state.endAtEpochMs);

        JSObject result = new JSObject();
        result.put("active", true);
        call.resolve(result);
    }

    @PluginMethod
    public void update(PluginCall call) {
        start(call);
    }

    @PluginMethod
    public void end(PluginCall call) {
        clearTimer(getContext());

        JSObject result = new JSObject();
        result.put("active", false);
        call.resolve(result);
    }

    @PluginMethod
    public void getCurrent(PluginCall call) {
        RestTimerState state =
            readState(getContext());

        if (
            state == null ||
            state.endAtEpochMs <=
                System.currentTimeMillis()
        ) {
            JSObject result = new JSObject();
            result.put("active", false);
            call.resolve(result);
            return;
        }

        JSObject result = new JSObject();
        result.put("active", true);
        result.put("athleteSlug", state.athleteSlug);
        result.put("exerciseKey", state.exerciseKey);
        result.put("exerciseName", state.exerciseName);
        result.put("completedSet", state.completedSet);
        result.put("nextSet", state.nextSet);
        result.put("nextLoad", state.nextLoad);
        result.put("nextReps", state.nextReps);
        result.put("durationSeconds", state.durationSeconds);
        result.put("startedAt", state.startedAtEpochMs);
        result.put("endAtEpochMs", state.endAtEpochMs);
        result.put("endAt", state.endAtIso);
        call.resolve(result);
    }

    static void ensureChannels(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationManager manager =
            context.getSystemService(NotificationManager.class);

        NotificationChannel active =
            new NotificationChannel(
                CHANNEL_ACTIVE,
                "Chronomètre de repos",
                NotificationManager.IMPORTANCE_LOW
            );

        active.setDescription(
            "Chronomètre visible pendant les temps de repos."
        );
        active.setSound(null, null);

        NotificationChannel finished =
            new NotificationChannel(
                CHANNEL_FINISHED,
                "Fin du temps de repos",
                NotificationManager.IMPORTANCE_HIGH
            );

        finished.setDescription(
            "Alerte quand le temps de repos est terminé."
        );

        manager.createNotificationChannel(active);
        manager.createNotificationChannel(finished);
    }

    static void showActiveNotification(
        Context context,
        RestTimerState state
    ) {
        ensureChannels(context);

        String next =
            joinParts(
                state.nextSet,
                state.nextLoad,
                state.nextReps
            );

        Intent openIntent =
            context.getPackageManager()
                .getLaunchIntentForPackage(
                    context.getPackageName()
                );

        PendingIntent contentIntent =
            openIntent == null
                ? null
                : PendingIntent.getActivity(
                    context,
                    47010,
                    openIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT |
                    PendingIntent.FLAG_IMMUTABLE
                );

        NotificationCompat.Builder builder =
            new NotificationCompat.Builder(
                context,
                CHANNEL_ACTIVE
            )
                .setSmallIcon(
                    android.R.drawable.ic_lock_idle_alarm
                )
                .setContentTitle(
                    state.exerciseName
                )
                .setContentText(
                    next.isEmpty()
                        ? "Repos en cours"
                        : "Suivante · " + next
                )
                .setSubText(
                    state.completedSet
                )
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setCategory(
                    NotificationCompat.CATEGORY_STOPWATCH
                )
                .setPriority(
                    NotificationCompat.PRIORITY_LOW
                )
                .setWhen(
                    state.endAtEpochMs
                )
                .setUsesChronometer(true)
                .setChronometerCountDown(true)
                .setShowWhen(true);

        if (contentIntent != null) {
            builder.setContentIntent(contentIntent);
        }

        builder.addAction(
            0,
            "−15s",
            actionIntent(
                context,
                RestTimerReceiver.ACTION_MINUS,
                47011
            )
        );

        builder.addAction(
            0,
            "Passer",
            actionIntent(
                context,
                RestTimerReceiver.ACTION_SKIP,
                47012
            )
        );

        builder.addAction(
            0,
            "+15s",
            actionIntent(
                context,
                RestTimerReceiver.ACTION_PLUS,
                47013
            )
        );

        try {
            NotificationManagerCompat
                .from(context)
                .notify(
                    ACTIVE_NOTIFICATION_ID,
                    builder.build()
                );
        } catch (SecurityException ignored) {
            // Permission refused: in-app timer still works.
        }
    }

    static void showFinishedNotification(
        Context context,
        RestTimerState state
    ) {
        ensureChannels(context);

        String next =
            joinParts(
                state.nextSet,
                state.nextLoad,
                state.nextReps
            );

        NotificationCompat.Builder builder =
            new NotificationCompat.Builder(
                context,
                CHANNEL_FINISHED
            )
                .setSmallIcon(
                    android.R.drawable.ic_lock_idle_alarm
                )
                .setContentTitle(
                    "Repos terminé · " +
                    state.exerciseName
                )
                .setContentText(
                    next.isEmpty()
                        ? "Prêt pour la prochaine série."
                        : "À toi · " + next
                )
                .setAutoCancel(true)
                .setPriority(
                    NotificationCompat.PRIORITY_HIGH
                )
                .setDefaults(
                    NotificationCompat.DEFAULT_ALL
                );

        try {
            NotificationManagerCompat
                .from(context)
                .notify(
                    FINISHED_NOTIFICATION_ID,
                    builder.build()
                );
        } catch (SecurityException ignored) {
            // Permission refused.
        }
    }

    static PendingIntent actionIntent(
        Context context,
        String action,
        int requestCode
    ) {
        Intent intent =
            new Intent(
                context,
                RestTimerReceiver.class
            );

        intent.setAction(action);

        return PendingIntent.getBroadcast(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT |
            PendingIntent.FLAG_IMMUTABLE
        );
    }

    static void scheduleFinishAlarm(
        Context context,
        long endAt
    ) {
        AlarmManager manager =
            (AlarmManager)
                context.getSystemService(
                    Context.ALARM_SERVICE
                );

        PendingIntent intent =
            actionIntent(
                context,
                RestTimerReceiver.ACTION_FINISH,
                47014
            );

        manager.cancel(intent);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            manager.setAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP,
                endAt,
                intent
            );
        } else {
            manager.set(
                AlarmManager.RTC_WAKEUP,
                endAt,
                intent
            );
        }
    }

    static void clearTimer(
        Context context
    ) {
        AlarmManager manager =
            (AlarmManager)
                context.getSystemService(
                    Context.ALARM_SERVICE
                );

        manager.cancel(
            actionIntent(
                context,
                RestTimerReceiver.ACTION_FINISH,
                47014
            )
        );

        NotificationManagerCompat
            .from(context)
            .cancel(
                ACTIVE_NOTIFICATION_ID
            );

        context.getSharedPreferences(
            PREFS,
            Context.MODE_PRIVATE
        )
            .edit()
            .clear()
            .apply();
    }

    static RestTimerState readState(
        Context context
    ) {
        SharedPreferences prefs =
            context.getSharedPreferences(
                PREFS,
                Context.MODE_PRIVATE
            );

        if (!prefs.getBoolean("active", false)) {
            return null;
        }

        return RestTimerState.fromPrefs(prefs);
    }

    static void saveState(
        Context context,
        RestTimerState state
    ) {
        state.save(
            context.getSharedPreferences(
                PREFS,
                Context.MODE_PRIVATE
            )
        );
    }

    static String joinParts(
        String... parts
    ) {
        StringBuilder builder =
            new StringBuilder();

        for (String part : parts) {
            if (
                part == null ||
                part.trim().isEmpty()
            ) {
                continue;
            }

            if (builder.length() > 0) {
                builder.append(" · ");
            }

            builder.append(part.trim());
        }

        return builder.toString();
    }

    static final class RestTimerState {
        String athleteSlug;
        String exerciseKey;
        String exerciseName;
        String completedSet;
        String nextSet;
        String nextLoad;
        String nextReps;
        String endAtIso;
        int durationSeconds;
        long startedAtEpochMs;
        long endAtEpochMs;

        static RestTimerState fromCall(
            PluginCall call
        ) {
            Long endAt =
                call.getLong(
                    "endAtEpochMs"
                );

            if (
                endAt == null ||
                endAt <= 0
            ) {
                return null;
            }

            RestTimerState state =
                new RestTimerState();

            state.athleteSlug =
                value(
                    call.getString(
                        "athleteSlug"
                    )
                );
            state.exerciseKey =
                value(
                    call.getString(
                        "exerciseKey"
                    )
                );
            state.exerciseName =
                valueOr(
                    call.getString(
                        "exerciseName"
                    ),
                    "Exercice"
                );
            state.completedSet =
                value(
                    call.getString(
                        "completedSet"
                    )
                );
            state.nextSet =
                value(
                    call.getString(
                        "nextSet"
                    )
                );
            state.nextLoad =
                value(
                    call.getString(
                        "nextLoad"
                    )
                );
            state.nextReps =
                value(
                    call.getString(
                        "nextReps"
                    )
                );
            state.endAtIso =
                value(
                    call.getString(
                        "endAt"
                    )
                );
            state.durationSeconds =
                Math.max(
                    1,
                    call.getInt(
                        "durationSeconds",
                        90
                    )
                );
            state.startedAtEpochMs =
                System.currentTimeMillis();
            state.endAtEpochMs =
                endAt;

            return state;
        }

        static RestTimerState fromPrefs(
            SharedPreferences prefs
        ) {
            RestTimerState state =
                new RestTimerState();

            state.athleteSlug =
                prefs.getString(
                    "athleteSlug",
                    ""
                );
            state.exerciseKey =
                prefs.getString(
                    "exerciseKey",
                    ""
                );
            state.exerciseName =
                prefs.getString(
                    "exerciseName",
                    "Exercice"
                );
            state.completedSet =
                prefs.getString(
                    "completedSet",
                    ""
                );
            state.nextSet =
                prefs.getString(
                    "nextSet",
                    ""
                );
            state.nextLoad =
                prefs.getString(
                    "nextLoad",
                    ""
                );
            state.nextReps =
                prefs.getString(
                    "nextReps",
                    ""
                );
            state.endAtIso =
                prefs.getString(
                    "endAtIso",
                    ""
                );
            state.durationSeconds =
                prefs.getInt(
                    "durationSeconds",
                    90
                );
            state.startedAtEpochMs =
                prefs.getLong(
                    "startedAtEpochMs",
                    0
                );
            state.endAtEpochMs =
                prefs.getLong(
                    "endAtEpochMs",
                    0
                );

            return state;
        }

        void save(
            SharedPreferences prefs
        ) {
            prefs.edit()
                .putBoolean(
                    "active",
                    true
                )
                .putString(
                    "athleteSlug",
                    athleteSlug
                )
                .putString(
                    "exerciseKey",
                    exerciseKey
                )
                .putString(
                    "exerciseName",
                    exerciseName
                )
                .putString(
                    "completedSet",
                    completedSet
                )
                .putString(
                    "nextSet",
                    nextSet
                )
                .putString(
                    "nextLoad",
                    nextLoad
                )
                .putString(
                    "nextReps",
                    nextReps
                )
                .putString(
                    "endAtIso",
                    endAtIso
                )
                .putInt(
                    "durationSeconds",
                    durationSeconds
                )
                .putLong(
                    "startedAtEpochMs",
                    startedAtEpochMs
                )
                .putLong(
                    "endAtEpochMs",
                    endAtEpochMs
                )
                .apply();
        }

        static String value(
            String value
        ) {
            return value == null
                ? ""
                : value;
        }

        static String valueOr(
            String value,
            String fallback
        ) {
            return (
                value == null ||
                value.trim().isEmpty()
            )
                ? fallback
                : value;
        }
    }
}
