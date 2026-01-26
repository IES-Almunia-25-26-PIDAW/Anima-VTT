package org.example.proyectocliente.tests;

import javafx.application.Application;
import javafx.application.Platform;
import javafx.scene.Scene;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;
import javafx.stage.Stage;

import java.util.concurrent.CompletableFuture;

public class PingApplication extends Application {

    @Override
    public void start(Stage stage) {
        Label statusLabel = new Label("Esperando...");
        Button pingButton = new Button("Ping Server");

        pingButton.setOnAction(e -> {
            CompletableFuture.supplyAsync(() -> {
                try {
                    return HttpPing.pingServer();
                } catch (Exception ex) {
                    throw new RuntimeException(ex);
                }
            }).thenAccept(respuesta -> {
                Platform.runLater(() -> statusLabel.setText(respuesta));
            }).exceptionally(ex -> {
                Platform.runLater(() -> statusLabel.setText("Error: " + ex.getMessage()));
                return null;
            });
        });

        VBox root = new VBox(10, pingButton, statusLabel);
        root.setStyle("-fx-padding: 20px;");

        stage.setScene(new Scene(root, 300, 150));
        stage.setTitle("Ping Server");
        stage.show();
    }

    public static void main(String[] args) {
        launch();
    }
}

