// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno;

import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;
import org.springframework.modulith.docs.Documenter;

/**
 * Architecture verification (ADR 0014).
 *
 * Runs as part of `gradle test` in CI. Two responsibilities:
 *   1. Verify module structure — any package-level access from one
 *      module to another module's `internal` package is a build break.
 *   2. Generate PlantUML / AsciiDoc into target/spring-modulith-docs/
 *      so the architecture diagrams stay in sync with the actual code.
 *
 * As long as B-1 has zero @ApplicationModule classes, both are no-ops;
 * they start enforcing real boundaries from B-2 onward.
 */
class ArchitectureTest {

    private final ApplicationModules modules =
        ApplicationModules.of(BalrunoBackendApplication.class);

    @Test
    void verifiesModuleStructure() {
        modules.verify();
    }

    @Test
    void writesDocumentation() {
        new Documenter(modules)
            .writeDocumentation()
            .writeIndividualModulesAsPlantUml();
    }
}
