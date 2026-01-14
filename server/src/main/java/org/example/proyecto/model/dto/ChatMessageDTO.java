package org.example.proyecto.model.dto;

import lombok.Getter;
import lombok.Setter;

@Setter
@Getter
public class ChatMessageDTO {
    private Long userId;
    private String message;
    private String messageType; // chat, roll, system

}
