package org.example.proyecto.service;

import org.jetbrains.annotations.NotNull;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.proyecto.model.CharacterDTO;

public class GameWebSocketHandler extends TextWebSocketHandler {

    private final ObjectMapper mapper = new ObjectMapper();

    @Override
    public void handleTextMessage(@NotNull WebSocketSession session, @NotNull TextMessage message) throws Exception {
        CharacterDTO dto = mapper.readValue(message.getPayload(), CharacterDTO.class);
        System.out.println("Recibido CharacterDTO: " + dto.getName());
    }
}

