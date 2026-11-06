package io.github.fionapreroll.wormholesurfing;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * Files the game hands the player, which Android's WebView cannot download by itself: the save,
 * the debug log and the collection's picture (src/ui/native.ts). `save` asks where to put a file
 * with Android's own dialog, which needs no permission; `share` hands it to the share sheet.
 */
@CapacitorPlugin(name = "Files")
public class FilesPlugin extends Plugin {

    /** The largest file the game hands over: a save or a log is far smaller. */
    private static final int MAX_BYTES = 32 * 1024 * 1024;

    @PluginMethod
    public void save(PluginCall call) {
        byte[] bytes = bytesOf(call);
        if (bytes == null) return;
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(call.getString("mime", "application/octet-stream"));
        intent.putExtra(Intent.EXTRA_TITLE, nameOf(call));
        startActivityForResult(call, intent, "saved");
    }

    @ActivityCallback
    private void saved(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject answer = new JSObject();
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            answer.put("saved", false);
            call.resolve(answer);
            return;
        }
        byte[] bytes = bytesOf(call);
        if (bytes == null) return;
        try (OutputStream out = getContext().getContentResolver().openOutputStream(data.getData())) {
            if (out == null) throw new IllegalStateException("No file to write to");
            out.write(bytes);
        } catch (Exception error) {
            call.reject("Could not write the file", error);
            return;
        }
        answer.put("saved", true);
        call.resolve(answer);
    }

    @PluginMethod
    public void share(PluginCall call) {
        byte[] bytes = bytesOf(call);
        if (bytes == null) return;
        try {
            File folder = new File(getContext().getCacheDir(), "shared");
            if (!folder.isDirectory() && !folder.mkdirs()) throw new IllegalStateException("No folder");
            File file = new File(folder, nameOf(call));
            try (FileOutputStream out = new FileOutputStream(file)) {
                out.write(bytes);
            }
            Uri uri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                file
            );
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType(call.getString("mime", "application/octet-stream"));
            send.putExtra(Intent.EXTRA_STREAM, uri);
            send.putExtra(Intent.EXTRA_TEXT, call.getString("text", ""));
            send.putExtra(Intent.EXTRA_SUBJECT, call.getString("title", ""));
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Intent chooser = Intent.createChooser(send, call.getString("title", ""));
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(chooser);
            call.resolve();
        } catch (Exception error) {
            call.reject("Could not share the file", error);
        }
    }

    /** The file's name, without folders. */
    private static String nameOf(PluginCall call) {
        String name = call.getString("name", "wormhole-surfing");
        return new File(name).getName();
    }

    /** The file's bytes, or null after rejecting the call. */
    private static byte[] bytesOf(PluginCall call) {
        String data = call.getString("data");
        if (data == null) {
            call.reject("No data");
            return null;
        }
        try {
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            if (bytes.length > MAX_BYTES) {
                call.reject("File too large");
                return null;
            }
            return bytes;
        } catch (IllegalArgumentException error) {
            call.reject("Data is not base64", error);
            return null;
        }
    }
}
