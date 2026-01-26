package org.example.proyecto.test;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.proyecto.model.dto.*;
import org.example.proyecto.service.GameSession;
import org.example.proyecto.service.SessionManager;
import org.example.proyecto.websocket.GameWebSocketHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.util.*;


@ExtendWith(MockitoExtension.class)
class GameWebSocketHandlerTest {

    @Mock
    private SessionManager sessionManager;

    @Mock
    private WebSocketSession webSocketSession;

    @Mock
    private GameSession gameSession;

    @Mock
    private UserSession userSession;

    private GameWebSocketHandler handler;
    private ObjectMapper mapper;

    @BeforeEach
    void setUp() {
        handler = new GameWebSocketHandler(sessionManager);
        mapper = new ObjectMapper();

        // mock session configuration
        lenient().when(webSocketSession.getId()).thenReturn("session-123");
    }

    // ==========================================
    // Tests de Ciclo de Vida de la Conexión
    // ==========================================

    @Test
    void deberiaEstablecerConexionCorrectamente() throws Exception {
        // When
        handler.afterConnectionEstablished(webSocketSession);

        // Then - getId() se llama al menos una vez
        verify(webSocketSession, atLeastOnce()).getId();
    }

    @Test
    void deberiaCerrarConexionYLimpiarRecursos() throws Exception {
        // Given - Primero establecemos una conexión y la unimos a una campaña
        handler.afterConnectionEstablished(webSocketSession);

        Long campaignId = 1L;
        Long userId = 100L;
        String username = "TestUser";
        SceneState sceneState = new SceneState();

        when(userSession.getUsername()).thenReturn(username);
        when(userSession.getRole()).thenReturn("player");
        when(sessionManager.addUser(campaignId, userId, "session-123")).thenReturn(userSession);
        when(sessionManager.getOrCreateSession(campaignId)).thenReturn(gameSession);
        when(gameSession.getActiveScene()).thenReturn(sceneState);
        when(gameSession.getVisibleTokens()).thenReturn(Collections.emptyList());
        when(gameSession.getConnectedUsernames()).thenReturn(List.of(username));
        when(gameSession.isInCombat()).thenReturn(false);
        when(gameSession.getCombatState()).thenReturn(new CombatState());
        when(gameSession.isFogOfWarEnabled()).thenReturn(false);

        String joinMessage = createMessage("JOIN_CAMPAIGN", Map.of(
                "campaignId", campaignId,
                "userId", userId
        ));
        handler.handleTextMessage(webSocketSession, new TextMessage(joinMessage));

        // When - Cerramos la conexión
        handler.afterConnectionClosed(webSocketSession, CloseStatus.NORMAL);

        // Then
        verify(sessionManager).removeUser(campaignId, userId);
    }

    // ==========================================
    // Tests de JOIN_CAMPAIGN
    // ==========================================

    @Test
    void deberiaUnirseACampañaCorrectamente() throws Exception {
        // Given
        Long campaignId = 1L;
        Long userId = 100L;
        String username = "PlayerOne";

        SceneState sceneState = new SceneState();
        CombatState combatState = new CombatState();

        // Then
        when(webSocketSession.getId()).thenReturn("session-123");
        doNothing().when(webSocketSession).sendMessage(any(TextMessage.class));

        // Then
        when(userSession.getUsername()).thenReturn(username);
        when(userSession.getRole()).thenReturn("player");

        // Then
        when(sessionManager.addUser(campaignId, userId, "session-123")).thenReturn(userSession);
        when(sessionManager.getOrCreateSession(campaignId)).thenReturn(gameSession);

        // Then
        when(gameSession.getActiveScene()).thenReturn(sceneState);
        when(gameSession.getVisibleTokens()).thenReturn(Collections.emptyList());
        when(gameSession.getConnectedUsernames()).thenReturn(List.of(username));
        when(gameSession.isInCombat()).thenReturn(false);
        when(gameSession.getCombatState()).thenReturn(combatState);
        when(gameSession.isFogOfWarEnabled()).thenReturn(false);

        // Msg JOIN_CAMPAIGN
        String message = createMessage("JOIN_CAMPAIGN", Map.of(
                "campaignId", campaignId,
                "userId", userId
        ));

        // When
        handler.handleTextMessage(webSocketSession, new TextMessage(message));

        //Then
        verify(sessionManager).addUser(campaignId, userId, "session-123");
        verify(sessionManager).getOrCreateSession(campaignId);

        ArgumentCaptor<TextMessage> messageCaptor = ArgumentCaptor.forClass(TextMessage.class);
        verify(webSocketSession, atLeastOnce()).sendMessage(messageCaptor.capture());

        List<TextMessage> capturedMessages = messageCaptor.getAllValues();

        boolean foundSessionState = capturedMessages.stream()
                .anyMatch(msg -> msg.getPayload().contains("SESSION_STATE"));
        assertTrue(foundSessionState, "Should send SESSION_STATE");
    }

