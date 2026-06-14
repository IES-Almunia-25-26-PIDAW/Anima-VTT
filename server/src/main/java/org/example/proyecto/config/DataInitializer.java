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

        Scene scene2 = new Scene();
        scene2.setCampaign(campaign);
        scene2.setName("Mazmorra");
        scene2.setBackgroundImagePath(null);
        scene2.setGridSize(64);
        scene2.setWidth(1280);
        scene2.setHeight(960);
        scene2.setIsActive(false);
        sceneRepository.save(scene2);

        // ── Characters ─────────────────────────────────────────────────────────
        // All values verified against animaCalc formulas:
        //   HA/HP/HE = floor(pd/cost)*5 + statMod(stat) + catBonus
        //   RF/RE/RV = Presencia + statMod(CON) + esp
        //   RM        = Presencia + statMod(POD) + esp
        //   RP        = Presencia + statMod(VOL) + esp
        //   Presencia = 25 + level*5
        // Guerrero PD costs: HA=10, HP=10, HE=10, LA=10
        // Ladrón   PD costs: HA=15, HP=15, HE=10, LA=15

        // PC — Kaelindra Voss, Guerrera nivel 5
        // AGI10(+25) CON9(+20) DES11(+30) FUE10(+25) INT8(+15) PER9(+20) POD6(+5) VOL8(+15)
        // Presencia=50 | HA=305 HP=250 HE=125 LA=100 | RF=70 RE=70 RV=70 RM=55 RP=65
        GameCharacter kaelindra = new GameCharacter();
        kaelindra.setCampaign(campaign);
        kaelindra.setName("Kaelindra Voss");
        kaelindra.setType("PC");
        kaelindra.setAttributesJson("{" +
                "\"race\":\"Humano\",\"gender\":\"F\",\"gnosis\":10," +
                "\"category1\":\"Guerrero\",\"level1\":5," +
                "\"baseAGI\":10,\"tmpAGI\":0," +
                "\"baseCON\":9,\"tmpCON\":0," +
                "\"baseDES\":11,\"tmpDES\":0," +
                "\"baseFUE\":10,\"tmpFUE\":0," +
                "\"baseINT\":8,\"tmpINT\":0," +
                "\"basePER\":9,\"tmpPER\":0," +
                "\"basePOD\":6,\"tmpPOD\":0," +
                "\"baseVOL\":8,\"tmpVOL\":0," +
                "\"pdHA\":500,\"costHA\":10,\"catBonusHA\":25," +
                "\"pdHP\":400,\"costHP\":10,\"catBonusHP\":20," +
                "\"pdHE\":180,\"costHE\":10,\"catBonusHE\":10," +
                "\"pdLA\":120,\"costLA\":10,\"catBonusLA\":15," +
                "\"espRF\":0,\"espRE\":0,\"espRV\":0,\"espRM\":0,\"espRP\":0," +
                "\"maxPV\":170,\"currentPV\":170," +
                "\"maxCansancio\":9,\"currentCansancio\":9}");
        kaelindra.setBiography("Mercenaria veterana de las Guerras del Norte. Combate con una espada a dos manos y una determinación inquebrantable. Busca redención por las órdenes que cumplió sin preguntar.");
        characterRepository.save(kaelindra);

        // NPC — Silas Mora, Ladrón nivel 3
        // AGI12(+35) CON7(+10) DES10(+25) FUE6(+5) INT10(+25) PER11(+30) POD5(+0) VOL6(+5)
        // Presencia=40 | HA=55 HP=25 HE=110 LA=5 | RF=50 RE=50 RV=50 RM=40 RP=45
        GameCharacter silas = new GameCharacter();
        silas.setCampaign(campaign);
        silas.setName("Silas Mora");
        silas.setType("NPC");
        silas.setAttributesJson("{" +
                "\"race\":\"Humano\",\"gender\":\"M\",\"gnosis\":10," +
                "\"category1\":\"Ladrón\",\"level1\":3," +
                "\"baseAGI\":12,\"tmpAGI\":0," +
                "\"baseCON\":7,\"tmpCON\":0," +
                "\"baseDES\":10,\"tmpDES\":0," +
                "\"baseFUE\":6,\"tmpFUE\":0," +
                "\"baseINT\":10,\"tmpINT\":0," +
                "\"basePER\":11,\"tmpPER\":0," +
                "\"basePOD\":5,\"tmpPOD\":0," +
                "\"baseVOL\":6,\"tmpVOL\":0," +
                "\"pdHA\":80,\"costHA\":15,\"catBonusHA\":5," +
                "\"pdHP\":0,\"costHP\":15,\"catBonusHP\":0," +
                "\"pdHE\":120,\"costHE\":10,\"catBonusHE\":15," +
                "\"pdLA\":0,\"costLA\":15,\"catBonusLA\":0," +
                "\"espRF\":0,\"espRE\":0,\"espRV\":0,\"espRM\":0,\"espRP\":0," +
                "\"maxPV\":75,\"currentPV\":50," +
                "\"maxCansancio\":7,\"currentCansancio\":7}");
        silas.setBiography("Informante y ratero al servicio de la red criminal de la ciudad. Nervioso pero perspicaz. Lleva una daga escondida y sabe más de lo que aparenta. Actualmente herido tras un encuentro que salió mal.");
        characterRepository.save(silas);

        // Monster — Karrath, Ladrón nivel 4 (Goblin explorador de élite)
        // AGI13(+40) CON6(+5) DES11(+30) FUE5(+0) INT7(+10) PER12(+35) POD5(+0) VOL5(+0)
        // Presencia=45 | HA=70 HP=30 HE=140 LA=0 | RF=50 RE=50 RV=50 RM=45 RP=45
        GameCharacter karrath = new GameCharacter();
        karrath.setCampaign(campaign);
        karrath.setName("Karrath");
        karrath.setType("Monster");
        karrath.setAttributesJson("{" +
                "\"race\":\"Goblin\",\"gender\":\"M\",\"gnosis\":10," +
                "\"category1\":\"Ladrón\",\"level1\":4," +
                "\"baseAGI\":13,\"tmpAGI\":0," +
                "\"baseCON\":6,\"tmpCON\":0," +
                "\"baseDES\":11,\"tmpDES\":0," +
                "\"baseFUE\":5,\"tmpFUE\":0," +
                "\"baseINT\":7,\"tmpINT\":0," +
                "\"basePER\":12,\"tmpPER\":0," +
                "\"basePOD\":5,\"tmpPOD\":0," +
                "\"baseVOL\":5,\"tmpVOL\":0," +
                "\"pdHA\":100,\"costHA\":15,\"catBonusHA\":10," +
                "\"pdHP\":0,\"costHP\":15,\"catBonusHP\":0," +
                "\"pdHE\":160,\"costHE\":10,\"catBonusHE\":20," +
                "\"pdLA\":0,\"costLA\":15,\"catBonusLA\":0," +
                "\"espRF\":0,\"espRE\":0,\"espRV\":0,\"espRM\":0,\"espRP\":0," +
                "\"maxPV\":55,\"currentPV\":55," +
                "\"maxCansancio\":6,\"currentCansancio\":6}");
        karrath.setBiography("Explorador goblin de élite, líder de la avanzadilla enemiga. Extremadamente ágil y escurridizo. Prefiere emboscar a atacar de frente.");
        characterRepository.save(karrath);

        // ── Tokens ─────────────────────────────────────────────────────────────
        // Positions are cell centres: col*64+32, row*64+32
        tokenRepository.save(makeToken(scene, kaelindra, 224.0, 352.0)); // col 3, row 5
        tokenRepository.save(makeToken(scene, silas,     608.0, 224.0)); // col 9, row 3
        tokenRepository.save(makeToken(scene, karrath,   928.0, 672.0)); // col 14, row 10

        log.info("Seed complete — campaign '{}', scene '{}', 3 Anima characters: Kaelindra (PC Guerrera 5), Silas (NPC Ladrón 3), Karrath (Monster Ladrón 4).",
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
