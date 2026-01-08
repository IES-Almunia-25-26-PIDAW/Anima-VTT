package org.example.proyecto.model;

import org.jetbrains.annotations.Contract;
import org.jetbrains.annotations.NotNull;

public class Character {
    private String name;
    private String category;
    private int level;

    public Character(String name, String category, int level) {
        setName(name);
        setCategory(category);
        setLevel(level);
    }

    @Contract("_ -> new")
    public static @NotNull Character fromDTO(@NotNull CharacterDTO dto) {
        return new Character(dto.getName(), dto.getCategory(), dto.getLevel());
    }

    public String getName() {
        return name;
    }
    public void setName(String name) {
        this.name = name;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public int getLevel() {
        return level;
    }

    public void setLevel(int level) {
        this.level = level;
    }
}
