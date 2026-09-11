package com.xugcc.lockin;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MediaStoreSaverPlugin.class);
        super.onCreate(savedInstanceState);
    }
}