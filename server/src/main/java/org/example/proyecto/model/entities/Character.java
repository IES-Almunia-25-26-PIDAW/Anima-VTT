package org.example.proyecto.model.entities;

import jakarta.persistence.*;
import lombok.Data;

import java.util.List;

@Entity
@Table(name = "characters")
@Data
public class Character {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "campaign_id", nullable = false)
    private Campaign campaign;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String type; // PC, NPC, Monster

    @Column(name = "attributes_json", columnDefinition = "TEXT")
    private String attributesJson;

    @Column(columnDefinition = "TEXT")
    private String biography;

    @Column(name = "portrait_path")
    private String portraitPath;

    @OneToMany(mappedBy = "character", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Token> tokens;

    @OneToMany(mappedBy = "character", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Item> items;
}
