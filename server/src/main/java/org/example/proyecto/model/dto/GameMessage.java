package org.example.proyecto.model.dto;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.Getter;
import lombok.Setter;

@Setter
@Getter
public class GameMessage {
    private String type; // TOKEN_MOVE, CHAT_MESSAGE, JOIN_CAMPAIGN...
    private JsonNode payload; // Puede ser CharacterDTO, TokenMoveDTO, ChatMessageDTO...
}

