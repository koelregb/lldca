package com.lldca.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.Settings;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 后台监测核心：抓行情 → 比对提醒条件 → 发通知。
 * 由 WatchWorker（WorkManager 定时）在 App 未打开时调用；也供 WatchPlugin 读写配置。
 */
public class WatchCore {

    public static final String PREFS = "fuley_watch";
    public static final String KEY_ALERTS = "alerts";
    public static final String KEY_TONE = "tone";
    public static final String KEY_LANG = "lang";
    public static final String KEY_ON = "on";
    public static final String KEY_MIN = "min";
    public static final String KEY_LAST_CHECK = "lastCheck";
    public static final String KEY_LAST_FIRE = "lastFire";
    public static final String KEY_LAST_RESULT = "lastResult";

    public static final String WORK_NAME = "fuley_watch";

    private static final String CBOE = "https://cdn.cboe.com/api/global/delayed_quotes/quotes/_VIX.json";
    private static final String CNBC = "https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol"
            + "?symbols=.VIX&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json";
    private static final String QT = "https://qt.gtimg.cn/q=";

    /** 后台闹钟触发后暂存，回到 App 时由插件取走并弹全屏卡片 */
    public static volatile String pendingTitle = null;
    public static volatile String pendingBody = null;

    private static MediaPlayer ringer;

    /** 不依赖通知通道的振铃：直接播 res/raw，走闹钟音量，可循环 */
    public static void startRing(Context c, String toneId, boolean loop) {
        try {
            stopRing();
            int rid = c.getResources().getIdentifier(toneId, "raw", c.getPackageName());
            if (rid == 0) return;
            ringer = new MediaPlayer();
            ringer.setAudioAttributes(new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .build());
            ringer.setDataSource(c, Uri.parse("android.resource://" + c.getPackageName() + "/raw/" + toneId));
            ringer.setLooping(loop);
            /* 息屏/后台也把铃声播完：CPU 保持唤醒，避免省电休眠掐断音频 */
            ringer.setWakeMode(c, PowerManager.PARTIAL_WAKE_LOCK);
            ringer.prepare();
            ringer.start();
        } catch (Exception ignored) {
            stopRing();
        }
    }

    public static void stopRing() {
        try {
            if (ringer != null) {
                if (ringer.isPlaying()) ringer.stop();
                ringer.release();
            }
        } catch (Exception ignored) {
        }
        ringer = null;
    }

    /** 后台用：播 seconds 秒（Worker 持 wakelock，期间不会被休眠掐断） */
    public static void ringFor(Context c, String toneId, int seconds) {
        startRing(c, toneId, true);
        try {
            Thread.sleep(seconds * 1000L);
        } catch (InterruptedException ignored) {
        }
        stopRing();
    }

    /* ---------------- 配置存取 ---------------- */

