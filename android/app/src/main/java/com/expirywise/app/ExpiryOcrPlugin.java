package com.expirywise.app;

import android.net.Uri;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import java.io.IOException;

@CapacitorPlugin(name = "ExpiryOcr")
public class ExpiryOcrPlugin extends Plugin {
    @PluginMethod
    public void recognizeText(PluginCall call) {
        String path = call.getString("path");
        if (path == null || path.trim().isEmpty()) {
            call.reject("Missing image path");
            return;
        }

        Uri imageUri = Uri.parse(path);
        InputImage image;
        try {
            image = InputImage.fromFilePath(getContext(), imageUri);
        } catch (IOException error) {
            call.reject("Could not read image", error);
            return;
        }

        TextRecognizer recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        recognizer.process(image)
            .addOnSuccessListener(result -> {
                JSObject response = new JSObject();
                response.put("text", result.getText());
                call.resolve(response);
            })
            .addOnFailureListener(error -> call.reject("Could not recognize text", error))
            .addOnCompleteListener(task -> recognizer.close());
    }
}
