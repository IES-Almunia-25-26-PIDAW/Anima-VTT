package org.example.proyecto.websocket;

import com.fasterxml.jackson.core.JsonParseException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import lombok.extern.slf4j.Slf4j;
import org.example.proyecto.model.dto.*;
import org.example.proyecto.service.GameSession;
import org.example.proyecto.service.SessionManager;
import org.jetbrains.annotations.NotNull;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
@Slf4j
public class GameWebSocketHandler extends TextWebSocketHandler {

    private final ObjectMapper mapper = JsonMapper.builder()
            .addModule(new JavaTimeModule())
            .build();

    private final SessionManager sessionManager;

    private final Map<String, ConnectionInfo> connections = new ConcurrentHashMap<>();

    private final Map<String, WebSocketSession> webSocketSessions = new ConcurrentHashMap<>();

    private final Map<Long, Set<String>> campaignSessions = new ConcurrentHashMap<>();

    public GameWebSocketHandler(SessionManager sessionManager) {
        this.sessionManager = sessionManager;
    }

    @Override
    public void afterConnectionEstablished(@NotNull WebSocketSession session) {
        log.info("WebSocket connection established: {}", session.getId());
        webSocketSessions.put(session.getId(), session);
    }

    @Override
    public void handleTextMessage(@NotNull WebSocketSession session, @NotNull TextMessage message) {
        try {
            JsonNode root = mapper.readTree(message.getPayload());
            String type = root.get("type").asText();
            JsonNode payload = root.get("payload");

            log.debug("Received message type: {} from session: {}", type, session.getId());

            switch (type) {
                case "JOIN_CAMPAIGN":
                    handleJoinCampaign(session, payload);
                    break;

                case "LEAVE_CAMPAIGN":
                    handleLeaveCampaign(session);
                    break;

                case "TOKEN_MOVE":
                    handleTokenMove(session, payload);
                    break;

                case "TOKEN_ROTATE":
                    handleTokenRotate(session, payload);
                    break;

                case "TOKEN_VISIBILITY":
                    handleTokenVisibility(session, payload);
                    break;

                case "CHANGE_SCENE":
                    handleChangeScene(session, payload);
                    break;

                case "START_COMBAT":
                    handleStartCombat(session, payload);
                    break;

                case "NEXT_TURN":
                    handleNextTurn(session);
                    break;

                case "END_COMBAT":
                    handleEndCombat(session);
                    break;

                case "REORDER_COMBAT":
                    handleReorderCombat(session, payload);
                    break;

                case "DICE_ROLL":
                    handleDiceRoll(session, payload);
                    break;

                case "CHAT_MESSAGE":
                    handleChatMessage(session, payload);
                    break;

                case "SAVE_SESSION":
                    handleSaveSession(session);
                    break;

                case "UPDATE_CHARACTER":
                    handleUpdateCharacter(session, payload);
                    break;

                case "UPDATE_SCENE":
                    handleUpdateScene(session, payload);
                    break;

                case "CREATE_SCENE":
                    handleCreateScene(session, payload);
                    break;

                case "ADD_TOKEN":
                    handleAddToken(session, payload);
                    break;

                case "CREATE_JOURNAL_FOLDER":
                    handleCreateJournalFolder(session, payload);
                    break;

                case "DELETE_JOURNAL_FOLDER":
                    handleDeleteJournalFolder(session, payload);
                    break;

                case "CREATE_JOURNAL_ENTRY":
                    handleCreateJournalEntry(session, payload);
                    break;

                case "UPDATE_JOURNAL_ENTRY":
                    handleUpdateJournalEntry(session, payload);
                    break;

                case "DELETE_JOURNAL_ENTRY":
                    handleDeleteJournalEntry(session, payload);
                    break;

                case "REMOVE_TOKEN":
                    handleRemoveToken(session, payload);
                    break;

                case "ASSIGN_CHARACTER":
                    handleAssignCharacter(session, payload);
                    break;

                case "CREATE_CHARACTER":
                    handleCreateCharacter(session, payload);
                    break;

                case "DELETE_CHARACTER":
                    handleDeleteCharacter(session, payload);
                    break;

                case "UPDATE_PORTRAIT":
                    handleUpdatePortrait(session, payload);
                    break;

                case "PING_MAP":
                    handlePingMap(session, payload);
                    break;

                case "ADD_AREA":
                    handleAddArea(session, payload);
                    break;

                case "REMOVE_AREA":
                    handleRemoveArea(session, payload);
                    break;

                case "SET_TOKEN_AURAS":
                    handleSetTokenAuras(session, payload);
                    break;

                case "TOGGLE_FOG_OF_WAR":
                    handleToggleFogOfWar(session);
                    break;

                case "PAINT_FOG_CELLS":
                    handlePaintFogCells(session, payload);
                    break;

                case "LOGIN":
                    handleLogin(session, payload);
                    break;
                case "REGISTER":
                    handleRegister(session, payload);
                    break;

                default:
                    log.warn("Unknown message type: {}", type);
                    sendError(session, "Unknown message type: " + type);
            }
        } catch (JsonParseException e) {
            log.warn("Malformed JSON received: {}", message.getPayload(), e);
            sendError(session, "Malformed JSON");
        } catch (Exception e) {
            log.error("Error handling WebSocket message", e);
            sendError(session, "Internal error processing message");
        }
    }

