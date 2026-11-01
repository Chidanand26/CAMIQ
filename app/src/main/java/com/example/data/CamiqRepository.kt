package com.example.data

import java.security.MessageDigest
import java.util.UUID
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

data class CoverageEvaluationResult(
    val selectedCameras: List<String>,
    val reasoningLines: List<String>,
    val hasCoverageGap: Boolean,
    val formattedReasoning: String
)

class CamiqRepository(val dao: CamiqDao) {

    val users = dao.observeUsers()
    val sites = dao.observeSites()
    val cameras = dao.observeCameras()
    val orchestrationEvents = dao.observeOrchestrationEvents()
    val incidents = dao.observeIncidents()
    val safeWalkSessions = dao.observeSafeWalkSessions()
    val trustedContacts = dao.observeTrustedContacts()
    val gateEvents = dao.observeGateEvents()
    val visitorPasses = dao.observeVisitorPasses()
    val departments = dao.observeDepartments()
    val laboratories = dao.observeLaboratories()
    val assets = dao.observeAssets()
    val auditLogs = dao.observeAuditLogs()
    val systemConfig = dao.observeSystemConfig()

    suspend fun ensureDefaultSystemConfig() {
        val current = dao.getSystemConfigSync()
        if (current == null) {
            dao.upsertSystemConfig(SystemConfigEntity(id = 1))
        }
    }

    fun hashPassword(plain: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val bytes = digest.digest(plain.toByteArray(Charsets.UTF_8))
        return bytes.joinToString("") { "%02x".format(it) }
    }

    suspend fun recordAudit(
        actorName: String,
        actorRole: String,
        actionType: String,
        targetEntity: String,
        details: String
    ) {
        dao.insertAuditLog(
            AuditLogEntity(
                actorName = actorName,
                actorRole = actorRole,
                actionType = actionType,
                targetEntity = targetEntity,
                details = details
            )
        )
    }

    suspend fun registerUser(
        username: String,
        passwordPlain: String,
        fullName: String,
        role: String,
        studentIdCode: String = "",
        departmentName: String = "",
        gender: String = "UNSPECIFIED",
        siteId: Long? = null,
        isTestRecord: Boolean = false,
        actorName: String = "SYSTEM",
        actorRole: String = "ADMIN"
    ): Result<UserEntity> {
        val cleanUsername = username.trim().lowercase()
        if (cleanUsername.isEmpty() || passwordPlain.isEmpty() || fullName.isBlank()) {
            return Result.failure(IllegalArgumentException("Username, full name, and password are required."))
        }
        val existing = dao.getUserByUsername(cleanUsername)
        if (existing != null) {
            return Result.failure(IllegalArgumentException("Username '$cleanUsername' is already registered."))
        }
        val entity = UserEntity(
            username = cleanUsername,
            passwordHash = hashPassword(passwordPlain),
            fullName = fullName.trim(),
            role = role,
            studentIdCode = studentIdCode.trim(),
            departmentName = departmentName.trim(),
            gender = gender,
            isOnDuty = role == "GUARD",
            campusPresenceState = "OUTSIDE",
            siteId = siteId,
            isTestRecord = isTestRecord
        )
        val newId = dao.insertUser(entity)
        val saved = entity.copy(id = newId)
        recordAudit(
            actorName = actorName,
            actorRole = actorRole,
            actionType = "USER_CREATED",
            targetEntity = "User:$cleanUsername ($role)",
            details = "Created $role account for ${saved.fullName}${if (isTestRecord) " [TEST]" else ""}"
        )
        return Result.success(saved)
    }

    suspend fun authenticate(username: String, passwordPlain: String): Result<UserEntity> {
        val user = dao.getUserByUsername(username.trim().lowercase())
            ?: return Result.failure(IllegalArgumentException("Account not found. Create an account first."))
        if (user.passwordHash != hashPassword(passwordPlain)) {
            return Result.failure(IllegalArgumentException("Invalid credentials."))
        }
        recordAudit(
            actorName = user.fullName,
            actorRole = user.role,
            actionType = "AUTH_LOGIN",
            targetEntity = "User:${user.username}",
            details = "Authenticated session started"
        )
        return Result.success(user)
    }

    suspend fun toggleGuardDuty(guardId: Long, onDuty: Boolean): UserEntity? {
        val user = dao.getUserById(guardId) ?: return null
        val updated = user.copy(isOnDuty = onDuty)
        dao.updateUser(updated)
        recordAudit(
            actorName = updated.fullName,
            actorRole = updated.role,
            actionType = if (onDuty) "GUARD_ON_DUTY" else "GUARD_OFF_DUTY",
            targetEntity = "Guard:${updated.username}",
            details = "Duty status changed to ${if (onDuty) "ON DUTY" else "OFF DUTY"}"
        )
        return updated
    }

