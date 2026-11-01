package com.example.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface CamiqDao {
    // Users
    @Query("SELECT * FROM users ORDER BY createdAt DESC")
    fun observeUsers(): Flow<List<UserEntity>>

    @Query("SELECT * FROM users WHERE username = :username LIMIT 1")
    suspend fun getUserByUsername(username: String): UserEntity?

    @Query("SELECT * FROM users WHERE id = :id LIMIT 1")
    suspend fun getUserById(id: Long): UserEntity?

    @Query("SELECT * FROM users WHERE role = 'GUARD' AND isOnDuty = 1")
    suspend fun getOnDutyGuards(): List<UserEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertUser(user: UserEntity): Long

    @Update
    suspend fun updateUser(user: UserEntity)

    // Sites
    @Query("SELECT * FROM sites ORDER BY createdAt DESC")
    fun observeSites(): Flow<List<SiteEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSite(site: SiteEntity): Long

    @Query("DELETE FROM sites WHERE id = :id")
    suspend fun deleteSite(id: Long)

    // Cameras
    @Query("SELECT * FROM cameras ORDER BY cameraCode ASC")
    fun observeCameras(): Flow<List<CameraEntity>>

    @Query("SELECT * FROM cameras ORDER BY cameraCode ASC")
    suspend fun getAllCamerasSync(): List<CameraEntity>

    @Query("SELECT * FROM cameras WHERE cameraCode = :code LIMIT 1")
    suspend fun getCameraByCode(code: String): CameraEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertCamera(camera: CameraEntity)

    @Query("DELETE FROM cameras WHERE cameraCode = :code")
    suspend fun deleteCamera(code: String)

    // Orchestration Events
    @Query("SELECT * FROM orchestration_events ORDER BY timestamp DESC")
    fun observeOrchestrationEvents(): Flow<List<OrchestrationEventEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrchestrationEvent(event: OrchestrationEventEntity)

    // Incidents
    @Query("SELECT * FROM incidents ORDER BY createdAt DESC")
    fun observeIncidents(): Flow<List<IncidentEntity>>

    @Query("SELECT * FROM incidents WHERE incidentId = :incidentId LIMIT 1")
    suspend fun getIncidentById(incidentId: String): IncidentEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertIncident(incident: IncidentEntity)

    // SafeWalk Sessions
    @Query("SELECT * FROM safewalk_sessions ORDER BY createdAt DESC")
    fun observeSafeWalkSessions(): Flow<List<SafeWalkEntity>>

    @Query("SELECT * FROM safewalk_sessions WHERE sessionId = :sessionId LIMIT 1")
    suspend fun getSafeWalkById(sessionId: String): SafeWalkEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertSafeWalk(session: SafeWalkEntity)

    // Trusted Contacts
    @Query("SELECT * FROM trusted_contacts ORDER BY id DESC")
    fun observeTrustedContacts(): Flow<List<TrustedContactEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTrustedContact(contact: TrustedContactEntity)

    @Query("DELETE FROM trusted_contacts WHERE id = :id")
    suspend fun deleteTrustedContact(id: Long)

    // QR Tokens
    @Query("SELECT * FROM qr_tokens WHERE opaqueToken = :token LIMIT 1")
    suspend fun getQrToken(token: String): QrTokenEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertQrToken(token: QrTokenEntity)

    @Update
    suspend fun updateQrToken(token: QrTokenEntity)

    @Query("DELETE FROM qr_tokens WHERE expiresAt < :cutoffTime AND isConsumed = 1")
    suspend fun purgeExpiredConsumedTokens(cutoffTime: Long)

    // Gate Events
    @Query("SELECT * FROM gate_events ORDER BY timestamp DESC")
    fun observeGateEvents(): Flow<List<GateEventEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertGateEvent(event: GateEventEntity)

    // Visitor Passes
    @Query("SELECT * FROM visitor_passes ORDER BY createdAt DESC")
    fun observeVisitorPasses(): Flow<List<VisitorPassEntity>>

    @Query("SELECT * FROM visitor_passes WHERE id = :id LIMIT 1")
    suspend fun getVisitorPassById(id: Long): VisitorPassEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertVisitorPass(pass: VisitorPassEntity): Long

    // Departments
    @Query("SELECT * FROM departments ORDER BY id DESC")
    fun observeDepartments(): Flow<List<DepartmentEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertDepartment(dept: DepartmentEntity): Long

    // Laboratories
    @Query("SELECT * FROM laboratories ORDER BY id DESC")
    fun observeLaboratories(): Flow<List<LaboratoryEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertLaboratory(lab: LaboratoryEntity): Long

    // Assets
    @Query("SELECT * FROM assets ORDER BY lastUpdatedAt DESC")
    fun observeAssets(): Flow<List<AssetEntity>>

    @Query("SELECT * FROM assets WHERE assetCode = :code LIMIT 1")
    suspend fun getAssetByCode(code: String): AssetEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAsset(asset: AssetEntity)

    // Audit Logs
    @Query("SELECT * FROM audit_logs ORDER BY timestamp DESC")
    fun observeAuditLogs(): Flow<List<AuditLogEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAuditLog(log: AuditLogEntity)

    @Query("DELETE FROM audit_logs WHERE timestamp < :cutoff")
    suspend fun purgeAuditLogsBefore(cutoff: Long)

    // System Config
    @Query("SELECT * FROM system_configs WHERE id = 1 LIMIT 1")
    fun observeSystemConfig(): Flow<SystemConfigEntity?>

    @Query("SELECT * FROM system_configs WHERE id = 1 LIMIT 1")
    suspend fun getSystemConfigSync(): SystemConfigEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertSystemConfig(config: SystemConfigEntity)
}
