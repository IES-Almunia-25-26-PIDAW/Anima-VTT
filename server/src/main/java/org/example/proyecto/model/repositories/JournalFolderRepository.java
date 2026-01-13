package org.example.proyecto.model.repositories;

import org.example.proyecto.model.entities.JournalFolder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface JournalFolderRepository extends JpaRepository<JournalFolder, Long> {
    List<JournalFolder> findByCampaignId(Long campaignId);
}
