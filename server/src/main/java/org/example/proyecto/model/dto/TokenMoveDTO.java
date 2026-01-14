package org.example.proyecto.model.dto;

import lombok.Getter;
import lombok.Setter;

@Setter
@Getter
public class TokenMoveDTO {
    private Long tokenId;
    private Double x;
    private Double y;
    private Long userId;

}

