package org.example.proyecto.model.repositories;

import org.example.proyecto.model.entities.Asset;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AssetRepository extends JpaRepository<Asset, Long> {
    List<Asset> findByCampaignId(Long campaignId);
    List<Asset> findByCampaignIdAndType(Long campaignId, String type);
}
