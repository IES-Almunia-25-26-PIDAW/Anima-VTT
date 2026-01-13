package org.example.proyecto.model.repositories;

import org.example.proyecto.model.entities.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    List<ChatMessage> findByCampaignIdOrderByTimestampDesc(Long campaignId);
    List<ChatMessage> findByCampaignIdAndMessageType(Long campaignId, String messageType);
}
