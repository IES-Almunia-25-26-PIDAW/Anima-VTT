package org.example.proyecto.model.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.example.proyecto.model.entities.User;
import org.jetbrains.annotations.Contract;
import org.jetbrains.annotations.NotNull;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class UserDTO {
    private Long id;
    private String username;
    private String role;

    @Contract("_ -> new")
    public static @NotNull UserDTO fromEntity(@NotNull User user) {
        return new UserDTO(
                user.getId(),
                user.getUsername(),
                user.getRole()
        );
    }
}
