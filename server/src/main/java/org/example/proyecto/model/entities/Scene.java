package org.example.proyecto.model.entities;

import jakarta.persistence.*;
import lombok.Data;

import java.util.List;

@Entity
@Table(name = "scenes")
@Data
public class Scene {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "campaign_id", nullable = false)
    private Campaign campaign;

    @Column(nullable = false)
    private String name;

    @Column(name = "background_image_path")
    private String backgroundImagePath;

    @Column(name = "grid_size")
    private Integer gridSize;

    private Integer width;
    private Integer height;

    @Column(name = "is_active")
    private Boolean isActive = false;

    @Column(name = "fog_of_war_enabled")
    private Boolean fogOfWarEnabled = false;

    @Column(name = "revealed_cells_json", columnDefinition = "TEXT")
    private String revealedCellsJson;

    @OneToMany(mappedBy = "scene", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Token> tokens;
}
