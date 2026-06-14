package org.example.proyecto.test;

import org.example.proyecto.service.GameSession;
import org.example.proyecto.service.SessionManager;
import org.example.proyecto.model.dto.TokenState;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
class TokenSaveIntegrationTest {

    @Autowired
    private SessionManager sessionManager;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void saveAllTokenPositions_persists_to_database() {
        // Insert a minimal token row directly (SQLite does not enforce FK by default)
        jdbcTemplate.update(
            "INSERT INTO tokens (scene_id, character_id, x_position, y_position, rotation, is_visible, is_locked) " +
            "VALUES (999, 999, 100.0, 100.0, 0.0, 1, 0)"
        );
        Long tokenId = jdbcTemplate.queryForObject(
            "SELECT id FROM tokens WHERE scene_id = 999 AND character_id = 999",
            Long.class
        );
        assertNotNull(tokenId, "Token should have been inserted");

        // Verify the initial position in DB
        Double initialX = jdbcTemplate.queryForObject(
            "SELECT x_position FROM tokens WHERE id = ?", Double.class, tokenId
        );
        assertEquals(100.0, initialX, 0.001, "Initial x should be 100");

        // Build an in-memory GameSession with the token at new position (999, 888)
        GameSession session = new GameSession(1L);
        TokenState tokenState = new TokenState(
            tokenId, 999L, 999L, "TestToken",
            999.0, 888.0, 45.0,
            true, false, null, null, null, null
        );
        session.addOrUpdateToken(tokenState);

        // Act: save
        sessionManager.saveAllTokenPositions(session);

        // Assert: position in DB must be the new values
        Double savedX = jdbcTemplate.queryForObject(
            "SELECT x_position FROM tokens WHERE id = ?", Double.class, tokenId
        );
        Double savedY = jdbcTemplate.queryForObject(
            "SELECT y_position FROM tokens WHERE id = ?", Double.class, tokenId
        );
        assertEquals(999.0, savedX, 0.001, "x_position should be updated to 999");
        assertEquals(888.0, savedY, 0.001, "y_position should be updated to 888");

        // Cleanup
        jdbcTemplate.update("DELETE FROM tokens WHERE id = ?", tokenId);
    }
}