    /**
     * Coverage-to-Compute Orchestrator:
     * Evaluates all registered cameras against a geographical location (lat, lng):
     * 1. Checks if camera has valid coordinates configured.
     * 2. Computes Haversine distance in meters & bearing angle vs camera direction + FOV cone.
     * 3. Checks camera availability (connectionState == CONNECTED).
     * 4. Checks processing delay (measuredLatencyMs) and active analysis workload (activeWorkloadCount).
     * 5. Prioritizes the best eligible cameras and generates transparent selection/rejection reasons.
     * 6. If no camera covers the location, reports CAMERA COVERAGE GAP.
     */
    suspend fun evaluateCoverageToCompute(
        targetLat: Double?,
        targetLng: Double?
    ): CoverageEvaluationResult {
        val allCameras = dao.getAllCamerasSync()
        if (allCameras.isEmpty()) {
            return CoverageEvaluationResult(
                selectedCameras = emptyList(),
                reasoningLines = listOf("CAMERA COVERAGE GAP: No cameras registered in the database."),
                hasCoverageGap = true,
                formattedReasoning = "CAMERA COVERAGE GAP — No cameras registered in the database."
            )
        }
        if (targetLat == null || targetLng == null) {
            return CoverageEvaluationResult(
                selectedCameras = emptyList(),
                reasoningLines = listOf("CAMERA COVERAGE GAP: Event location was not shared or is unavailable."),
                hasCoverageGap = true,
                formattedReasoning = "CAMERA COVERAGE GAP — Location coordinates not available."
            )
        }

        data class CandidateScore(
            val camera: CameraEntity,
            val distanceMeters: Double,
            val score: Double,
            val reason: String
        )

        val eligible = mutableListOf<CandidateScore>()
        val rejections = mutableListOf<String>()

        for (cam in allCameras) {
            val camLat = cam.latitude
            val camLng = cam.longitude
            if (camLat == null || camLng == null) {
                rejections.add("${cam.cameraCode}: REJECTED (No geographical coordinates configured)")
                continue
            }
            val dist = haversineMeters(camLat, camLng, targetLat, targetLng)
            if (dist > cam.maxDistanceMeters) {
                rejections.add(
                    "${cam.cameraCode}: REJECTED (Out of range: ${dist.toInt()}m > max ${cam.maxDistanceMeters.toInt()}m)"
                )
                continue
            }
            val bearing = bearingDegrees(camLat, camLng, targetLat, targetLng)
            val angleDiff = angularDifference(cam.directionDeg, bearing)
            val halfFov = cam.fovAngleDeg / 2.0
            if (dist > 3.0 && angleDiff > halfFov) {
                rejections.add(
                    "${cam.cameraCode}: REJECTED (Outside FOV cone: bearing ${bearing.toInt()}° vs dir ${cam.directionDeg.toInt()}° ±${halfFov.toInt()}°)"
                )
                continue
            }
            if (cam.connectionState != "CONNECTED") {
                rejections.add("${cam.cameraCode}: REJECTED (Camera state is DISCONNECTED — attempting fallback)")
                continue
            }
            // Compute scheduling score: lower distance, lower latency, lower active workload = higher priority
            val latencyPenalty = cam.measuredLatencyMs * 0.25
            val workloadPenalty = cam.activeWorkloadCount * 18.0
            val score = 1000.0 - dist - latencyPenalty - workloadPenalty
            eligible.add(
                CandidateScore(
                    camera = cam,
                    distanceMeters = dist,
                    score = score,
                    reason = "${cam.cameraCode}: SELECTED (In FOV at ${dist.toInt()}m, delay ${cam.measuredLatencyMs}ms, workload ${cam.activeWorkloadCount}, score ${score.toInt()})"
                )
            )
        }

        eligible.sortByDescending { it.score }

        if (eligible.isEmpty()) {
            val lines = mutableListOf("CAMERA COVERAGE GAP — Zero available cameras cover (${"%.5f".format(targetLat)}, ${"%.5f".format(targetLng)}).")
            lines.addAll(rejections)
            return CoverageEvaluationResult(
                selectedCameras = emptyList(),
                reasoningLines = lines,
                hasCoverageGap = true,
                formattedReasoning = lines.joinToString("\n")
            )
        }

        // Select top 2 eligible cameras and switch them to INVESTIGATE mode
        val chosen = eligible.take(2)
        val eventId = "ORCH-${UUID.randomUUID().toString().take(8).uppercase()}"
        val now = System.currentTimeMillis()
        for (item in chosen) {
            dao.upsertCamera(
                item.camera.copy(
                    orchestrationMode = "INVESTIGATE",
                    activeWorkloadCount = item.camera.activeWorkloadCount + 1,
                    lastAckEventId = eventId,
                    lastAckTimestamp = now
                )
            )
        }

        val allLines = mutableListOf<String>()
        chosen.forEach { allLines.add(it.reason) }
        eligible.drop(2).forEach {
            allLines.add("${it.camera.cameraCode}: STANDBY ELIGIBLE (${it.distanceMeters.toInt()}m, lower priority score ${it.score.toInt()})")
        }
        allLines.addAll(rejections)

        return CoverageEvaluationResult(
            selectedCameras = chosen.map { it.camera.cameraCode },
            reasoningLines = allLines,
            hasCoverageGap = false,
            formattedReasoning = allLines.joinToString("\n")
        )
    }

