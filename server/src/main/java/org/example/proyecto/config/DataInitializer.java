package org.example.proyecto.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.example.proyecto.model.entities.*;
import org.example.proyecto.model.repositories.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final CampaignRepository campaignRepository;
    private final SceneRepository sceneRepository;
    private final GameCharacterRepository characterRepository;
    private final TokenRepository tokenRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public void run(String... args) {
        if (campaignRepository.count() > 0) {
            log.info("Database already seeded, skipping.");
            return;
        }

        log.info("Seeding database...");

        // ── Users ──────────────────────────────────────────────────────────────
        User gm = new User();
        gm.setUsername("gm");
        gm.setPasswordHash(passwordEncoder.encode("gm123"));
        gm.setRole("gm");
        userRepository.save(gm);

        User player = new User();
        player.setUsername("player1");
        player.setPasswordHash(passwordEncoder.encode("player123"));
        player.setRole("player");
        userRepository.save(player);

        // ── Campaign ───────────────────────────────────────────────────────────
        Campaign campaign = new Campaign();
        campaign.setName("La Maldición de Strahd");
        campaign.setDescription("Una campaña de terror gótico en las brumas de Barovia.");
        campaignRepository.save(campaign);

        // ── Scene ──────────────────────────────────────────────────────────────
        Scene scene = new Scene();
        scene.setCampaign(campaign);
        scene.setName("Taberna del Pueblo");
        scene.setBackgroundImagePath(null);
        scene.setGridSize(64);
        scene.setWidth(1600);
        scene.setHeight(1200);
        scene.setIsActive(true);
        sceneRepository.save(scene);

        // ── Characters ─────────────────────────────────────────────────────────
        GameCharacter aragorn = new GameCharacter();
        aragorn.setCampaign(campaign);
        aragorn.setName("Aragorn");
        aragorn.setType("PC");
        aragorn.setAttributesJson("{\"hp\":45,\"maxHp\":45,\"ac\":16,\"str\":18,\"dex\":14,\"con\":16,\"int\":12,\"wis\":14,\"cha\":16}");
        aragorn.setBiography("Un ranger misterioso que viaja de incógnito.");
        characterRepository.save(aragorn);

        GameCharacter innkeeper = new GameCharacter();
        innkeeper.setCampaign(campaign);
        innkeeper.setName("Tobias el Posadero");
        innkeeper.setType("NPC");
        innkeeper.setAttributesJson("{\"hp\":12,\"maxHp\":12,\"ac\":10,\"str\":10,\"dex\":10,\"con\":12,\"int\":11,\"wis\":12,\"cha\":13}");
        innkeeper.setBiography("El nervioso dueño de la taberna. Sabe más de lo que dice.");
        characterRepository.save(innkeeper);

        GameCharacter goblin = new GameCharacter();
        goblin.setCampaign(campaign);
        goblin.setName("Explorador Goblin");
        goblin.setType("Monster");
        goblin.setAttributesJson("{\"hp\":7,\"maxHp\":7,\"ac\":15,\"str\":8,\"dex\":14,\"con\":10,\"int\":8,\"wis\":8,\"cha\":8}");
        characterRepository.save(goblin);

        // ── Tokens ─────────────────────────────────────────────────────────────
        tokenRepository.save(makeToken(scene, aragorn,  192.0, 384.0));
        tokenRepository.save(makeToken(scene, innkeeper, 640.0, 256.0));
        tokenRepository.save(makeToken(scene, goblin,   960.0, 704.0));

        log.info("Seed complete — campaign '{}', scene '{}', 3 characters, 3 tokens.",
                campaign.getName(), scene.getName());
        log.info("Login credentials:  gm / gm123  |  player1 / player123");
    }

    private Token makeToken(Scene scene, GameCharacter character, double x, double y) {
        Token t = new Token();
        t.setScene(scene);
        t.setCharacter(character);
        t.setXPosition(x);
        t.setYPosition(y);
        t.setRotation(0.0);
        t.setIsVisible(true);
        t.setIsLocked(false);
        return t;
    }
}
