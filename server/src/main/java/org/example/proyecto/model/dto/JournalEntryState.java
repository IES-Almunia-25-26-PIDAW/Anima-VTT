package org.example.proyecto.model.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class JournalEntryState {
    private Long entryId;
    private Long folderId;
    private String title;
    private String content;
    private String visibility; // "gm" | "all"
}
