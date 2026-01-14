package org.example.proyecto.model.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class SceneState {
    private Long sceneId;
    private Long campaignId;
    private String name;
    private String backgroundImagePath;
    private Integer gridSize;
    private Integer width;
    private Integer height;
    private Boolean isActive;
}
