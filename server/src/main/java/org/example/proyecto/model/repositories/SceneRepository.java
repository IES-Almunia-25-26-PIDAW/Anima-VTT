package org.example.proyecto.model.repositories;

import org.example.proyecto.model.entities.Scene;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SceneRepository extends JpaRepository<Scene, Long> {
    List<Scene> findByCampaignId(Long campaignId);
    List<Scene> findByCampaignIdAndIsActive(Long campaignId, Boolean isActive);
}
