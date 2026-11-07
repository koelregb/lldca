package com.lldca.app;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.Build;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.concurrent.TimeUnit;

/**
 * 网页层 ↔ 后台监测的桥：
 * configure 同步提醒规则并（按需）排程；pull 回传后台更新过的运行状态；
 * takeAlarm 取走后台触发过的闹钟内容。
 */
@CapacitorPlugin(name = "Watch")
public class WatchPlugin extends Plugin {

    private MediaPlayer player;

    /** 试听 / 振铃：直接播 res/raw，不依赖通知通道 */
    @PluginMethod
    public void playTone(PluginCall call) {
        String id = call.getString("id", "alice");
        boolean loop = Boolean.TRUE.equals(call.getBoolean("loop", false));
        try {
            if (player != null) {
                player.release();
                player = null;
            }
            int rid = getContext().getResources().getIdentifier(id, "raw", getContext().getPackageName());
            if (rid == 0) {
                call.reject("no such tone");
                return;
            }
            player = new MediaPlayer();
            player.setAudioAttributes(new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .build());
            player.setLooping(loop);
            player.setDataSource(getContext(), android.net.Uri.parse(
                    "android.resource://" + getContext().getPackageName() + "/raw/" + id));
            /* 息屏也把铃声播完：CPU 保持唤醒 */
            player.setWakeMode(getContext(), PowerManager.PARTIAL_WAKE_LOCK);
            player.setOnCompletionListener(new MediaPlayer.OnCompletionListener() {
                @Override
                public void onCompletion(MediaPlayer mp) {
                    mp.release();
                    if (player == mp) player = null;
                }
            });
            player.prepare();
            player.start();
            call.resolve(new JSObject().put("ok", true));
        } catch (Exception e) {
            call.reject("play failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopTone(PluginCall call) {
        try {
            if (player != null) {
                if (player.isPlaying()) player.stop();
                player.release();
            }
        } catch (Exception ignored) {
        }
        player = null;
        WatchCore.stopRing();
        call.resolve(new JSObject().put("ok", true));
    }

    /** 自检：把「为什么不响」需要看的每一项都返回给界面 */
    @PluginMethod
    public void diagnose(PluginCall call) {
        Context c = getContext();
        JSObject o = new JSObject();
        SharedPreferences p = WatchCore.prefs(c);
        String tone = WatchCore.tone(c);

        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        AudioManager am = (AudioManager) c.getSystemService(Context.AUDIO_SERVICE);
        AlarmManager alarm = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);

        boolean enabled = true;
        try {
            enabled = nm != null && nm.areNotificationsEnabled();
        } catch (Exception ignored) {
        }
        o.put("notifEnabled", enabled);
        o.put("tone", tone);
        o.put("postPermission", Build.VERSION.SDK_INT < 33 || c.checkSelfPermission("android.permission.POST_NOTIFICATIONS")
                == android.content.pm.PackageManager.PERMISSION_GRANTED);

        NotificationChannel ch = null;
        if (nm != null && Build.VERSION.SDK_INT >= 26) {
            ch = nm.getNotificationChannel("fuley_alarm2_" + tone);
        }
        o.put("channelId", "fuley_alarm2_" + tone);
        o.put("channelExists", ch != null);
        if (ch != null) {
            o.put("channelImportance", ch.getImportance());
            o.put("channelSound", ch.getSound() == null ? "" : ch.getSound().toString());
            o.put("channelBlocked", ch.getImportance() == NotificationManager.IMPORTANCE_NONE);
            o.put("channelBypassDnd", ch.canBypassDnd());
        } else {
            o.put("channelImportance", -1);
            o.put("channelSound", "");
            o.put("channelBlocked", false);
            o.put("channelBypassDnd", false);
        }

        int aVol = 0, aMax = 1, nVol = 0, nMax = 1, mode = -1;
        try {
            if (am != null) {
                aVol = am.getStreamVolume(AudioManager.STREAM_ALARM);
                aMax = am.getStreamMaxVolume(AudioManager.STREAM_ALARM);
                nVol = am.getStreamVolume(AudioManager.STREAM_NOTIFICATION);
                nMax = am.getStreamMaxVolume(AudioManager.STREAM_NOTIFICATION);
                mode = am.getRingerMode();
            }
        } catch (Exception ignored) {
        }
        o.put("alarmVolume", aVol);
        o.put("alarmVolumeMax", aMax);
        o.put("notifVolume", nVol);
        o.put("notifVolumeMax", nMax);
        o.put("ringerMode", mode);
        int filter = 0;
        try {
            if (nm != null && Build.VERSION.SDK_INT >= 23) filter = nm.getCurrentInterruptionFilter();
        } catch (Exception ignored) {
        }
        o.put("dndFilter", filter);
        o.put("dndAccess", nm != null && Build.VERSION.SDK_INT >= 23 && nm.isNotificationPolicyAccessGranted());

        boolean exact = true;
        try {
            if (alarm != null && Build.VERSION.SDK_INT >= 31) exact = alarm.canScheduleExactAlarms();
        } catch (Exception ignored) {
        }
        o.put("exactAlarm", exact);
        o.put("batteryOk", WatchCore.batteryOk(c));
        o.put("lastCheck", p.getLong(WatchCore.KEY_LAST_CHECK, 0));
        o.put("lastFire", p.getLong(WatchCore.KEY_LAST_FIRE, 0));
        o.put("lastResult", p.getString(WatchCore.KEY_LAST_RESULT, ""));
        call.resolve(o);
    }

    /** 打开「勿扰 / 通知策略」授权页，让闹钟通道可以穿透勿扰 */
    @PluginMethod
    public void openDndSettings(PluginCall call) {
        Context c = getContext();
        try {
            if (Build.VERSION.SDK_INT >= 23) {
                Intent i = new Intent(android.provider.Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS);
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                c.startActivity(i);
            }
            call.resolve(new JSObject().put("ok", true));
        } catch (Exception e) {
            call.reject("cannot open");
        }
    }

    @PluginMethod
    public void openSoundSettings(PluginCall call) {
        Context c = getContext();
        try {
            Intent i = new Intent(android.provider.Settings.ACTION_SOUND_SETTINGS);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            c.startActivity(i);
            call.resolve(new JSObject().put("ok", true));
        } catch (Exception e) {
            call.reject("cannot open");
        }
    }

    private final Handler handler = new Handler(Looper.getMainLooper());

    /** 立即响一次测试铃声（8 秒后自动停），不阻塞插件线程 */
    @PluginMethod
    public void testAlarm(PluginCall call) {
        try {
            WatchCore.ensureChannels(getContext());
            WatchCore.startRing(getContext(), WatchCore.tone(getContext()), true);
            handler.removeCallbacksAndMessages(null);
            handler.postDelayed(new Runnable() {
                @Override
                public void run() {
                    WatchCore.stopRing();
                }
            }, 8000);
            call.resolve(new JSObject().put("ok", true));
        } catch (Exception e) {
            call.reject("failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void configure(PluginCall call) {
        Context c = getContext();
        boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        int min = call.getInt("min", 15);
        String tone = call.getString("tone", "alarm");
        String lang = call.getString("lang", "zh");
        String alertsJson = call.getString("alerts", "[]");

        SharedPreferences.Editor ed = WatchCore.prefs(c).edit()
                .putBoolean(WatchCore.KEY_ON, on)
                .putInt(WatchCore.KEY_MIN, min < 15 ? 15 : min)
                .putString(WatchCore.KEY_TONE, tone == null ? "alarm" : tone)
                .putString(WatchCore.KEY_LANG, "en".equals(lang) ? "en" : "zh");

        try {
            JSONArray incoming = new JSONArray(alertsJson == null ? "[]" : alertsJson);
            WatchCore.saveAlerts(c, merge(WatchCore.loadAlerts(c), incoming));
        } catch (Exception ignored) {
        }
        ed.apply();

        WatchCore.ensureChannels(c);
        if (on) {
            schedule(c, min);
        } else {
            WorkManager.getInstance(c).cancelUniqueWork(WatchCore.WORK_NAME);
        }
        call.resolve(statusOf(c));
    }

    @PluginMethod
    public void status(PluginCall call) {
        call.resolve(statusOf(getContext()));
    }

    @PluginMethod
    public void pull(PluginCall call) {
        Context c = getContext();
        JSObject o = new JSObject();
        o.put("alerts", WatchCore.loadAlerts(c).toString());
        SharedPreferences p = WatchCore.prefs(c);
        o.put("lastCheck", p.getLong(WatchCore.KEY_LAST_CHECK, 0));
        o.put("lastFire", p.getLong(WatchCore.KEY_LAST_FIRE, 0));
        o.put("lastResult", p.getString(WatchCore.KEY_LAST_RESULT, ""));
        call.resolve(o);
    }

    /** 手动触发一次后台任务（关掉 App 的情况下也能验证）。 */
    @PluginMethod
    public void checkNow(PluginCall call) {
        Context c = getContext();
        Constraints cons = new Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build();
        WorkManager.getInstance(c).enqueueUniqueWork(
                WatchCore.WORK_NAME + "_now",
                ExistingWorkPolicy.REPLACE,
                new OneTimeWorkRequest.Builder(WatchWorker.class).setConstraints(cons).build());
        call.resolve(new JSObject().put("queued", true));
    }

    /** 取走后台触发的闹钟内容（取一次即清空）。 */
    @PluginMethod
    public void takeAlarm(PluginCall call) {
        JSObject o = new JSObject();
        if (WatchCore.pendingTitle != null) {
            o.put("title", WatchCore.pendingTitle);
            o.put("body", WatchCore.pendingBody == null ? "" : WatchCore.pendingBody);
            WatchCore.pendingTitle = null;
            WatchCore.pendingBody = null;
        }
        call.resolve(o);
    }

    /** 打开「忽略电池优化」授权页；部分机型需退回设置列表。 */
    @PluginMethod
    public void openBatterySettings(PluginCall call) {
        Context c = getContext();
        try {
            if (Build.VERSION.SDK_INT >= 23) {
                Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                i.setData(Uri.parse("package:" + c.getPackageName()));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                c.startActivity(i);
                call.resolve(new JSObject().put("ok", true));
                return;
            }
        } catch (Exception ignored) {
        }
        try {
            Intent i2 = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
            i2.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            c.startActivity(i2);
            call.resolve(new JSObject().put("ok", true));
        } catch (Exception e) {
            call.reject("cannot open settings");
        }
    }

    /* ---------------- 内部 ---------------- */

    private void schedule(Context c, int min) {
        Constraints cons = new Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build();
        PeriodicWorkRequest req = new PeriodicWorkRequest.Builder(
                WatchWorker.class, Math.max(15, min), TimeUnit.MINUTES)
                .setConstraints(cons)
                .build();
        WorkManager.getInstance(c).enqueueUniquePeriodicWork(
                WatchCore.WORK_NAME, ExistingPeriodicWorkPolicy.UPDATE, req);
    }

    /** 保留后台已经更新过的运行字段（was / done / day / last），规则字段以网页层为准。 */
    private JSONArray merge(JSONArray stored, JSONArray incoming) {
        JSONArray out = new JSONArray();
        for (int i = 0; i < incoming.length(); i++) {
            JSONObject a = incoming.optJSONObject(i);
            if (a == null) continue;
            JSONObject old = byId(stored, a.optString("id", ""));
            if (old != null && old.optLong("last", 0) > a.optLong("last", 0)) {
                try {
                    a.put("was", old.optBoolean("was", false));
                    a.put("done", old.optBoolean("done", false));
                    a.put("day", old.optString("day", ""));
                    a.put("last", old.optLong("last", 0));
                    a.put("lastVal", old.optDouble("lastVal", 0));
                    if (old.optBoolean("done", false)) a.put("on", false);
                } catch (Exception ignored) {
                }
            }
            out.put(a);
        }
        return out;
    }

    private JSONObject byId(JSONArray arr, String id) {
        if (id == null || id.isEmpty()) return null;
        for (int i = 0; i < arr.length(); i++) {
            JSONObject o = arr.optJSONObject(i);
            if (o != null && id.equals(o.optString("id", ""))) return o;
        }
        return null;
    }

    private JSObject statusOf(Context c) {
        SharedPreferences p = WatchCore.prefs(c);
        JSObject o = new JSObject();
        o.put("on", p.getBoolean(WatchCore.KEY_ON, false));
        o.put("min", WatchCore.intervalMin(c));
        o.put("lastCheck", p.getLong(WatchCore.KEY_LAST_CHECK, 0));
        o.put("lastFire", p.getLong(WatchCore.KEY_LAST_FIRE, 0));
        o.put("lastResult", p.getString(WatchCore.KEY_LAST_RESULT, ""));
        o.put("batteryOk", WatchCore.batteryOk(c));
        o.put("canNotify", WatchCore.canNotify(c));
        return o;
    }
}
