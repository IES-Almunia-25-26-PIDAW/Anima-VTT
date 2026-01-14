package org.example.proyecto.model.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class TokenState {
    private Long tokenId;
    private Long sceneId;
    private Long characterId;
    private String characterName; // Para mostrar sin consultar BD
    private Double xPosition;
    private Double yPosition;
    private Double rotation;
    private Boolean isVisible;
    private Boolean isLocked;
    private Integer hpOverride;
    private String statusEffectsJson;

    public TokenState(Long tokenId, Long characterId, String characterName,
                      Double xPosition, Double yPosition) {
        this.tokenId = tokenId;
        this.characterId = characterId;
        this.characterName = characterName;
        this.xPosition = xPosition;
        this.yPosition = yPosition;
        this.rotation = 0.0;
        this.isVisible = true;
        this.isLocked = false;
    }
}
