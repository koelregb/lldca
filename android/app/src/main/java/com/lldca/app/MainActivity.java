package com.lldca.app;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppSettingsPlugin.class);
        registerPlugin(WatchPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (intent == null) return;
        String t = intent.getStringExtra("fuley_alarm_title");
        String b = intent.getStringExtra("fuley_alarm_body");
        if (t != null) {
            WatchCore.pendingTitle = t;
            WatchCore.pendingBody = b;
        }
        setIntent(intent);
    }
}
