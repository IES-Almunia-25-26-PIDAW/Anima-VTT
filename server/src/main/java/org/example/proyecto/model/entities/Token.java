package org.example.proyecto.model.entities;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "tokens")
@Data
public class Token {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "scene_id", nullable = false)
    private Scene scene;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "character_id", nullable = false)
    private GameCharacter character;

    @Column(name = "x_position")
    private Double xPosition;

    @Column(name = "y_position")
    private Double yPosition;

    private Double rotation;

    @Column(name = "is_visible")
    private Boolean isVisible = true;

    @Column(name = "is_locked")
    private Boolean isLocked = false;

    @Column(name = "hp_override")
    private Integer hpOverride;

    @Column(name = "status_effects_json", columnDefinition = "TEXT")
    private String statusEffectsJson;

    @Column(name = "auras_json", columnDefinition = "TEXT")
    private String aurasJson;
}