    public static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static JSONArray loadAlerts(Context c) {
        try {
            return new JSONArray(prefs(c).getString(KEY_ALERTS, "[]"));
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    public static void saveAlerts(Context c, JSONArray arr) {
        prefs(c).edit().putString(KEY_ALERTS, arr.toString()).apply();
    }

    private static final String[] TONE_IDS = {"alice", "canon", "turkish", "ode", "bigben", "phone"};

    public static String tone(Context c) {
        String t = prefs(c).getString(KEY_TONE, "alice");
        for (String id : TONE_IDS) {
            if (id.equals(t)) return t;
        }
        return "alice";   /* 旧版铃声（alarm/beep/.../system）已下线，统一迁移 */
    }

    public static boolean enabled(Context c) {
        return prefs(c).getBoolean(KEY_ON, false);
    }

    public static int intervalMin(Context c) {
        int m = prefs(c).getInt(KEY_MIN, 15);
        return m < 15 ? 15 : m;
    }

    public static boolean batteryOk(Context c) {
        try {
            android.os.PowerManager pm = (android.os.PowerManager) c.getSystemService(Context.POWER_SERVICE);
            return pm != null && pm.isIgnoringBatteryOptimizations(c.getPackageName());
        } catch (Exception e) {
            return true;
        }
    }

    public static boolean canNotify(Context c) {
        try {
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return false;
            if (Build.VERSION.SDK_INT >= 24) return nm.areNotificationsEnabled();
            return true;
        } catch (Exception e) {
            return true;
        }
    }

    /* ---------------- 主流程 ---------------- */

    /** 返回一句人类可读的结果，写进 lastResult 供界面显示。 */
    public static String run(Context c) {
        long now = System.currentTimeMillis();
        String day = new SimpleDateFormat("yyyyMMdd", Locale.US).format(new Date(now));
        JSONArray all = loadAlerts(c);
        List<JSONObject> live = new ArrayList<>();
        for (int i = 0; i < all.length(); i++) {
            JSONObject a = all.optJSONObject(i);
            if (a == null) continue;
            if (!a.optBoolean("on", true)) continue;
            String t = a.optString("type", "");
            if (!"price".equals(t) && !"vix".equals(t)) continue;
            live.add(a);
        }
        if (live.isEmpty()) {
            prefs(c).edit().putLong(KEY_LAST_CHECK, now).putString(KEY_LAST_RESULT, "no-alert").apply();
            return "no-alert";
        }

        boolean zh = !"en".equals(prefs(c).getString(KEY_LANG, "zh"));
        int fired = 0;

        /* 个股 */
        List<JSONObject> priceAlerts = new ArrayList<>();
        for (JSONObject a : live) if ("price".equals(a.optString("type"))) priceAlerts.add(a);

        if (!priceAlerts.isEmpty()) {
            Map<String, Double> got = fetchPrices(priceAlerts);
            for (JSONObject a : priceAlerts) {
                Double cur = got.get(a.optString("code", "").toUpperCase(Locale.US));
                if (cur == null) continue;
                if (apply(c, a, cur.doubleValue(), day, now, zh)) fired++;
            }
        }

        /* VIX */
        boolean hasVix = false;
        for (JSONObject a : live) if ("vix".equals(a.optString("type"))) hasVix = true;
        if (hasVix) {
            Double v = fetchVix();
            if (v != null) {
                for (JSONObject a : live) {
                    if (!"vix".equals(a.optString("type"))) continue;
                    if (apply(c, a, v.doubleValue(), day, now, zh)) fired++;
                }
            }
        }

        if (fired > 0) {
            /* 通知之外再独立振铃一次（通道被关、通知权限被拒时也能响）；Worker 持 wakelock，期间不会被休眠掐断 */
            ringFor(c, tone(c), 12);
        }
        saveAlerts(c, all);
        String result = fired > 0 ? ("fired:" + fired) : "ok";
        SharedPreferences.Editor ed = prefs(c).edit()
                .putLong(KEY_LAST_CHECK, now)
                .putString(KEY_LAST_RESULT, result);
        if (fired > 0) ed.putLong(KEY_LAST_FIRE, now);
        ed.apply();
        return result;
    }

    /** 判断单条条件；命中则发提醒。返回是否真的发了。 */
    private static boolean apply(Context c, JSONObject a, double cur, String day, long now, boolean zh) {
        boolean gte = !"lte".equals(a.optString("op", "gte"));
        boolean hit = gte ? cur >= a.optDouble("value", 0) : cur <= a.optDouble("value", 0);
        boolean was = a.optBoolean("was", false);
        String freq = a.optString("freq", "once");

        boolean can = true;
        if (!a.optBoolean("on", true)) can = false;
        if ("once".equals(freq) && a.optBoolean("done", false)) can = false;
        if ("daily".equals(freq) && day.equals(a.optString("day", ""))) can = false;
        long last = a.optLong("last", 0);
        long gap = "always".equals(freq) ? 5 * 60 * 1000L : 60 * 1000L;
        if (last > 0 && now - last < gap) can = false;

        boolean fired = false;
        if (hit && can && ("always".equals(freq) || !was)) {
            fire(c, a, cur, zh);
            try {
                a.put("last", now);
                a.put("lastVal", cur);
                a.put("was", true);
                if ("daily".equals(freq)) a.put("day", day);
                if ("once".equals(freq)) {
                    a.put("done", true);
                    a.put("on", false);
                }
            } catch (Exception ignored) {
            }
            fired = true;
        }
        if (was != hit) {
            try {
                a.put("was", hit);
            } catch (Exception ignored) {
            }
        }
        return fired;
    }

    /* ---------------- 提醒发送 ---------------- */

    private static void fire(Context c, JSONObject a, double cur, boolean zh) {
        boolean isP = "price".equals(a.optString("type"));
        String code = a.optString("code", "");
        String name = a.optString("name", "");
        String val = String.format(Locale.US, "%.2f", cur);
        String target = String.format(Locale.US, "%.2f", a.optDouble("value", 0));
        boolean gte = !"lte".equals(a.optString("op", "gte"));

        String title = isP
                ? ((name.isEmpty() ? code : name + " " + code) + (zh ? " 价格提醒" : " price alert"))
                : (zh ? "VIX 恐慌指数提醒" : "VIX alert");
        String body = isP
                ? (code + (zh ? " 现价 " : " now ") + val + (zh ? (gte ? "，已高于 " : "，已低于 ") : (gte ? " — above " : " — below ")) + target)
                : ("VIX" + (zh ? " 现价 " : " now ") + val + (zh ? (gte ? "，已高于 " : "，已低于 ") : (gte ? " — above " : " — below ")) + target);

        List<String> modes = new ArrayList<>();
        JSONArray ma = a.optJSONArray("modes");
        if (ma != null) for (int i = 0; i < ma.length(); i++) modes.add(ma.optString(i, ""));
        if (modes.isEmpty()) modes.add("notify");

        boolean wantAlarm = modes.contains("alarm");
        boolean wantNotify = modes.contains("notify");
        boolean wantVib = modes.contains("vibrate");

        if (wantAlarm) {
            post(c, title, body, alarmChannel(c), true);
        } else if (wantNotify) {
            post(c, title, body, alertChannel2(c), false);
        }
        if (wantVib && !wantAlarm) vibrate(c);
        if (wantAlarm) {
            pendingTitle = title;
            pendingBody = body;
            /* 响铃统一由 run() 收尾时执行一次，避免多条命中串行响 12×N 秒 */
        }
    }

    private static void post(Context c, String title, String body, String channelId, boolean alarm) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        Intent it = new Intent(c, MainActivity.class);
        it.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        it.putExtra("fuley_alarm_title", title);
        it.putExtra("fuley_alarm_body", body);
        int pi = (int) (System.currentTimeMillis() % 100000);
        PendingIntent content = PendingIntent.getActivity(c, pi, it,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification.Builder b = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(c, channelId)
                : new Notification.Builder(c);
        b.setContentTitle(title)
                .setContentText(body)
                .setStyle(new Notification.BigTextStyle().bigText(body))
                .setSmallIcon(R.mipmap.ic_launcher)
                .setAutoCancel(true)
                .setContentIntent(content)
                .setPriority(Notification.PRIORITY_HIGH)
                .setCategory(alarm ? Notification.CATEGORY_ALARM : Notification.CATEGORY_REMINDER);

        if (alarm && Build.VERSION.SDK_INT >= 29) {
            boolean allowed = true;
            if (Build.VERSION.SDK_INT >= 34) {
                try {
                    allowed = nm.canUseFullScreenIntent();
                } catch (Exception ignored) {
                }
            }
            if (allowed) b.setFullScreenIntent(content, true);
        }

        try {
            nm.notify(pi, b.build());
        } catch (Exception ignored) {
        }
    }

    private static String alertChannel2(Context c) {
        String tone = tone(c);
        ensureChannel(c, "fuley_alert2_" + tone, "浮乐提醒 · " + toneName(tone), soundFile(tone), false);
        return "fuley_alert2_" + tone;
    }

    private static String alarmChannel(Context c) {
        String tone = tone(c);
        ensureChannel(c, "fuley_alarm2_" + tone, "浮乐闹钟 · " + toneName(tone), soundFile(tone), true);
        ensureChannel(c, "fuley_alert2_" + tone, "浮乐提醒 · " + toneName(tone), soundFile(tone), false);
        return "fuley_alarm2_" + tone;
    }

    public static void ensureChannels(Context c) {
        alarmChannel(c);
        purgeLegacyChannels(c);
    }

    /** 老版本通道没有音频（创建后无法修改），换 v2 通道时顺手删掉 */
    private static void purgeLegacyChannels(Context c) {
        SharedPreferences p = prefs(c);
        if (p.getBoolean("chanV2", false)) return;
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null && Build.VERSION.SDK_INT >= 26) {
            String[] old = {"fuley_alert", "fuley_alarm", "fuley_alarm_alarm", "fuley_alarm_beep",
                    "fuley_alarm_deep", "fuley_alarm_chime", "fuley_alarm_system"};
            for (String id : old) {
                try {
                    nm.deleteNotificationChannel(id);
                } catch (Exception ignored) {
                }
            }
        }
        p.edit().putBoolean("chanV2", true).apply();
    }

    private static void ensureChannel(Context c, String id, String name, String soundFile, boolean alarm) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (nm.getNotificationChannel(id) != null) return;   // 已存在：声音不可改，跳过
        NotificationChannel ch = new NotificationChannel(id, name, NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription(alarm ? "闹钟式强提醒（响铃 + 振动）" : "VIX 到价提醒");
        Uri u = Settings.System.DEFAULT_NOTIFICATION_URI;
        if (soundFile != null) {
            String res = soundFile.replace(".wav", "");
            if (c.getResources().getIdentifier(res, "raw", c.getPackageName()) != 0) {
                u = Uri.parse("android.resource://" + c.getPackageName() + "/raw/" + res);
            }
        }
        AudioAttributes attrs = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(alarm ? AudioAttributes.USAGE_ALARM : AudioAttributes.USAGE_NOTIFICATION)
                .build();
        ch.setSound(u, attrs);
        ch.enableVibration(true);
        ch.setVibrationPattern(new long[]{600, 300, 600, 300, 600});
        ch.enableLights(true);
        try {
            nm.createNotificationChannel(ch);
        } catch (Exception ignored) {
        }
    }

    private static String toneName(String id) {
        if ("beep".equals(id)) return "滴滴";
        if ("deep".equals(id)) return "低沉";
        if ("chime".equals(id)) return "上行三音";
        if ("siren".equals(id)) return "警报";
        if ("bell".equals(id)) return "钟声";
        if ("alice".equals(id)) return "致爱丽丝";
        if ("canon".equals(id)) return "卡农";
        if ("turkish".equals(id)) return "土耳其进行曲";
        if ("ode".equals(id)) return "欢乐颂";
        if ("bigben".equals(id)) return "大本钟";
        if ("phone".equals(id)) return "老式电话铃";
        return "致爱丽丝";
    }

    /** 音频资源名与铃声 id 同名：alice / canon / turkish / ode / bigben / phone */
    private static String soundFile(String id) {
        if (id == null || id.isEmpty()) return "alice.wav";
        return id + ".wav";
    }

    private static void vibrate(Context c) {
        try {
            Vibrator v = (Vibrator) c.getSystemService(Context.VIBRATOR_SERVICE);
            if (v == null || !v.hasVibrator()) return;
            long[] pat = {0, 420, 220, 420};
            if (Build.VERSION.SDK_INT >= 26) {
                v.vibrate(VibrationEffect.createWaveform(pat, -1));
            } else {
                v.vibrate(pat, -1);
            }
        } catch (Exception ignored) {
        }
    }

    /* ---------------- 行情 ---------------- */

    private static Map<String, Double> fetchPrices(List<JSONObject> alerts) {
        Map<String, Double> out = new LinkedHashMap<>();
        Map<String, String> qt2code = new LinkedHashMap<>();
        for (JSONObject a : alerts) {
            String code = a.optString("code", "");
            String q = qtCode(code);
            if (q != null && !qt2code.containsKey(q)) qt2code.put(q, code.toUpperCase(Locale.US));
        }
        if (qt2code.isEmpty()) return out;

        StringBuilder sb = new StringBuilder();
        for (String q : qt2code.keySet()) {
            if (sb.length() > 0) sb.append(',');
            sb.append(q);
        }
        String txt;
        try {
            txt = http(QT + sb.toString(), "GBK");
        } catch (Exception e) {
            return out;
        }
        Matcher m = Pattern.compile("v_([A-Za-z0-9.]+)=\"([^\"]*)\"").matcher(txt);
        while (m.find()) {
            String key = m.group(1);
            String[] f = m.group(2).split("~");
            if (f.length < 5) continue;
            double p;
            try {
                p = Double.parseDouble(f[3]);
            } catch (Exception e) {
                continue;
            }
            if (!(p > 0)) continue;
            String userCode = qt2code.get(key);
            if (userCode != null) out.put(userCode, p);
        }
        return out;
    }

    /** 与网页层 quoteCodeFor 保持一致 */
    static String qtCode(String code) {
        if (code == null) return null;
        String c = code.trim();
        if (c.isEmpty()) return null;
        String low = c.toLowerCase(Locale.US);
        if (low.matches("^(sh|sz|hk|us|bj)[a-z0-9.\\-]+$")) return low;
        if (c.matches("\\d{6}")) {
            char d = c.charAt(0);
            if (d == '6' || d == '5') return "sh" + c;
            if (d == '0' || d == '1' || d == '2' || d == '3') return "sz" + c;
            if (d == '4' || d == '8' || c.startsWith("92")) return "bj" + c;
            if (d == '9') return "sh" + c;
            return "sz" + c;
        }
        if (c.matches("\\d{5}")) return "hk" + c;
        if (c.matches("[A-Za-z][A-Za-z0-9.\\-]*")) return "us" + c.toUpperCase(Locale.US);
        return null;
    }

    private static Double fetchVix() {
        try {
            JSONObject o = new JSONObject(http(CBOE, "UTF-8"));
            JSONObject d = o.optJSONObject("data");
            if (d != null) {
                double v = d.optDouble("current_price", -1);
                if (v > 0) return v;
            }
        } catch (Exception ignored) {
        }
        try {
            JSONObject o = new JSONObject(http(CNBC, "UTF-8"));
            JSONObject r = o.optJSONObject("FormattedQuoteResult");
            JSONArray q = r == null ? null : r.optJSONArray("FormattedQuote");
            if (q != null && q.length() > 0) {
                String s = q.optJSONObject(0).optString("last", "").replace(",", "");
                double v = Double.parseDouble(s);
                if (v > 0) return v;
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    private static String http(String url, String charset) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setConnectTimeout(8000);
        conn.setReadTimeout(12000);
        conn.setRequestProperty("User-Agent",
                "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36");
        conn.setRequestProperty("Accept", "*/*");
        int code = conn.getResponseCode();
        InputStream in = code >= 400 ? conn.getErrorStream() : conn.getInputStream();
        if (in == null) return "";
        ByteArrayOutputStream bo = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) > 0) bo.write(buf, 0, n);
        in.close();
        conn.disconnect();
        return new String(bo.toByteArray(), charset);
    }
}