    private void handleLogin(@NotNull WebSocketSession session, @NotNull JsonNode payload) {
        String username = payload.get("username").asText();
        String password = payload.get("password").asText();

        try {
            UserDTO user = sessionManager.authenticateUser(username, password);

            sendToSession(session, "LOGIN_SUCCESS", Map.of(
                    "userId", user.getId(),
                    "username", user.getUsername(),
                    "role", user.getRole()
            ));

            log.info("User {} logged in successfully", username);

        } catch (Exception e) {
            sendToSession(session, "LOGIN_ERROR", Map.of(
                    "message", e.getMessage()
            ));
            log.error("Login error for user {}", username, e);
        }
    }

    private void handleRegister(@NotNull WebSocketSession session, @NotNull JsonNode payload) {
        String username = payload.get("username").asText();
        String password = payload.get("password").asText();
        String email = payload.has("email") ? payload.get("email").asText() : null;

        try {
            UserDTO newUser = sessionManager.registerUser(username, password, email);

            sendToSession(session, "REGISTER_SUCCESS", Map.of(
                    "message", "Registro exitoso. Espera la aprobación del DM.",
                    "userId", newUser.getId(),
                    "username", newUser.getUsername()
            ));

            log.info("New user registered: {}", username);

        } catch (Exception e) {
            sendToSession(session, "REGISTER_ERROR", Map.of(
                    "message", e.getMessage()
            ));
            log.error("Registration error for user {}", username, e);
        }
    }

    @Override
    public void afterConnectionClosed(@NotNull WebSocketSession session, @NotNull CloseStatus status) {
        log.info("WebSocket connection closed: {} with status: {}", session.getId(), status);

        ConnectionInfo info = connections.remove(session.getId());
        webSocketSessions.remove(session.getId());

        if (info != null) {
            Set<String> sessions = campaignSessions.get(info.campaignId);
            if (sessions != null) {
                sessions.remove(session.getId());
                if (sessions.isEmpty()) {
                    campaignSessions.remove(info.campaignId);
                }
            }

            sessionManager.removeUser(info.campaignId, info.userId);

            broadcastToCampaign(info.campaignId, "USER_LEFT", Map.of(
                    "userId", info.userId,
                    "username", info.username
            ));
        }
    }

    // -------------------------------
    // Handlers de mensajes
    // -------------------------------

    private void handleJoinCampaign(@NotNull WebSocketSession session, @NotNull JsonNode payload) {
        Long campaignId = payload.get("campaignId").asLong();
        Long userId = payload.get("userId").asLong();

        UserSession userSession = sessionManager.addUser(campaignId, userId, session.getId());

        ConnectionInfo info = new ConnectionInfo(
                campaignId,
                userId,
                userSession.getUsername(),
                userSession.getRole()
        );
        connections.put(session.getId(), info);

        campaignSessions.computeIfAbsent(campaignId, k -> ConcurrentHashMap.newKeySet())
                .add(session.getId());

        GameSession gameSession = sessionManager.getOrCreateSession(campaignId);

        Map<String, Object> sessionState = new HashMap<>();
        sessionState.put("campaignId", campaignId);
        sessionState.put("activeScene", gameSession.getActiveScene());

        // Read token positions directly from DB (fresh, non-transactional query) so that
        // SESSION_STATE always reflects the latest committed x/y regardless of any
        // in-memory staleness or transaction-snapshot issues.
        SceneState activeScene = gameSession.getActiveScene();
        List<TokenState> visibleTokens = activeScene != null
                ? sessionManager.getVisibleTokensFromDb(activeScene.getSceneId())
                : new ArrayList<>();
        log.info("[JOIN] Sending SESSION_STATE to user {} with {} tokens", userSession.getUsername(), visibleTokens.size());
        for (TokenState t : visibleTokens) {
            log.info("[JOIN] token id={} x={} y={}", t.getTokenId(), t.getXPosition(), t.getYPosition());
        }
        sessionState.put("tokens", visibleTokens);
        sessionState.put("characters", gameSession.getAllCharacters());
        sessionState.put("connectedUsers", gameSession.getConnectedUsersInfo());
        sessionState.put("inCombat", gameSession.isInCombat());
        sessionState.put("combatState", gameSession.getCombatState());
        sessionState.put("fogOfWar", gameSession.isFogOfWarEnabled());
        sessionState.put("revealedCells", gameSession.getRevealedCells());
        sessionState.put("allScenes", sessionManager.getAllScenes(campaignId));
        boolean isGM = "gm".equals(info.role);
        sessionState.put("journalFolders", sessionManager.getJournalFolders(campaignId));
        sessionState.put("journalEntries", sessionManager.getJournalEntries(campaignId, isGM));
        sessionState.put("areas", gameSession.getAreas());
        sendToSession(session, "SESSION_STATE", sessionState);

        broadcastToCampaign(campaignId, "USER_JOINED", Map.of(
                "userId", userId,
                "username", userSession.getUsername(),
                "role", userSession.getRole(),
                "connectedUsers", gameSession.getConnectedUsersInfo()
        ), session.getId());

        log.info("User {} joined campaign {}", userSession.getUsername(), campaignId);
    }

