package org.example.proyecto.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.*;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@RestController
@RequestMapping("/api/uploads")
@CrossOrigin(origins = "*")
@Slf4j
public class FileUploadController {

    private static final Set<String> ALLOWED_TYPES = Set.of(
            "image/jpeg", "image/png", "image/webp", "image/gif"
    );

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, String>> upload(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "File is empty"));
        }

        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_TYPES.contains(contentType)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Only JPEG, PNG, WebP, and GIF are allowed"));
        }

        try {
            Path dir = Paths.get(uploadDir).toAbsolutePath();
            Files.createDirectories(dir);

            String original = Objects.requireNonNullElse(file.getOriginalFilename(), "image");
            String ext = original.contains(".") ? original.substring(original.lastIndexOf('.')) : ".bin";
            String filename = UUID.randomUUID() + ext;

            Path dest = dir.resolve(filename);
            file.transferTo(dest);

            String url = "/uploads/" + filename;
            log.info("Uploaded file: {}", filename);
            return ResponseEntity.ok(Map.of("url", url));

        } catch (IOException e) {
            log.error("File upload failed", e);
            return ResponseEntity.internalServerError().body(Map.of("error", "Upload failed"));
        }
    }

    @GetMapping
    public ResponseEntity<List<String>> list() {
        try {
            Path dir = Paths.get(uploadDir).toAbsolutePath();
            if (!Files.exists(dir)) {
                return ResponseEntity.ok(List.of());
            }

            try (Stream<Path> files = Files.list(dir)) {
                List<String> urls = files
                        .filter(p -> !Files.isDirectory(p))
                        .map(p -> "/uploads/" + p.getFileName())
                        .sorted()
                        .collect(Collectors.toList());
                return ResponseEntity.ok(urls);
            }

        } catch (IOException e) {
            log.error("Failed to list uploads", e);
            return ResponseEntity.ok(List.of());
        }
    }
}
