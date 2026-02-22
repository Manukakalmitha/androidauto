package com.manuk.androidauto;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NotificationPlugin")
public class NotificationPlugin extends Plugin {

    private BroadcastReceiver receiver;

    @Override
    public void load() {
        receiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                JSObject ret = new JSObject();
                ret.put("package", intent.getStringExtra("package"));
                ret.put("title", intent.getStringExtra("title"));
                ret.put("text", intent.getStringExtra("text"));
                ret.put("category", intent.getStringExtra("category"));
                notifyListeners("onNotificationReceived", ret);
            }
        };

        IntentFilter filter = new IntentFilter("com.manuk.androidauto.NOTIFICATION_LISTENER");
        getContext().registerReceiver(receiver, filter);
    }

    @PluginMethod
    public void checkPermission(PluginCall call) {
        // We can't easily check for notification listener permission here,
        // but we can provide a method to open the settings.
        JSObject ret = new JSObject();
        ret.put("status", "unknown");
        call.resolve(ret);
    }
}