    // ==========================================
    // Tests de TOKEN_MOVE
    // ==========================================

    @Test
    void deberiaMoverTokenCorrectamente() throws Exception {
        // Given
        setupUserInCampaign(1L, 100L, "player");

        Long tokenId = 500L;
        Double x = 10.5;
        Double y = 20.3;

        when(sessionManager.moveToken(1L, tokenId, x, y)).thenReturn(true);

        String message = createMessage("TOKEN_MOVE", Map.of(
                "tokenId", tokenId,
                "x", x,
                "y", y
        ));

        // When
        handler.handleTextMessage(webSocketSession, new TextMessage(message));

        // Then
        verify(sessionManager).moveToken(1L, tokenId, x, y);
    }

    @Test
    void deberiaEnviarErrorSiMovimientoFalla() throws Exception {
        // Given
        setupUserInCampaign(1L, 100L, "player");

        Long tokenId = 500L;
        when(sessionManager.moveToken(anyLong(), eq(tokenId), anyDouble(), anyDouble()))
                .thenReturn(false);

        String message = createMessage("TOKEN_MOVE", Map.of(
                "tokenId", tokenId,
                "x", 10.0,
                "y", 20.0
        ));

        // When
        handler.handleTextMessage(webSocketSession, new TextMessage(message));

        // Then
        ArgumentCaptor<TextMessage> messageCaptor = ArgumentCaptor.forClass(TextMessage.class);
        verify(webSocketSession, atLeastOnce()).sendMessage(messageCaptor.capture());

        boolean foundError = messageCaptor.getAllValues().stream()
                .anyMatch(msg -> msg.getPayload().contains("ERROR") &&
                        msg.getPayload().contains("Failed to move token"));
        assertTrue(foundError, "Debería enviar mensaje de error");
    }

    // ==========================================
    // Tests de TOKEN_VISIBILITY (Solo GM)
    // ==========================================

    @Test
    void gmDeberiaPoderCambiarVisibilidadDeToken() throws Exception {
        // Given
        setupUserInCampaign(1L, 100L, "gm");

        Long tokenId = 500L;
        TokenState tokenState = new TokenState();
        tokenState.setTokenId(tokenId);
        tokenState.setIsVisible(true);

        when(sessionManager.getOrCreateSession(1L)).thenReturn(gameSession);
        when(gameSession.getToken(tokenId)).thenReturn(tokenState);

        String message = createMessage("TOKEN_VISIBILITY", Map.of("tokenId", tokenId));

        // When
        handler.handleTextMessage(webSocketSession, new TextMessage(message));

        // Then
        verify(gameSession).toggleTokenVisibility(tokenId);
    }

    @Test
    void jugadorNoDeberiaPoderCambiarVisibilidadDeToken() throws Exception {
        // Given
        setupUserInCampaign(1L, 100L, "player");

        String message = createMessage("TOKEN_VISIBILITY", Map.of("tokenId", 500L));

        // When
        handler.handleTextMessage(webSocketSession, new TextMessage(message));

        // Then
        verify(gameSession, never()).toggleTokenVisibility(anyLong());

        ArgumentCaptor<TextMessage> messageCaptor = ArgumentCaptor.forClass(TextMessage.class);
        verify(webSocketSession, atLeastOnce()).sendMessage(messageCaptor.capture());

        boolean foundError = messageCaptor.getAllValues().stream()
                .anyMatch(msg -> msg.getPayload().contains("Only GM can change token visibility"));
        assertTrue(foundError);
    }

    // ==========================================
    // Tests de COMBAT
    // ==========================================

    @Test
    void gmDeberiaPoderIniciarCombate() throws Exception {
        // Given
        setupUserInCampaign(1L, 100L, "gm");

        List<Long> tokenIds = Arrays.asList(1L, 2L, 3L);
        CombatState combatState = new CombatState();
        combatState.setActive(true);

        when(sessionManager.getOrCreateSession(1L)).thenReturn(gameSession);
        when(gameSession.getCombatState()).thenReturn(combatState);

        String message = createMessage("START_COMBAT", Map.of("tokenIds", tokenIds));

        // When
        handler.handleTextMessage(webSocketSession, new TextMessage(message));

        // Then
        verify(sessionManager).startCombat(eq(1L), eq(tokenIds));
    }

    @Test
    void gmDeberiaPoderAvanzarTurno() throws Exception {
        // Given
        setupUserInCampaign(1L, 100L, "gm");

        CombatState combatState = new CombatState();
        combatState.setActive(true);

        when(sessionManager.getOrCreateSession(1L)).thenReturn(gameSession);
        when(gameSession.getCombatState()).thenReturn(combatState);

        String message = createMessage("NEXT_TURN", Map.of());

        // When
        handler.handleTextMessage(webSocketSession, new TextMessage(message));

        // Then
        verify(sessionManager).nextTurn(1L);
    }

