package com.manuk.androidauto;

import android.content.Intent;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;

public class NotificationService extends NotificationListenerService {
    private static final String TAG = "NotificationService";

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        Log.d(TAG, "Notification posted: " + sbn.getPackageName());
        
        Intent intent = new Intent("com.manuk.androidauto.NOTIFICATION_LISTENER");
        intent.putExtra("package", sbn.getPackageName());
        
        CharSequence title = sbn.getNotification().extras.getCharSequence("android.title");
        CharSequence text = sbn.getNotification().extras.getCharSequence("android.text");
        
        intent.putExtra("title", title != null ? title.toString() : "");
        intent.putExtra("text", text != null ? text.toString() : "");
        intent.putExtra("category", sbn.getNotification().category);
        
        sendBroadcast(intent);
    }

    @Override
    public void onNotificationRemoved(StatusBarNotification sbn) {
        Log.d(TAG, "Notification removed: " + sbn.getPackageName());
    }
}
