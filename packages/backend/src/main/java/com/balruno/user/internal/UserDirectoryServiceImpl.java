// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.user.internal;

import com.balruno.user.UserBrief;
import com.balruno.user.UserDirectoryService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
class UserDirectoryServiceImpl implements UserDirectoryService {

    private final UserRepository users;

    UserDirectoryServiceImpl(UserRepository users) {
        this.users = users;
    }

    @Override
    public Map<UUID, UserBrief> findBriefsByIds(Collection<UUID> ids) {
        if (ids == null || ids.isEmpty()) return Map.of();
        return users.findAllById(ids).stream()
                .collect(Collectors.toUnmodifiableMap(
                        UserEntity::getId,
                        e -> new UserBrief(e.getId(), e.getEmail(), e.getName(), e.getAvatarUrl())));
    }
}
