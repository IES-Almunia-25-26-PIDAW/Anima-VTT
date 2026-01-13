package org.example.proyecto.model.entities;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "journal_folders")
@Data
public class JournalFolder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "campaign_id", nullable = false)
    private Campaign campaign;

    @Column(nullable = false)
    private String name;
}
