package com.agriprice.app;

import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
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
            
            // Re-enforce after a short delay just in case Capacitor resets it
            webview.postDelayed(new Runnable() {
                @Override
                public void run() {
                    webview.setVerticalScrollBarEnabled(false);
                    webview.setHorizontalScrollBarEnabled(false);
                    webview.setOverScrollMode(View.OVER_SCROLL_NEVER);
                }
            }, 1000);
        }
    }
}
