package org.example.proyecto.model.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class UserSession {
    private Long userId;
    private String username;
    private String role;
    private LocalDateTime connectedAt;
    private String webSocketSessionId;

    public UserSession(Long userId, String username, String role) {
        this.userId = userId;
        this.username = username;
        this.role = role;
        this.connectedAt = LocalDateTime.now();
    }

    public boolean isGM() {
        return "gm".equalsIgnoreCase(role);
    }
}