    @Test
    void jugadorNoDeberiaPoderIniciarCombate() throws Exception {
        // Given
        setupUserInCampaign(1L, 100L, "player");

        String message = createMessage("START_COMBAT", Map.of("tokenIds", Arrays.asList(1L)));

        // When
        handler.handleTextMessage(webSocketSession, new TextMessage(message));

        // Then
        verify(sessionManager, never()).startCombat(anyLong(), anyList());
    }

    // ==========================================
    // Tests de DICE_ROLL
    // ==========================================

    @Test
    void deberiaManejarTiradaDeDadosCorrectamente() throws Exception {
        // Given
        setupUserInCampaign(1L, 100L, "player");

        when(sessionManager.getOrCreateSession(1L)).thenReturn(gameSession);

        String message = createMessage("DICE_ROLL", Map.of(
                "formula", "2d6+3",
                "result", 11,
                "details", "Rolled 2d6+3: [4,4]+3 = 11"
        ));

        // When
        handler.handleTextMessage(webSocketSession, new TextMessage(message));

        // Then
        ArgumentCaptor<DiceRoll> rollCaptor = ArgumentCaptor.forClass(DiceRoll.class);
        verify(gameSession).addDiceRoll(rollCaptor.capture());

        DiceRoll capturedRoll = rollCaptor.getValue();
        assertEquals("2d6+3", capturedRoll.getFormula());
        assertEquals(11, capturedRoll.getResult());
    }

    // ==========================================
    // Tests de CHAT_MESSAGE
    // ==========================================

    @Test
    void deberiaTransmitirMensajesDeChatCorrectamente() throws Exception {
        // Given
        setupUserInCampaign(1L, 100L, "player");

        when(webSocketSession.isOpen()).thenReturn(true);

        String message = createMessage("CHAT_MESSAGE", Map.of(
                "message", "Hello everyone!"
        ));

        // When
        handler.handleTextMessage(webSocketSession, new TextMessage(message));

        // Then
        verify(webSocketSession).sendMessage(argThat(msg -> {
            String payload = (String) msg.getPayload();
            return payload.contains("Hello everyone!");
        }));

    }

    // ==========================================
    // Tests de Manejo de Errores
    // ==========================================

    @Test
    void deberiaEnviarErrorParaTipoMensajeDesconocido() throws Exception {
        // Given
        setupUserInCampaign(1L, 100L, "player");

        String message = createMessage("UNKNOWN_TYPE", Map.of());

        // When
        handler.handleTextMessage(webSocketSession, new TextMessage(message));

        // Then
        ArgumentCaptor<TextMessage> messageCaptor = ArgumentCaptor.forClass(TextMessage.class);
        verify(webSocketSession, atLeastOnce()).sendMessage(messageCaptor.capture());

        boolean foundError = messageCaptor.getAllValues().stream()
                .anyMatch(msg -> msg.getPayload().contains("Unknown message type"));
        assertTrue(foundError);
    }

    @Test
    void deberiaManejarExcepcionEnParseoDeJSON() throws Exception {
        // Given
        String invalidJson = "{ invalid json }";

        // When
        handler.handleTextMessage(webSocketSession, new TextMessage(invalidJson));

        // Then
        ArgumentCaptor<TextMessage> messageCaptor = ArgumentCaptor.forClass(TextMessage.class);
        verify(webSocketSession, atLeastOnce()).sendMessage(messageCaptor.capture());

        boolean foundError = messageCaptor.getAllValues().stream()
                .anyMatch(msg -> msg.getPayload().contains("ERROR"));
        assertTrue(foundError);
    }

    @Test
    void deberiaEnviarErrorSiSesionNoRegistrada() throws Exception {
        // Given
        handler.afterConnectionEstablished(webSocketSession);

        String message = createMessage("TOKEN_MOVE", Map.of(
                "tokenId", 1L,
                "x", 10.0,
                "y", 20.0
        ));

        // When
        handler.handleTextMessage(webSocketSession, new TextMessage(message));

        // Then
        ArgumentCaptor<TextMessage> captor = ArgumentCaptor.forClass(TextMessage.class);
        verify(webSocketSession, atLeastOnce()).sendMessage(captor.capture());

        boolean errorSent = captor.getAllValues().stream()
                .anyMatch(msg -> msg.getPayload().contains("\"type\":\"ERROR\""));

        assertTrue(errorSent, "Debería enviar un mensaje ERROR si la sesión no está registrada");
    }


    // ==========================================
    // Tests adicionales
    // ==========================================