    private void handleLeaveCampaign(@NotNull WebSocketSession session) {
        ConnectionInfo info = connections.get(session.getId());
        if (info != null) {
            sessionManager.removeUser(info.campaignId, info.userId);
            log.info("User {} left campaign {}", info.username, info.campaignId);
        }
    }

    private void handleTokenMove(WebSocketSession session, @NotNull JsonNode payload) {
        ConnectionInfo info = getConnectionInfo(session);
        Long tokenId = payload.get("tokenId").asLong();
        Double x = payload.get("x").asDouble();
        Double y = payload.get("y").asDouble();

        if (!"gm".equals(info.role)) {
            GameSession gs = sessionManager.getOrCreateSession(info.campaignId);
            TokenState token = gs.getToken(tokenId);
            if (token == null || !info.userId.equals(token.getOwnerUserId())) {
                sendError(session, "No tienes permiso para mover este token");
                return;
            }
        }

        boolean moved = sessionManager.moveToken(info.campaignId, tokenId, x, y);
        if (moved) {
            broadcastToCampaign(info.campaignId, "TOKEN_MOVED", Map.of(
                    "tokenId", tokenId,
                    "x", x,
                    "y", y,
                    "movedBy", info.username
            ));
        } else {
            sendError(session, "Failed to move token");
        }
    }

    private void handleTokenRotate(WebSocketSession session, @NotNull JsonNode payload) {
        ConnectionInfo info = getConnectionInfo(session);
        Long campaignId = info.campaignId;
        Long tokenId = payload.get("tokenId").asLong();
        Double rotation = payload.get("rotation").asDouble();

        if (!"gm".equals(info.role)) {
            GameSession gs = sessionManager.getOrCreateSession(campaignId);
            TokenState token = gs.getToken(tokenId);
            if (token == null || !info.userId.equals(token.getOwnerUserId())) {
                sendError(session, "No tienes permiso para rotar este token");
                return;
            }
        }

        GameSession gameSession = sessionManager.getOrCreateSession(campaignId);
        boolean rotated = gameSession.rotateToken(tokenId, rotation);
        if (rotated) {
            broadcastToCampaign(campaignId, "TOKEN_ROTATED", Map.of(
                    "tokenId", tokenId,
                    "rotation", rotation
            ));
        }
    }

    private void handleAssignCharacter(WebSocketSession session, JsonNode payload) {
        ConnectionInfo info = getConnectionInfo(session);
        if (!"gm".equals(info.role)) {
            sendError(session, "Solo el GM puede asignar personajes");
            return;
        }
        Long characterId = payload.get("characterId").asLong();
        Long ownerUserId = payload.has("userId") && !payload.get("userId").isNull()
                ? payload.get("userId").asLong()
                : null;

        sessionManager.assignCharacterOwner(info.campaignId, characterId, ownerUserId);

        java.util.Map<String, Object> change = new java.util.HashMap<>();
        change.put("characterId", characterId);
        change.put("ownerUserId", ownerUserId);
        broadcastToCampaign(info.campaignId, "CHARACTER_OWNERSHIP_CHANGED", change);
    }

    private void handleTokenVisibility(WebSocketSession session, JsonNode payload) {
        ConnectionInfo info = getConnectionInfo(session);

        if (!"gm".equals(info.role)) {
            sendError(session, "Only GM can change token visibility");
            return;
        }

        Long tokenId = payload.get("tokenId").asLong();
        GameSession gameSession = sessionManager.getOrCreateSession(info.campaignId);
        gameSession.toggleTokenVisibility(tokenId);

        TokenState token = gameSession.getToken(tokenId);
        if (token != null) {
            broadcastToCampaign(info.campaignId, "TOKEN_VISIBILITY_CHANGED", Map.of(
                    "tokenId", tokenId,
                    "isVisible", token.getIsVisible()
            ));
        }
    }

