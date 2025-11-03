module org.example.proyectocliente {
    requires javafx.controls;
    requires javafx.fxml;

    requires org.controlsfx.controls;
    requires java.net.http;
    requires org.apache.poi.poi;
    requires org.apache.poi.ooxml;
    requires org.jetbrains.annotations;
    requires com.fasterxml.jackson.databind;
    requires org.apache.httpcomponents.client5.httpclient5;
    requires org.apache.httpcomponents.core5.httpcore5;
    requires tyrus.standalone.client;

    opens org.example.proyectocliente to javafx.fxml;
    exports org.example.proyectocliente;
    exports org.example.proyectocliente.model;
    opens org.example.proyectocliente.model to javafx.fxml;
    exports org.example.proyectocliente.tests;
    opens org.example.proyectocliente.tests to javafx.fxml;
    exports org.example.proyectocliente.service;
    opens org.example.proyectocliente.service to javafx.fxml;
    exports org.example.proyectocliente.view;
    opens org.example.proyectocliente.view to javafx.fxml;

}