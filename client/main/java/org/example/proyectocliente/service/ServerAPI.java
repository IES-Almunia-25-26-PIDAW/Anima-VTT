package org.example.proyectocliente.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.websocket.*;
import org.example.proyectocliente.model.CharacterDTO;
import org.jetbrains.annotations.NotNull;

import java.net.URI;

@ClientEndpoint
public class ServerAPI {

    private static final ObjectMapper mapper = new ObjectMapper();
    private Session session;

    public void connect(String serverUri) throws Exception {
        WebSocketContainer container = ContainerProvider.getWebSocketContainer();
        container.connectToServer(this, new URI(serverUri));
    }

    @OnOpen
    public void onOpen(Session session) {
        this.session = session;
        System.out.println("Connection to server established");
    }

    @OnMessage
    public void onMessage(String message) {
        System.out.println("Message received: " + message);
    }

    @OnClose
    public void onClose(Session session, @NotNull CloseReason reason) {
        System.out.println("Closed session: " + reason.getReasonPhrase());
    }

    public void disconnect() throws Exception {
        if (session != null && session.isOpen()) {
            session.close();
        }
    }

    public void sendCharacterDTO(CharacterDTO dto) throws Exception {
        if (session != null && session.isOpen()) {
            String json = mapper.writeValueAsString(dto);
            session.getAsyncRemote().sendText(json);
        }
    }
}


