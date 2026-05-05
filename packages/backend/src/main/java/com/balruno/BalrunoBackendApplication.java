// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.modulith.Modulithic;

/**
 * Balruno backend entry point. Domain modules (user, workspace, project,
 * sync, document, ai) live as sub-packages of {@code com.balruno}.
 *
 * {@code @Modulithic} enables compile-time module boundary enforcement:
 * any cross-module access to a sibling's {@code internal} package becomes
 * a build failure via the ArchitectureTest in src/test/java.
 */
@Modulithic
@SpringBootApplication
public class BalrunoBackendApplication {
    public static void main(String[] args) {
        SpringApplication.run(BalrunoBackendApplication.class, args);
    }
}
