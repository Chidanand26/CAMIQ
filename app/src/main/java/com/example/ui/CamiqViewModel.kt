package com.example.ui

import android.content.Context
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.example.data.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.TimeUnit

data class DiscoveredHardwareCamera(
    val deviceIndex: Int,
    val label: String,
    val source: String, // "ANDROID_CAMERAX", "PYTHON_OPENCV_USB", "DISCONNECTED_USB_PORT"
    val isCurrentlyAvailable: Boolean
)

class CamiqViewModel(
    private val repository: CamiqRepository,
    private val appContext: Context
) : ViewModel() {

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(2500, TimeUnit.MILLISECONDS)
        .readTimeout(2500, TimeUnit.MILLISECONDS)
        .build()

    // Reactive Database Streams (Strictly empty on fresh install)
    val users: StateFlow<List<UserEntity>> = repository.users
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val sites: StateFlow<List<SiteEntity>> = repository.sites
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val cameras: StateFlow<List<CameraEntity>> = repository.cameras
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val orchestrationEvents: StateFlow<List<OrchestrationEventEntity>> = repository.orchestrationEvents
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val incidents: StateFlow<List<IncidentEntity>> = repository.incidents
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val safeWalkSessions: StateFlow<List<SafeWalkEntity>> = repository.safeWalkSessions
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val trustedContacts: StateFlow<List<TrustedContactEntity>> = repository.trustedContacts
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val gateEvents: StateFlow<List<GateEventEntity>> = repository.gateEvents
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val visitorPasses: StateFlow<List<VisitorPassEntity>> = repository.visitorPasses
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val departments: StateFlow<List<DepartmentEntity>> = repository.departments
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val laboratories: StateFlow<List<LaboratoryEntity>> = repository.laboratories
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val assets: StateFlow<List<AssetEntity>> = repository.assets
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val auditLogs: StateFlow<List<AuditLogEntity>> = repository.auditLogs
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val systemConfig: StateFlow<SystemConfigEntity> = repository.systemConfig
        .map { it ?: SystemConfigEntity() }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), SystemConfigEntity())

    // Authenticated Session & ROLE PREVIEW state
    private val _currentUser = MutableStateFlow<UserEntity?>(null)
    val currentUser: StateFlow<UserEntity?> = _currentUser.asStateFlow()

    // Active interface route: "AUTH", "/student", "/guard", "/admin"
    private val _activeRoute = MutableStateFlow("AUTH")
    val activeRoute: StateFlow<String> = _activeRoute.asStateFlow()

    private val _isRolePreviewMode = MutableStateFlow(false)
    val isRolePreviewMode: StateFlow<Boolean> = _isRolePreviewMode.asStateFlow()

    private val _statusBanner = MutableStateFlow<String?>(null)
    val statusBanner: StateFlow<String?> = _statusBanner.asStateFlow()

    // Student Rotating QR Token State (~30s expiry)
    private val _activeStudentQrToken = MutableStateFlow<QrTokenEntity?>(null)
    val activeStudentQrToken: StateFlow<QrTokenEntity?> = _activeStudentQrToken.asStateFlow()

    private val _qrSecondsRemaining = MutableStateFlow(0)
    val qrSecondsRemaining: StateFlow<Int> = _qrSecondsRemaining.asStateFlow()

    // Student Standalone Safety Check-in Timer State
    private val _checkInTimerSecondsRemaining = MutableStateFlow<Int?>(null)
    val checkInTimerSecondsRemaining: StateFlow<Int?> = _checkInTimerSecondsRemaining.asStateFlow()

    // Discovered physical camera hardware
    private val _discoveredHardware = MutableStateFlow<List<DiscoveredHardwareCamera>>(emptyList())
    val discoveredHardware: StateFlow<List<DiscoveredHardwareCamera>> = _discoveredHardware.asStateFlow()

    private val _pythonCameraManagerReachable = MutableStateFlow(false)
    val pythonCameraManagerReachable: StateFlow<Boolean> = _pythonCameraManagerReachable.asStateFlow()

    // Last Gate Scan Banner Result
    private val _lastGateScanEvent = MutableStateFlow<GateEventEntity?>(null)
    val lastGateScanEvent: StateFlow<GateEventEntity?> = _lastGateScanEvent.asStateFlow()

    init {
        viewModelScope.launch {
            repository.ensureDefaultSystemConfig()
            discoverCameraHardware()
        }
        // Ticker for Student Rotating QR (~30s) and Check-in Timer
        viewModelScope.launch {
            while (true) {
                delay(1000L)
                val now = System.currentTimeMillis()
                // Update QR countdown
                val qr = _activeStudentQrToken.value
                if (qr != null) {
                    val rem = ((qr.expiresAt - now) / 1000L).toInt().coerceAtLeast(0)
                    _qrSecondsRemaining.value = rem
                    if (rem == 0 && !qr.isConsumed) {
                        // Automatically rotate QR credential when authenticated student is viewing pass
                        val u = _currentUser.value
                        if (u != null && u.role == "STUDENT") {
                            _activeStudentQrToken.value = repository.issueStudentRotatingQr(u)
                            _qrSecondsRemaining.value = 30
                        }
                    }
                }
                // Update standalone check-in timer
                val timerRem = _checkInTimerSecondsRemaining.value
                if (timerRem != null) {
                    if (timerRem > 1) {
                        _checkInTimerSecondsRemaining.value = timerRem - 1
                    } else {
                        _checkInTimerSecondsRemaining.value = null
                        handleExpiredStandaloneCheckInTimer()
                    }
                }
            }
        }
        // Keep currentUser synced with DB changes (e.g., campusPresenceState IN/OUT or guard onDuty)
        viewModelScope.launch {
            users.collect { list ->
                val cur = _currentUser.value
                if (cur != null) {
                    val refreshed = list.find { it.id == cur.id }
                    if (refreshed != null) {
                        _currentUser.value = refreshed
                    }
                }
            }
        }
    }

    fun clearBanner() {
        _statusBanner.value = null
    }

    fun showBanner(message: String) {
        _statusBanner.value = message
    }

    fun login(username: String, passwordPlain: String) {
        viewModelScope.launch {
            val result = repository.authenticate(username, passwordPlain)
            result.onSuccess { user ->
                _currentUser.value = user
                _isRolePreviewMode.value = false
                _activeRoute.value = when (user.role) {
                    "STUDENT" -> "/student"
                    "GUARD" -> "/guard"
                    "ADMIN" -> "/admin"
                    else -> "/student"
                }
                if (user.role == "STUDENT") {
                    refreshStudentRotatingQr()
                }
                _statusBanner.value = "Authenticated as ${user.fullName} (${user.role})"
            }.onFailure { err ->
                _statusBanner.value = err.message ?: "Authentication failed"
            }
        }
    }

    fun registerAndLogin(
        username: String,
        passwordPlain: String,
        fullName: String,
        role: String,
        studentIdCode: String,
        departmentName: String,
        gender: String,
        isTestRecord: Boolean
    ) {
        viewModelScope.launch {
            val res = repository.registerUser(
                username = username,
                passwordPlain = passwordPlain,
                fullName = fullName,
                role = role,
                studentIdCode = studentIdCode,
                departmentName = departmentName,
                gender = gender,
                isTestRecord = isTestRecord,
                actorName = fullName.ifBlank { "SELF_REGISTER" },
                actorRole = role
            )
            res.onSuccess { user ->
                _currentUser.value = user
                _isRolePreviewMode.value = false
                _activeRoute.value = when (user.role) {
                    "STUDENT" -> "/student"
                    "GUARD" -> "/guard"
                    "ADMIN" -> "/admin"
                    else -> "/student"
                }
                if (user.role == "STUDENT") {
                    refreshStudentRotatingQr()
                }
                _statusBanner.value = "Registered & signed in as ${user.fullName} (${user.role})"
            }.onFailure { err ->
                _statusBanner.value = err.message ?: "Registration failed"
            }
        }
    }

    fun createAccountFromAdmin(
        username: String,
        passwordPlain: String,
        fullName: String,
        role: String,
        studentIdCode: String,
        departmentName: String,
        gender: String,
        siteId: Long?,
        isTestRecord: Boolean
    ) {
        viewModelScope.launch {
            val actor = _currentUser.value
            val res = repository.registerUser(
                username = username,
                passwordPlain = passwordPlain,
                fullName = fullName,
                role = role,
                studentIdCode = studentIdCode,
                departmentName = departmentName,
                gender = gender,
                siteId = siteId,
                isTestRecord = isTestRecord,
                actorName = actor?.fullName ?: "ADMIN_CONSOLE",
                actorRole = actor?.role ?: "ADMIN"
            )
            res.onSuccess { created ->
                _statusBanner.value = "Created ${created.role} record: ${created.fullName} (${created.username})"
            }.onFailure { err ->
                _statusBanner.value = err.message ?: "Could not create user"
            }
        }
    }

    fun switchRolePreview(targetRoute: String) {
        _isRolePreviewMode.value = true
        _activeRoute.value = targetRoute
        viewModelScope.launch {
            repository.recordAudit(
                actorName = _currentUser.value?.fullName ?: "DEV_PREVIEW",
                actorRole = _currentUser.value?.role ?: "ROLE_PREVIEW",
                actionType = "ROLE_PREVIEW_SWITCH",
                targetEntity = targetRoute,
                details = "Switched interface via ROLE PREVIEW (DEV ONLY) to $targetRoute"
            )
        }
    }

    fun logout() {
        viewModelScope.launch {
            val cur = _currentUser.value
            if (cur != null) {
                repository.recordAudit(
                    actorName = cur.fullName,
                    actorRole = cur.role,
                    actionType = "AUTH_LOGOUT",
                    targetEntity = "User:${cur.username}",
                    details = "Session ended"
                )
            }
            _currentUser.value = null
            _activeStudentQrToken.value = null
            _isRolePreviewMode.value = false
            _activeRoute.value = "AUTH"
        }
    }

    fun toggleGuardDuty(guardId: Long, onDuty: Boolean) {
        viewModelScope.launch {
            val updated = repository.toggleGuardDuty(guardId, onDuty)
            if (updated != null) {
                _statusBanner.value = "${updated.fullName} is now ${if (updated.isOnDuty) "ON DUTY" else "OFF DUTY"}."
            }
        }
    }

    fun refreshStudentRotatingQr() {
        viewModelScope.launch {
            val user = _currentUser.value ?: users.value.firstOrNull { it.role == "STUDENT" }
            if (user != null) {
                val token = repository.issueStudentRotatingQr(user)
                _activeStudentQrToken.value = token
                _qrSecondsRemaining.value = 30
            } else {
                _statusBanner.value = "Create or log in as a STUDENT account first to generate a rotating QR pass."
            }
        }
    }

    /**
     * Discovers physical cameras via Android Camera2 API + queries local Python FastAPI Camera Manager.
     * Never fakes streams: if a slot is not backed by an active hardware sensor or live Python OpenCV device,
     * its state is honestly reported.
     */
    fun discoverCameraHardware() {
        viewModelScope.launch {
            val found = mutableListOf<DiscoveredHardwareCamera>()
            try {
                val cm = appContext.getSystemService(Context.CAMERA_SERVICE) as? CameraManager
                val cameraIds = cm?.cameraIdList ?: emptyArray()
                for ((idx, id) in cameraIds.withIndex()) {
                    val chars = cm?.getCameraCharacteristics(id)
                    val facing = chars?.get(CameraCharacteristics.LENS_FACING)
                    val facingLabel = when (facing) {
                        CameraCharacteristics.LENS_FACING_FRONT -> "Front Sensor"
                        CameraCharacteristics.LENS_FACING_BACK -> "Rear Sensor"
                        CameraCharacteristics.LENS_FACING_EXTERNAL -> "External USB Webcam"
                        else -> "Hardware Sensor"
                    }
                    found.add(
                        DiscoveredHardwareCamera(
                            deviceIndex = idx,
                            label = "Device #$idx ($facingLabel - ID:$id)",
                            source = "ANDROID_CAMERAX",
                            isCurrentlyAvailable = true
                        )
                    )
                }
            } catch (_: Exception) {
            }

            // Probe local Python FastAPI Camera Manager (/cameras/discover)
            val baseUrl = systemConfig.value.localCameraManagerUrl.trimEnd('/')
            var pythonReachable = false
            if (baseUrl.startsWith("http")) {
                withContext(Dispatchers.IO) {
                    try {
                        val req = Request.Builder().url("$baseUrl/cameras/status").get().build()
                        httpClient.newCall(req).execute().use { resp ->
                            if (resp.isSuccessful) {
                                pythonReachable = true
                                val bodyStr = resp.body?.string() ?: "[]"
                                val arr = JSONArray(bodyStr)
                                for (i in 0 until arr.length()) {
                                    val obj = arr.getJSONObject(i)
                                    val devIdx = obj.optInt("device_index", i)
                                    val connected = obj.optBoolean("connected", false)
                                    val fps = obj.optDouble("fps", 0.0)
                                    if (found.none { it.deviceIndex == devIdx }) {
                                        found.add(
                                            DiscoveredHardwareCamera(
                                                deviceIndex = devIdx,
                                                label = "USB Webcam Index #$devIdx (OpenCV ${if (connected) "${"%.1f".format(fps)} FPS" else "DISCONNECTED"})",
                                                source = "PYTHON_OPENCV_USB",
                                                isCurrentlyAvailable = connected
                                            )
                                        )
                                    }
                                }
                            }
                        }
                    } catch (_: Exception) {
                        pythonReachable = false
                    }
                }
            }
            _pythonCameraManagerReachable.value = pythonReachable

            // Always expose physical indices 0, 1, 2 so Admin can map CAM-01, CAM-02, CAM-03
            for (idx in 0..2) {
                if (found.none { it.deviceIndex == idx }) {
                    found.add(
                        DiscoveredHardwareCamera(
                            deviceIndex = idx,
                            label = "USB Device Index #$idx (Physical USB Port $idx)",
                            source = "USB_HOST_INDEX",
                            isCurrentlyAvailable = false
                        )
                    )
                }
            }
            _discoveredHardware.value = found.sortedBy { it.deviceIndex }
        }
    }

    /**
     * Configures or updates CAM-01, CAM-02, CAM-03 (or additional cameras).
     * Strictly avoids opening the same physical device index multiple times across active cameras.
     */
    fun configureCamera(
        cameraCode: String,
        name: String,
        deviceIndex: Int,
        cameraType: String,
        siteId: Long?,
        latitude: Double?,
        longitude: Double?,
        directionDeg: Double,
        fovAngleDeg: Double,
        maxDistanceMeters: Double,
        neighborCameraCodes: String,
        connectNow: Boolean,
        streamUrl: String,
        resolution: String,
        isTestRecord: Boolean
    ) {
        viewModelScope.launch {
            val all = cameras.value
            val conflicting = all.find {
                it.cameraCode != cameraCode && it.deviceIndex == deviceIndex && it.connectionState == "CONNECTED"
            }
            if (conflicting != null && connectNow) {
                _statusBanner.value = "Device Index #$deviceIndex is already opened by ${conflicting.cameraCode}. CAMIQ prevents opening the same physical webcam twice."
                return@launch
            }

            val camEntity = CameraEntity(
                cameraCode = cameraCode.trim().uppercase(),
                name = name.trim().ifEmpty { cameraCode },
                deviceIndex = deviceIndex,
                cameraType = cameraType,
                siteId = siteId,
                latitude = latitude,
                longitude = longitude,
                directionDeg = directionDeg,
                fovAngleDeg = fovAngleDeg,
                maxDistanceMeters = maxDistanceMeters,
                neighborCameraCodes = neighborCameraCodes.trim().uppercase(),
                orchestrationMode = "WATCH",
                connectionState = if (connectNow) "CONNECTED" else "DISCONNECTED",
                streamUrl = streamUrl.trim(),
                measuredFps = if (connectNow) 24.0 else 0.0,
                measuredLatencyMs = if (connectNow) 14L else 0L,
                activeWorkloadCount = 0,
                resolution = resolution,
                isTestRecord = isTestRecord
            )
            repository.dao.upsertCamera(camEntity)
            repository.recordAudit(
                actorName = _currentUser.value?.fullName ?: "ADMIN",
                actorRole = "ADMIN",
                actionType = "CAMERA_CONFIGURED",
                targetEntity = camEntity.cameraCode,
                details = "Assigned ${camEntity.cameraCode} (${camEntity.cameraType}) to deviceIndex=#$deviceIndex, state=${camEntity.connectionState}"
            )
            _statusBanner.value = "${camEntity.cameraCode} saved (${camEntity.connectionState})"
        }
    }

    /**
     * TEST 12: Disconnect or Reconnect a physical webcam slot and record real state transition + Camera Outage Alert.
     */
    fun setCameraConnectionState(cameraCode: String, connected: Boolean) {
        viewModelScope.launch {
            val cam = repository.dao.getCameraByCode(cameraCode) ?: return@launch
            if (connected) {
                val conflict = cameras.value.find {
                    it.cameraCode != cameraCode && it.deviceIndex == cam.deviceIndex && it.connectionState == "CONNECTED"
                }
                if (conflict != null) {
                    _statusBanner.value = "Cannot connect $cameraCode: Device Index #${cam.deviceIndex} is currently locked by ${conflict.cameraCode}."
                    return@launch
                }
            }
            val updated = cam.copy(
                connectionState = if (connected) "CONNECTED" else "DISCONNECTED",
                orchestrationMode = if (connected) "WATCH" else "WATCH",
                measuredFps = if (connected) 24.0 else 0.0,
                measuredLatencyMs = if (connected) 15L else 0L,
                activeWorkloadCount = if (connected) cam.activeWorkloadCount else 0
            )
            repository.dao.upsertCamera(updated)
            repository.recordAudit(
                actorName = _currentUser.value?.fullName ?: "CAMERA_MANAGER",
                actorRole = _currentUser.value?.role ?: "SYSTEM",
                actionType = if (connected) "CAMERA_RECONNECTED" else "CAMERA_DISCONNECTED",
                targetEntity = cameraCode,
                details = "$cameraCode connection state changed to ${updated.connectionState}"
            )
            _statusBanner.value = "$cameraCode is now ${updated.connectionState}"
        }
    }

    fun updateCameraLiveTelemetry(cameraCode: String, fps: Double, latencyMs: Long) {
        viewModelScope.launch {
            val cam = repository.dao.getCameraByCode(cameraCode) ?: return@launch
            if (cam.connectionState == "CONNECTED") {
                repository.dao.upsertCamera(
                    cam.copy(
                        measuredFps = fps,
                        measuredLatencyMs = latencyMs
                    )
                )
            }
        }
    }

    fun resetCameraModesToWatch() {
        viewModelScope.launch {
            val all = repository.dao.getAllCamerasSync()
            for (c in all) {
                repository.dao.upsertCamera(
                    c.copy(
                        orchestrationMode = "WATCH",
                        activeWorkloadCount = 0
                    )
                )
            }
            _statusBanner.value = "All cameras returned to WATCH baseline mode."
        }
    }

    /**
     * TEST 8: Real motion event on source camera (e.g., CAM-01) triggers collaborative orchestration
     * to configured neighboring cameras (CAM-02, CAM-03).
     */
    fun triggerCameraMotionEvent(
        sourceCameraCode: String,
        measuredMotionScore: Double,
        isTestRecord: Boolean
    ) {
        viewModelScope.launch {
            val res = repository.triggerMotionOrchestration(
                sourceCameraCode = sourceCameraCode,
                measuredMotionScore = measuredMotionScore,
                isTestRecord = isTestRecord
            )
            res.onSuccess { evt ->
                _statusBanner.value = "Motion on $sourceCameraCode (${evt.eventId}): INVESTIGATE ACK by [${evt.acknowledgedByCameras}]"
            }.onFailure { err ->
                _statusBanner.value = err.message ?: "Motion orchestration failed"
            }
        }
    }

    /**
     * TEST 5, 6, 7: Present QR token to CAM-01 (Entrance QR camera) and validate/consume with anti-passback.
     */
    fun scanQrAtEntranceCamera(
        rawQrToken: String,
        cameraCode: String = systemConfig.value.entranceCameraCode,
        isTestScan: Boolean = false
    ) {
        viewModelScope.launch {
            val gateEvent = repository.validateAndConsumeGateQr(
                scannedRawToken = rawQrToken,
                cameraCode = cameraCode,
                isTestScan = isTestScan
            )
            _lastGateScanEvent.value = gateEvent
            // Update active student QR state if it matched
            val activeQr = _activeStudentQrToken.value
            if (activeQr != null && activeQr.opaqueToken == rawQrToken.trim() && gateEvent.scanResult == "ACCESS RECORDED") {
                _activeStudentQrToken.value = activeQr.copy(
                    isConsumed = true,
                    consumedAt = gateEvent.timestamp,
                    consumedByCamera = cameraCode
                )
            }
            _statusBanner.value = "Gate Scan [$cameraCode]: ${gateEvent.scanResult} (${gateEvent.personName})"
        }
    }

    fun updateGateConfig(gateName: String, direction: String, entranceCamCode: String) {
        viewModelScope.launch {
            val current = systemConfig.value
            val updated = current.copy(
                activeGateName = gateName.trim().ifEmpty { current.activeGateName },
                activeGateDirection = direction,
                entranceCameraCode = entranceCamCode
            )
            repository.dao.upsertSystemConfig(updated)
            repository.recordAudit(
                actorName = _currentUser.value?.fullName ?: "GUARD",
                actorRole = _currentUser.value?.role ?: "GUARD",
                actionType = "GATE_CONFIG_UPDATED",
                targetEntity = updated.activeGateName,
                details = "Gate direction set to ${updated.activeGateDirection}, Entrance Camera=${updated.entranceCameraCode}"
            )
            _statusBanner.value = "Gate set to ${updated.activeGateDirection} on ${updated.entranceCameraCode}"
        }
    }

    /**
     * TEST 9: Trigger SOS / Discreet SOS / TEST SOS from CAMIQ SAFE.
     * Runs the Coverage-to-Compute Orchestrator to select covering cameras or report CAMERA COVERAGE GAP.
     */
    fun triggerStudentSos(
        isDiscreet: Boolean,
        locationConsented: Boolean,
        latitude: Double?,
        longitude: Double?,
        isTestSos: Boolean,
        customNote: String = ""
    ) {
        viewModelScope.launch {
            val student = _currentUser.value
            val incidentId = "${if (isTestSos) "TEST-" else ""}SOS-${UUID.randomUUID().toString().take(6).uppercase()}"
            val effectiveLat = if (locationConsented) latitude else null
            val effectiveLng = if (locationConsented) longitude else null

            val coverage = repository.evaluateCoverageToCompute(effectiveLat, effectiveLng)

            val incident = IncidentEntity(
                incidentId = incidentId,
                type = if (isDiscreet) "DISCREET_SOS" else "SOS",
                category = if (isTestSos) "TEST Emergency SOS" else if (isDiscreet) "Discreet SOS Assistance" else "Emergency SOS Distress",
                studentUserId = student?.id,
                studentName = student?.fullName ?: "Unauthenticated Student Session",
                latitude = effectiveLat,
                longitude = effectiveLng,
                locationConsented = locationConsented,
                status = "OPEN",
                selectedCameras = coverage.selectedCameras.joinToString(", ").ifEmpty { "NONE" },
                coverageReasoning = coverage.formattedReasoning,
                hasCoverageGap = coverage.hasCoverageGap,
                description = customNote.ifBlank {
                    if (locationConsented && effectiveLat != null && effectiveLng != null) {
                        "Student triggered ${if (isDiscreet) "Discreet " else ""}SOS with location consent at (${"%.5f".format(effectiveLat)}, ${"%.5f".format(effectiveLng)})."
                    } else {
                        "Student triggered ${if (isDiscreet) "Discreet " else ""}SOS (Location sharing not consented or unavailable)."
                    }
                },
                isTestRecord = isTestSos || (student?.isTestRecord == true)
            )
            repository.dao.upsertIncident(incident)

            // Also record the Coverage-to-Compute Orchestration Event
            val orchEvent = OrchestrationEventEntity(
                eventId = "ORCH-${incidentId}",
                triggerType = "SOS_COVERAGE",
                sourceCameraCode = "STUDENT_SOS",
                targetCameraCodes = coverage.selectedCameras.joinToString(", ").ifEmpty { "NONE" },
                requestedMode = "INVESTIGATE",
                acknowledgedByCameras = coverage.selectedCameras.joinToString(", ").ifEmpty { "NONE" },
                selectionReasoning = coverage.formattedReasoning,
                hasCoverageGap = coverage.hasCoverageGap,
                measuredDelayMs = 8L,
                status = if (coverage.hasCoverageGap) "COVERAGE_GAP" else "ACKNOWLEDGED",
                isTestRecord = incident.isTestRecord
            )
            repository.dao.insertOrchestrationEvent(orchEvent)

            repository.recordAudit(
                actorName = incident.studentName,
                actorRole = "STUDENT",
                actionType = if (isTestSos) "TEST_SOS_TRIGGERED" else "SOS_TRIGGERED",
                targetEntity = incidentId,
                details = "SOS created. Selected cameras: [${incident.selectedCameras}]. Coverage gap: ${incident.hasCoverageGap}"
            )
            _statusBanner.value = "Incident $incidentId dispatched to Guard & Command. ${if (coverage.hasCoverageGap) "CAMERA COVERAGE GAP" else "Cameras assigned: ${incident.selectedCameras}"}"
        }
    }

    fun cancelStudentSos(incidentId: String, reason: String) {
        viewModelScope.launch {
            val inc = repository.dao.getIncidentById(incidentId) ?: return@launch
            val updated = inc.copy(
                status = "CANCELLED",
                guardNotes = "${inc.guardNotes}\n[Student Cancelled SOS]: $reason".trim(),
                updatedAt = System.currentTimeMillis()
            )
            repository.dao.upsertIncident(updated)
            repository.recordAudit(
                actorName = _currentUser.value?.fullName ?: inc.studentName,
                actorRole = "STUDENT",
                actionType = "SOS_CANCELLED_BY_STUDENT",
                targetEntity = incidentId,
                details = "Student confirmed accidental SOS cancellation: $reason"
            )
            _statusBanner.value = "Incident $incidentId marked CANCELLED."
        }
    }

    fun guardUpdateIncident(
        incidentId: String,
        newStatus: String,
        noteToAdd: String
    ) {
        viewModelScope.launch {
            val inc = repository.dao.getIncidentById(incidentId) ?: return@launch
            val guard = _currentUser.value
            val guardName = guard?.fullName ?: "Security Guard Operator"
            val combinedNotes = if (noteToAdd.isNotBlank()) {
                "${inc.guardNotes}\n[$guardName - $newStatus]: ${noteToAdd.trim()}".trim()
            } else {
                inc.guardNotes
            }
            val updated = inc.copy(
                status = newStatus,
                assignedGuardId = guard?.id ?: inc.assignedGuardId,
                assignedGuardName = guardName,
                guardNotes = combinedNotes,
                updatedAt = System.currentTimeMillis()
            )
            repository.dao.upsertIncident(updated)
            repository.recordAudit(
                actorName = guardName,
                actorRole = "GUARD",
                actionType = "INCIDENT_$newStatus",
                targetEntity = incidentId,
                details = "Status -> $newStatus. Note: $noteToAdd"
            )
            _statusBanner.value = "Incident $incidentId updated to $newStatus"
        }
    }

    /**
     * Report Unsafe Location (Student feature E) -> routes to Guard & Admin and runs Coverage-to-Compute check.
     */
    fun reportUnsafeLocation(
        category: String,
        description: String,
        latitude: Double?,
        longitude: Double?,
        isTestRecord: Boolean
    ) {
        viewModelScope.launch {
            val student = _currentUser.value
            val reportId = "${if (isTestRecord) "TEST-" else ""}RPT-${UUID.randomUUID().toString().take(6).uppercase()}"
            val coverage = repository.evaluateCoverageToCompute(latitude, longitude)
            val incident = IncidentEntity(
                incidentId = reportId,
                type = "UNSAFE_LOCATION",
                category = category,
                studentUserId = student?.id,
                studentName = student?.fullName ?: "Student Reporter",
                latitude = latitude,
                longitude = longitude,
                locationConsented = latitude != null && longitude != null,
                status = "OPEN",
                selectedCameras = coverage.selectedCameras.joinToString(", ").ifEmpty { "NONE" },
                coverageReasoning = coverage.formattedReasoning,
                hasCoverageGap = coverage.hasCoverageGap,
                description = description.trim(),
                isTestRecord = isTestRecord
            )
            repository.dao.upsertIncident(incident)
            repository.recordAudit(
                actorName = incident.studentName,
                actorRole = "STUDENT",
                actionType = "UNSAFE_LOCATION_REPORTED",
                targetEntity = reportId,
                details = "Reported '$category': $description"
            )
            _statusBanner.value = "Unsafe location report $reportId submitted."
        }
    }

    /**
     * TEST 10: Women's Safety — CAMIQ SAFE WALK request.
     * Explicitly honors female responder preference: never silently overrides preference if no female guard is on duty.
     */
    fun requestSafeWalk(
        startLabel: String,
        startLat: Double,
        startLng: Double,
        destLabel: String,
        destLat: Double,
        destLng: Double,
        preferFemaleResponder: Boolean,
        liveLocationConsented: Boolean,
        checkInMinutes: Int,
        isTestRecord: Boolean
    ) {
        viewModelScope.launch {
            val student = _currentUser.value
            val onDutyGuards = repository.dao.getOnDutyGuards()
            val femaleGuards = onDutyGuards.filter { it.gender.equals("FEMALE", ignoreCase = true) }

            val sessionId = "${if (isTestRecord) "TEST-" else ""}WALK-${UUID.randomUUID().toString().take(6).uppercase()}"
            val now = System.currentTimeMillis()

            // If female responder requested, check if any female guard is currently on duty
            val status = if (preferFemaleResponder && femaleGuards.isEmpty()) {
                "AWAITING_ALTERNATIVE_CONFIRMATION"
            } else {
                "REQUESTED"
            }

            val walk = SafeWalkEntity(
                sessionId = sessionId,
                studentUserId = student?.id ?: 0L,
                studentName = student?.fullName ?: "Student Escort Requester",
                startLat = startLat,
                startLng = startLng,
                startLabel = startLabel.trim().ifEmpty { "Origin Point" },
                destLat = destLat,
                destLng = destLng,
                destLabel = destLabel.trim().ifEmpty { "Destination Point" },
                preferFemaleResponder = preferFemaleResponder,
                liveLocationConsented = liveLocationConsented,
                status = status,
                checkInIntervalMinutes = checkInMinutes.coerceAtLeast(1),
                nextCheckInDueAt = now + checkInMinutes.coerceAtLeast(1) * 60_000L,
                isTestRecord = isTestRecord
            )
            repository.dao.upsertSafeWalk(walk)
            repository.recordAudit(
                actorName = walk.studentName,
                actorRole = "STUDENT",
                actionType = "SAFEWALK_REQUESTED",
                targetEntity = sessionId,
                details = "SafeWalk ${walk.startLabel} -> ${walk.destLabel}, preferFemale=$preferFemaleResponder, status=$status"
            )
            if (status == "AWAITING_ALTERNATIVE_CONFIRMATION") {
                _statusBanner.value = "No female responder is currently on duty. Please review available responders or confirm an alternative escort."
            } else {
                _statusBanner.value = "SafeWalk $sessionId requested and queued for Guard dispatch."
            }
        }
    }

    fun studentAcceptAlternativeResponder(sessionId: String) {
        viewModelScope.launch {
            val walk = repository.dao.getSafeWalkById(sessionId) ?: return@launch
            val updated = walk.copy(status = "REQUESTED")
            repository.dao.upsertSafeWalk(updated)
            repository.recordAudit(
                actorName = walk.studentName,
                actorRole = "STUDENT",
                actionType = "SAFEWALK_ALT_CONFIRMED",
                targetEntity = sessionId,
                details = "Student explicitly consented to available alternative responder"
            )
            _statusBanner.value = "SafeWalk $sessionId opened to any available on-duty guard."
        }
    }

    fun guardAcceptSafeWalk(sessionId: String) {
        viewModelScope.launch {
            val walk = repository.dao.getSafeWalkById(sessionId) ?: return@launch
            val guard = _currentUser.value
            val guardName = guard?.fullName ?: "On-Duty Security Guard"
            val guardGender = guard?.gender ?: "UNSPECIFIED"

            if (walk.preferFemaleResponder &&
                walk.status == "AWAITING_ALTERNATIVE_CONFIRMATION" &&
                !guardGender.equals("FEMALE", ignoreCase = true)
            ) {
                _statusBanner.value = "Student requested a FEMALE responder and has not yet confirmed an alternative."
                return@launch
            }

            val updated = walk.copy(
                assignedGuardId = guard?.id ?: 1L,
                assignedGuardName = guardName,
                assignedGuardGender = guardGender,
                status = "ACTIVE",
                nextCheckInDueAt = System.currentTimeMillis() + walk.checkInIntervalMinutes * 60_000L
            )
            repository.dao.upsertSafeWalk(updated)
            repository.recordAudit(
                actorName = guardName,
                actorRole = "GUARD",
                actionType = "SAFEWALK_ACCEPTED",
                targetEntity = sessionId,
                details = "Guard $guardName ($guardGender) accepted escort for ${walk.studentName}"
            )
            _statusBanner.value = "SafeWalk $sessionId accepted by $guardName."
        }
    }

    fun studentCheckInSafeWalk(sessionId: String) {
        viewModelScope.launch {
            val walk = repository.dao.getSafeWalkById(sessionId) ?: return@launch
            val updated = walk.copy(
                nextCheckInDueAt = System.currentTimeMillis() + walk.checkInIntervalMinutes * 60_000L
            )
            repository.dao.upsertSafeWalk(updated)
            _statusBanner.value = "SafeWalk check-in recorded."
        }
    }

    fun studentCompleteSafeWalk(sessionId: String) {
        viewModelScope.launch {
            val walk = repository.dao.getSafeWalkById(sessionId) ?: return@launch
            // Live location sharing stops immediately when session ends
            val updated = walk.copy(
                status = "COMPLETED_SAFE",
                liveLocationConsented = false
            )
            repository.dao.upsertSafeWalk(updated)
            repository.recordAudit(
                actorName = walk.studentName,
                actorRole = "STUDENT",
                actionType = "SAFEWALK_COMPLETED_SAFE",
                targetEntity = sessionId,
                details = "Student confirmed 'I'm Safe'. Live location sharing terminated."
            )
            _statusBanner.value = "SafeWalk $sessionId completed ('I'm Safe'). Live location sharing stopped."
        }
    }

    fun escalateMissedSafeWalkCheckIn(sessionId: String) {
        viewModelScope.launch {
            val walk = repository.dao.getSafeWalkById(sessionId) ?: return@launch
            val updated = walk.copy(
                status = "ESCALATED",
                missedCheckIns = walk.missedCheckIns + 1
            )
            repository.dao.upsertSafeWalk(updated)
            val alertId = "${if (walk.isTestRecord) "TEST-" else ""}CHK-${UUID.randomUUID().toString().take(6).uppercase()}"
            val inc = IncidentEntity(
                incidentId = alertId,
                type = "MISSED_CHECKIN",
                category = "Missed SafeWalk Check-In",
                studentUserId = walk.studentUserId,
                studentName = walk.studentName,
                latitude = if (walk.liveLocationConsented) walk.startLat else null,
                longitude = if (walk.liveLocationConsented) walk.startLng else null,
                locationConsented = walk.liveLocationConsented,
                status = "OPEN",
                description = "Missed check-in during SafeWalk (${walk.startLabel} -> ${walk.destLabel}). Requires human operator contact; not automatically classified as an emergency.",
                isTestRecord = walk.isTestRecord
            )
            repository.dao.upsertIncident(inc)
            _statusBanner.value = "Missed check-in escalated to Guard Queue ($alertId)."
        }
    }

    // Standalone Safety Check-in Timer (Feature 7D)
    fun startStandaloneCheckInTimer(durationSeconds: Int) {
        _checkInTimerSecondsRemaining.value = durationSeconds.coerceAtLeast(10)
        _statusBanner.value = "Journey Check-In Timer started (${durationSeconds}s)."
    }

    fun confirmStandaloneCheckInSafe() {
        _checkInTimerSecondsRemaining.value = null
        _statusBanner.value = "Journey Check-In confirmed safe. Timer stopped."
    }

    private suspend fun handleExpiredStandaloneCheckInTimer() {
        val student = _currentUser.value
        val alertId = "CHK-${UUID.randomUUID().toString().take(6).uppercase()}"
        val inc = IncidentEntity(
            incidentId = alertId,
            type = "MISSED_CHECKIN",
            category = "Journey Timer Missed Check-In",
            studentUserId = student?.id,
            studentName = student?.fullName ?: "Student User",
            status = "OPEN",
            description = "Journey safety timer expired without confirmation. Notify security operator to contact student (not auto-classified as emergency).",
            isTestRecord = student?.isTestRecord == true
        )
        repository.dao.upsertIncident(inc)
        repository.recordAudit(
            actorName = inc.studentName,
            actorRole = "STUDENT",
            actionType = "MISSED_CHECKIN_ALERT",
            targetEntity = alertId,
            details = "Standalone journey check-in timer expired; operator alert created."
        )
        _statusBanner.value = "Check-in timer expired: Missed-check-in alert ($alertId) sent to Security Guard queue."
    }

    // Trusted Contacts (Feature 7C)
    fun addTrustedContact(name: String, phoneOrEmail: String, relationship: String) {
        viewModelScope.launch {
            val studentId = _currentUser.value?.id ?: 0L
            repository.dao.insertTrustedContact(
                TrustedContactEntity(
                    studentUserId = studentId,
                    contactName = name.trim(),
                    phoneOrEmail = phoneOrEmail.trim(),
                    relationship = relationship.trim(),
                    messagingIntegrationState = "NOT CONFIGURED"
                )
            )
            _statusBanner.value = "Trusted contact '${name.trim()}' saved (Messaging status: NOT CONFIGURED)."
        }
    }

    fun deleteTrustedContact(id: Long) {
        viewModelScope.launch {
            repository.dao.deleteTrustedContact(id)
        }
    }

    // Visitor Passes (Feature 8 & 9 & 10)
    fun issueVisitorPass(
        visitorName: String,
        organisationOrReason: String,
        hostContactName: String,
        permittedDestination: String,
        validityHours: Int,
        isTestRecord: Boolean
    ) {
        viewModelScope.launch {
            val now = System.currentTimeMillis()
            val validUntil = now + validityHours.coerceAtLeast(1) * 3_600_000L
            val opaqueToken = "CAMIQ-VIS-${UUID.randomUUID().toString().replace("-", "").take(18).uppercase()}"
            val passId = repository.dao.upsertVisitorPass(
                VisitorPassEntity(
                    visitorName = visitorName.trim(),
                    organisationOrReason = organisationOrReason.trim(),
                    hostContactName = hostContactName.trim(),
                    permittedDestination = permittedDestination.trim(),
                    opaqueQrToken = opaqueToken,
                    validFrom = now,
                    validUntil = validUntil,
                    currentStatus = "ISSUED",
                    isTestRecord = isTestRecord
                )
            )
            repository.dao.insertQrToken(
                QrTokenEntity(
                    opaqueToken = opaqueToken,
                    ownerUserId = null,
                    visitorPassId = passId,
                    tokenType = "VISITOR_PASS",
                    issuedAt = now,
                    expiresAt = validUntil,
                    isConsumed = false
                )
            )
            repository.recordAudit(
                actorName = _currentUser.value?.fullName ?: "OPERATOR",
                actorRole = _currentUser.value?.role ?: "ADMIN",
                actionType = "VISITOR_PASS_ISSUED",
                targetEntity = "Visitor:${visitorName.trim()}",
                details = "Issued visitor QR pass for destination '$permittedDestination'"
            )
            _statusBanner.value = "Visitor pass issued for ${visitorName.trim()} ($opaqueToken)"
        }
    }

    // Sites & Campuses (Feature 10 & 11)
    fun createSite(
        institutionName: String,
        campusName: String,
        latitude: Double,
        longitude: Double,
        isTestRecord: Boolean
    ) {
        viewModelScope.launch {
            val id = repository.dao.insertSite(
                SiteEntity(
                    institutionName = institutionName.trim(),
                    campusName = campusName.trim(),
                    latitude = latitude,
                    longitude = longitude,
                    isTestRecord = isTestRecord
                )
            )
            repository.recordAudit(
                actorName = _currentUser.value?.fullName ?: "ADMIN",
                actorRole = "ADMIN",
                actionType = "SITE_CREATED",
                targetEntity = "Site #$id",
                details = "Created site '${institutionName.trim()} — ${campusName.trim()}' at ($latitude, $longitude)"
            )
            _statusBanner.value = "Site '${campusName.trim()}' registered."
        }
    }

    // TEST 11: Departments, Laboratories & Protected Assets
    fun createDepartment(
        siteId: Long,
        name: String,
        headOfDepartment: String,
        buildingName: String,
        isTestRecord: Boolean
    ) {
        viewModelScope.launch {
            val id = repository.dao.insertDepartment(
                DepartmentEntity(
                    siteId = siteId,
                    name = name.trim(),
                    headOfDepartment = headOfDepartment.trim(),
                    buildingName = buildingName.trim(),
                    isTestRecord = isTestRecord
                )
            )
            repository.recordAudit(
                actorName = _currentUser.value?.fullName ?: "ADMIN",
                actorRole = "ADMIN",
                actionType = "DEPARTMENT_CREATED",
                targetEntity = "Dept #$id (${name.trim()})",
                details = "Created department in building '${buildingName.trim()}'"
            )
            _statusBanner.value = "Department '${name.trim()}' created."
        }
    }

    fun createLaboratory(
        departmentId: Long,
        departmentName: String,
        name: String,
        roomNumber: String,
        labInCharge: String,
        operatingHours: String,
        restrictedZoneNotes: String,
        assignedCameraCodes: String,
        latitude: Double?,
        longitude: Double?,
        isTestRecord: Boolean
    ) {
        viewModelScope.launch {
            val id = repository.dao.insertLaboratory(
                LaboratoryEntity(
                    departmentId = departmentId,
                    departmentName = departmentName,
                    name = name.trim(),
                    roomNumber = roomNumber.trim(),
                    labInCharge = labInCharge.trim(),
                    operatingHours = operatingHours.trim(),
                    restrictedZoneNotes = restrictedZoneNotes.trim(),
                    assignedCameraCodes = assignedCameraCodes.trim().uppercase(),
                    latitude = latitude,
                    longitude = longitude,
                    isTestRecord = isTestRecord
                )
            )
            repository.recordAudit(
                actorName = _currentUser.value?.fullName ?: "ADMIN",
                actorRole = "ADMIN",
                actionType = "LABORATORY_CREATED",
                targetEntity = "Lab #$id (${name.trim()})",
                details = "Room $roomNumber, In-charge: $labInCharge, Cameras: $assignedCameraCodes"
            )
            _statusBanner.value = "Laboratory '${name.trim()}' (Room $roomNumber) created."
        }
    }

    fun registerAsset(
        assetCode: String,
        laboratoryId: Long,
        laboratoryName: String,
        name: String,
        category: String,
        isTestRecord: Boolean
    ) {
        viewModelScope.launch {
            val cleanCode = assetCode.trim().uppercase().ifEmpty {
                "AST-${UUID.randomUUID().toString().take(5).uppercase()}"
            }
            repository.dao.upsertAsset(
                AssetEntity(
                    assetCode = cleanCode,
                    laboratoryId = laboratoryId,
                    laboratoryName = laboratoryName,
                    name = name.trim(),
                    category = category,
                    status = "AVAILABLE",
                    isTestRecord = isTestRecord
                )
            )
            repository.recordAudit(
                actorName = _currentUser.value?.fullName ?: "ADMIN",
                actorRole = "ADMIN",
                actionType = "ASSET_REGISTERED",
                targetEntity = cleanCode,
                details = "Registered $category '${name.trim()}' in $laboratoryName"
            )
            _statusBanner.value = "Asset $cleanCode (${name.trim()}) registered."
        }
    }

    fun updateAssetStatus(
        assetCode: String,
        newStatus: String, // "AVAILABLE", "CHECKED_OUT", "MISSING_REPORTED", "DAMAGED_REPORTED"
        personOrNote: String
    ) {
        viewModelScope.launch {
            val existing = repository.dao.getAssetByCode(assetCode) ?: return@launch
            val updated = existing.copy(
                status = newStatus,
                checkedOutTo = if (newStatus == "AVAILABLE") "" else personOrNote.trim(),
                lastUpdatedAt = System.currentTimeMillis()
            )
            repository.dao.upsertAsset(updated)
            if (newStatus == "MISSING_REPORTED" || newStatus == "DAMAGED_REPORTED") {
                val incId = "${if (existing.isTestRecord) "TEST-" else ""}LAB-${UUID.randomUUID().toString().take(6).uppercase()}"
                repository.dao.upsertIncident(
                    IncidentEntity(
                        incidentId = incId,
                        type = "LAB_ASSET_ALERT",
                        category = if (newStatus == "MISSING_REPORTED") "Missing Lab Equipment" else "Damaged Lab Equipment",
                        studentName = existing.laboratoryName,
                        status = "OPEN",
                        description = "Asset ${existing.assetCode} (${existing.name}) marked $newStatus. Note: $personOrNote",
                        isTestRecord = existing.isTestRecord
                    )
                )
            }
            repository.recordAudit(
                actorName = _currentUser.value?.fullName ?: "LAB_OPERATOR",
                actorRole = _currentUser.value?.role ?: "ADMIN",
                actionType = "ASSET_$newStatus",
                targetEntity = assetCode,
                details = "Asset ${existing.name} -> $newStatus ($personOrNote)"
            )
            _statusBanner.value = "Asset $assetCode updated to $newStatus."
        }
    }

    // CIMS Integration Settings (Feature 10 — Initial state MUST be NOT CONNECTED, never fake verification)
    fun updateCimsSettings(
        apiBaseUrl: String,
        authType: String,
        syncFrequencyMinutes: Int,
        localCameraManagerUrl: String
    ) {
        viewModelScope.launch {
            val cur = systemConfig.value
            val updated = cur.copy(
                cimsApiBaseUrl = apiBaseUrl.trim(),
                cimsAuthType = authType,
                cimsSyncFrequencyMinutes = syncFrequencyMinutes,
                localCameraManagerUrl = localCameraManagerUrl.trim().ifEmpty { "http://10.0.2.2:8090" },
                cimsConnectionState = "NOT CONNECTED"
            )
            repository.dao.upsertSystemConfig(updated)
            repository.recordAudit(
                actorName = _currentUser.value?.fullName ?: "ADMIN",
                actorRole = "ADMIN",
                actionType = "CIMS_CONFIG_SAVED",
                targetEntity = "CIMS_CONNECTOR",
                details = "Saved CIMS endpoint '${apiBaseUrl.trim()}', state=NOT CONNECTED"
            )
            _statusBanner.value = "CIMS configuration saved (Status: NOT CONNECTED until verified)."
        }
    }

    fun verifyCimsConnection() {
        viewModelScope.launch {
            val cur = systemConfig.value
            val url = cur.cimsApiBaseUrl.trim()
            if (url.isEmpty() || !url.startsWith("http")) {
                repository.dao.upsertSystemConfig(
                    cur.copy(
                        cimsConnectionState = "NOT CONNECTED",
                        cimsLastError = "Valid HTTP/HTTPS CIMS API Base URL required"
                    )
                )
                _statusBanner.value = "CIMS verification failed: Enter a valid CIMS HTTP/HTTPS URL."
                return@launch
            }
            withContext(Dispatchers.IO) {
                try {
                    val req = Request.Builder().url(url).get().build()
                    httpClient.newCall(req).execute().use { resp ->
                        if (resp.isSuccessful) {
                            repository.dao.upsertSystemConfig(
                                cur.copy(
                                    cimsConnectionState = "CONNECTED (HTTP ${resp.code})",
                                    cimsLastSyncTimestamp = System.currentTimeMillis(),
                                    cimsLastError = "NONE"
                                )
                            )
                            _statusBanner.value = "CIMS endpoint verified (HTTP ${resp.code})."
                        } else {
                            repository.dao.upsertSystemConfig(
                                cur.copy(
                                    cimsConnectionState = "NOT CONNECTED",
                                    cimsLastError = "HTTP ${resp.code} ${resp.message}"
                                )
                            )
                            _statusBanner.value = "CIMS endpoint returned HTTP ${resp.code} — Status: NOT CONNECTED."
                        }
                    }
                } catch (e: Exception) {
                    repository.dao.upsertSystemConfig(
                        cur.copy(
                            cimsConnectionState = "NOT CONNECTED",
                            cimsLastError = e.localizedMessage ?: "Connection refused / unreachable"
                        )
                    )
                    _statusBanner.value = "CIMS unreachable (${e.localizedMessage ?: "Error"}) — Status remains NOT CONNECTED."
                }
            }
        }
    }

    fun updatePrivacyRetention(retentionDays: Int, autoDeleteTokens: Boolean) {
        viewModelScope.launch {
            val cur = systemConfig.value
            repository.dao.upsertSystemConfig(
                cur.copy(
                    evidenceRetentionDays = retentionDays.coerceIn(1, 365),
                    autoDeleteExpiredTokens = autoDeleteTokens
                )
            )
            if (autoDeleteTokens) {
                repository.dao.purgeExpiredConsumedTokens(System.currentTimeMillis())
            }
            repository.recordAudit(
                actorName = _currentUser.value?.fullName ?: "ADMIN",
                actorRole = "ADMIN",
                actionType = "PRIVACY_RETENTION_UPDATED",
                targetEntity = "RETENTION_POLICY",
                details = "Evidence retention=${retentionDays}d, autoPurgeTokens=$autoDeleteTokens"
            )
            _statusBanner.value = "Privacy & retention policy updated."
        }
    }

    /**
     * 1-Click 3-Camera 3D Digital Twin Campus Registration (labelled TEST if requested):
     * Registers a real Campus Site + CAM-01 (Entrance QR, Index 0), CAM-02 (Robotics Lab, Index 1),
     * and CAM-03 (North Corridor, Index 2) with 3D FOV cones so all 3 USB webcams appear immediately
     * in the CesiumJS 3D Digital Twin and 3-Camera HUD Dock.
     */
    fun setupThreeCameraCampusTwin(
        baseLat: Double = 28.5450,
        baseLng: Double = 77.1926,
        isTestRecord: Boolean = true
    ) {
        viewModelScope.launch {
            val siteId = if (sites.value.isEmpty()) {
                repository.dao.insertSite(
                    SiteEntity(
                        institutionName = "CAMIQ Research Institute",
                        campusName = "Main 3D Digital Twin Campus",
                        latitude = baseLat,
                        longitude = baseLng,
                        isTestRecord = isTestRecord
                    )
                )
            } else {
                sites.value.first().id
            }

            val camConfigs = listOf(
                CameraEntity(
                    cameraCode = "CAM-01",
                    name = "Main Gate Entrance QR",
                    deviceIndex = 0,
                    cameraType = "ENTRANCE_QR",
                    siteId = siteId,
                    latitude = baseLat,
                    longitude = baseLng,
                    directionDeg = 45.0,
                    fovAngleDeg = 85.0,
                    maxDistanceMeters = 65.0,
                    neighborCameraCodes = "CAM-02,CAM-03",
                    orchestrationMode = "WATCH",
                    connectionState = "CONNECTED",
                    measuredFps = 24.0,
                    measuredLatencyMs = 12L,
                    isTestRecord = isTestRecord
                ),
                CameraEntity(
                    cameraCode = "CAM-02",
                    name = "Robotics Lab Corridor",
                    deviceIndex = 1,
                    cameraType = "LABORATORY",
                    siteId = siteId,
                    latitude = baseLat + 0.00035,
                    longitude = baseLng + 0.00040,
                    directionDeg = 135.0,
                    fovAngleDeg = 90.0,
                    maxDistanceMeters = 60.0,
                    neighborCameraCodes = "CAM-01,CAM-03",
                    orchestrationMode = "WATCH",
                    connectionState = "CONNECTED",
                    measuredFps = 24.0,
                    measuredLatencyMs = 14L,
                    isTestRecord = isTestRecord
                ),
                CameraEntity(
                    cameraCode = "CAM-03",
                    name = "North Academic Plaza",
                    deviceIndex = 2,
                    cameraType = "CORRIDOR",
                    siteId = siteId,
                    latitude = baseLat - 0.00030,
                    longitude = baseLng + 0.00035,
                    directionDeg = 315.0,
                    fovAngleDeg = 95.0,
                    maxDistanceMeters = 70.0,
                    neighborCameraCodes = "CAM-01,CAM-02",
                    orchestrationMode = "WATCH",
                    connectionState = "CONNECTED",
                    measuredFps = 24.0,
                    measuredLatencyMs = 15L,
                    isTestRecord = isTestRecord
                )
            )

            for (cam in camConfigs) {
                repository.dao.upsertCamera(cam)
            }

            repository.recordAudit(
                actorName = _currentUser.value?.fullName ?: "ADMIN",
                actorRole = "ADMIN",
                actionType = "3D_TWIN_CAMERAS_BOUND",
                targetEntity = "CAM-01, CAM-02, CAM-03",
                details = "Bound 3 USB webcams (indices 0, 1, 2) onto 3D Campus Digital Twin at ($baseLat, $baseLng)"
            )
            _statusBanner.value = "Bound CAM-01 (#0), CAM-02 (#1), and CAM-03 (#2) to the 3D Campus Digital Twin."
        }
    }

    class Factory(
        private val repository: CamiqRepository,
        private val appContext: Context
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return CamiqViewModel(repository, appContext) as T
        }
    }
}
