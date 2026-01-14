package org.example.proyecto.model.repositories;

import org.example.proyecto.model.entities.GameCharacter;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GameCharacterRepository extends JpaRepository<GameCharacter, Long> {

    @Query("SELECT c FROM GameCharacter c WHERE c.campaign.id = :campaignId")
    List<GameCharacter> findByCampaignId(@Param("campaignId") Long campaignId);

    @Query("SELECT c FROM GameCharacter c WHERE c.campaign.id = :campaignId AND c.type = :type")
    List<GameCharacter> findByCampaignIdAndType(
            @Param("campaignId") Long campaignId,
            @Param("type") String type
    );
}
