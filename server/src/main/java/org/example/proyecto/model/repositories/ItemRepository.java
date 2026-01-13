package org.example.proyecto.model.repositories;

import org.example.proyecto.model.entities.Item;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ItemRepository extends JpaRepository<Item, Long> {
    List<Item> findByCampaignId(Long campaignId);
    List<Item> findByCharacterId(Long characterId);
    List<Item> findByCampaignIdAndType(Long campaignId, String type);
}
