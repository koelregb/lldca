package com.lldca.app;

import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** 打开系统通知设置 / 应用详情页（用于按通道改铃声）。 */
@CapacitorPlugin(name = "AppSettings")
public class AppSettingsPlugin extends Plugin {

    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
            intent.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
            return;
        } catch (Exception ignored) {
            // 部分 ROM 不支持该 action，退回应用详情页
        }
        try {
            Intent detail = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            detail.setData(Uri.parse("package:" + getContext().getPackageName()));
            detail.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(detail);
            call.resolve();
        } catch (Exception e) {
            call.reject("cannot open settings");
        }
    }
}
