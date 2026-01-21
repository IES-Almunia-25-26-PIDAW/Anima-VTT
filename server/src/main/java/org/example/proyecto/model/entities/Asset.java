package org.example.proyecto.model.entities;


import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "assets")
@Data
public  class Asset {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "campaign_id", nullable = false)
    private Campaign campaign;

    @Column(nullable = false)
    private String path;

    private String type; // image, audio

    private String label;
}
