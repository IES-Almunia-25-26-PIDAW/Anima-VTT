package org.example.proyecto.service;

import org.example.proyecto.model.dto.UserDTO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.proyecto.model.dto.CharacterState;
import org.example.proyecto.model.dto.JournalEntryState;
import org.example.proyecto.model.dto.JournalFolderState;
import org.example.proyecto.model.dto.SceneState;
import org.example.proyecto.model.dto.TokenState;
import org.example.proyecto.model.dto.UserSession;
import org.example.proyecto.model.entities.Campaign;
import org.example.proyecto.model.entities.GameCharacter;
import org.example.proyecto.model.entities.JournalEntry;
import org.example.proyecto.model.entities.JournalFolder;
import org.example.proyecto.model.entities.Scene;
import org.example.proyecto.model.entities.Token;
import org.example.proyecto.model.entities.User;
import org.example.proyecto.model.repositories.*;
import org.jetbrains.annotations.Contract;
import org.jetbrains.annotations.NotNull;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class SessionManager {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final Map<Long, GameSession> sessions = new ConcurrentHashMap<>();

    @Autowired
    private PasswordEncoder passwordEncoder;

    private final JdbcTemplate jdbcTemplate;

    // Repositories
    private final CampaignRepository campaignRepository;
    private final SceneRepository sceneRepository;
    private final TokenRepository tokenRepository;
    private final GameCharacterRepository characterRepository;
    private final UserRepository userRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final JournalFolderRepository journalFolderRepository;
    private final JournalEntryRepository journalEntryRepository;

    // -------------------------------
    // Gestión de sesiones
    // -------------------------------

    @Transactional(readOnly = true)
    public UserDTO authenticateUser(String username, String password) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));

        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new RuntimeException("Credenciales inválidas");
        }

        return UserDTO.fromEntity(user);
    }

    @Transactional
    public UserDTO registerUser(String username, String password, String email) {
        if (userRepository.findByUsername(username).isPresent()) {
            throw new RuntimeException("El nombre de usuario ya está en uso");
        }

        User newUser = new User();
        newUser.setUsername(username);
        newUser.setPasswordHash(passwordEncoder.encode(password));
        newUser.setRole("player");

        User savedUser = userRepository.save(newUser);

        return UserDTO.fromEntity(savedUser);
    }

    @Transactional
    public GameSession getOrCreateSession(Long campaignId) {
        return sessions.computeIfAbsent(campaignId, id -> {
            log.info("Creating new session for campaign {}", id);
            GameSession session = new GameSession(id);
            loadActiveScene(session);
            loadCampaignCharacters(session);
            return session;
        });
    }

    public Optional<GameSession> getSession(Long campaignId) {
        return Optional.ofNullable(sessions.get(campaignId));
    }

    public void removeSession(Long campaignId) {
        GameSession session = sessions.get(campaignId);
        if (session != null) {
            log.info("Removing session for campaign {}", campaignId);
            saveSessionState(session);
        }
        sessions.remove(campaignId);
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
    public List<SceneState> getAllScenes(Long campaignId) {
        return sceneRepository.findByCampaignId(campaignId)
                .stream()
                .map(this::mapToSceneState)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public void loadActiveScene(@NotNull GameSession session) {
        sceneRepository.findByCampaignIdAndIsActive(session.getCampaignId(), true)
                .stream()
                .findFirst()
                .ifPresent(scene -> {
                    SceneState sceneState = mapToSceneState(scene);
                    session.setActiveScene(sceneState);
                    loadSceneTokens(session, scene.getId());
                    loadSceneFog(session, scene);
                });
    }

    private void loadSceneFog(@NotNull GameSession session, @NotNull Scene scene) {
        session.clearRevealedCells();
        session.setFogOfWarEnabled(Boolean.TRUE.equals(scene.getFogOfWarEnabled()));
        String cellsJson = scene.getRevealedCellsJson();
        if (cellsJson != null && !cellsJson.isBlank()) {
            try {
                @SuppressWarnings("unchecked")
                List<String> cells = MAPPER.readValue(cellsJson, ArrayList.class);
                session.revealCells(cells);
            } catch (Exception e) {
                log.warn("Failed to parse revealed cells JSON for scene {}: {}", scene.getId(), e.getMessage());
            }
        }
    }

    @Transactional
    public TokenState addToken(Long campaignId, Long characterId, double x, double y) {
        GameSession session = getOrCreateSession(campaignId);
        if (session.getActiveScene() == null) throw new RuntimeException("No active scene");

        Scene scene = sceneRepository.findById(session.getActiveScene().getSceneId())
                .orElseThrow(() -> new RuntimeException("Scene not found"));
        GameCharacter character = characterRepository.findById(characterId)
                .orElseThrow(() -> new RuntimeException("Character not found: " + characterId));

        Token token = new Token();
        token.setScene(scene);
        token.setCharacter(character);
        token.setXPosition(x);
        token.setYPosition(y);
        token.setRotation(0.0);
        token.setIsVisible(true);
        token.setIsLocked(false);
        tokenRepository.save(token);

        TokenState tokenState = mapToTokenState(token);
        session.addOrUpdateToken(tokenState);
        return tokenState;
    }

    @Transactional
    public boolean removeToken(Long campaignId, Long tokenId) {
        GameSession session = getOrCreateSession(campaignId);
        if (session.getToken(tokenId) == null) return false;

        session.removeToken(tokenId);
        tokenRepository.deleteById(tokenId);
        return true;
    }

    // -------------------------------
    // Journal
    // -------------------------------

    @Transactional(readOnly = true)
    public List<JournalFolderState> getJournalFolders(Long campaignId) {
        return journalFolderRepository.findByCampaignId(campaignId).stream()
                .map(f -> new JournalFolderState(f.getId(), f.getName()))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<JournalEntryState> getJournalEntries(Long campaignId, boolean includeGMOnly) {
        return journalEntryRepository.findByCampaignId(campaignId).stream()
                .filter(e -> includeGMOnly || "all".equals(e.getVisibility()))
                .map(this::mapToEntryState)
                .collect(Collectors.toList());
    }

    @Transactional
    public JournalFolderState createFolder(Long campaignId, String name) {
        Campaign campaign = campaignRepository.findById(campaignId).orElseThrow();
        JournalFolder folder = new JournalFolder();
        folder.setCampaign(campaign);
        folder.setName(name);
        journalFolderRepository.save(folder);
        return new JournalFolderState(folder.getId(), folder.getName());
    }

    @Transactional
    public void deleteFolder(Long folderId) {
        journalEntryRepository.findByFolderId(folderId).forEach(e -> {
            e.setFolder(null);
            journalEntryRepository.save(e);
        });
        journalFolderRepository.deleteById(folderId);
    }

    @Transactional
    public JournalEntryState createEntry(Long campaignId, String title, String content, String visibility, Long folderId) {
        Campaign campaign = campaignRepository.findById(campaignId).orElseThrow();
        JournalEntry entry = new JournalEntry();
        entry.setCampaign(campaign);
        entry.setTitle(title != null && !title.isBlank() ? title : "Sin título");
        entry.setContent(content != null ? content : "");
        entry.setVisibility(visibility != null ? visibility : "gm");
        if (folderId != null) {
            journalFolderRepository.findById(folderId).ifPresent(entry::setFolder);
        }
        journalEntryRepository.save(entry);
        return mapToEntryState(entry);
    }

    @Transactional
    public JournalEntryState updateEntry(Long entryId, String title, String content, String visibility, Long folderId) {
        JournalEntry entry = journalEntryRepository.findById(entryId).orElseThrow();
        entry.setTitle(title != null && !title.isBlank() ? title : "Sin título");
        entry.setContent(content != null ? content : "");
        entry.setVisibility(visibility != null ? visibility : "gm");
        entry.setFolder(folderId != null
                ? journalFolderRepository.findById(folderId).orElse(null)
                : null);
        journalEntryRepository.save(entry);
        return mapToEntryState(entry);
    }

    @Transactional
    public void deleteEntry(Long entryId) {
        journalEntryRepository.deleteById(entryId);
    }

    private JournalEntryState mapToEntryState(JournalEntry e) {
        return new JournalEntryState(
                e.getId(),
                e.getFolder() != null ? e.getFolder().getId() : null,
                e.getTitle(),
                e.getContent(),
                e.getVisibility()
        );
    }

    @Transactional
    public SceneState createScene(Long campaignId, String name, int gridSize, int width, int height) {
        Campaign campaign = campaignRepository.findById(campaignId)
                .orElseThrow(() -> new RuntimeException("Campaign not found: " + campaignId));

        Scene scene = new Scene();
        scene.setCampaign(campaign);
        scene.setName(name);
        scene.setGridSize(gridSize);
        scene.setWidth(width);
        scene.setHeight(height);
        scene.setIsActive(false);
        sceneRepository.save(scene);

        return mapToSceneState(scene);
    }

    @Transactional
    public void changeActiveScene(Long campaignId, Long newSceneId) {
        GameSession session = getOrCreateSession(campaignId);

        if (session.hasActiveScene()) {
            sceneRepository.findById(session.getActiveScene().getSceneId())
                    .ifPresent(oldScene -> {
                        oldScene.setIsActive(false);
                        saveFogStateToScene(session, oldScene);
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
        loadSceneFog(session, newScene);

        log.info("Changed active scene to {} in campaign {}", newSceneId, campaignId);
    }

    public void loadSceneTokens(@NotNull GameSession session, Long sceneId) {
        session.clearTokens();

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
            "SELECT t.id, t.scene_id, t.character_id, c.name AS char_name, " +
            "t.x_position, t.y_position, t.rotation, t.is_visible, t.is_locked, " +
            "t.hp_override, t.status_effects_json, t.auras_json, c.owner_user_id " +
            "FROM tokens t JOIN characters c ON t.character_id = c.id " +
            "WHERE t.scene_id = ?", sceneId);

        log.info("[LOAD] {} tokens for scene {}", rows.size(), sceneId);
        for (Map<String, Object> row : rows) {
            Long id          = ((Number) row.get("id")).longValue();
            Long charId      = row.get("character_id") != null ? ((Number) row.get("character_id")).longValue() : null;
            String charName  = (String) row.get("char_name");
            Double x         = row.get("x_position") != null ? ((Number) row.get("x_position")).doubleValue() : 0.0;
            Double y         = row.get("y_position") != null ? ((Number) row.get("y_position")).doubleValue() : 0.0;
            Double rotation  = row.get("rotation")   != null ? ((Number) row.get("rotation")).doubleValue()   : 0.0;
            Boolean visible  = row.get("is_visible")  != null && ((Number) row.get("is_visible")).intValue()  == 1;
            Boolean locked   = row.get("is_locked")   != null && ((Number) row.get("is_locked")).intValue()   == 1;
            Integer hpOvr    = row.get("hp_override") != null ? ((Number) row.get("hp_override")).intValue()  : null;
            String statusJson = (String) row.get("status_effects_json");
            String aurasJson  = (String) row.get("auras_json");
            Long ownerUserId  = row.get("owner_user_id") != null ? ((Number) row.get("owner_user_id")).longValue() : null;

            log.info("[LOAD] token id={} x={} y={}", id, x, y);
            session.addOrUpdateToken(new TokenState(id, sceneId, charId, charName, x, y, rotation, visible, locked, hpOvr, statusJson, aurasJson, ownerUserId));
        }
    }

    @Transactional
    public void updateSceneBackground(Long campaignId, Long sceneId, String imagePath) {
        sceneRepository.findById(sceneId).ifPresent(scene -> {
            scene.setBackgroundImagePath(imagePath);
            sceneRepository.save(scene);
        });

        getSession(campaignId).ifPresent(session -> {
            SceneState cur = session.getActiveScene();
            if (cur != null && cur.getSceneId().equals(sceneId)) {
                session.updateActiveSceneBackground(imagePath);
            }
        });

        log.info("Updated background image for scene {} in campaign {}", sceneId, campaignId);
    }

    // -------------------------------
    // Gestión de tokens
    // -------------------------------

    public boolean moveToken(Long campaignId, Long tokenId, Double x, Double y) {
        return getSession(campaignId)
                .map(session -> {
                    boolean moved = session.moveToken(tokenId, x, y);
                    if (moved) {
                        int rows = jdbcTemplate.update(
                            "UPDATE tokens SET x_position=?, y_position=? WHERE id=?", x, y, tokenId);
                        log.info("[MOVE] token id={} x={} y={} rows_updated={}", tokenId, x, y, rows);
                    }
                    return moved;
                })
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

    /**
     * Reads visible tokens for a scene directly from the database using a fresh,
     * non-transactional JDBC connection. This bypasses both the in-memory session
     * and any active transaction's read snapshot, guaranteeing the latest committed
     * positions are returned — critical for SESSION_STATE on JOIN.
     */
    public List<TokenState> getVisibleTokensFromDb(Long sceneId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
            "SELECT t.id, t.scene_id, t.character_id, c.name AS char_name, " +
            "t.x_position, t.y_position, t.rotation, t.is_visible, t.is_locked, " +
            "t.hp_override, t.status_effects_json, t.auras_json, c.owner_user_id " +
            "FROM tokens t JOIN characters c ON t.character_id = c.id " +
            "WHERE t.scene_id = ? AND t.is_visible = 1", sceneId);

        log.info("[JOIN-DB] {} visible tokens for scene {} from DB", rows.size(), sceneId);
        return rows.stream().map(row -> {
            Long id         = ((Number) row.get("id")).longValue();
            Long sId        = ((Number) row.get("scene_id")).longValue();
            Long charId     = row.get("character_id") != null ? ((Number) row.get("character_id")).longValue() : null;
            String charName = (String) row.get("char_name");
            Double x        = row.get("x_position") != null ? ((Number) row.get("x_position")).doubleValue() : 0.0;
            Double y        = row.get("y_position") != null ? ((Number) row.get("y_position")).doubleValue() : 0.0;
            Double rotation = row.get("rotation")   != null ? ((Number) row.get("rotation")).doubleValue()   : 0.0;
            Boolean visible = row.get("is_visible") != null && ((Number) row.get("is_visible")).intValue()   == 1;
            Boolean locked  = row.get("is_locked")  != null && ((Number) row.get("is_locked")).intValue()    == 1;
            Integer hpOvr   = row.get("hp_override") != null ? ((Number) row.get("hp_override")).intValue()  : null;
            String statusJson = (String) row.get("status_effects_json");
            String aurasJson  = (String) row.get("auras_json");
            Long ownerUserId  = row.get("owner_user_id") != null ? ((Number) row.get("owner_user_id")).longValue() : null;
            log.info("[JOIN-DB] token id={} x={} y={}", id, x, y);
            return new TokenState(id, sId, charId, charName, x, y, rotation, visible, locked, hpOvr, statusJson, aurasJson, ownerUserId);
        }).collect(Collectors.toList());
    }

    public void saveAllTokenPositions(@NotNull GameSession session) {
        // x_position/y_position are excluded: moveToken() auto-commits them on every drag.
        // Saving them here from in-memory would overwrite the DB with potentially stale values.
        Collection<TokenState> allTokens = session.getAllTokens();
        log.info("[SAVE] Campaign {} - saving {} tokens (rotation/visibility/etc only)", session.getCampaignId(), allTokens.size());
        for (TokenState tokenState : allTokens) {
            jdbcTemplate.update(
                "UPDATE tokens SET rotation=?, is_visible=?, is_locked=?, " +
                "hp_override=?, status_effects_json=?, auras_json=? WHERE id=?",
                tokenState.getRotation(),
                Boolean.TRUE.equals(tokenState.getIsVisible()) ? 1 : 0,
                Boolean.TRUE.equals(tokenState.getIsLocked()) ? 1 : 0,
                tokenState.getHpOverride(),
                tokenState.getStatusEffectsJson(),
                tokenState.getAurasJson(),
                tokenState.getTokenId()
            );
        }
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

    public void reorderCombat(Long campaignId, List<Long> tokenIds) {
        getSession(campaignId).ifPresent(s -> s.reorderCombat(tokenIds));
    }

    // -------------------------------
    // Guardar estado
    // -------------------------------

    public void saveSessionState(@NotNull GameSession session) {
        saveAllTokenPositions(session);
        saveFogState(session.getCampaignId());
        log.info("Saved session state for campaign {}", session.getCampaignId());
    }

    @Transactional
    public void saveFogState(Long campaignId) {
        getSession(campaignId).ifPresent(session -> {
            if (session.getActiveScene() == null) return;
            sceneRepository.findById(session.getActiveScene().getSceneId()).ifPresent(scene -> {
                saveFogStateToScene(session, scene);
                sceneRepository.save(scene);
            });
        });
    }

    private void saveFogStateToScene(@NotNull GameSession session, @NotNull Scene scene) {
        scene.setFogOfWarEnabled(session.isFogOfWarEnabled());
        try {
            scene.setRevealedCellsJson(MAPPER.writeValueAsString(session.getRevealedCells()));
        } catch (Exception e) {
            log.warn("Failed to serialize revealed cells for scene {}: {}", scene.getId(), e.getMessage());
        }
    }

    @Transactional
    public void saveAllSessions() {
        sessions.values().forEach(this::saveSessionState);
        log.info("Saved all active sessions");
    }

    // -------------------------------
    // Gestión de personajes
    // -------------------------------

    @Transactional(readOnly = true)
    public void loadCampaignCharacters(@NotNull GameSession session) {
        List<GameCharacter> chars = characterRepository.findByCampaignId(session.getCampaignId());
        for (GameCharacter c : chars) {
            session.addOrUpdateCharacter(mapToCharacterState(c));
        }
        log.info("Loaded {} characters for campaign {}", chars.size(), session.getCampaignId());
    }

    @Transactional
    public CharacterState createCharacter(Long campaignId, String name, String type, String attributesJson, String biography, String portraitPath) {
        Campaign campaign = campaignRepository.findById(campaignId)
                .orElseThrow(() -> new RuntimeException("Campaign not found: " + campaignId));

        GameCharacter character = new GameCharacter();
        character.setCampaign(campaign);
        character.setName(name != null && !name.isBlank() ? name : "Sin nombre");
        character.setType(type != null ? type : "NPC");
        character.setAttributesJson(attributesJson);
        character.setBiography(biography);
        character.setPortraitPath(portraitPath);
        characterRepository.save(character);

        CharacterState state = mapToCharacterState(character);
        getOrCreateSession(campaignId).addOrUpdateCharacter(state);
        log.info("Created character '{}' in campaign {}", character.getName(), campaignId);
        return state;
    }

    @Transactional
    public boolean deleteCharacter(Long campaignId, Long characterId) {
        var charOpt = characterRepository.findById(characterId);
        if (charOpt.isEmpty()) return false;

        GameCharacter character = charOpt.get();
        if (!character.getCampaign().getId().equals(campaignId)) return false;

        // Collect token IDs before cascade-delete removes them
        List<Long> tokenIds = character.getTokens() != null
                ? character.getTokens().stream().map(org.example.proyecto.model.entities.Token::getId).collect(Collectors.toList())
                : List.of();

        characterRepository.delete(character);

        getSession(campaignId).ifPresent(session -> {
            tokenIds.forEach(session::removeToken);
            session.removeCharacter(characterId);
        });

        log.info("Deleted character {} from campaign {}", characterId, campaignId);
        return true;
    }

    @Transactional
    public boolean updateCharacterAttributes(Long campaignId, Long characterId, String newAttributesJson) {
        var charOpt = characterRepository.findById(characterId);
        if (charOpt.isEmpty()) return false;

        GameCharacter c = charOpt.get();
        if (!c.getCampaign().getId().equals(campaignId)) return false;

        c.setAttributesJson(newAttributesJson);
        characterRepository.save(c);

        getSession(campaignId).ifPresent(session ->
                session.updateCharacterAttributes(characterId, newAttributesJson));

        log.info("Updated character {} attributes in campaign {}", characterId, campaignId);
        return true;
    }

    // -------------------------------
    // Mappers (Entidad → DTO)
    // -------------------------------

    @Contract("_ -> new")
    private @NotNull CharacterState mapToCharacterState(@NotNull GameCharacter c) {
        return new CharacterState(
                c.getId(),
                c.getName(),
                c.getType(),
                c.getAttributesJson(),
                c.getBiography(),
                c.getPortraitPath(),
                c.getOwnerUserId()
        );
    }

    @Transactional
    public boolean updateCharacterBiography(Long campaignId, Long characterId, String biography) {
        var charOpt = characterRepository.findById(characterId);
        if (charOpt.isEmpty()) return false;
        GameCharacter c = charOpt.get();
        if (!c.getCampaign().getId().equals(campaignId)) return false;
        c.setBiography(biography);
        characterRepository.save(c);
        getSession(campaignId).ifPresent(session ->
                session.updateCharacterBiography(characterId, biography));
        log.info("Updated character {} biography in campaign {}", characterId, campaignId);
        return true;
    }

    @Transactional
    public boolean updateCharacterPortrait(Long campaignId, Long characterId, String portraitPath) {
        var charOpt = characterRepository.findById(characterId);
        if (charOpt.isEmpty()) return false;

        GameCharacter c = charOpt.get();
        if (!c.getCampaign().getId().equals(campaignId)) return false;

        c.setPortraitPath(portraitPath);
        characterRepository.save(c);

        getSession(campaignId).ifPresent(session ->
                session.updateCharacterPortrait(characterId, portraitPath));

        log.info("Updated character {} portrait in campaign {}", characterId, campaignId);
        return true;
    }

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

        Long ownerUserId = token.getCharacter() != null ? token.getCharacter().getOwnerUserId() : null;

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
                token.getStatusEffectsJson(),
                token.getAurasJson(),
                ownerUserId
        );
    }

    @Transactional
    public void assignCharacterOwner(Long campaignId, Long characterId, Long ownerUserId) {
        characterRepository.findById(characterId).ifPresent(c -> {
            c.setOwnerUserId(ownerUserId);
            characterRepository.save(c);
        });
        getSession(campaignId).ifPresent(session -> session.assignCharacterOwner(characterId, ownerUserId));
        log.info("Assigned character {} to user {} in campaign {}", characterId, ownerUserId, campaignId);
    }
}

