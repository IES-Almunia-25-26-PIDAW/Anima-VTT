package org.example.proyecto.service;

import org.springframework.transaction.annotation.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.proyecto.model.dto.SceneState;
import org.example.proyecto.model.dto.TokenState;
import org.example.proyecto.model.dto.UserSession;
import org.example.proyecto.model.entities.Scene;
import org.example.proyecto.model.entities.Token;
import org.example.proyecto.model.entities.User;
import org.example.proyecto.model.repositories.*;
import org.jetbrains.annotations.Contract;
import org.jetbrains.annotations.NotNull;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Collection;

@Service
@RequiredArgsConstructor
@Slf4j
public class SessionManager {

    private final Map<Long, GameSession> sessions = new ConcurrentHashMap<>();

    // Repositories
    private final CampaignRepository campaignRepository;
    private final SceneRepository sceneRepository;
    private final TokenRepository tokenRepository;
    private final GameCharacterRepository characterRepository;
    private final UserRepository userRepository;
    private final ChatMessageRepository chatMessageRepository;

    // -------------------------------
    // Gestión de sesiones
    // -------------------------------

    @Transactional
    public GameSession getOrCreateSession(Long campaignId) {
        return sessions.computeIfAbsent(campaignId, id -> {
            log.info("Creating new session for campaign {}", id);
            GameSession session = new GameSession(id);
            loadActiveScene(session);
            return session;
        });
    }

    public Optional<GameSession> getSession(Long campaignId) {
        return Optional.ofNullable(sessions.get(campaignId));
    }

    @Transactional
    public void removeSession(Long campaignId) {
        GameSession session = sessions.remove(campaignId);
        if (session != null) {
            log.info("Removing session for campaign {}", campaignId);
            saveSessionState(session);
        }
    }

    public Collection<GameSession> getAllSessions() {
        return sessions.values();
    }

    public int getActiveSessionCount() {
        return sessions.size();
    }

    // -------------------------------
    // Gestión de usuarios
    // -------------------------------

    @Transactional(readOnly = true)
    public UserSession addUser(Long campaignId, Long userId, String webSocketSessionId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found: " + userId));

        UserSession userSession = new UserSession(
                user.getId(),
                user.getUsername(),
                user.getRole(),
                LocalDateTime.now(),
                webSocketSessionId
        );

        GameSession session = getOrCreateSession(campaignId);
        session.addUser(userSession);

        log.info("User {} joined campaign {}", user.getUsername(), campaignId);
        return userSession;
    }

    @Transactional
    public void removeUser(Long campaignId, Long userId) {
        getSession(campaignId).ifPresent(session -> {
            UserSession user = session.getUser(userId);
            session.removeUser(userId);

            if (user != null) {
                log.info("User {} left campaign {}", user.getUsername(), campaignId);
            }

            if (session.isEmpty()) {
                removeSession(campaignId);
            }
        });
    }

    // -------------------------------
    // Gestión de escenas
    // -------------------------------

    @Transactional(readOnly = true)
    public void loadActiveScene(@NotNull GameSession session) {
        sceneRepository.findByCampaignIdAndIsActive(session.getCampaignId(), true)
                .stream()
                .findFirst()
                .ifPresent(scene -> {
                    SceneState sceneState = mapToSceneState(scene);
                    session.setActiveScene(sceneState);
                    loadSceneTokens(session, scene.getId());
                });
    }

    @Transactional
    public void changeActiveScene(Long campaignId, Long newSceneId) {
        GameSession session = getOrCreateSession(campaignId);

        if (session.hasActiveScene()) {
            sceneRepository.findById(session.getActiveScene().getSceneId())
                    .ifPresent(oldScene -> {
                        oldScene.setIsActive(false);
                        sceneRepository.save(oldScene);
                    });
        }

        Scene newScene = sceneRepository.findById(newSceneId)
                .orElseThrow(() -> new RuntimeException("Scene not found: " + newSceneId));

        newScene.setIsActive(true);
        sceneRepository.save(newScene);

        SceneState sceneState = mapToSceneState(newScene);
        session.setActiveScene(sceneState);
        loadSceneTokens(session, newSceneId);

        log.info("Changed active scene to {} in campaign {}", newSceneId, campaignId);
    }

