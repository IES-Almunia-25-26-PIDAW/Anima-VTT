package org.example.proyecto.service;

import lombok.Getter;
import org.example.proyecto.model.dto.*;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Collections;
import java.util.stream.Collectors;

public class GameSession {

    @Getter
    private final Long campaignId;

    private final Map<Long, UserSession> connectedUsers = new ConcurrentHashMap<>();

    @Getter
    private SceneState activeScene;

    private final Map<Long, TokenState> tokens = new ConcurrentHashMap<>();

    @Getter
    private CombatState combatState;

    private final Deque<DiceRoll> recentRolls = new LinkedList<>();
    private static final int MAX_RECENT_ROLLS = 50;

    // Configuración temporal
    @Getter
    private boolean fogOfWarEnabled = false;

    // Revealed fog cells — stored as "cx,cy" grid-coordinate strings
    private final Set<String> revealedCells = ConcurrentHashMap.newKeySet();

    // Map areas — shared overlays (circles, rectangles) placed by users
    private final List<Map<String, Object>> areas = new java.util.concurrent.CopyOnWriteArrayList<>();

    public GameSession(Long campaignId) {
        this.campaignId = campaignId;
        this.combatState = new CombatState();
    }

    // -------------------------------
    // Gestión de usuarios
    // -------------------------------

    public void addUser(UserSession userSession) {
        connectedUsers.put(userSession.getUserId(), userSession);
    }

    public void removeUser(Long userId) {
        connectedUsers.remove(userId);
    }

    public Collection<UserSession> getConnectedUsers() {
        return connectedUsers.values();
    }

    public UserSession getUser(Long userId) {
        return connectedUsers.get(userId);
    }

    public boolean isUserConnected(Long userId) {
        return connectedUsers.containsKey(userId);
    }

    public List<String> getConnectedUsernames() {
        return connectedUsers.values().stream()
                .map(UserSession::getUsername)
                .collect(Collectors.toList());
    }

    public List<Map<String, Object>> getConnectedUsersInfo() {
        return connectedUsers.values().stream()
                .map(u -> {
                    Map<String, Object> info = new java.util.HashMap<>();
                    info.put("userId", u.getUserId());
                    info.put("username", u.getUsername());
                    info.put("role", u.getRole());
                    return info;
                })
                .collect(Collectors.toList());
    }

    public boolean hasGMConnected() {
        return connectedUsers.values().stream()
                .anyMatch(UserSession::isGM);
    }

    public int getConnectedUserCount() {
        return connectedUsers.size();
    }

    // -------------------------------
    // Gestión de escena
    // -------------------------------

    public void setActiveScene(SceneState scene) {
        this.activeScene = scene;
        tokens.clear();
    }

    public void updateActiveSceneBackground(String imagePath) {
        if (activeScene == null) return;
        SceneState c = activeScene;
        activeScene = new SceneState(
                c.getSceneId(), c.getCampaignId(), c.getName(),
                imagePath, c.getGridSize(), c.getWidth(), c.getHeight(), c.getIsActive()
        );
    }

    public boolean hasActiveScene() {
        return activeScene != null;
    }

    // -------------------------------
    // Gestión de tokens
    // -------------------------------

    public TokenState getToken(Long tokenId) {
        return tokens.get(tokenId);
    }

    public void addOrUpdateToken(TokenState token) {
        tokens.put(token.getTokenId(), token);
    }

    public void removeToken(Long tokenId) {
        tokens.remove(tokenId);
    }

    public Collection<TokenState> getAllTokens() {
        return tokens.values();
    }

    public List<TokenState> getVisibleTokens() {
        return tokens.values().stream()
                .filter(t -> Boolean.TRUE.equals(t.getIsVisible()))
                .collect(Collectors.toList());
    }

    public void clearTokens() {
        tokens.clear();
    }

    // -------------------------------
    // Gestión de personajes
    // -------------------------------

    private final Map<Long, CharacterState> characters = new ConcurrentHashMap<>();

    public void addOrUpdateCharacter(CharacterState cs) {
        characters.put(cs.getCharacterId(), cs);
    }

    public Collection<CharacterState> getAllCharacters() {
        return characters.values();
    }

    public CharacterState getCharacter(Long characterId) {
        return characters.get(characterId);
    }

    public void updateCharacterAttributes(Long characterId, String attributesJson) {
        CharacterState cs = characters.get(characterId);
        if (cs != null) cs.setAttributesJson(attributesJson);
    }

    public void updateCharacterPortrait(Long characterId, String portraitPath) {
        CharacterState cs = characters.get(characterId);
        if (cs != null) cs.setPortraitPath(portraitPath);
    }

    public void updateCharacterBiography(Long characterId, String biography) {
        CharacterState cs = characters.get(characterId);
        if (cs != null) cs.setBiography(biography);
    }

    public void removeCharacter(Long characterId) {
        characters.remove(characterId);
    }