    private void handleChangeScene(WebSocketSession session, JsonNode payload) {
        ConnectionInfo info = getConnectionInfo(session);

        if (!"gm".equals(info.role)) {
            sendError(session, "Only GM can change scenes");
            return;
        }

        Long sceneId = payload.get("sceneId").asLong();
        sessionManager.changeActiveScene(info.campaignId, sceneId);

        GameSession gameSession = sessionManager.getOrCreateSession(info.campaignId);

        broadcastToCampaign(info.campaignId, "SCENE_CHANGED", Map.of(
                "activeScene", gameSession.getActiveScene(),
                "tokens", gameSession.getVisibleTokens(),
                "fogOfWar", gameSession.isFogOfWarEnabled(),
                "revealedCells", gameSession.getRevealedCells()
        ));
    }

    private void handleStartCombat(WebSocketSession session, JsonNode payload) {
        ConnectionInfo info = getConnectionInfo(session);

        if (!"gm".equals(info.role)) {
            sendError(session, "Only GM can start combat");
            return;
        }

        List<Long> tokenIds = mapper.convertValue(
                payload.get("tokenIds"),
                mapper.getTypeFactory().constructCollectionType(List.class, Long.class)
        );

        sessionManager.startCombat(info.campaignId, tokenIds);
        GameSession gameSession = sessionManager.getOrCreateSession(info.campaignId);

        broadcastToCampaign(info.campaignId, "COMBAT_STARTED", Map.of(
                "combatState", gameSession.getCombatState()
        ));
    }

    private void handleNextTurn(WebSocketSession session) {
        ConnectionInfo info = getConnectionInfo(session);

        if (!"gm".equals(info.role)) {
            sendError(session, "Only GM can advance turns");
            return;
        }

        sessionManager.nextTurn(info.campaignId);
        GameSession gameSession = sessionManager.getOrCreateSession(info.campaignId);

        broadcastToCampaign(info.campaignId, "TURN_CHANGED", Map.of(
                "combatState", gameSession.getCombatState()
        ));
    }

    private void handlePaintFogCells(WebSocketSession session, JsonNode payload) {
        ConnectionInfo info = getConnectionInfo(session);
        if (!"gm".equals(info.role)) {
            sendError(session, "Only GM can paint fog cells");
            return;
        }

        GameSession gameSession = sessionManager.getOrCreateSession(info.campaignId);
        boolean revealed = payload.get("revealed").asBoolean();

        List<String> cells = new ArrayList<>();
        payload.get("cells").forEach(node -> cells.add(node.asText()));

        if (revealed) {
            gameSession.revealCells(cells);
        } else {
            gameSession.hideCells(cells);
        }

        Map<String, Object> broadcastPayload = new HashMap<>();
        broadcastPayload.put("cells", cells);
        broadcastPayload.put("revealed", revealed);
        broadcastToCampaign(info.campaignId, "FOG_CELLS_CHANGED", broadcastPayload);
    }

    private void handleToggleFogOfWar(WebSocketSession session) {
        ConnectionInfo info = getConnectionInfo(session);

        if (!"gm".equals(info.role)) {
            sendError(session, "Only GM can toggle fog of war");
            return;
        }

        GameSession gameSession = sessionManager.getOrCreateSession(info.campaignId);
        boolean newValue = !gameSession.isFogOfWarEnabled();
        gameSession.setFogOfWarEnabled(newValue);

        broadcastToCampaign(info.campaignId, "FOG_OF_WAR_CHANGED", Map.of(
                "enabled", newValue
        ));
    }

    private void handleEndCombat(WebSocketSession session) {
        ConnectionInfo info = getConnectionInfo(session);

        if (!"gm".equals(info.role)) {
            sendError(session, "Only GM can end combat");
            return;
        }

        sessionManager.endCombat(info.campaignId);

        broadcastToCampaign(info.campaignId, "COMBAT_ENDED", Map.of(
                "message", "Combat has ended"
        ));
    }

    private void handleReorderCombat(WebSocketSession session, @NotNull JsonNode payload) {
        ConnectionInfo info = getConnectionInfo(session);

        if (!"gm".equals(info.role)) {
            sendError(session, "Only GM can reorder combat");
            return;
        }

        List<Long> tokenIds = mapper.convertValue(
                payload.get("tokenIds"),
                mapper.getTypeFactory().constructCollectionType(List.class, Long.class)
        );

        sessionManager.reorderCombat(info.campaignId, tokenIds);
        GameSession gameSession = sessionManager.getOrCreateSession(info.campaignId);

        broadcastToCampaign(info.campaignId, "TURN_CHANGED", Map.of(
                "combatState", gameSession.getCombatState()
        ));
    }

