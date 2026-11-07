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
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
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

    /** The cache folder where files wait while the player chooses where to save them. */
    private static final String OUTGOING = "outgoing";

    @PluginMethod
    public void save(PluginCall call) {
        byte[] bytes = bytesOf(call);
        if (bytes == null) return;
        File staged;
        try {
            staged = stage(call.getCallbackId(), bytes);
        } catch (Exception error) {
            call.reject("Could not keep the file", error);
            return;
        }
        // Capacitor keeps the data of a call that opens another screen, twice, in the state Android
        // saves for the app when that screen covers it; Android allows that state about a
        // megabyte and stops the app beyond it, as a debug log's bytes made it do. The bytes wait
        // in a file instead, and the call keeps only that file's name.
        call.getData().remove("data");
        call.getData().put("staged", staged.getName());
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(call.getString("mime", "application/octet-stream"));
        intent.putExtra(Intent.EXTRA_TITLE, nameOf(call));
        startActivityForResult(call, intent, "saved");
    }

    @ActivityCallback
    private void saved(PluginCall call, ActivityResult result) {
        if (call == null) return;
        File staged = stagedFile(call);
        try {
            JSObject answer = new JSObject();
            Intent data = result.getData();
            if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
                answer.put("saved", false);
                call.resolve(answer);
                return;
            }
            if (staged == null || !staged.isFile()) {
                call.reject("The file to save is gone");
                return;
            }
            try (
                InputStream in = new FileInputStream(staged);
                OutputStream out = getContext().getContentResolver().openOutputStream(data.getData())
            ) {
                if (out == null) throw new IllegalStateException("No file to write to");
                byte[] buffer = new byte[64 * 1024];
                int read;
                while ((read = in.read(buffer)) != -1) out.write(buffer, 0, read);
            } catch (Exception error) {
                call.reject("Could not write the file", error);
                return;
            }
            answer.put("saved", true);
            call.resolve(answer);
        } finally {
            if (staged != null && staged.exists() && !staged.delete()) staged.deleteOnExit();
        }
    }

    /**
     * Keeps a file's bytes in the app's cache until the player has chosen where it goes. Files
     * left over from a save that never finished, as when the app was closed meanwhile, go.
     */
    private File stage(String id, byte[] bytes) throws Exception {
        File folder = new File(getContext().getCacheDir(), OUTGOING);
        if (!folder.isDirectory() && !folder.mkdirs()) throw new IllegalStateException("No folder");
        File[] old = folder.listFiles();
        long dayAgo = System.currentTimeMillis() - 24L * 60 * 60 * 1000;
        if (old != null) for (File file : old) if (file.lastModified() < dayAgo) file.delete();
        File file = new File(folder, "file-" + id.replaceAll("[^A-Za-z0-9]", ""));
        try (FileOutputStream out = new FileOutputStream(file)) {
            out.write(bytes);
        }
        return file;
    }

    /** The file a save keeps its bytes in, or null. */
    private File stagedFile(PluginCall call) {
        String name = call.getString("staged");
        if (name == null) return null;
        return new File(new File(getContext().getCacheDir(), OUTGOING), new File(name).getName());
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
