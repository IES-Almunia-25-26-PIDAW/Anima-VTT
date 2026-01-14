package org.example.proyecto.service;

import lombok.Getter;
import org.example.proyecto.model.dto.*;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
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