    private void handleDiceRoll(WebSocketSession session, @NotNull JsonNode payload) {
        ConnectionInfo info = getConnectionInfo(session);

        String formula = payload.get("formula").asText();
        Integer result = payload.get("result").asInt();
        String details = payload.get("details").asText();

        DiceRoll roll = new DiceRoll(
                info.userId,
                info.username,
                formula,
                result,
                details,
                java.time.LocalDateTime.now()
        );

        GameSession gameSession = sessionManager.getOrCreateSession(info.campaignId);
        gameSession.addDiceRoll(roll);

        broadcastToCampaign(info.campaignId, "DICE_ROLLED", Map.of(
                "roll", roll
        ));
    }

    private void handleChatMessage(WebSocketSession session, @NotNull JsonNode payload) {
        ConnectionInfo info = getConnectionInfo(session);
        String message = payload.get("message").asText();

        broadcastToCampaign(info.campaignId, "CHAT_MESSAGE", Map.of(
                "userId", info.userId,
                "username", info.username,
                "message", message,
                "timestamp", java.time.LocalDateTime.now()
        ));
    }

    private void handleUpdateCharacter(WebSocketSession session, @NotNull JsonNode payload) {
        ConnectionInfo info = getConnectionInfo(session);

        if (!"gm".equals(info.role())) {
            sendError(session, "Only the GM can update character sheets");
            return;
        }

        Long characterId = payload.get("characterId").asLong();
        boolean updated = false;
        Map<String, Object> broadcastPayload = new HashMap<>();
        broadcastPayload.put("characterId", characterId);

        if (payload.has("attributesJson")) {
            String attributesJson = payload.get("attributesJson").asText();
            if (sessionManager.updateCharacterAttributes(info.campaignId(), characterId, attributesJson)) {
                broadcastPayload.put("attributesJson", attributesJson);
                updated = true;
            }
        }

        if (payload.has("biography")) {
            String biography = payload.get("biography").asText();
            if (sessionManager.updateCharacterBiography(info.campaignId(), characterId, biography)) {
                broadcastPayload.put("biography", biography);
                updated = true;
            }
        }

        if (updated) {
            broadcastToCampaign(info.campaignId(), "CHARACTER_UPDATED", broadcastPayload);
        } else {
            sendError(session, "Character not found or not in this campaign");
        }
    }

    private void handleUpdatePortrait(WebSocketSession session, @NotNull JsonNode payload) {
        ConnectionInfo info = getConnectionInfo(session);

        if (!"gm".equals(info.role())) {
            sendError(session, "Only the GM can update character portraits");
            return;
        }

        Long characterId = payload.get("characterId").asLong();
        String portraitPath = (payload.has("portraitPath") && !payload.get("portraitPath").isNull())
                ? payload.get("portraitPath").asText()
                : null;

        boolean updated = sessionManager.updateCharacterPortrait(info.campaignId(), characterId, portraitPath);

        if (updated) {
            Map<String, Object> broadcastPayload = new HashMap<>();
            broadcastPayload.put("characterId", characterId);
            broadcastPayload.put("portraitPath", portraitPath);
            broadcastToCampaign(info.campaignId(), "CHARACTER_UPDATED", broadcastPayload);
        } else {
            sendError(session, "Character not found or not in this campaign");
        }
    }

    private void handlePingMap(WebSocketSession session, @NotNull JsonNode payload) {
        ConnectionInfo info = getConnectionInfo(session);
        double x = payload.get("x").asDouble();
        double y = payload.get("y").asDouble();
        Map<String, Object> broadcastPayload = new HashMap<>();
        broadcastPayload.put("x", x);
        broadcastPayload.put("y", y);
        broadcastPayload.put("userId", info.userId());
        broadcastPayload.put("username", info.username());
        broadcastToCampaign(info.campaignId(), "MAP_PING", broadcastPayload);
    }

    private void handleAddArea(WebSocketSession session, @NotNull JsonNode payload) {
        ConnectionInfo info = getConnectionInfo(session);
        GameSession gameSession = sessionManager.getOrCreateSession(info.campaignId());
        if (!gameSession.hasActiveScene()) return;

        Map<String, Object> area = new HashMap<>();
        area.put("id", java.util.UUID.randomUUID().toString());
        area.put("type", payload.get("type").asText());
        area.put("x", payload.get("x").asDouble());
        area.put("y", payload.get("y").asDouble());
        area.put("x2", payload.get("x2").asDouble());
        area.put("y2", payload.get("y2").asDouble());
        area.put("color", payload.get("color").asText());
        area.put("ownerUserId", info.userId());
        area.put("username", info.username());

        gameSession.addArea(area);
        Map<String, Object> broadcastPayload = new HashMap<>();
        broadcastPayload.put("area", area);
        broadcastToCampaign(info.campaignId(), "AREA_ADDED", broadcastPayload);
    }

