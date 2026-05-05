// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

@SpringBootTest
@Import(TestcontainersConfig.class)
class BalrunoBackendApplicationTests {

    @Test
    void contextLoads() {
        // Spring context boots, Flyway runs every V*__*.sql migration, and
        // JPA validates entity mappings against the resulting schema.
    }
}
