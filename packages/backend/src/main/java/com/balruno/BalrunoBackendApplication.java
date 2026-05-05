// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.modulith.Modulithic;

/**
 * Balruno backend entry point.
 *
 * Phase B-1 boots the bare app — actuator + a single root controller.
 * Domain modules (user, workspace, project, sync, document, ai) land in
 * B-2 onward per ADR 0014 (Spring Modulith).
 *
 * @Modulithic enables compile-time module boundary enforcement: any
 * cross-module access to internal packages becomes a build failure via
 * the ArchitectureTest in src/test/java.
 */
@Modulithic
@SpringBootApplication
public class BalrunoBackendApplication {
    public static void main(String[] args) {
        SpringApplication.run(BalrunoBackendApplication.class, args);
    }
}