    private void handleRemoveArea(WebSocketSession session, @NotNull JsonNode payload) {
        ConnectionInfo info = getConnectionInfo(session);
        GameSession gameSession = sessionManager.getOrCreateSession(info.campaignId());

        String areaId = payload.get("areaId").asText();
        boolean isGM = "gm".equals(info.role());
        boolean removed = gameSession.removeArea(areaId, info.userId(), isGM);
        if (removed) {
            broadcastToCampaign(info.campaignId(), "AREA_REMOVED", Map.of("areaId", areaId));
        }
    }

    private void handleSetTokenAuras(WebSocketSession session, @NotNull JsonNode payload) {
        ConnectionInfo info = getConnectionInfo(session);
        if (!"gm".equals(info.role())) {
            sendError(session, "Only GM can set token auras");
            return;
        }
        Long tokenId = payload.get("tokenId").asLong();
        String aurasJson = payload.has("aurasJson") ? payload.get("aurasJson").asText() : "[]";
        GameSession gameSession = sessionManager.getOrCreateSession(info.campaignId());
        boolean updated = gameSession.setTokenAuras(tokenId, aurasJson);
        if (updated) {
            Map<String, Object> resp = new HashMap<>();
            resp.put("tokenId", tokenId);
            resp.put("aurasJson", aurasJson);
            broadcastToCampaign(info.campaignId(), "TOKEN_AURAS_CHANGED", resp);
        }
    }

    private void handleUpdateScene(WebSocketSession session, JsonNode payload) {
        ConnectionInfo info = getConnectionInfo(session);

        if (!"gm".equals(info.role())) {
            sendError(session, "Only GM can update scene");
            return;
        }

        Long sceneId = payload.get("sceneId").asLong();
        String imagePath = (payload.has("backgroundImagePath") && !payload.get("backgroundImagePath").isNull())
                ? payload.get("backgroundImagePath").asText()
                : null;

        sessionManager.updateSceneBackground(info.campaignId(), sceneId, imagePath);

        GameSession gameSession = sessionManager.getOrCreateSession(info.campaignId());

        broadcastToCampaign(info.campaignId(), "SCENE_CHANGED", Map.of(
                "activeScene", gameSession.getActiveScene(),
                "tokens", gameSession.getVisibleTokens()
        ));
    }

    private void handleAddToken(WebSocketSession session, JsonNode payload) {
        ConnectionInfo info = getConnectionInfo(session);
        if (!"gm".equals(info.role)) {
            sendError(session, "Only GM can add tokens");
            return;
        }

        Long characterId = payload.get("characterId").asLong();
        GameSession gameSession = sessionManager.getOrCreateSession(info.campaignId);
        if (gameSession.getActiveScene() == null) {
            sendError(session, "No active scene");
            return;
        }

        // Default to scene centre
        double x = payload.has("x") ? payload.get("x").asDouble()
                : gameSession.getActiveScene().getWidth()  / 2.0;
        double y = payload.has("y") ? payload.get("y").asDouble()
                : gameSession.getActiveScene().getHeight() / 2.0;

        // Snap to cell centre
        int g = gameSession.getActiveScene().getGridSize();
        x = Math.floor(x / g) * g + g / 2.0;
        y = Math.floor(y / g) * g + g / 2.0;

        try {
            var tokenState = sessionManager.addToken(info.campaignId, characterId, x, y);
            broadcastToCampaign(info.campaignId, "TOKEN_ADDED", Map.of("token", tokenState));
        } catch (RuntimeException e) {
            sendError(session, e.getMessage());
        }
    }

    private void handleRemoveToken(WebSocketSession session, JsonNode payload) {
        ConnectionInfo info = getConnectionInfo(session);
        if (!"gm".equals(info.role)) {
            sendError(session, "Only GM can remove tokens");
            return;
        }

        Long tokenId = payload.get("tokenId").asLong();
        boolean removed = sessionManager.removeToken(info.campaignId, tokenId);
        if (removed) {
            broadcastToCampaign(info.campaignId, "TOKEN_REMOVED", Map.of("tokenId", tokenId));
        } else {
            sendError(session, "Token not found: " + tokenId);
        }
    }

