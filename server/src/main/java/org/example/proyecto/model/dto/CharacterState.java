package org.example.proyecto.model.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class CharacterState {
    private Long characterId;
    private String name;
    private String type;
    private String attributesJson;
    private String biography;
    private String portraitPath;
    private Long ownerUserId;
}
