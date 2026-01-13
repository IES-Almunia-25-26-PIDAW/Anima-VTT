package org.example.proyecto.model.repositories;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.example.proyecto.model.entities.Token;

import java.util.List;

@Repository
public interface TokenRepository extends JpaRepository<Token, Long> {
    List<Token> findBySceneId(Long sceneId);
    List<Token> findByCharacterId(Long characterId);
}