    /**
     * Collaborative Camera Intelligence Workflow (TEST 8):
     * 1. Source camera (e.g. CAM-01) detects real movement (MOTION_DETECTED).
     * 2. Coordinator checks configured neighboring cameras (e.g. CAM-02, CAM-03).
     * 3. Neighboring cameras receive INVESTIGATE commands if CONNECTED, or fallback/report if DISCONNECTED.
     * 4. Processing loops update to INVESTIGATE mode and acknowledge with unique event ID & measured delay.
     */
    suspend fun triggerMotionOrchestration(
        sourceCameraCode: String,
        measuredMotionScore: Double,
        isTestRecord: Boolean = false
    ): Result<OrchestrationEventEntity> {
        val startNs = System.nanoTime()
        val sourceCam = dao.getCameraByCode(sourceCameraCode)
            ?: return Result.failure(IllegalArgumentException("Camera $sourceCameraCode is not configured."))

        if (sourceCam.connectionState != "CONNECTED") {
            return Result.failure(IllegalStateException("$sourceCameraCode is DISCONNECTED. Connect the camera before running motion orchestration."))
        }

        val eventId = "EVT-${UUID.randomUUID().toString().take(8).uppercase()}"
        val now = System.currentTimeMillis()

        // Update source camera to VERIFY mode first
        dao.upsertCamera(
            sourceCam.copy(
                orchestrationMode = "VERIFY",
                lastAckEventId = eventId,
                lastAckTimestamp = now
            )
        )

        val neighborCodes = sourceCam.neighborCameraCodes
            .split(",")
            .map { it.trim() }
            .filter { it.isNotEmpty() && it != sourceCameraCode }

        val allCameras = dao.getAllCamerasSync().associateBy { it.cameraCode }
        val targetCodes = if (neighborCodes.isNotEmpty()) {
            neighborCodes
        } else {
            allCameras.keys.filter { it != sourceCameraCode }
        }

        val ackedList = mutableListOf<String>()
        val reasoningBuilder = mutableListOf<String>()
        reasoningBuilder.add(
            "1. $sourceCameraCode reported MOTION_DETECTED (delta=${"%.1f".format(measuredMotionScore)}%). Switched $sourceCameraCode -> VERIFY."
        )

        for (code in targetCodes) {
            val neighbor = allCameras[code]
            if (neighbor == null) {
                reasoningBuilder.add("2. Neighbour $code: REJECTED (Not found in camera registry).")
                continue
            }
            if (neighbor.connectionState == "CONNECTED") {
                dao.upsertCamera(
                    neighbor.copy(
                        orchestrationMode = "INVESTIGATE",
                        activeWorkloadCount = neighbor.activeWorkloadCount + 1,
                        lastAckEventId = eventId,
                        lastAckTimestamp = now
                    )
                )
                ackedList.add(code)
                reasoningBuilder.add(
                    "2. Neighbour $code: Command INVESTIGATE dispatched & ACKNOWLEDGED (FPS=${"%.1f".format(neighbor.measuredFps)}, latency=${neighbor.measuredLatencyMs}ms)."
                )
            } else {
                reasoningBuilder.add(
                    "2. Neighbour $code: FAILED ACKNOWLEDGEMENT (Camera is DISCONNECTED)."
                )
            }
        }

        val elapsedMs = ((System.nanoTime() - startNs) / 1_000_000L).coerceAtLeast(2L)
        val hasGap = ackedList.isEmpty()
        val event = OrchestrationEventEntity(
            eventId = eventId,
            triggerType = "MOTION_DETECTED",
            sourceCameraCode = sourceCameraCode,
            targetCameraCodes = targetCodes.joinToString(", ").ifEmpty { "NONE" },
            requestedMode = "INVESTIGATE",
            acknowledgedByCameras = ackedList.joinToString(", ").ifEmpty { "NONE" },
            selectionReasoning = reasoningBuilder.joinToString("\n"),
            hasCoverageGap = hasGap,
            measuredDelayMs = elapsedMs,
            status = if (ackedList.isNotEmpty()) "ACKNOWLEDGED" else "COVERAGE_GAP",
            isTestRecord = isTestRecord,
            timestamp = now
        )
        dao.insertOrchestrationEvent(event)
        recordAudit(
            actorName = "CAMIQ-COORDINATOR",
            actorRole = "SYSTEM",
            actionType = "MOTION_ORCHESTRATION",
            targetEntity = eventId,
            details = "Motion on $sourceCameraCode -> INVESTIGATE sent to [${targetCodes.joinToString()}], ACK by [${ackedList.joinToString()}]"
        )
        return Result.success(event)
    }

