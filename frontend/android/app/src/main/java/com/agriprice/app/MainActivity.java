package com.agriprice.app;

import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
        getWindow().getDecorView().setBackgroundColor(Color.TRANSPARENT);
    }

    @Override
    public void onStart() {
        super.onStart();
        final WebView webview = getBridge().getWebView();
        if (webview != null) {
            // Disable scrollbars natively
            webview.setVerticalScrollBarEnabled(false);
            webview.setHorizontalScrollBarEnabled(false);
            webview.setScrollbarFadingEnabled(false);
            webview.setOverScrollMode(View.OVER_SCROLL_NEVER);
            webview.setBackgroundColor(Color.TRANSPARENT);
            webview.setLayerType(View.LAYER_TYPE_HARDWARE, null);
            
            // Re-enforce after a short delay just in case Capacitor resets it
            webview.postDelayed(new Runnable() {
                @Override
                public void run() {
                    webview.setVerticalScrollBarEnabled(false);
                    webview.setHorizontalScrollBarEnabled(false);
                    webview.setOverScrollMode(View.OVER_SCROLL_NEVER);
                    webview.setBackgroundColor(Color.TRANSPARENT);
                    webview.setLayerType(View.LAYER_TYPE_HARDWARE, null);
                }
            }, 1000);
        }
    }
}