    public void assignCharacterOwner(Long characterId, Long ownerUserId) {
        CharacterState cs = characters.get(characterId);
        if (cs != null) cs.setOwnerUserId(ownerUserId);
        tokens.values().stream()
                .filter(t -> characterId.equals(t.getCharacterId()))
                .forEach(t -> t.setOwnerUserId(ownerUserId));
    }

    // -------------------------------
    // Movimiento de tokens
    // -------------------------------

    public boolean moveToken(Long tokenId, Double x, Double y) {
        TokenState token = tokens.get(tokenId);
        if (token == null || Boolean.TRUE.equals(token.getIsLocked())) {
            return false;
        }

        token.setXPosition(x);
        token.setYPosition(y);
        return true;
    }

    public boolean rotateToken(Long tokenId, Double rotation) {
        TokenState token = tokens.get(tokenId);
        if (token == null || Boolean.TRUE.equals(token.getIsLocked())) {
            return false;
        }

        token.setRotation(rotation);
        return true;
    }

    public void toggleTokenVisibility(Long tokenId) {
        TokenState token = tokens.get(tokenId);
        if (token != null) {
            token.setIsVisible(!Boolean.TRUE.equals(token.getIsVisible()));
        }
    }

    public void lockToken(Long tokenId, boolean locked) {
        TokenState token = tokens.get(tokenId);
        if (token != null) {
            token.setIsLocked(locked);
        }
    }

    // -------------------------------
    // Gestión de combate
    // -------------------------------

    public void startCombat(List<Long> tokenIds) {
        combatState.setActive(true);
        combatState.setCurrentRound(1);
        combatState.setTurnOrder(new ArrayList<>(tokenIds));
        if (!tokenIds.isEmpty()) {
            combatState.setCurrentTurnTokenId(tokenIds.get(0));
        }
    }

    public void reorderCombat(List<Long> tokenIds) {
        combatState.setTurnOrder(new ArrayList<>(tokenIds));
        if (!tokenIds.isEmpty()) {
            combatState.setCurrentTurnTokenId(tokenIds.get(0));
        }
    }

    public void endCombat() {
        combatState = new CombatState();
    }

    public void nextTurn() {
        if (combatState.isActive()) {
            combatState.nextTurn();
        }
    }

    public boolean isInCombat() {
        return combatState.isActive();
    }

    // -------------------------------
    // Gestión de tiradas de dados
    // -------------------------------

    public void addDiceRoll(DiceRoll roll) {
        recentRolls.addFirst(roll);
        while (recentRolls.size() > MAX_RECENT_ROLLS) {
            recentRolls.removeLast();
        }
    }

    public List<DiceRoll> getRecentRolls(int count) {
        return recentRolls.stream()
                .limit(count)
                .collect(Collectors.toList());
    }

    public List<DiceRoll> getAllRecentRolls() {
        return new ArrayList<>(recentRolls);
    }

    public void clearRecentRolls() {
        recentRolls.clear();
    }

    // -------------------------------
    // Configuración
    // -------------------------------

    @SuppressWarnings("LombokSetterMayBeUsed")
    public void setFogOfWarEnabled(boolean enabled) {
        this.fogOfWarEnabled = enabled;
    }

    public List<String> getRevealedCells() {
        return new ArrayList<>(revealedCells);
    }

    public void revealCells(List<String> cells) {
        revealedCells.addAll(cells);
    }

    public void hideCells(List<String> cells) {
        revealedCells.removeAll(cells);
    }

    public void clearRevealedCells() {
        revealedCells.clear();
    }

    // -------------------------------
    // Gestión de áreas
    // -------------------------------

    public void addArea(Map<String, Object> area) {
        areas.add(area);
    }

    public boolean removeArea(String areaId, Long userId, boolean isGM) {
        return areas.removeIf(a -> areaId.equals(a.get("id")) &&
                (isGM || userId.equals(a.get("ownerUserId"))));
    }

    public List<Map<String, Object>> getAreas() {
        return Collections.unmodifiableList(areas);
    }

    public void clearAreas() {
        areas.clear();
    }

    public boolean setTokenAuras(Long tokenId, String aurasJson) {
        TokenState token = tokens.get(tokenId);
        if (token == null) return false;
        token.setAurasJson(aurasJson);
        return true;
    }

    // -------------------------------
    // Utilidades
    // -------------------------------

    public boolean isEmpty() {
        return connectedUsers.isEmpty();
    }

    public Map<String, Object> toSummary() {
        Map<String, Object> summary = new HashMap<>();
        summary.put("campaignId", campaignId);
        summary.put("connectedUsers", getConnectedUserCount());
        summary.put("activeSceneId", activeScene != null ? activeScene.getSceneId() : null);
        summary.put("tokenCount", tokens.size());
        summary.put("inCombat", combatState.isActive());
        summary.put("fogOfWar", fogOfWarEnabled);
        return summary;
    }
}
