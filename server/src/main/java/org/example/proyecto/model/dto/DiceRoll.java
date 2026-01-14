package org.example.proyecto.model.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class DiceRoll {
    private Long userId;
    private String username;
    private String formula;
    private Integer result;
    private String details;
    private LocalDateTime timestamp;
}