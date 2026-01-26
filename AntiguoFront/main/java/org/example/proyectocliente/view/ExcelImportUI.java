package org.example.proyectocliente.view;

import javafx.application.Application;
import javafx.scene.Scene;
import javafx.scene.control.Button;
import javafx.stage.FileChooser;
import javafx.stage.Stage;
import org.example.proyectocliente.model.CharacterDTO;
import org.example.proyectocliente.model.ExcelReader;
import org.example.proyectocliente.service.Config;
import org.example.proyectocliente.service.ServerAPI;
import org.jetbrains.annotations.NotNull;

import java.io.File;
import java.util.List;

public class ExcelImportUI extends Application {

    private final ServerAPI webSocketClient = new ServerAPI();

    @Override
    public void start(@NotNull Stage stage) throws Exception {
        webSocketClient.connect("ws://"+ Config.SERVER_HOST+":"+Config.SERVER_PORT+Config.API_GAME_ENDPOINT);

        Button btn = new Button("Importar ficha de Excel");
        btn.setOnAction(e -> importExcel(stage));

        stage.setScene(new Scene(btn, 300, 100));
        stage.setTitle("VTT Importador");
        stage.show();
    }

    private void importExcel(Stage stage) {
        FileChooser fileChooser = new FileChooser();
        fileChooser.setTitle("Seleccionar ficha");
        fileChooser.getExtensionFilters().add(
                new FileChooser.ExtensionFilter("Excel Files", "*.xlsm")
        );

        File file = fileChooser.showOpenDialog(stage);
        if (file != null) {
            try {
                webSocketClient.sendCharacterDTO(ExcelReader.readCharacterDTOs(file));
            } catch (Exception ex) {
                throw new RuntimeException(ex);
            }
        }
    }

    public static void main(String[] args) {
        launch(args);
    }
}