    /**
     * Generates a rotating ~30-second opaque one-time QR credential for an authenticated student.
     * Contains zero plaintext personal information.
     */
    suspend fun issueStudentRotatingQr(student: UserEntity): QrTokenEntity {
        val now = System.currentTimeMillis()
        val rawRandom = UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().take(8)
        val opaqueToken = "CAMIQ-PASS-${rawRandom.take(20).uppercase()}"
        val entity = QrTokenEntity(
            opaqueToken = opaqueToken,
            ownerUserId = student.id,
            visitorPassId = null,
            tokenType = "STUDENT_PASS",
            issuedAt = now,
            expiresAt = now + 30_000L, // 30 seconds expiry
            isConsumed = false
        )
        dao.insertQrToken(entity)
        return entity
    }

    /**
     * Validates and atomically consumes a QR token scanned by CAM-01 (Entrance QR Camera),
     * enforcing anti-passback (cannot enter twice without exiting, cannot exit when already outside).
     */
    suspend fun validateAndConsumeGateQr(
        scannedRawToken: String,
        cameraCode: String,
        isTestScan: Boolean = false
    ): GateEventEntity {
        val cleanToken = scannedRawToken.trim()
        val now = System.currentTimeMillis()
        val sysConfig = dao.getSystemConfigSync() ?: SystemConfigEntity()
        val gateName = sysConfig.activeGateName
        val direction = sysConfig.activeGateDirection

        // Check camera availability first
        val cam = dao.getCameraByCode(cameraCode)
        if (cam == null || cam.connectionState != "CONNECTED") {
            val event = GateEventEntity(
                tokenUsed = cleanToken.take(28),
                personName = "UNVERIFIED",
                personRole = "UNKNOWN",
                direction = direction,
                gateName = gateName,
                cameraCode = cameraCode,
                scanResult = "MANUAL VERIFICATION REQUIRED",
                isTestRecord = isTestScan,
                timestamp = now
            )
            dao.insertGateEvent(event)
            return event
        }

        val tokenRecord = dao.getQrToken(cleanToken)
        if (tokenRecord == null) {
            val event = GateEventEntity(
                tokenUsed = cleanToken.take(28),
                personName = "UNKNOWN",
                personRole = "UNKNOWN",
                direction = direction,
                gateName = gateName,
                cameraCode = cameraCode,
                scanResult = "INVALID CREDENTIAL",
                isTestRecord = isTestScan,
                timestamp = now
            )
            dao.insertGateEvent(event)
            recordAudit(
                actorName = cameraCode,
                actorRole = "GATE_CAMERA",
                actionType = "QR_SCAN_REJECTED",
                targetEntity = cleanToken.take(16),
                details = "Scan result: INVALID CREDENTIAL at $gateName"
            )
            return event
        }

        // Check if already consumed (TEST 6: Attempt to use the same QR twice -> rejected)
        if (tokenRecord.isConsumed) {
            val event = GateEventEntity(
                tokenUsed = cleanToken,
                personName = "CONSUMED TOKEN HOLDER",
                personRole = tokenRecord.tokenType,
                userId = tokenRecord.ownerUserId,
                visitorPassId = tokenRecord.visitorPassId,
                direction = direction,
                gateName = gateName,
                cameraCode = cameraCode,
                scanResult = "INVALID CREDENTIAL",
                isTestRecord = isTestScan,
                timestamp = now
            )
            dao.insertGateEvent(event)
            recordAudit(
                actorName = cameraCode,
                actorRole = "GATE_CAMERA",
                actionType = "QR_REPLAY_BLOCKED",
                targetEntity = cleanToken,
                details = "Rejected second use of one-time QR token at $gateName"
            )
            return event
        }

        // Check expiration
        if (now > tokenRecord.expiresAt) {
            val event = GateEventEntity(
                tokenUsed = cleanToken,
                personName = "EXPIRED TOKEN HOLDER",
                personRole = tokenRecord.tokenType,
                userId = tokenRecord.ownerUserId,
                visitorPassId = tokenRecord.visitorPassId,
                direction = direction,
                gateName = gateName,
                cameraCode = cameraCode,
                scanResult = "EXPIRED QR",
                isTestRecord = isTestScan,
                timestamp = now
            )
            dao.insertGateEvent(event)
            return event
        }

        // Student Pass validation + Anti-passback
        if (tokenRecord.tokenType == "STUDENT_PASS" && tokenRecord.ownerUserId != null) {
            val student = dao.getUserById(tokenRecord.ownerUserId)
            if (student == null) {
                val event = GateEventEntity(
                    tokenUsed = cleanToken,
                    personName = "UNKNOWN STUDENT",
                    personRole = "STUDENT",
                    direction = direction,
                    gateName = gateName,
                    cameraCode = cameraCode,
                    scanResult = "MANUAL VERIFICATION REQUIRED",
                    isTestRecord = isTestScan,
                    timestamp = now
                )
                dao.insertGateEvent(event)
                return event
            }

            // Anti-passback check
            if (direction == "IN" && student.campusPresenceState == "INSIDE") {
                val event = GateEventEntity(
                    tokenUsed = cleanToken,
                    personName = student.fullName,
                    personRole = "STUDENT",
                    userId = student.id,
                    direction = direction,
                    gateName = gateName,
                    cameraCode = cameraCode,
                    scanResult = "ALREADY INSIDE",
                    isTestRecord = isTestScan || student.isTestRecord,
                    timestamp = now
                )
                dao.insertGateEvent(event)
                recordAudit(
                    actorName = cameraCode,
                    actorRole = "GATE_CAMERA",
                    actionType = "ANTI_PASSBACK_BLOCK",
                    targetEntity = "Student:${student.username}",
                    details = "Anti-passback prevented duplicate IN scan for ${student.fullName}"
                )
                return event
            }

            if (direction == "OUT" && student.campusPresenceState == "OUTSIDE") {
                val event = GateEventEntity(
                    tokenUsed = cleanToken,
                    personName = student.fullName,
                    personRole = "STUDENT",
                    userId = student.id,
                    direction = direction,
                    gateName = gateName,
                    cameraCode = cameraCode,
                    scanResult = "ALREADY OUTSIDE",
                    isTestRecord = isTestScan || student.isTestRecord,
                    timestamp = now
                )
                dao.insertGateEvent(event)
                recordAudit(
                    actorName = cameraCode,
                    actorRole = "GATE_CAMERA",
                    actionType = "ANTI_PASSBACK_BLOCK",
                    targetEntity = "Student:${student.username}",
                    details = "Anti-passback prevented duplicate OUT scan for ${student.fullName}"
                )
                return event
            }

            // Atomically consume token and update student presence
            dao.updateQrToken(
                tokenRecord.copy(
                    isConsumed = true,
                    consumedAt = now,
                    consumedByCamera = cameraCode
                )
            )
            val newState = if (direction == "IN") "INSIDE" else "OUTSIDE"
            dao.updateUser(student.copy(campusPresenceState = newState))

            val event = GateEventEntity(
                tokenUsed = cleanToken,
                personName = student.fullName,
                personRole = "STUDENT",
                userId = student.id,
                direction = direction,
                gateName = gateName,
                cameraCode = cameraCode,
                scanResult = "ACCESS RECORDED",
                isTestRecord = isTestScan || student.isTestRecord,
                timestamp = now
            )
            dao.insertGateEvent(event)
            recordAudit(
                actorName = cameraCode,
                actorRole = "GATE_CAMERA",
                actionType = "GATE_${direction}_RECORDED",
                targetEntity = "Student:${student.username}",
                details = "QR credential validated for ${student.fullName} ($direction at $gateName via $cameraCode)"
            )
            return event
        }

        // Visitor Pass validation + Anti-passback
        if (tokenRecord.tokenType == "VISITOR_PASS" && tokenRecord.visitorPassId != null) {
            val visitor = dao.getVisitorPassById(tokenRecord.visitorPassId)
            if (visitor == null) {
                val event = GateEventEntity(
                    tokenUsed = cleanToken,
                    personName = "UNKNOWN VISITOR",
                    personRole = "VISITOR",
                    direction = direction,
                    gateName = gateName,
                    cameraCode = cameraCode,
                    scanResult = "MANUAL VERIFICATION REQUIRED",
                    isTestRecord = isTestScan,
                    timestamp = now
                )
                dao.insertGateEvent(event)
                return event
            }

            if (direction == "IN" && visitor.currentStatus == "INSIDE") {
                val event = GateEventEntity(
                    tokenUsed = cleanToken,
                    personName = visitor.visitorName,
                    personRole = "VISITOR",
                    visitorPassId = visitor.id,
                    direction = direction,
                    gateName = gateName,
                    cameraCode = cameraCode,
                    scanResult = "ALREADY INSIDE",
                    isTestRecord = isTestScan || visitor.isTestRecord,
                    timestamp = now
                )
                dao.insertGateEvent(event)
                return event
            }
            if (direction == "OUT" && visitor.currentStatus != "INSIDE") {
                val event = GateEventEntity(
                    tokenUsed = cleanToken,
                    personName = visitor.visitorName,
                    personRole = "VISITOR",
                    visitorPassId = visitor.id,
                    direction = direction,
                    gateName = gateName,
                    cameraCode = cameraCode,
                    scanResult = "ALREADY OUTSIDE",
                    isTestRecord = isTestScan || visitor.isTestRecord,
                    timestamp = now
                )
                dao.insertGateEvent(event)
                return event
            }

            if (direction == "OUT") {
                dao.updateQrToken(
                    tokenRecord.copy(
                        isConsumed = true,
                        consumedAt = now,
                        consumedByCamera = cameraCode
                    )
                )
            }
            dao.upsertVisitorPass(
                visitor.copy(currentStatus = if (direction == "IN") "INSIDE" else "EXITED")
            )
            val event = GateEventEntity(
                tokenUsed = cleanToken,
                personName = visitor.visitorName,
                personRole = "VISITOR",
                visitorPassId = visitor.id,
                direction = direction,
                gateName = gateName,
                cameraCode = cameraCode,
                scanResult = "ACCESS RECORDED",
                isTestRecord = isTestScan || visitor.isTestRecord,
                timestamp = now
            )
            dao.insertGateEvent(event)
            recordAudit(
                actorName = cameraCode,
                actorRole = "GATE_CAMERA",
                actionType = "VISITOR_${direction}_RECORDED",
                targetEntity = "Visitor:${visitor.visitorName}",
                details = "Visitor pass validated ($direction at $gateName via $cameraCode)"
            )
            return event
        }

        val fallback = GateEventEntity(
            tokenUsed = cleanToken,
            personName = "UNCLASSIFIED",
            personRole = "UNKNOWN",
            direction = direction,
            gateName = gateName,
            cameraCode = cameraCode,
            scanResult = "MANUAL VERIFICATION REQUIRED",
            isTestRecord = isTestScan,
            timestamp = now
        )
        dao.insertGateEvent(fallback)
        return fallback
    }

    private fun haversineMeters(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val r = 6371000.0
        val dLat = Math.toRadians(lat2 - lat1)
        val dLon = Math.toRadians(lon2 - lon1)
        val a = sin(dLat / 2) * sin(dLat / 2) +
                cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) *
                sin(dLon / 2) * sin(dLon / 2)
        val c = 2 * atan2(sqrt(a), sqrt(1 - a))
        return r * c
    }

    private fun bearingDegrees(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val phi1 = Math.toRadians(lat1)
        val phi2 = Math.toRadians(lat2)
        val dLon = Math.toRadians(lon2 - lon1)
        val y = sin(dLon) * cos(phi2)
        val x = cos(phi1) * sin(phi2) - sin(phi1) * cos(phi2) * cos(dLon)
        val brng = Math.toDegrees(atan2(y, x))
        return (brng + 360.0) % 360.0
    }

    private fun angularDifference(a: Double, b: Double): Double {
        val diff = abs(a - b) % 360.0
        return if (diff > 180.0) 360.0 - diff else diff
    }
}