    @Transactional(readOnly = true)
    public void loadSceneTokens(@NotNull GameSession session, Long sceneId) {
        session.clearTokens();

        List<Token> tokens = tokenRepository.findBySceneId(sceneId);
        for (Token token : tokens) {
            TokenState tokenState = mapToTokenState(token);
            session.addOrUpdateToken(tokenState);
        }

        log.info("Loaded {} tokens for scene {}", tokens.size(), sceneId);
    }

    // -------------------------------
    // Gestión de tokens
    // -------------------------------

    public boolean moveToken(Long campaignId, Long tokenId, Double x, Double y) {
        return getSession(campaignId)
                .map(session -> session.moveToken(tokenId, x, y))
                .orElse(false);
    }

    @Transactional
    public void saveTokenPosition(Long campaignId, Long tokenId) {
        getSession(campaignId).ifPresent(session -> {
            TokenState tokenState = session.getToken(tokenId);
            if (tokenState != null) {
                tokenRepository.findById(tokenId).ifPresent(token -> {
                    token.setXPosition(tokenState.getXPosition());
                    token.setYPosition(tokenState.getYPosition());
                    token.setRotation(tokenState.getRotation());
                    tokenRepository.save(token);
                    log.debug("Saved token {} position to database", tokenId);
                });
            }
        });
    }

    public void saveAllTokenPositions(Long campaignId) {
        getSession(campaignId).ifPresent(session -> {
            session.getAllTokens().forEach(tokenState -> tokenRepository.findById(tokenState.getTokenId()).ifPresent(token -> {
                token.setXPosition(tokenState.getXPosition());
                token.setYPosition(tokenState.getYPosition());
                token.setRotation(tokenState.getRotation());
                token.setIsVisible(tokenState.getIsVisible());
                token.setIsLocked(tokenState.getIsLocked());
                token.setHpOverride(tokenState.getHpOverride());
            }));
            tokenRepository.flush();
            log.info("Saved all token positions for campaign {}", campaignId);
        });
    }

    // -------------------------------
    // Gestión de combate
    // -------------------------------

    public void startCombat(Long campaignId, List<Long> tokenIds) {
        getSession(campaignId).ifPresent(session -> {
            session.startCombat(tokenIds);
            log.info("Combat started in campaign {} with {} tokens", campaignId, tokenIds.size());
        });
    }

    public void endCombat(Long campaignId) {
        getSession(campaignId).ifPresent(session -> {
            session.endCombat();
            log.info("Combat ended in campaign {}", campaignId);
        });
    }

    public void nextTurn(Long campaignId) {
        getSession(campaignId).ifPresent(GameSession::nextTurn);
    }

    // -------------------------------
    // Guardar estado
    // -------------------------------

    public void saveSessionState(@NotNull GameSession session) {
        saveAllTokenPositions(session.getCampaignId());
        log.info("Saved session state for campaign {}", session.getCampaignId());
    }

    @Transactional
    public void saveAllSessions() {
        sessions.values().forEach(this::saveSessionState);
        log.info("Saved all active sessions");
    }

    // -------------------------------
    // Mappers (Entidad → DTO)
    // -------------------------------

    @Contract("_ -> new")
    private @NotNull SceneState mapToSceneState(@NotNull Scene scene) {
        return new SceneState(
                scene.getId(),
                scene.getCampaign().getId(),
                scene.getName(),
                scene.getBackgroundImagePath(),
                scene.getGridSize(),
                scene.getWidth(),
                scene.getHeight(),
                scene.getIsActive()
        );
    }

    @Contract("_ -> new")
    private @NotNull TokenState mapToTokenState(@NotNull Token token) {
        String characterName = token.getCharacter() != null
                ? token.getCharacter().getName()
                : "Unknown";

        return new TokenState(
                token.getId(),
                token.getScene().getId(),
                token.getCharacter() != null ? token.getCharacter().getId() : null,
                characterName,
                token.getXPosition(),
                token.getYPosition(),
                token.getRotation(),
                token.getIsVisible(),
                token.getIsLocked(),
                token.getHpOverride(),
                token.getStatusEffectsJson()
        );
    }
}

