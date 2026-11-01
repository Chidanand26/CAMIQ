package com.example.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [
        UserEntity::class,
        SiteEntity::class,
        CameraEntity::class,
        OrchestrationEventEntity::class,
        IncidentEntity::class,
        SafeWalkEntity::class,
        TrustedContactEntity::class,
        QrTokenEntity::class,
        GateEventEntity::class,
        VisitorPassEntity::class,
        DepartmentEntity::class,
        LaboratoryEntity::class,
        AssetEntity::class,
        AuditLogEntity::class,
        SystemConfigEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class CamiqDatabase : RoomDatabase() {
    abstract fun camiqDao(): CamiqDao

    companion object {
        @Volatile
        private var INSTANCE: CamiqDatabase? = null

        fun getDatabase(context: Context): CamiqDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    CamiqDatabase::class.java,
                    "camiq_unified_safety.db"
                )
                    .fallbackToDestructiveMigration()
                    .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
