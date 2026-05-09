// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.web.internal;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

/**
 * Smoke-test endpoint. nginx on prod_app proxies / to here; until B-3 lands
 * the real routing this just confirms "Cloudflare → nginx → Spring" works.
 */
@RestController
class RootController {

    @GetMapping("/")
    public Map<String, Object> root() {
        return Map.of(
            "service", "balruno-backend",
            "version", "0.0.1-SNAPSHOT",
            "phase", "B-1",
            "now", Instant.now().toString()
        );
    }
}