    private void handleCreateScene(WebSocketSession session, JsonNode payload) {
        ConnectionInfo info = getConnectionInfo(session);

        if (!"gm".equals(info.role)) {
            sendError(session, "Only GM can create scenes");
            return;
        }

        String name = payload.has("name") ? payload.get("name").asText().trim() : "Nueva escena";
        int gridSize = payload.has("gridSize") ? payload.get("gridSize").asInt() : 64;
        int width    = payload.has("width")    ? payload.get("width").asInt()    : 1600;
        int height   = payload.has("height")   ? payload.get("height").asInt()   : 1200;

        if (name.isEmpty()) name = "Nueva escena";

        SceneState created = sessionManager.createScene(info.campaignId, name, gridSize, width, height);

        broadcastToCampaign(info.campaignId, "SCENE_CREATED", Map.of("scene", created));
    }

    private void handleCreateJournalFolder(WebSocketSession session, JsonNode payload) {
        ConnectionInfo info = getConnectionInfo(session);
        if (!"gm".equals(info.role)) { sendError(session, "Solo el GM puede crear carpetas"); return; }
        String name = payload.get("name").asText().trim();
        if (name.isEmpty()) name = "Nueva carpeta";
        var folder = sessionManager.createFolder(info.campaignId, name);
        broadcastToCampaign(info.campaignId, "JOURNAL_FOLDER_CREATED", Map.of("folder", folder));
    }

    private void handleDeleteJournalFolder(WebSocketSession session, JsonNode payload) {
        ConnectionInfo info = getConnectionInfo(session);
        if (!"gm".equals(info.role)) { sendError(session, "Solo el GM puede eliminar carpetas"); return; }
        Long folderId = payload.get("folderId").asLong();
        sessionManager.deleteFolder(folderId);
        broadcastToCampaign(info.campaignId, "JOURNAL_FOLDER_DELETED", Map.of("folderId", folderId));
    }

    private void handleCreateJournalEntry(WebSocketSession session, JsonNode payload) {
        ConnectionInfo info = getConnectionInfo(session);
        if (!"gm".equals(info.role)) { sendError(session, "Solo el GM puede crear entradas"); return; }
        String title      = payload.has("title")      ? payload.get("title").asText()      : "";
        String content    = payload.has("content")    ? payload.get("content").asText()    : "";
        String visibility = payload.has("visibility") ? payload.get("visibility").asText() : "gm";
        Long folderId     = payload.has("folderId") && !payload.get("folderId").isNull()
                ? payload.get("folderId").asLong() : null;
        var entry = sessionManager.createEntry(info.campaignId, title, content, visibility, folderId);
        if ("all".equals(entry.getVisibility())) {
            broadcastToCampaign(info.campaignId, "JOURNAL_ENTRY_CREATED", Map.of("entry", entry));
        } else {
            broadcastToGMs(info.campaignId, "JOURNAL_ENTRY_CREATED", Map.of("entry", entry));
        }
    }

    private void handleUpdateJournalEntry(WebSocketSession session, JsonNode payload) {
        ConnectionInfo info = getConnectionInfo(session);
        if (!"gm".equals(info.role)) { sendError(session, "Solo el GM puede editar entradas"); return; }
        Long entryId      = payload.get("entryId").asLong();
        String title      = payload.has("title")      ? payload.get("title").asText()      : "";
        String content    = payload.has("content")    ? payload.get("content").asText()    : "";
        String visibility = payload.has("visibility") ? payload.get("visibility").asText() : "gm";
        Long folderId     = payload.has("folderId") && !payload.get("folderId").isNull()
                ? payload.get("folderId").asLong() : null;
        var entry = sessionManager.updateEntry(entryId, title, content, visibility, folderId);
        if ("all".equals(entry.getVisibility())) {
            broadcastToCampaign(info.campaignId, "JOURNAL_ENTRY_UPDATED", Map.of("entry", entry));
        } else {
            broadcastToGMs(info.campaignId, "JOURNAL_ENTRY_UPDATED", Map.of("entry", entry));
        }
    }

    private void handleDeleteJournalEntry(WebSocketSession session, JsonNode payload) {
        ConnectionInfo info = getConnectionInfo(session);
        if (!"gm".equals(info.role)) { sendError(session, "Solo el GM puede eliminar entradas"); return; }
        Long entryId = payload.get("entryId").asLong();
        sessionManager.deleteEntry(entryId);
        broadcastToCampaign(info.campaignId, "JOURNAL_ENTRY_DELETED", Map.of("entryId", entryId));
    }

