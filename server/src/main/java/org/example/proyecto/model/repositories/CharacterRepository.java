package org.example.proyecto.model.repositories;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CharacterRepository extends JpaRepository<Character, Long> {
    List<Character> findByCampaignId(Long campaignId);
    List<Character> findByCampaignIdAndType(Long campaignId, String type);
}
