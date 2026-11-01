package com.example.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "users")
data class UserEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val username: String,
    val passwordHash: String,
    val fullName: String,
    val role: String, // "STUDENT", "GUARD", "ADMIN"
    val studentIdCode: String = "",
    val departmentName: String = "",
    val gender: String = "UNSPECIFIED", // "FEMALE", "MALE", "OTHER", "UNSPECIFIED"
    val isOnDuty: Boolean = false,
    val campusPresenceState: String = "OUTSIDE", // "INSIDE", "OUTSIDE"
    val siteId: Long? = null,
    val isTestRecord: Boolean = false,
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "sites")
data class SiteEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val institutionName: String,
    val campusName: String,
    val latitude: Double,
    val longitude: Double,
    val defaultZoom: Double = 16.0,
    val isTestRecord: Boolean = false,
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "cameras")
data class CameraEntity(
    @PrimaryKey val cameraCode: String, // "CAM-01", "CAM-02", "CAM-03", etc.
    val name: String,
    val deviceIndex: Int, // Physical USB index 0, 1, 2
    val cameraType: String, // "ENTRANCE_QR", "LABORATORY", "CORRIDOR", "PERIMETER"
    val siteId: Long? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val directionDeg: Double = 0.0,
    val fovAngleDeg: Double = 90.0,
    val maxDistanceMeters: Double = 45.0,
    val neighborCameraCodes: String = "", // Comma-separated e.g. "CAM-02,CAM-03"
    val orchestrationMode: String = "WATCH", // "WATCH", "VERIFY", "INVESTIGATE"
    val connectionState: String = "DISCONNECTED", // "CONNECTED", "DISCONNECTED"
    val streamUrl: String = "",
    val measuredFps: Double = 0.0,
    val measuredLatencyMs: Long = 0L,
    val activeWorkloadCount: Int = 0,
    val lastAckEventId: String = "",
    val lastAckTimestamp: Long = 0L,
    val resolution: String = "1280x720",
    val isTestRecord: Boolean = false
)

@Entity(tableName = "orchestration_events")
data class OrchestrationEventEntity(
    @PrimaryKey val eventId: String,
    val triggerType: String, // "MOTION_DETECTED", "SOS_COVERAGE", "UNSAFE_REPORT", "AFTER_HOURS_LAB"
    val sourceCameraCode: String,
    val targetCameraCodes: String,
    val requestedMode: String, // "VERIFY", "INVESTIGATE"
    val acknowledgedByCameras: String,
    val selectionReasoning: String, // Detailed Coverage-to-Compute explanation or CAMERA COVERAGE GAP
    val hasCoverageGap: Boolean = false,
    val measuredDelayMs: Long = 0L,
    val status: String, // "ACKNOWLEDGED", "PENDING", "COVERAGE_GAP", "TIMEOUT"
    val isTestRecord: Boolean = false,
    val timestamp: Long = System.currentTimeMillis()
)

@Entity(tableName = "incidents")
data class IncidentEntity(
    @PrimaryKey val incidentId: String,
    val type: String, // "SOS", "DISCREET_SOS", "MISSED_CHECKIN", "UNSAFE_LOCATION", "LAB_ASSET_ALERT", "CAMERA_OUTAGE"
    val category: String, // e.g. "Emergency SOS", "Poor Lighting", "Harassment", "Missing Equipment"
    val studentUserId: Long? = null,
    val studentName: String = "",
    val latitude: Double? = null,
    val longitude: Double? = null,
    val locationConsented: Boolean = false,
    val status: String, // "OPEN", "ACKNOWLEDGED", "ASSIGNED", "RESOLVED", "CANCELLED"
    val assignedGuardId: Long? = null,
    val assignedGuardName: String = "",
    val selectedCameras: String = "", // Comma-separated cameras selected by Coverage-to-Compute Orchestrator
    val coverageReasoning: String = "", // Detailed selection/rejection explanation or CAMERA COVERAGE GAP
    val hasCoverageGap: Boolean = false,
    val description: String = "",
    val guardNotes: String = "",
    val isTestRecord: Boolean = false,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "safewalk_sessions")
