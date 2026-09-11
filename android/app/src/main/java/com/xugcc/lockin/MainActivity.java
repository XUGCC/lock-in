package com.xugcc.lockin;

import android.os.Bundle;
import android.util.Log;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MediaStoreSaverPlugin.class);
        super.onCreate(savedInstanceState);

        WebView webView = getBridge().getWebView();
        // 把网页 console.log 转发到 logcat(tag: JSConsole),便于真机调试
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                Log.w("JSConsole", consoleMessage.message()
                        + " @" + (consoleMessage.sourceId() != null ? consoleMessage.sourceId() : "?")
                        + ":" + consoleMessage.lineNumber());
                return true;
            }
        });
        webView.setWebContentsDebuggingEnabled(true);
    }
}