    @Test
    void deberiaRotarTokenCorrectamente() throws Exception {
        // Given
        setupUserInCampaign(1L, 100L, "player");

        Long tokenId = 500L;
        Double rotation = 45.0;

        when(sessionManager.getOrCreateSession(1L)).thenReturn(gameSession);
        when(gameSession.rotateToken(tokenId, rotation)).thenReturn(true);

        String message = createMessage("TOKEN_ROTATE", Map.of(
                "tokenId", tokenId,
                "rotation", rotation
        ));

        // When
        handler.handleTextMessage(webSocketSession, new TextMessage(message));

        // Then
        verify(gameSession).rotateToken(tokenId, rotation);
    }

    @Test
    void gmDeberiaPoderCambiarEscena() throws Exception {
        // Given
        setupUserInCampaign(1L, 100L, "gm");

        Long sceneId = 10L;
        SceneState sceneState = new SceneState();

        when(sessionManager.getOrCreateSession(1L)).thenReturn(gameSession);
        when(gameSession.getActiveScene()).thenReturn(sceneState);
        when(gameSession.getVisibleTokens()).thenReturn(Collections.emptyList());

        String message = createMessage("CHANGE_SCENE", Map.of("sceneId", sceneId));

        // When
        handler.handleTextMessage(webSocketSession, new TextMessage(message));

        // Then
        verify(sessionManager).changeActiveScene(1L, sceneId);
    }

    @Test
    void gmDeberiaPoderTerminarCombate() throws Exception {
        // Given
        setupUserInCampaign(1L, 100L, "gm");

        String message = createMessage("END_COMBAT", Map.of());

        // When
        handler.handleTextMessage(webSocketSession, new TextMessage(message));

        // Then
        verify(sessionManager).endCombat(1L);
    }

    @Test
    void gmDeberiaPoderGuardarSesion() throws Exception {
        // Given
        setupUserInCampaign(1L, 100L, "gm");

        when(sessionManager.getOrCreateSession(1L)).thenReturn(gameSession);

        String message = createMessage("SAVE_SESSION", Map.of());

        // When
        handler.handleTextMessage(webSocketSession, new TextMessage(message));

        // Then
        verify(sessionManager).saveSessionState(gameSession);
    }

    @Test
    void jugadorNoDeberiaPoderGuardarSesion() throws Exception {
        // Given
        setupUserInCampaign(1L, 100L, "player");

        String message = createMessage("SAVE_SESSION", Map.of());

        // When
        handler.handleTextMessage(webSocketSession, new TextMessage(message));

        // Then
        verify(sessionManager, never()).saveSessionState(any());

        ArgumentCaptor<TextMessage> messageCaptor = ArgumentCaptor.forClass(TextMessage.class);
        verify(webSocketSession, atLeastOnce()).sendMessage(messageCaptor.capture());

        boolean foundError = messageCaptor.getAllValues().stream()
                .anyMatch(msg -> msg.getPayload().contains("Only GM can save session"));
        assertTrue(foundError);
    }

    // ==========================================
    // Métodos auxiliares para tests
    // ==========================================

    private String createMessage(String type, Map<String, Object> payload) {
        try {
            Map<String, Object> message = new HashMap<>();
            message.put("type", type);
            message.put("payload", payload);
            return mapper.writeValueAsString(message);
        } catch (Exception e) {
            throw new RuntimeException("Error creating test message", e);
        }
    }

    private void setupUserInCampaign(Long campaignId, Long userId, String role) throws IOException {
        // Establecer conexión
        handler.afterConnectionEstablished(webSocketSession);

        SceneState sceneState = new SceneState();

        // Configurar mocks
        when(userSession.getUsername()).thenReturn("TestUser");
        when(userSession.getRole()).thenReturn(role);
        when(sessionManager.addUser(campaignId, userId, "session-123")).thenReturn(userSession);
        when(sessionManager.getOrCreateSession(campaignId)).thenReturn(gameSession);
        when(gameSession.getActiveScene()).thenReturn(sceneState);
        when(gameSession.getVisibleTokens()).thenReturn(Collections.emptyList());
        when(gameSession.getConnectedUsernames()).thenReturn(List.of("TestUser"));
        when(gameSession.isInCombat()).thenReturn(false);
        when(gameSession.getCombatState()).thenReturn(new CombatState());
        when(gameSession.isFogOfWarEnabled()).thenReturn(false);

        // Unir a la campaña
        String joinMessage = createMessage("JOIN_CAMPAIGN", Map.of(
                "campaignId", campaignId,
                "userId", userId
        ));
        handler.handleTextMessage(webSocketSession, new TextMessage(joinMessage));

        // Limpiar las invocaciones anteriores para tests más limpios
        clearInvocations(webSocketSession, sessionManager, gameSession);
    }
}