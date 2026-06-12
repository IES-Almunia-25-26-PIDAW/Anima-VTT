package org.example.proyecto.controller;

import lombok.RequiredArgsConstructor;
import org.example.proyecto.model.dto.CampaignDTO;
import org.example.proyecto.model.repositories.CampaignRepository;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/campaigns")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class CampaignController {

    private final CampaignRepository campaignRepository;

    @GetMapping
    public List<CampaignDTO> getAll() {
        return campaignRepository.findAll()
                .stream()
                .map(CampaignDTO::fromEntity)
                .toList();
    }
}
