package org.example.proyecto.model.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
public class CombatState {
    private boolean active;
    private int currentRound;
    private Long currentTurnTokenId;
    private java.util.List<Long> turnOrder;

    public CombatState() {
        this.active = false;
        this.currentRound = 0;
        this.turnOrder = new java.util.ArrayList<>();
    }

    public void nextTurn() {
        if (turnOrder.isEmpty()) return;

        int currentIndex = turnOrder.indexOf(currentTurnTokenId);
        int nextIndex = (currentIndex + 1) % turnOrder.size();

        if (nextIndex == 0) {
            currentRound++;
        }

        currentTurnTokenId = turnOrder.get(nextIndex);
    }
}
