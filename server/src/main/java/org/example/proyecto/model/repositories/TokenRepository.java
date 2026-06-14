package org.example.proyecto.model.repositories;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import org.example.proyecto.model.entities.Token;

import java.util.List;

@Repository
public interface TokenRepository extends JpaRepository<Token, Long> {
    List<Token> findBySceneId(Long sceneId);
    List<Token> findByCharacterId(Long characterId);

    @Modifying
    @Transactional
    @Query("UPDATE Token t SET t.xPosition = :x, t.yPosition = :y, t.rotation = :r, " +
           "t.isVisible = :vis, t.isLocked = :locked, t.hpOverride = :hp, " +
           "t.statusEffectsJson = :status, t.aurasJson = :auras WHERE t.id = :id")
    void updateTokenState(
            @Param("id")     Long id,
            @Param("x")      Double x,
            @Param("y")      Double y,
            @Param("r")      Double r,
            @Param("vis")    Boolean vis,
            @Param("locked") Boolean locked,
            @Param("hp")     Integer hp,
            @Param("status") String status,
            @Param("auras")  String auras
    );
}
