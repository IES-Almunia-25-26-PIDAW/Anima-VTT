package org.example.proyecto.model.repositories;

import org.example.proyecto.model.entities.UserPermission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface UserPermissionRepository extends JpaRepository<UserPermission, Long> {
    List<UserPermission> findByUserId(Long userId);
    List<UserPermission> findByUserIdAndCharacterId(Long userId, Long characterId);
}