    private void handleCreateCharacter(WebSocketSession session, JsonNode payload) {
        ConnectionInfo info = getConnectionInfo(session);
        if (!"gm".equals(info.role())) {
            sendError(session, "Solo el GM puede crear personajes");
            return;
        }
        String name           = payload.has("name")          ? payload.get("name").asText()          : "Sin nombre";
        String type           = payload.has("type")          ? payload.get("type").asText()          : "NPC";
        String attributesJson = payload.has("attributesJson") ? payload.get("attributesJson").asText() : "{}";
        String biography      = payload.has("biography")     ? payload.get("biography").asText()     : "";
        String portraitPath   = (payload.has("portraitPath") && !payload.get("portraitPath").isNull())
                ? payload.get("portraitPath").asText() : null;

        var character = sessionManager.createCharacter(info.campaignId(), name, type, attributesJson, biography, portraitPath);
        broadcastToCampaign(info.campaignId(), "CHARACTER_CREATED", Map.of("character", character));
    }

    private void handleDeleteCharacter(WebSocketSession session, JsonNode payload) {
        ConnectionInfo info = getConnectionInfo(session);
        if (!"gm".equals(info.role())) {
            sendError(session, "Solo el GM puede eliminar personajes");
            return;
        }
        Long characterId = payload.get("characterId").asLong();
        boolean deleted = sessionManager.deleteCharacter(info.campaignId(), characterId);
        if (deleted) {
            broadcastToCampaign(info.campaignId(), "CHARACTER_DELETED", Map.of("characterId", characterId));
        } else {
            sendError(session, "Personaje no encontrado: " + characterId);
        }
    }

    private void broadcastToGMs(Long campaignId, String type, Object payload) {
        Set<String> sessionIds = campaignSessions.get(campaignId);
        if (sessionIds == null) return;
        Map<String, Object> message = Map.of("type", type, "payload", payload);
        for (String sid : sessionIds) {
            ConnectionInfo info = connections.get(sid);
            if (info != null && "gm".equals(info.role)) {
                WebSocketSession ws = webSocketSessions.get(sid);
                if (ws != null && ws.isOpen()) {
                    try { ws.sendMessage(new TextMessage(mapper.writeValueAsString(message))); }
                    catch (IOException e) { log.error("Error broadcasting to GM {}", sid, e); }
                }
            }
        }
    }

    private void handleSaveSession(WebSocketSession session) {
        ConnectionInfo info = getConnectionInfo(session);

        if (!"gm".equals(info.role)) {
            sendError(session, "Only GM can save session");
            return;
        }

        GameSession gameSession = sessionManager.getOrCreateSession(info.campaignId);
        sessionManager.saveSessionState(gameSession);

        sendToSession(session, "SESSION_SAVED", Map.of(
                "message", "Session saved successfully"
        ));
    }

    // -------------------------------
    // Utilidades de comunicación
    // -------------------------------

    private void sendToSession(@NotNull WebSocketSession session, String type, Object payload) {
        try {
            Map<String, Object> message = Map.of(
                    "type", type,
                    "payload", payload
            );
            session.sendMessage(new TextMessage(mapper.writeValueAsString(message)));
        } catch (IOException e) {
            log.error("Error sending message to session {}", session.getId(), e);
        }
    }

    private void broadcastToCampaign(Long campaignId, String type, Object payload) {
        broadcastToCampaign(campaignId, type, payload, null);
    }

    private void broadcastToCampaign(Long campaignId, String type, Object payload, String excludeSessionId) {
        Set<String> sessionIds = campaignSessions.get(campaignId);
        if (sessionIds == null) return;

        Map<String, Object> message = Map.of(
                "type", type,
                "payload", payload
        );

        String json;
        try {
            json = mapper.writeValueAsString(message);
        } catch (Exception e) {
            log.error("Error serializing broadcast message", e);
            return;
        }

        sessionIds.forEach(sessionId -> {
            if (excludeSessionId != null && excludeSessionId.equals(sessionId)) {
                return;
            }

            WebSocketSession wsSession = webSocketSessions.get(sessionId);
            if (wsSession != null && wsSession.isOpen()) {
                try {
                    wsSession.sendMessage(new TextMessage(json));
                } catch (IOException e) {
                    log.error("Error broadcasting to session {}", sessionId, e);
                }
            }
        });
    }

    private void sendError(WebSocketSession session, String error) {
        sendToSession(session, "ERROR", Map.of("message", error));
    }

    private @NotNull ConnectionInfo getConnectionInfo(@NotNull WebSocketSession session) {
        ConnectionInfo info = connections.get(session.getId());
        if (info == null) {
            throw new IllegalStateException("Session not registered: " + session.getId());
        }
        return info;
    }

    // -------------------------------
    // Clase record interna para info de conexión
    // -------------------------------

    private record ConnectionInfo(Long campaignId, Long userId, String username, String role) {}
}


