package org.example.proyecto.model.repositories;

import org.example.proyecto.model.entities.JournalEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface JournalEntryRepository extends JpaRepository<JournalEntry, Long> {
    List<JournalEntry> findByCampaignId(Long campaignId);
    List<JournalEntry> findByFolderId(Long folderId);
}
