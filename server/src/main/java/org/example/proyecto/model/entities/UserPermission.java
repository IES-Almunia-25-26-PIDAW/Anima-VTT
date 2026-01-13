package org.example.proyecto.model.entities;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "user_permissions")
@Data
public class UserPermission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "character_id")
    private Long characterId;

    @Column(name = "scene_id")
    private Long sceneId;

    @Column(name = "can_edit")
    private Boolean canEdit = false;

    @Column(name = "can_view")
    private Boolean canView = false;
}
