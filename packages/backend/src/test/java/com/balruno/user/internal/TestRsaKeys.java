// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user.internal;

/**
 * Disposable RSA 2048-bit key pair used only by JWT-related unit tests.
 * Same PEMs that the test-classpath {@code application.yml} ships; kept
 * as Java constants so isolated unit tests don't need Spring context.
 */
final class TestRsaKeys {

    private TestRsaKeys() {}

    static final String PRIVATE_KEY_PEM = """
            -----BEGIN PRIVATE KEY-----
            MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQDiKy+fb95PSYOL
            f3shBcVCFbABkNDW7uI+rkTv/meY/4i55UXMRE589M7LH264W3ho7TPr+Yb7YprC
            SLNhM9BZ3JMikQZfSFK9LkmJWewZsmXsWU9vj7sUBgwQnuTh50Inro5jgK7OgA6i
            7itzVTF3r+ci9WEfK5IuSY9hwHWi4kQQpJIjJjfStjyWosXyeVkT6pu0NaOkq5Zx
            1ssh+KaFIxmrLsnYLeq/vqx9bgoHfANYfrvAJx6fTyi35KMgJhzP0fDSxyO5PJqz
            k8InTKrtvyBBm4mbpSrUZTL/5qQYBBw5/HeBhhTb2BGtjoC+03PgmO2t2TVjJbFU
            LsMvh2oHAgMBAAECggEAGad6u5PlvHT4b2KH9cXLoMSIq5Ig0OiAOvTrNpUobNHm
            JpP2TVvIKA4Kxj6WrAxwGughFhi+nMA2vBKhX5q60klIr/M8V6LYA8PULTjJJQcN
            NE3TIAfxLq3Flj23ylTANnPAjKfZluyD/IDrO9CuOkchKYrPjUi/cvGpdRXuzLQK
            xr+wYh+dOaOZW+HbaKQ5AOrvUt5O+DLizaASy3t3BL7Yf45hyQILIa0m9fkYD4LV
            ie9X8YWweLAIxsZ0M8OyI/8SBfdXgN93+FEFdMnPpJZSdZnJGVdGyKjooFjaxU/q
            7UT7diEdzTu165RMTOyqgc3W8ZYrFFr78GTww9r7FQKBgQDxndrpUUi26u5Uodzc
            9bhBe5Wnfrtfl5sqsdkhE0ASGV9IbJGgsp6BBN2BxPqhUxU4P+SJvEuhebghQHjp
            ChEsIcQMibmOyHoYnbACdSYk2ZR52p5T+uC6fnYon0//lO/olp2A8dMqiHBMaf1T
            GiTrKyqe4oBtKz8ViXK3cilfRQKBgQDvoekRO+LFmsG8dPmi2yrz4+9bJfcAtAU5
            F7B29lv49uVJoPWDwqgpq1mhB99Z4Dn3R/r8Mz56iKpZghDAH1lRgTogJbgtwO7t
            Df+DUpnlc0EnMDs5UeSyRgXczWqNo9hY8zpjf9f42hsXSfnzo0JwLFvuyrYrf/VW
            Z7/G3Gji2wKBgQC8+zcKXyV8zOx1DdVujlL8BOndBGcSMcaP8mNeV2w5u9anEyQk
            iREo4OFQav2NySpDwNXEVZ7iQg4fFAp+W/1qg06Qb/jPEUdOkaflhDO9huF3HePQ
            092KgPdydolf4uJzDbtL69m63tTXL9+QbFaMCktf0tGYkcbZ1ZQAoC5z8QKBgQCk
            GezRsIELcX9a34BU1mIDwwQXF1ifUqiBAIgH743sYKeEVIXNRXCDmKQ4cnuxwKvx
            e4mVTEJtB0ohIcD20IEKH8T+XtZR/t2f2QYxmE9rohHsFEt6ZWqH6wv4uXNOq/Vs
            dKR3nwT3leUXfcF95z+IMdiDHq7B+063bTUXqbjqIQKBgQCSg/JHxBPc2tXrOU1m
            QQqTPItlKVWGrk6Qzn8TgmsGACt8wXk+T5rSgtQDYoDJu+NsTHSgtR2h/w7DEfzi
            1Pma8ZAHURFAn9eKVYyntdph5WPhXbkXZKvhUDewl0MBoBfu55yGlnINcX16RfpC
            PRKNcwhqkgCFqMrbc17x/cCI3w==
            -----END PRIVATE KEY-----
            """;

    static final String PUBLIC_KEY_PEM = """
            -----BEGIN PUBLIC KEY-----
            MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA4isvn2/eT0mDi397IQXF
            QhWwAZDQ1u7iPq5E7/5nmP+IueVFzEROfPTOyx9uuFt4aO0z6/mG+2KawkizYTPQ
            WdyTIpEGX0hSvS5JiVnsGbJl7FlPb4+7FAYMEJ7k4edCJ66OY4CuzoAOou4rc1Ux
            d6/nIvVhHyuSLkmPYcB1ouJEEKSSIyY30rY8lqLF8nlZE+qbtDWjpKuWcdbLIfim
            hSMZqy7J2C3qv76sfW4KB3wDWH67wCcen08ot+SjICYcz9Hw0scjuTyas5PCJ0yq
            7b8gQZuJm6Uq1GUy/+akGAQcOfx3gYYU29gRrY6AvtNz4Jjtrdk1YyWxVC7DL4dq
            BwIDAQAB
            -----END PUBLIC KEY-----
            """;
}