data class SafeWalkEntity(
    @PrimaryKey val sessionId: String,
    val studentUserId: Long,
    val studentName: String,
    val startLat: Double,
    val startLng: Double,
    val startLabel: String,
    val destLat: Double,
    val destLng: Double,
    val destLabel: String,
    val preferFemaleResponder: Boolean,
    val liveLocationConsented: Boolean,
    val assignedGuardId: Long? = null,
    val assignedGuardName: String = "",
    val assignedGuardGender: String = "",
    val status: String, // "REQUESTED", "AWAITING_ALTERNATIVE_CONFIRMATION", "ACCEPTED", "ACTIVE", "COMPLETED_SAFE", "ESCALATED"
    val checkInIntervalMinutes: Int = 5,
    val nextCheckInDueAt: Long = 0L,
    val missedCheckIns: Int = 0,
    val isTestRecord: Boolean = false,
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "trusted_contacts")
data class TrustedContactEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val studentUserId: Long,
    val contactName: String,
    val phoneOrEmail: String,
    val relationship: String,
    val notifyOnSos: Boolean = true,
    val notifyOnSafeWalk: Boolean = true,
    val messagingIntegrationState: String = "NOT CONFIGURED" // Never fake SENT/DELIVERED without real integration
)

@Entity(tableName = "qr_tokens")
data class QrTokenEntity(
    @PrimaryKey val opaqueToken: String, // Opaque random token - no PII
    val ownerUserId: Long? = null,
    val visitorPassId: Long? = null,
    val tokenType: String, // "STUDENT_PASS", "VISITOR_PASS"
    val issuedAt: Long,
    val expiresAt: Long, // ~30s for student rotating QR
    val isConsumed: Boolean = false,
    val consumedAt: Long? = null,
    val consumedByCamera: String? = null
)

@Entity(tableName = "gate_events")
data class GateEventEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val tokenUsed: String,
    val personName: String,
    val personRole: String, // "STUDENT", "VISITOR", "UNKNOWN"
    val userId: Long? = null,
    val visitorPassId: Long? = null,
    val direction: String, // "IN", "OUT"
    val gateName: String,
    val cameraCode: String,
    val scanResult: String, // "ACCESS RECORDED", "INVALID CREDENTIAL", "EXPIRED QR", "ALREADY INSIDE", "ALREADY OUTSIDE", "MANUAL VERIFICATION REQUIRED"
    val isTestRecord: Boolean = false,
    val timestamp: Long = System.currentTimeMillis()
)

@Entity(tableName = "visitor_passes")
data class VisitorPassEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val visitorName: String,
    val organisationOrReason: String,
    val hostContactName: String,
    val permittedDestination: String,
    val opaqueQrToken: String,
    val validFrom: Long,
    val validUntil: Long,
    val currentStatus: String = "ISSUED", // "ISSUED", "INSIDE", "EXITED", "EXPIRED"
    val isTestRecord: Boolean = false,
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "departments")
data class DepartmentEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val siteId: Long,
    val name: String,
    val headOfDepartment: String,
    val buildingName: String,
    val isTestRecord: Boolean = false
)

@Entity(tableName = "laboratories")
data class LaboratoryEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val departmentId: Long,
    val departmentName: String,
    val name: String,
    val roomNumber: String,
    val labInCharge: String,
    val operatingHours: String, // e.g. "08:00 - 20:00"
    val restrictedZoneNotes: String,
    val assignedCameraCodes: String, // e.g. "CAM-02"
    val latitude: Double? = null,
    val longitude: Double? = null,
    val isTestRecord: Boolean = false
)

@Entity(tableName = "assets")
data class AssetEntity(
    @PrimaryKey val assetCode: String, // e.g. "AST-OSC-01"
    val laboratoryId: Long,
    val laboratoryName: String,
    val name: String,
    val category: String, // "Laptop", "Oscilloscope", "Sensor", "Robotics Kit", "Instrument", "Other"
    val status: String, // "AVAILABLE", "CHECKED_OUT", "MISSING_REPORTED", "DAMAGED_REPORTED"
    val checkedOutTo: String = "",
    val lastUpdatedAt: Long = System.currentTimeMillis(),
    val isTestRecord: Boolean = false
)

@Entity(tableName = "audit_logs")
data class AuditLogEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val actorName: String,
    val actorRole: String,
    val actionType: String,
    val targetEntity: String,
    val details: String,
    val timestamp: Long = System.currentTimeMillis()
)

@Entity(tableName = "system_configs")
data class SystemConfigEntity(
    @PrimaryKey val id: Int = 1,
    val activeGateName: String = "Main Campus North Gate",
    val activeGateDirection: String = "IN", // "IN" or "OUT"
    val entranceCameraCode: String = "CAM-01",
    val localCameraManagerUrl: String = "http://10.0.2.2:8090",
    val cimsApiBaseUrl: String = "",
    val cimsAuthType: String = "Bearer Token",
    val cimsSyncFrequencyMinutes: Int = 60,
    val cimsConnectionState: String = "NOT CONNECTED", // Initial state MUST be NOT CONNECTED
    val cimsLastSyncTimestamp: Long? = null,
    val cimsLastError: String = "NONE",
    val evidenceRetentionDays: Int = 30,
    val autoDeleteExpiredTokens: Boolean = true
)
