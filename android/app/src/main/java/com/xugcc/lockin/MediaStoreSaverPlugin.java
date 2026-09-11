package com.xugcc.lockin;

import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;

/**
 * 将一张 Base64 编码的 JPEG/PNG 图片写入 Android 系统相册（MediaStore）。
 * 用于"把 App 私有目录里的照片另存到系统相册"。
 */
@CapacitorPlugin(name = "MediaStoreSaver")
public class MediaStoreSaverPlugin extends Plugin {

    @PluginMethod
    public void saveImage(PluginCall call) {
        String data = call.getString("data");
        if (data == null || data.isEmpty()) {
            call.reject("data (base64) is required");
            return;
        }
        String mime = call.getString("mimeType", "image/jpeg");
        String fileName = call.getString("fileName", "lockin_" + System.currentTimeMillis() + ".jpg");

        // 去除可能的前缀 data:image/jpeg;base64,
        int comma = data.indexOf(',');
        String raw = comma >= 0 ? data.substring(comma + 1) : data;

        try {
            byte[] bytes = Base64.decode(raw, Base64.DEFAULT);

            ContentValues values = new ContentValues();
            values.put(MediaStore.Images.Media.DISPLAY_NAME, fileName);
            values.put(MediaStore.Images.Media.MIME_TYPE, mime);
            values.put(MediaStore.Images.Media.DESCRIPTION, "LOCK IN Photo");

            Uri collection;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                collection = MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
                values.put(MediaStore.Images.Media.RELATIVE_PATH,
                        Environment.DIRECTORY_PICTURES + "/LOCK IN");
                values.put(MediaStore.Images.Media.IS_PENDING, 1);
            } else {
                collection = MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
            }

            Uri item = getContext().getContentResolver().insert(collection, values);
            if (item == null) {
                call.reject("MediaStore insert failed");
                return;
            }

            try (OutputStream os = getContext().getContentResolver().openOutputStream(item)) {
                if (os == null) {
                    call.reject("openOutputStream returned null");
                    return;
                }
                os.write(bytes);
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues pending = new ContentValues();
                pending.put(MediaStore.Images.Media.IS_PENDING, 0);
                getContext().getContentResolver().update(item, pending, null, null);
            }

            JSObject result = new JSObject();
            result.put("uri", item.toString());
            call.resolve(result);
        } catch (Exception e) {
            call.reject(e.getMessage(), e);
        }
    }
}