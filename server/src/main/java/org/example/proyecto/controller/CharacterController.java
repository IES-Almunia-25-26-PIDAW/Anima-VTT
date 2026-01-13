package org.example.proyecto.controller;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/characters")
public class CharacterController {

/*    @PostMapping("/import")
    public ResponseEntity<?> importCharacter(@RequestBody CharacterDTO dto) {
        try {
            Character ch=Character.fromDTO(dto);
            return ResponseEntity.ok(ch);
        } catch (Exception e) {
            return ResponseEntity.status(400).body("Error when importing character: " + e.getMessage());
        }
    }*/
}