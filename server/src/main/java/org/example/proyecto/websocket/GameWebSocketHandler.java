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

                case "DICE_ROLL":
                    handleDiceRoll(session, payload);
                    break;

                case "CHAT_MESSAGE":
                    handleChatMessage(session, payload);
                    break;

                case "SAVE_SESSION":
                    handleSaveSession(session);
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

        sendToSession(session, "SESSION_STATE", Map.of(
                "campaignId", campaignId,
                "activeScene", gameSession.getActiveScene(),
                "tokens", gameSession.getVisibleTokens(),
                "connectedUsers", gameSession.getConnectedUsernames(),
                "inCombat", gameSession.isInCombat(),
                "combatState", gameSession.getCombatState(),
                "fogOfWar", gameSession.isFogOfWarEnabled()
        ));

        broadcastToCampaign(campaignId, "USER_JOINED", Map.of(
                "userId", userId,
                "username", userSession.getUsername(),
                "connectedUsers", gameSession.getConnectedUsernames()
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

        GameSession gameSession = sessionManager.getOrCreateSession(campaignId);
        boolean rotated = gameSession.rotateToken(tokenId, rotation);

        if (rotated) {
            broadcastToCampaign(campaignId, "TOKEN_ROTATED", Map.of(
                    "tokenId", tokenId,
                    "rotation", rotation
            ));
        }
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
                "tokens", gameSession.getVisibleTokens()
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


