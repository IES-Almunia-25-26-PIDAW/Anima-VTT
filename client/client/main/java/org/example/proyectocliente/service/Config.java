package org.example.proyectocliente.service;

import java.io.IOException;
import java.io.InputStream;
import java.util.Properties;

public class Config {
    private static final Properties props = new Properties();

    static {
        try (InputStream is = Config.class.getResourceAsStream("/config.properties")) {
            props.load(is);
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    public static final String SERVER_HOST = props.getProperty("server.host");
    public static final String SERVER_PORT = props.getProperty("server.port");
    public static final String API_ENDPOINT = props.getProperty("api.endpoint");
    public static final String API_GAME_ENDPOINT = props.getProperty("api.game.endpoint");
}

